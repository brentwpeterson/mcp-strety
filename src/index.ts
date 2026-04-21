#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";

// Configuration
const STRETY_API_BASE = "https://2.strety.com/api/v1";
const CONFIG_DIR = process.env.STRETY_CONFIG_DIR || path.join(process.env.HOME || "", ".mcp-strety");
const TOKEN_PATH = path.join(CONFIG_DIR, "token.json");

// Get credentials from environment
const clientId = process.env.STRETY_CLIENT_ID;
const clientSecret = process.env.STRETY_CLIENT_SECRET;

// Token loading priority:
// 1. Token file (if exists and newer) - this allows auto-refresh to persist
// 2. Environment variables - initial setup
let accessToken = process.env.STRETY_ACCESS_TOKEN;
let refreshToken = process.env.STRETY_REFRESH_TOKEN;

// Check if token file has fresher tokens (auto-refreshed tokens)
if (fs.existsSync(TOKEN_PATH)) {
  try {
    const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    // Always prefer token file if it exists - it contains auto-refreshed tokens
    if (tokenData.access_token) {
      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token || refreshToken;
      console.error(`Loaded tokens from ${TOKEN_PATH} (saved: ${tokenData.saved_at})`);
    }
  } catch (e) {
    console.error("Failed to load token file, using env vars:", e);
  }
}

if (!accessToken) {
  console.error("Error: STRETY_ACCESS_TOKEN environment variable is required");
  console.error("Or provide a token file at ~/.mcp-strety/token.json");
  process.exit(1);
}

// Save tokens to config file
function saveTokens(access: string, refresh?: string) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const tokenData = {
    access_token: access,
    refresh_token: refresh || refreshToken,
    saved_at: new Date().toISOString(),
  };
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
  accessToken = access;
  if (refresh) refreshToken = refresh;
}

// Refresh the access token
async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken || !clientId || !clientSecret) {
    console.error("Cannot refresh token: missing refresh_token or client credentials");
    return false;
  }

  try {
    const response = await fetch("https://2.strety.com/api/v1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      console.error("Token refresh failed:", await response.text());
      return false;
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
    };
    saveTokens(data.access_token, data.refresh_token);
    console.error("Token refreshed successfully");
    return true;
  } catch (error) {
    console.error("Token refresh error:", error);
    return false;
  }
}

// Helper function for Strety API requests with auto-refresh
async function stretyRequest(
  endpoint: string,
  method: string = "GET",
  body?: unknown,
  retryOnAuth: boolean = true,
  extraHeaders?: Record<string, string>
): Promise<unknown> {
  const url = `${STRETY_API_BASE}${endpoint}`;

  const isWrite = method === "POST" || method === "PATCH" || method === "PUT";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": isWrite ? "application/vnd.api+json" : "application/json",
    ...extraHeaders,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && isWrite) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  // Handle token expiration
  if (response.status === 401 && retryOnAuth) {
    console.error("Token expired, attempting refresh...");
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry the request with new token
      return stretyRequest(endpoint, method, body, false, extraHeaders);
    }
    throw new Error("Authentication failed. Please re-authenticate with Strety.");
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Strety API error (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  if (!text) {
    return { success: true };
  }

  return JSON.parse(text);
}

// Get the ETag for a resource (required for PATCH operations)
async function getETag(endpoint: string): Promise<string> {
  const url = `${STRETY_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return getETag(endpoint);
    }
    throw new Error("Authentication failed. Please re-authenticate with Strety.");
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get ETag (${response.status}): ${errorText}`);
  }

  const etag = response.headers.get("etag");
  if (!etag) {
    throw new Error("No ETag returned by API. Cannot perform update.");
  }

  return etag;
}

// Types for Strety API responses
interface StretyTodo {
  id: string;
  type: string;
  attributes: {
    id: string;
    title: string;
    due_date: string | null;
    priority: string;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    description: string | null;
    description_html: string | null;
  };
  relationships: {
    assignee: {
      data: {
        id: string;
        type: string;
      } | null;
    };
    space: {
      data: {
        id: string;
        type: string;
      } | null;
    };
  };
}

interface StretyGoal {
  id: string;
  type: string;
  attributes: {
    id: string;
    title: string;
    due_date: string | null;
    status: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    description: string | null;
    description_html: string | null;
  };
  relationships: {
    assignee: {
      data: {
        id: string;
        type: string;
      } | null;
    };
  };
}

interface StretyPerson {
  id: string;
  type: string;
  attributes: {
    id: string;
    name: string;
    email: string | null;
  };
}

