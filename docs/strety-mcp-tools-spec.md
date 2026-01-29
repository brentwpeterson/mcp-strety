# Strety MCP Tools Specification

**Version:** 0.2.0
**Status:** Phase 1 (Read) and Phase 2 (Write) complete and tested

## Phase 1 - Read Tools (Complete)

Read-only access to todos and people. Shipped in initial commit.

## Phase 2 - Write Tools (Complete, tested 2026-01-29)

Full CRUD for todos: create, update, complete, delete. Requires OAuth `write` scope.

## Tools

### Read Tools

### 1. strety_list_todos

**Description:** List todos from Strety. Returns tasks with their status, assignee, and due dates.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "limit": {
      "type": "number",
      "description": "Maximum number of todos to return (default: 20)",
      "default": 20
    },
    "status": {
      "type": "string",
      "description": "Filter by status (e.g., 'open', 'completed')",
      "enum": ["open", "completed", "all"]
    },
    "assignee_id": {
      "type": "string",
      "description": "Filter by assignee ID"
    }
  }
}
```

**Returns:** List of todos with:
- id
- title/description
- status
- assignee
- due_date
- created_at
- updated_at

### 2. strety_get_todo

**Description:** Get details of a specific todo by ID.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "todoId": {
      "type": "string",
      "description": "The ID of the todo to retrieve"
    }
  },
  "required": ["todoId"]
}
```

**Returns:** Full todo object with all fields.

### Write Tools

### 3. strety_create_todo

**Description:** Create a new todo in Strety.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "description": "Title of the todo (required)"
    },
    "description": {
      "type": "string",
      "description": "Description text for the todo"
    },
    "assignee": {
      "type": "string",
      "description": "Assignee name (partial match, e.g., 'Brent')"
    },
    "due_date": {
      "type": "string",
      "description": "Due date in ISO 8601 format (e.g., '2026-02-15')"
    },
    "priority": {
      "type": "string",
      "description": "Priority level"
    }
  },
  "required": ["title"]
}
```

**Returns:** The created todo with its ID and all fields.

### 4. strety_update_todo

**Description:** Update fields on an existing todo. Only provide fields you want to change. Handles ETag automatically.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "todoId": {
      "type": "string",
      "description": "The ID of the todo to update"
    },
    "title": { "type": "string" },
    "description": { "type": "string" },
    "assignee": { "type": "string" },
    "due_date": { "type": "string" },
    "priority": { "type": "string" }
  },
  "required": ["todoId"]
}
```

**Returns:** The updated todo.

### 5. strety_complete_todo

**Description:** Mark a todo as complete or reopen it. Handles ETag automatically.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "todoId": {
      "type": "string",
      "description": "The ID of the todo to complete"
    },
    "uncomplete": {
      "type": "boolean",
      "description": "Set to true to reopen (uncomplete) the todo",
      "default": false
    }
  },
  "required": ["todoId"]
}
```

**Returns:** The updated todo with `completed_at` set.

### 6. strety_delete_todo

**Description:** Permanently delete a todo. Cannot be undone.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "todoId": {
      "type": "string",
      "description": "The ID of the todo to delete"
    }
  },
  "required": ["todoId"]
}
```

**Returns:** Confirmation of deletion.

## Authentication

OAuth 2.0 with:
- **Scopes:** `read` (for read tools), `write` (for write tools)
- **Token Storage:** `~/.mcp-strety/token.json` (preferred) or environment variables
- **Base URL:** https://2.strety.com
- **Auto-refresh:** Server handles token refresh on 401 responses

## Technical Notes

- **JSON:API format:** Write operations use `{ data: { type: "todos", attributes: {...} } }`
- **ETag requirement:** All PATCH operations require an `If-Match` header. The server fetches the ETag automatically via a GET before each PATCH.
- **Assignee resolution:** Write tools accept partial name matches (e.g., "Brent") and resolve to the full person ID via the people endpoint.

## Future Phases

**Phase 3 - Goals & Metrics:**
- strety_list_goals
- strety_get_goal
- strety_list_metrics
- strety_create_goal_checkin
- strety_create_metric_checkin

**Phase 4 - Meeting Integration:**
- strety_list_meetings
- strety_get_meeting
- strety_list_issues
- strety_list_headlines

## Configuration

```json
{
  "mcpServers": {
    "strety": {
      "command": "node",
      "args": ["/Users/brent/scripts/CB-Workspace/mcp-servers/strety/dist/index.js"],
      "env": {
        "STRETY_ACCESS_TOKEN": "your-oauth-token"
      }
    }
  }
}
```

## Rate Limiting Handling

The MCP server should:
1. Respect the 10 requests per 10 seconds limit
2. Parse rate limit headers on responses
3. Return user-friendly error on 429 status
4. Include `Retry-After` info in error messages
