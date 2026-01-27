# Strety MCP Server - Planning Phase

**Status:** PLANNING
**Category:** Feature / MCP Integration
**Created:** 2026-01-26
**Branch:** Not created yet (planning phase)

## Overview

Create an MCP server for Strety (strategic planning and meeting management platform) to enable todo visibility in Claude Code. Starting with an MVP focused on reading Todos only.

## OAuth App Details

- **App Name:** Strety-MCP
- **Scopes:** read (MVP), write (future)
- **API Base:** https://2.strety.com

## MVP Scope

**Focus: Read-only Todos**
- `strety_list_todos` - List todos with filtering
- `strety_get_todo` - Get single todo details

See `strety-mcp-tools-spec.md` for full specification.

## Acceptance Criteria (Quick Discovery)

- [x] API capabilities documented
- [x] OAuth access token obtained and configured
- [x] Basic proof of concept (list todos working) - 295 todos retrieved

## Files

- [x] README.md - This file
- [x] strety-api-mapping.md - Full API endpoint documentation
- [x] strety-mcp-tools-spec.md - MCP tools specification (MVP)
- [ ] strety-oauth-flow.md - Authentication approach (if needed)

## Next Steps

1. Get OAuth access token from Strety
2. Store token in workspace.env or .mcp.json
3. `/start-work strety-mcp` to begin implementation

## Quick Commands

```bash
# Navigate to server directory
cd /Users/brent/scripts/CB-Workspace/mcp-servers/strety

# After implementation:
npm install
npm run build
```