interface StretyMetric {
  id: string;
  type: string;
  attributes: {
    id: string;
    title: string;
    description?: string | null;
    target?: number | null;
    target_operator?: string | null;
    unit?: string | null;
    frequency?: string | null;
    current_value?: number | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
  };
  relationships?: {
    assignee?: { data: { id: string; type: string } | null };
    space?: { data: { id: string; type: string } | null };
    [key: string]: unknown;
  };
}

interface StretyMetricCheckIn {
  id: string;
  type: string;
  attributes: {
    id: string;
    value?: number | null;
    note?: string | null;
    date?: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
  };
  relationships?: {
    [key: string]: unknown;
  };
}

interface StretyListResponse<T> {
  data: T[];
  meta: {
    total_count: number;
    page_size: number;
    page_number: number;
  };
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
}

// Cache for people lookup
let peopleCache: Map<string, StretyPerson> | null = null;

async function getPeopleMap(): Promise<Map<string, StretyPerson>> {
  if (peopleCache) return peopleCache;

  const response = await stretyRequest("/people") as StretyListResponse<StretyPerson>;
  peopleCache = new Map(response.data.map(p => [p.id, p]));
  return peopleCache;
}

// Tool implementations
async function listTodos(args: {
  assignee?: string;
  showCompleted?: boolean;
  maxResults?: number;
}): Promise<unknown> {
  const maxResults = Math.min(args.maxResults || 50, 100);
  const allTodos: StretyTodo[] = [];
  const people = await getPeopleMap();

  // Find assignee ID if name provided
  let assigneeId: string | undefined;
  if (args.assignee) {
    const assigneeLower = args.assignee.toLowerCase();
    for (const [id, person] of people) {
      if (person.attributes.name.toLowerCase().includes(assigneeLower)) {
        assigneeId = id;
        break;
      }
    }
    if (!assigneeId) {
      return { error: `No person found matching "${args.assignee}"`, people: Array.from(people.values()).map(p => p.attributes.name) };
    }
  }

  // Build query with server-side filters when possible
  // Note: brackets must be URL-encoded for Strety API
  let endpoint = "/todos?page%5Bsize%5D=20";
  if (assigneeId) {
    endpoint += `&filter%5Bassignee_id%5D=${assigneeId}`;
  }

  // Fetch ALL pages to find open todos (they may be spread across many pages)
  let page = 1;
  const maxPages = 50; // Safety limit - Strety has ~130 total todos per user

  while (allTodos.length < maxResults && page <= maxPages) {
    const response = await stretyRequest(`${endpoint}&page%5Bnumber%5D=${page}`) as StretyListResponse<StretyTodo>;

    if (response.data.length === 0) break;

    for (const todo of response.data) {
      // Filter by completion status (API doesn't support this filter)
      if (!args.showCompleted && todo.attributes.completed_at !== null) {
        continue;
      }

      allTodos.push(todo);

      if (allTodos.length >= maxResults) break;
    }

    // Check if there are more pages
    if (!response.links.next) break;
    page++;
  }

  // Format the results
  const formattedTodos = allTodos.map(todo => {
    const assignee = todo.relationships.assignee.data?.id
      ? people.get(todo.relationships.assignee.data.id)?.attributes.name
      : null;

    return {
      id: todo.id,
      title: todo.attributes.title,
      due_date: todo.attributes.due_date,
      priority: todo.attributes.priority,
      completed: todo.attributes.completed_at !== null,
      completed_at: todo.attributes.completed_at,
      assignee,
      description: todo.attributes.description,
      created_at: todo.attributes.created_at,
      updated_at: todo.attributes.updated_at,
    };
  });

  // Sort by due date (nulls last)
  formattedTodos.sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  return {
    todos: formattedTodos,
    count: formattedTodos.length,
    assignee_filter: args.assignee || null,
    show_completed: args.showCompleted || false,
  };
}

async function getTodo(todoId: string): Promise<unknown> {
  const response = await stretyRequest(`/todos/${todoId}`) as { data: StretyTodo };
  const todo = response.data;
  const people = await getPeopleMap();

  const assignee = todo.relationships.assignee.data?.id
    ? people.get(todo.relationships.assignee.data.id)?.attributes.name
    : null;

  return {
    id: todo.id,
    title: todo.attributes.title,
    description: todo.attributes.description,
    description_html: todo.attributes.description_html,
    due_date: todo.attributes.due_date,
    priority: todo.attributes.priority,
    completed: todo.attributes.completed_at !== null,
    completed_at: todo.attributes.completed_at,
    assignee,
    created_at: todo.attributes.created_at,
    updated_at: todo.attributes.updated_at,
  };
}

async function listPeople(): Promise<unknown> {
  const response = await stretyRequest("/people") as StretyListResponse<StretyPerson>;

  return {
    people: response.data.map(p => ({
      id: p.id,
      name: p.attributes.name,
      email: p.attributes.email,
    })),
    count: response.data.length,
  };
}

