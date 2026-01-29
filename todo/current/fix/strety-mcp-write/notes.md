# Fix Strety MCP Write - Notes

## 2026-01-29

- Current server has 3 read-only tools: strety_list_todos, strety_get_todo, strety_list_people
- Phase 2 from spec calls for: create, update, delete, complete
- Key challenge: PATCH requires ETag header (If-Match) from a prior GET
- API uses JSON:API format: `{ data: { type: "todos", attributes: { ... } } }`
- Content-Type for writes must be `application/vnd.api+json`
- OAuth tokens already have `read` and `write` scopes
