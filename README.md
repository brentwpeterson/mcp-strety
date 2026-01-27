# Strety MCP Server

MCP (Model Context Protocol) server for integrating Strety with Claude Code.

## Features

- List todos (with filtering by assignee, completion status)
- Get todo details
- List people in organization
- Auto-refresh OAuth tokens

## Installation

```bash
cd /Users/brent/scripts/CB-Workspace/mcp-servers/strety
npm install
npm run build
```

## Configuration

### 1. Create Strety OAuth App

1. Go to https://2.strety.com
2. Navigate to: My Integrations > My Apps
3. Create new app with:
   - **Name:** Strety-MCP
   - **Redirect URI:** `https://localhost:8888/callback`
   - **Scopes:** `read`, `write`

### 2. Get OAuth Tokens

See [todo/strety-oauth-flow.md](todo/strety-oauth-flow.md) for detailed instructions.

**Quick version:**

```bash
# Terminal 1: Start listener
nc -l 8888

# Terminal 2: Open this URL (replace CLIENT_ID)
# https://2.strety.com/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=https://localhost:8888/callback&response_type=code&scope=read+write

# Exchange code for token
curl -X POST "https://2.strety.com/api/v1/oauth/token" \
  -d "grant_type=authorization_code" \
  -d "code=CODE_FROM_CALLBACK" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=https://localhost:8888/callback"
```

### 3. Save Tokens

```bash
mkdir -p ~/.mcp-strety
cat > ~/.mcp-strety/token.json << 'EOF'
{
  "access_token": "YOUR_ACCESS_TOKEN",
  "refresh_token": "YOUR_REFRESH_TOKEN",
  "saved_at": "2026-01-27T00:00:00.000Z"
}
EOF
```

### 4. Add to Claude Code

Add to `~/.mcp.json` or project `.mcp.json`:

```json
{
  "mcpServers": {
    "strety": {
      "command": "node",
      "args": ["/Users/brent/scripts/CB-Workspace/mcp-servers/strety/dist/index.js"],
      "env": {
        "STRETY_ACCESS_TOKEN": "YOUR_ACCESS_TOKEN",
        "STRETY_REFRESH_TOKEN": "YOUR_REFRESH_TOKEN",
        "STRETY_CLIENT_ID": "YOUR_CLIENT_ID",
        "STRETY_CLIENT_SECRET": "YOUR_CLIENT_SECRET"
      }
    }
  }
}
```

### 5. Restart Claude Code

The MCP server loads on Claude Code startup.

## Available Tools

| Tool | Description |
|------|-------------|
| `strety_list_todos` | List todos with optional filters (assignee, completed status) |
| `strety_get_todo` | Get full details of a specific todo |
| `strety_list_people` | List all people in the organization |

## Token Management

The server handles token refresh automatically:

1. Tokens are loaded from `~/.mcp-strety/token.json` (preferred) or environment variables
2. When a 401 occurs, the server attempts to refresh using the refresh token
3. New tokens are saved back to `~/.mcp-strety/token.json`

**Important:** Tokens expire after 2 hours. The auto-refresh handles this, but if the refresh token also expires, you'll need to re-authorize.

## API Notes

- **Base URL:** `https://2.strety.com/api/v1`
- **Page size limit:** 20 items max per request
- **Rate limit:** 10 requests per 10 seconds
- **Pagination:** Server fetches up to 50 pages to find all matching todos

## Troubleshooting

### "Authentication failed" error

1. Check if tokens are expired
2. Try refreshing manually (see oauth-flow.md)
3. If refresh fails, re-authorize completely

### "Invalid scope" when updating todos

The token only has `read` scope. Re-authorize with `read+write` scope.

### Todos not showing up

The server paginates through up to 50 pages. If Brent's todos are spread across many pages, they should still be found. Check the assignee filter is correct.

## Files

```
strety/
├── src/index.ts      # Main server code
├── dist/index.js     # Compiled output
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md         # This file
└── todo/
    ├── strety-oauth-flow.md    # OAuth documentation
    ├── strety-api-mapping.md   # API endpoint reference
    └── strety-mcp-tools-spec.md
```

## Development

```bash
# Build
npm run build

# Watch mode (if configured)
npm run dev
```