async function listGoals(args: {
  assignee?: string;
  showCompleted?: boolean;
  maxResults?: number;
}): Promise<unknown> {
  const maxResults = Math.min(args.maxResults || 50, 100);
  const allGoals: StretyGoal[] = [];
  const people = await getPeopleMap();

  // Find assignee ID if name provided
  let assigneeId: string | undefined;
  if (args.assignee) {
    const assigneeLower = args.assignee.toLowerCase();
    for (const [id, person] of people) {
      if (person.attributes.name.toLowerCase().includes(assigneeLower)) {
        assigneeId = id;
        break;
      }
    }
    if (!assigneeId) {
      return { error: `No person found matching "${args.assignee}"`, people: Array.from(people.values()).map(p => p.attributes.name) };
    }
  }

  let endpoint = "/goals?page%5Bsize%5D=20";
  if (assigneeId) {
    endpoint += `&filter%5Bassignee_id%5D=${assigneeId}`;
  }

  let page = 1;
  const maxPages = 50;

  while (allGoals.length < maxResults && page <= maxPages) {
    const response = await stretyRequest(`${endpoint}&page%5Bnumber%5D=${page}`) as StretyListResponse<StretyGoal>;

    if (response.data.length === 0) break;

    for (const goal of response.data) {
      if (!args.showCompleted && goal.attributes.completed_at !== null) {
        continue;
      }
      allGoals.push(goal);
      if (allGoals.length >= maxResults) break;
    }

    if (!response.links.next) break;
    page++;
  }

  const formattedGoals = allGoals.map(goal => {
    const assignee = goal.relationships.assignee?.data?.id
      ? people.get(goal.relationships.assignee.data.id)?.attributes.name
      : null;

    return {
      id: goal.id,
      title: goal.attributes.title,
      description: goal.attributes.description,
      due_date: goal.attributes.due_date,
      status: goal.attributes.status,
      completed: goal.attributes.completed_at !== null,
      completed_at: goal.attributes.completed_at,
      assignee,
      created_at: goal.attributes.created_at,
      updated_at: goal.attributes.updated_at,
    };
  });

  formattedGoals.sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  return {
    goals: formattedGoals,
    count: formattedGoals.length,
    assignee_filter: args.assignee || null,
    show_completed: args.showCompleted || false,
  };
}

// Helper to resolve assignee name to ID
async function resolveAssigneeId(assigneeName: string): Promise<{ id: string } | { error: string; people: string[] }> {
  const people = await getPeopleMap();
  const assigneeLower = assigneeName.toLowerCase();
  for (const [id, person] of people) {
    if (person.attributes.name.toLowerCase().includes(assigneeLower)) {
      return { id };
    }
  }
  return {
    error: `No person found matching "${assigneeName}"`,
    people: Array.from(people.values()).map(p => p.attributes.name),
  };
}

// Helper to format a todo response
async function formatTodo(todo: StretyTodo) {
  const people = await getPeopleMap();
  const assignee = todo.relationships.assignee.data?.id
    ? people.get(todo.relationships.assignee.data.id)?.attributes.name
    : null;

  return {
    id: todo.id,
    title: todo.attributes.title,
    description: todo.attributes.description,
    due_date: todo.attributes.due_date,
    priority: todo.attributes.priority,
    completed: todo.attributes.completed_at !== null,
    completed_at: todo.attributes.completed_at,
    assignee,
    created_at: todo.attributes.created_at,
    updated_at: todo.attributes.updated_at,
  };
}

// Cache for teams lookup
let teamsCache: { id: string; name: string; leadership: boolean }[] | null = null;

async function getTeams(): Promise<{ id: string; name: string; leadership: boolean }[]> {
  if (teamsCache) return teamsCache;

  const response = await stretyRequest("/teams") as StretyListResponse<{
    id: string;
    type: string;
    attributes: { id: string; name: string; leadership: boolean };
  }>;
  teamsCache = response.data.map(t => ({
    id: t.id,
    name: t.attributes.name,
    leadership: t.attributes.leadership,
  }));
  return teamsCache;
}

// Resolve team name to ID (partial match, defaults to Leadership team)
async function resolveTeamId(teamName?: string): Promise<{ id: string; type: string }> {
  const teams = await getTeams();

  if (teamName) {
    const nameLower = teamName.toLowerCase();
    const match = teams.find(t => t.name.toLowerCase().includes(nameLower));
    if (match) return { id: match.id, type: "team" };
  }

  // Default to leadership team
  const leadership = teams.find(t => t.leadership);
  if (leadership) return { id: leadership.id, type: "team" };

  // Fallback to first team
  if (teams.length > 0) return { id: teams[0].id, type: "team" };

  throw new Error("No teams found in Strety organization");
}

