# Strety MCP Tools Specification - MVP

**Version:** 0.1.0 (MVP)
**Focus:** Read-only Todos access

## MVP Scope

For the initial version, we're focusing on **reading Todos only**. This provides immediate value for task visibility without the complexity of full CRUD operations.

## MVP Tools

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

## Authentication

OAuth 2.0 with:
- **Scope:** read (MVP only needs read)
- **Token Storage:** Environment variable `STRETY_ACCESS_TOKEN`
- **Base URL:** https://2.strety.com

## Future Phases (Post-MVP)

**Phase 2 - Todo Management:**
- strety_create_todo
- strety_update_todo
- strety_delete_todo
- strety_complete_todo

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
