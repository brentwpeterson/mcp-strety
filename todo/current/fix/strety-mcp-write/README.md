# Fix Strety MCP Write Operations

**Status:** IN PROGRESS
**Category:** Fix
**Created:** 2026-01-29
**Branch:** None (direct commit)

## Overview
Add write/create operations to the Strety MCP server. Currently the server is read-only (Phase 1/MVP). This implements Phase 2: Todo Management (create, update, delete, complete).

## Acceptance Criteria
- [ ] Strety MCP write/create operations execute without errors
- [ ] Created items appear correctly in Strety when verified

## Key Technical Notes
- API uses JSON:API format for request/response bodies
- PATCH requests require `If-Match` header with ETag from GET response
- Content-Type for write operations: `application/vnd.api+json`
- Complete a todo by setting `completed_at` to a timestamp
- Rate limit: 10 requests per 10 seconds

## Phase 2 Tools to Implement
- `strety_create_todo` - POST /api/v1/todos
- `strety_update_todo` - PATCH /api/v1/todos/{id} (requires ETag)
- `strety_complete_todo` - PATCH /api/v1/todos/{id} (set completed_at)
- `strety_delete_todo` - DELETE /api/v1/todos/{id}

## Quick Commands
```bash
# Build after changes
cd /Users/brent/scripts/CB-Workspace/mcp-servers/strety
npm run build

# Test via MCP
# Restart Claude Code to reload MCP server
```