async function createTodo(args: {
  title: string;
  description?: string;
  due_date?: string;
  priority?: string;
  assignee?: string;
  team?: string;
}): Promise<unknown> {
  // Resolve the team/space
  const space = await resolveTeamId(args.team);

  const relationships: Record<string, unknown> = {};

  // Resolve assignee name to ID
  if (args.assignee) {
    const result = await resolveAssigneeId(args.assignee);
    if ("error" in result) return result;
    relationships.assignee = { data: { id: result.id, type: "people" } };
  }

  const body: Record<string, unknown> = {
    data: {
      type: "todos",
      attributes: {
        title: args.title,
        space_id: space.id,
        space_type: space.type,
        ...(args.description && { description: args.description }),
        ...(args.due_date && { due_date: args.due_date }),
        ...(args.priority && { priority: args.priority }),
      },
      relationships,
    },
  };

  const response = await stretyRequest("/todos", "POST", body) as { data: StretyTodo };
  return {
    success: true,
    todo: await formatTodo(response.data),
  };
}

async function updateTodo(args: {
  todoId: string;
  title?: string;
  description?: string;
  due_date?: string;
  priority?: string;
  assignee?: string;
}): Promise<unknown> {
  // Get ETag first (required for PATCH)
  const etag = await getETag(`/todos/${args.todoId}`);

  const attributes: Record<string, unknown> = {};
  if (args.title !== undefined) attributes.title = args.title;
  if (args.description !== undefined) attributes.description = args.description;
  if (args.due_date !== undefined) attributes.due_date = args.due_date;
  if (args.priority !== undefined) attributes.priority = args.priority;

  const body: Record<string, unknown> = {
    data: {
      type: "todos",
      id: args.todoId,
      attributes,
      relationships: {} as Record<string, unknown>,
    },
  };

  if (args.assignee) {
    const result = await resolveAssigneeId(args.assignee);
    if ("error" in result) return result;
    (body.data as Record<string, unknown>).relationships = {
      assignee: { data: { id: result.id, type: "people" } },
    };
  }

  const response = await stretyRequest(
    `/todos/${args.todoId}`, "PATCH", body, true,
    { "If-Match": etag }
  ) as { data: StretyTodo };

  return {
    success: true,
    todo: await formatTodo(response.data),
  };
}

async function completeTodo(args: {
  todoId: string;
  uncomplete?: boolean;
}): Promise<unknown> {
  const etag = await getETag(`/todos/${args.todoId}`);

  const body = {
    data: {
      type: "todos",
      id: args.todoId,
      attributes: {
        completed_at: args.uncomplete ? null : new Date().toISOString(),
      },
    },
  };

  const response = await stretyRequest(
    `/todos/${args.todoId}`, "PATCH", body, true,
    { "If-Match": etag }
  ) as { data: StretyTodo };

  return {
    success: true,
    action: args.uncomplete ? "uncompleted" : "completed",
    todo: await formatTodo(response.data),
  };
}

async function deleteTodo(todoId: string): Promise<unknown> {
  await stretyRequest(`/todos/${todoId}`, "DELETE");
  return {
    success: true,
    deleted: todoId,
  };
}

// ============================================================================
// METRICS (Scorecard items)
// ============================================================================

async function formatMetric(metric: StretyMetric) {
  const people = await getPeopleMap();
  const assigneeRel = metric.relationships?.assignee;
  const assignee = assigneeRel && "data" in assigneeRel && assigneeRel.data?.id
    ? people.get(assigneeRel.data.id)?.attributes.name
    : null;

  return {
    id: metric.id,
    title: metric.attributes.title,
    description: metric.attributes.description,
    target: metric.attributes.target,
    target_operator: metric.attributes.target_operator,
    unit: metric.attributes.unit,
    frequency: metric.attributes.frequency,
    current_value: metric.attributes.current_value,
    assignee,
    created_at: metric.attributes.created_at,
    updated_at: metric.attributes.updated_at,
  };
}

async function listMetrics(args: {
  assignee?: string;
  maxResults?: number;
}): Promise<unknown> {
  const maxResults = Math.min(args.maxResults || 50, 100);
  const allMetrics: StretyMetric[] = [];
  const people = await getPeopleMap();

  let assigneeId: string | undefined;
  if (args.assignee) {
    const assigneeLower = args.assignee.toLowerCase();
    for (const [id, person] of people) {
      if (person.attributes.name.toLowerCase().includes(assigneeLower)) {
        assigneeId = id;
        break;
      }
    }
    if (!assigneeId) {
      return { error: `No person found matching "${args.assignee}"`, people: Array.from(people.values()).map(p => p.attributes.name) };
    }
  }

  let endpoint = "/metrics?page%5Bsize%5D=20";
  if (assigneeId) {
    endpoint += `&filter%5Bassignee_id%5D=${assigneeId}`;
  }

  let page = 1;
  const maxPages = 50;

  while (allMetrics.length < maxResults && page <= maxPages) {
    const response = await stretyRequest(`${endpoint}&page%5Bnumber%5D=${page}`) as StretyListResponse<StretyMetric>;

    if (response.data.length === 0) break;

    for (const metric of response.data) {
      allMetrics.push(metric);
      if (allMetrics.length >= maxResults) break;
    }

    if (!response.links.next) break;
    page++;
  }

  const formatted = await Promise.all(allMetrics.map(formatMetric));

  return {
    metrics: formatted,
    count: formatted.length,
    assignee_filter: args.assignee || null,
  };
}

