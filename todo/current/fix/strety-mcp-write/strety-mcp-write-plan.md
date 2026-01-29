# Fix Strety MCP Write - Implementation Plan

## Changes Required

### 1. Update `stretyRequest()` helper
- Add support for `If-Match` ETag header (needed for PATCH)
- Use `application/vnd.api+json` content type for write operations
- Return response headers (for ETag extraction)

### 2. Add helper: `getETag(todoId)`
- GET the todo, extract ETag from response headers
- Return both the ETag and current todo data

### 3. Implement new tool functions
- `createTodo(args)` - POST to /todos with JSON:API body
- `updateTodo(args)` - GET ETag, then PATCH with If-Match
- `completeTodo(args)` - GET ETag, then PATCH completed_at
- `deleteTodo(args)` - DELETE /todos/{id}

### 4. Register tools in ListToolsRequestSchema handler

### 5. Add tool routing in CallToolRequestSchema handler

### 6. Build and test
