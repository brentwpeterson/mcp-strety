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
  retryOnAuth: boolean = true
): Promise<unknown> {
  const url = `${STRETY_API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  // Handle token expiration
  if (response.status === 401 && retryOnAuth) {
    console.error("Token expired, attempting refresh...");
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry the request with new token
      return stretyRequest(endpoint, method, body, false);
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

interface StretyPerson {
  id: string;
  type: string;
  attributes: {
    id: string;
    name: string;
    email: string | null;
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