async function getMetric(metricId: string): Promise<unknown> {
  const response = await stretyRequest(`/metrics/${metricId}`) as { data: StretyMetric };
  return await formatMetric(response.data);
}

async function createMetric(args: {
  title: string;
  description?: string;
  target?: number;
  target_operator?: string;
  unit?: string;
  frequency?: string;
  assignee?: string;
  team?: string;
  extra_attributes?: Record<string, unknown>;
}): Promise<unknown> {
  const space = await resolveTeamId(args.team);

  const relationships: Record<string, unknown> = {};
  if (args.assignee) {
    const result = await resolveAssigneeId(args.assignee);
    if ("error" in result) return result;
    relationships.assignee = { data: { id: result.id, type: "people" } };
  }

  const attributes: Record<string, unknown> = {
    title: args.title,
    space_id: space.id,
    space_type: space.type,
    ...(args.description !== undefined && { description: args.description }),
    ...(args.target !== undefined && { target: args.target }),
    ...(args.target_operator !== undefined && { target_operator: args.target_operator }),
    ...(args.unit !== undefined && { unit: args.unit }),
    ...(args.frequency !== undefined && { frequency: args.frequency }),
    ...(args.extra_attributes || {}),
  };

  const body = {
    data: {
      type: "metrics",
      attributes,
      relationships,
    },
  };

  const response = await stretyRequest("/metrics", "POST", body) as { data: StretyMetric };
  return {
    success: true,
    metric: await formatMetric(response.data),
  };
}

async function updateMetric(args: {
  metricId: string;
  title?: string;
  description?: string;
  target?: number;
  target_operator?: string;
  unit?: string;
  frequency?: string;
  assignee?: string;
  extra_attributes?: Record<string, unknown>;
}): Promise<unknown> {
  const etag = await getETag(`/metrics/${args.metricId}`);

  const attributes: Record<string, unknown> = {
    ...(args.title !== undefined && { title: args.title }),
    ...(args.description !== undefined && { description: args.description }),
    ...(args.target !== undefined && { target: args.target }),
    ...(args.target_operator !== undefined && { target_operator: args.target_operator }),
    ...(args.unit !== undefined && { unit: args.unit }),
    ...(args.frequency !== undefined && { frequency: args.frequency }),
    ...(args.extra_attributes || {}),
  };

  const relationships: Record<string, unknown> = {};
  if (args.assignee) {
    const result = await resolveAssigneeId(args.assignee);
    if ("error" in result) return result;
    relationships.assignee = { data: { id: result.id, type: "people" } };
  }

  const body = {
    data: {
      type: "metrics",
      id: args.metricId,
      attributes,
      ...(Object.keys(relationships).length > 0 && { relationships }),
    },
  };

  const response = await stretyRequest(
    `/metrics/${args.metricId}`, "PATCH", body, true,
    { "If-Match": etag }
  ) as { data: StretyMetric };

  return {
    success: true,
    metric: await formatMetric(response.data),
  };
}

async function deleteMetric(metricId: string): Promise<unknown> {
  await stretyRequest(`/metrics/${metricId}`, "DELETE");
  return { success: true, deleted: metricId };
}

// ============================================================================
// METRIC CHECK-INS (weekly scorecard values)
// ============================================================================

function formatMetricCheckIn(checkIn: StretyMetricCheckIn) {
  return {
    id: checkIn.id,
    value: checkIn.attributes.value,
    note: checkIn.attributes.note,
    date: checkIn.attributes.date,
    created_at: checkIn.attributes.created_at,
    updated_at: checkIn.attributes.updated_at,
  };
}

async function listMetricCheckIns(args: {
  metricId: string;
  maxResults?: number;
}): Promise<unknown> {
  const maxResults = Math.min(args.maxResults || 50, 100);
  const all: StretyMetricCheckIn[] = [];

  let page = 1;
  const maxPages = 50;
  const base = `/metrics/${args.metricId}/check_ins?page%5Bsize%5D=20`;

  while (all.length < maxResults && page <= maxPages) {
    const response = await stretyRequest(`${base}&page%5Bnumber%5D=${page}`) as StretyListResponse<StretyMetricCheckIn>;
    if (response.data.length === 0) break;
    for (const item of response.data) {
      all.push(item);
      if (all.length >= maxResults) break;
    }
    if (!response.links.next) break;
    page++;
  }

  const formatted = all.map(formatMetricCheckIn);
  formatted.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  return {
    check_ins: formatted,
    count: formatted.length,
    metric_id: args.metricId,
  };
}

async function createMetricCheckIn(args: {
  metricId: string;
  value: number;
  date?: string;
  note?: string;
  extra_attributes?: Record<string, unknown>;
}): Promise<unknown> {
  const attributes: Record<string, unknown> = {
    value: args.value,
    ...(args.date !== undefined && { date: args.date }),
    ...(args.note !== undefined && { note: args.note }),
    ...(args.extra_attributes || {}),
  };

  const body = {
    data: {
      type: "metric_check_ins",
      attributes,
    },
  };

  const response = await stretyRequest(
    `/metrics/${args.metricId}/check_ins`, "POST", body
  ) as { data: StretyMetricCheckIn };

  return {
    success: true,
    metric_id: args.metricId,
    check_in: formatMetricCheckIn(response.data),
  };
}

async function updateMetricCheckIn(args: {
  metricId: string;
  checkInId: string;
  value?: number;
  date?: string;
  note?: string;
  extra_attributes?: Record<string, unknown>;
}): Promise<unknown> {
  const endpoint = `/metrics/${args.metricId}/check_ins/${args.checkInId}`;
  const etag = await getETag(endpoint);

  const attributes: Record<string, unknown> = {
    ...(args.value !== undefined && { value: args.value }),
    ...(args.date !== undefined && { date: args.date }),
    ...(args.note !== undefined && { note: args.note }),
    ...(args.extra_attributes || {}),
  };

  const body = {
    data: {
      type: "metric_check_ins",
      id: args.checkInId,
      attributes,
    },
  };

  const response = await stretyRequest(
    endpoint, "PATCH", body, true,
    { "If-Match": etag }
  ) as { data: StretyMetricCheckIn };

  return {
    success: true,
    check_in: formatMetricCheckIn(response.data),
  };
}

async function deleteMetricCheckIn(args: {
  metricId: string;
  checkInId: string;
}): Promise<unknown> {
  await stretyRequest(`/metrics/${args.metricId}/check_ins/${args.checkInId}`, "DELETE");
  return { success: true, deleted: args.checkInId };
}

// MCP Server setup
const server = new Server(
  {
    name: "strety",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "strety_list_todos",
      description: "List todos from Strety. Can filter by assignee name and completion status. Returns todos sorted by due date.",
      inputSchema: {
        type: "object",
        properties: {
          assignee: {
            type: "string",
            description: "Filter by assignee name (partial match, e.g., 'Brent' or 'isaac')",
          },
          showCompleted: {
            type: "boolean",
            description: "Include completed todos (default: false, only shows open todos)",
            default: false,
          },
          maxResults: {
            type: "number",
            description: "Maximum number of todos to return (default: 50, max: 100)",
            default: 50,
          },
        },
      },
    },
    {
      name: "strety_get_todo",
      description: "Get full details of a specific todo by its ID",
      inputSchema: {
        type: "object",
        properties: {
          todoId: {
            type: "string",
            description: "The ID of the todo to retrieve",
          },
        },
        required: ["todoId"],
      },
    },
    {
      name: "strety_list_people",
      description: "List all people in the Strety organization. Useful for finding assignee names/IDs.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "strety_list_goals",
      description: "List goals (rocks) from Strety. Can filter by assignee name and completion status. Returns goals sorted by due date.",
      inputSchema: {
        type: "object",
        properties: {
          assignee: {
            type: "string",
            description: "Filter by assignee name (partial match, e.g., 'Brent' or 'isaac')",
          },
          showCompleted: {
            type: "boolean",
            description: "Include completed goals (default: false, only shows open goals)",
            default: false,
          },
          maxResults: {
            type: "number",
            description: "Maximum number of goals to return (default: 50, max: 100)",
            default: 50,
          },
        },
      },
    },
    {
      name: "strety_create_todo",
      description: "Create a new todo in Strety. Returns the created todo with its ID.",
      inputSchema: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title of the todo (required)",
          },
          description: {
            type: "string",
            description: "Description text for the todo",
          },
          due_date: {
            type: "string",
            description: "Due date in ISO 8601 format (e.g., '2026-02-15')",
          },
          priority: {
            type: "string",
            description: "Priority level",
          },
          assignee: {
            type: "string",
            description: "Assignee name (partial match, e.g., 'Brent' or 'isaac')",
          },
          team: {
            type: "string",
            description: "Team name to assign the todo to (partial match, e.g., 'Leadership'). Defaults to Leadership team if not specified.",
          },
        },
        required: ["title"],
      },
    },
    {
      name: "strety_update_todo",
      description: "Update an existing todo in Strety. Only provide fields you want to change. Handles ETag automatically.",
      inputSchema: {
        type: "object",
        properties: {
          todoId: {
            type: "string",
            description: "The ID of the todo to update",
          },
          title: {
            type: "string",
            description: "New title",
          },
          description: {
            type: "string",
            description: "New description",
          },
          due_date: {
            type: "string",
            description: "New due date in ISO 8601 format (e.g., '2026-02-15')",
          },
          priority: {
            type: "string",
            description: "New priority level",
          },
          assignee: {
            type: "string",
            description: "New assignee name (partial match)",
          },
        },
        required: ["todoId"],
      },
    },
    {
      name: "strety_complete_todo",
      description: "Mark a todo as complete (or uncomplete it). Handles ETag automatically.",
      inputSchema: {
        type: "object",
        properties: {
          todoId: {
            type: "string",
            description: "The ID of the todo to complete",
          },
          uncomplete: {
            type: "boolean",
            description: "Set to true to mark the todo as NOT complete (reopen it)",
            default: false,
          },
        },
        required: ["todoId"],
      },
    },
    {
      name: "strety_delete_todo",
      description: "Permanently delete a todo from Strety. This cannot be undone.",
      inputSchema: {
        type: "object",
        properties: {
          todoId: {
            type: "string",
            description: "The ID of the todo to delete",
          },
        },
        required: ["todoId"],
      },
    },
    {
      name: "strety_list_metrics",
      description: "List scorecard metrics (KPIs) from Strety. Can filter by assignee name.",
      inputSchema: {
        type: "object",
        properties: {
          assignee: { type: "string", description: "Filter by assignee name (partial match)" },
          maxResults: { type: "number", description: "Max results (default 50, max 100)", default: 50 },
        },
      },
    },
    {
      name: "strety_get_metric",
      description: "Get full details of a specific scorecard metric by ID.",
      inputSchema: {
        type: "object",
        properties: {
          metricId: { type: "string", description: "The ID of the metric" },
        },
        required: ["metricId"],
      },
    },
    {
      name: "strety_create_metric",
      description: "Create a new scorecard metric (KPI) in Strety. Defaults to Leadership team if no team specified.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Metric title (required)" },
          description: { type: "string", description: "Description" },
          target: { type: "number", description: "Target value (e.g., 40 for 40 leads/week)" },
          target_operator: { type: "string", description: "Comparison operator: '>=', '<=', '=', '>', '<'" },
          unit: { type: "string", description: "Unit of measurement (e.g., 'leads', 'dollars', '%')" },
          frequency: { type: "string", description: "Check-in frequency (e.g., 'weekly', 'monthly')" },
          assignee: { type: "string", description: "Assignee name (partial match)" },
          team: { type: "string", description: "Team name (partial match). Defaults to Leadership." },
          extra_attributes: { type: "object", description: "Any additional attributes to pass through to the Strety API" },
        },
        required: ["title"],
      },
    },
    {
      name: "strety_update_metric",
      description: "Update an existing scorecard metric. Only provide fields to change. Handles ETag automatically.",
      inputSchema: {
        type: "object",
        properties: {
          metricId: { type: "string", description: "The ID of the metric to update" },
          title: { type: "string" },
          description: { type: "string" },
          target: { type: "number" },
          target_operator: { type: "string" },
          unit: { type: "string" },
          frequency: { type: "string" },
          assignee: { type: "string" },
          extra_attributes: { type: "object" },
        },
        required: ["metricId"],
      },
    },
    {
      name: "strety_delete_metric",
      description: "Permanently delete a scorecard metric. Cannot be undone.",
      inputSchema: {
        type: "object",
        properties: {
          metricId: { type: "string", description: "The ID of the metric to delete" },
        },
        required: ["metricId"],
      },
    },
    {
      name: "strety_list_metric_checkins",
      description: "List weekly check-ins (scorecard values) for a specific metric. Sorted by date, newest first.",
      inputSchema: {
        type: "object",
        properties: {
          metricId: { type: "string", description: "The ID of the metric" },
          maxResults: { type: "number", description: "Max results (default 50, max 100)", default: 50 },
        },
        required: ["metricId"],
      },
    },
    {
      name: "strety_create_metric_checkin",
      description: "Create a new check-in (weekly scorecard value) for a metric. This is how you record the weekly number.",
      inputSchema: {
        type: "object",
        properties: {
          metricId: { type: "string", description: "The ID of the metric" },
          value: { type: "number", description: "The numeric value for this check-in (required)" },
          date: { type: "string", description: "Check-in date in ISO 8601 (e.g., '2026-04-21'). Defaults to current period if omitted." },
          note: { type: "string", description: "Optional note about this check-in" },
          extra_attributes: { type: "object", description: "Any additional attributes" },
        },
        required: ["metricId", "value"],
      },
    },
    {
      name: "strety_update_metric_checkin",
      description: "Update an existing metric check-in. Handles ETag automatically.",
      inputSchema: {
        type: "object",
        properties: {
          metricId: { type: "string", description: "The ID of the metric" },
          checkInId: { type: "string", description: "The ID of the check-in to update" },
          value: { type: "number" },
          date: { type: "string" },
          note: { type: "string" },
          extra_attributes: { type: "object" },
        },
        required: ["metricId", "checkInId"],
      },
    },
    {
      name: "strety_delete_metric_checkin",
      description: "Permanently delete a metric check-in. Cannot be undone.",
      inputSchema: {
        type: "object",
        properties: {
          metricId: { type: "string", description: "The ID of the metric" },
          checkInId: { type: "string", description: "The ID of the check-in to delete" },
        },
        required: ["metricId", "checkInId"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "strety_list_todos": {
        const result = await listTodos({
          assignee: args?.assignee as string | undefined,
          showCompleted: args?.showCompleted as boolean | undefined,
          maxResults: args?.maxResults as number | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_get_todo": {
        const result = await getTodo(args?.todoId as string);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_list_people": {
        const result = await listPeople();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_list_goals": {
        const result = await listGoals({
          assignee: args?.assignee as string | undefined,
          showCompleted: args?.showCompleted as boolean | undefined,
          maxResults: args?.maxResults as number | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_create_todo": {
        const result = await createTodo({
          title: args?.title as string,
          description: args?.description as string | undefined,
          due_date: args?.due_date as string | undefined,
          priority: args?.priority as string | undefined,
          assignee: args?.assignee as string | undefined,
          team: args?.team as string | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_update_todo": {
        const result = await updateTodo({
          todoId: args?.todoId as string,
          title: args?.title as string | undefined,
          description: args?.description as string | undefined,
          due_date: args?.due_date as string | undefined,
          priority: args?.priority as string | undefined,
          assignee: args?.assignee as string | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_complete_todo": {
        const result = await completeTodo({
          todoId: args?.todoId as string,
          uncomplete: args?.uncomplete as boolean | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_delete_todo": {
        const result = await deleteTodo(args?.todoId as string);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_list_metrics": {
        const result = await listMetrics({
          assignee: args?.assignee as string | undefined,
          maxResults: args?.maxResults as number | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_get_metric": {
        const result = await getMetric(args?.metricId as string);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_create_metric": {
        const result = await createMetric({
          title: args?.title as string,
          description: args?.description as string | undefined,
          target: args?.target as number | undefined,
          target_operator: args?.target_operator as string | undefined,
          unit: args?.unit as string | undefined,
          frequency: args?.frequency as string | undefined,
          assignee: args?.assignee as string | undefined,
          team: args?.team as string | undefined,
          extra_attributes: args?.extra_attributes as Record<string, unknown> | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_update_metric": {
        const result = await updateMetric({
          metricId: args?.metricId as string,
          title: args?.title as string | undefined,
          description: args?.description as string | undefined,
          target: args?.target as number | undefined,
          target_operator: args?.target_operator as string | undefined,
          unit: args?.unit as string | undefined,
          frequency: args?.frequency as string | undefined,
          assignee: args?.assignee as string | undefined,
          extra_attributes: args?.extra_attributes as Record<string, unknown> | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_delete_metric": {
        const result = await deleteMetric(args?.metricId as string);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_list_metric_checkins": {
        const result = await listMetricCheckIns({
          metricId: args?.metricId as string,
          maxResults: args?.maxResults as number | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_create_metric_checkin": {
        const result = await createMetricCheckIn({
          metricId: args?.metricId as string,
          value: args?.value as number,
          date: args?.date as string | undefined,
          note: args?.note as string | undefined,
          extra_attributes: args?.extra_attributes as Record<string, unknown> | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_update_metric_checkin": {
        const result = await updateMetricCheckIn({
          metricId: args?.metricId as string,
          checkInId: args?.checkInId as string,
          value: args?.value as number | undefined,
          date: args?.date as string | undefined,
          note: args?.note as string | undefined,
          extra_attributes: args?.extra_attributes as Record<string, unknown> | undefined,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "strety_delete_metric_checkin": {
        const result = await deleteMetricCheckIn({
          metricId: args?.metricId as string,
          checkInId: args?.checkInId as string,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
});

async function main() {
  // Ensure config directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Strety MCP server running");
}

main().catch(console.error);
