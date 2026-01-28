# Strety OAuth Flow

**Last Updated:** 2026-01-27
**Last Working:** 2026-01-27

## Quick Reference

| Item | Value |
|------|-------|
| Client ID | `FpZSRlALHMghs8wq485b_qjh_SjXn6yQwLa3kM8fz7E` |
| Client Secret | `8jDvgnFtOvp1H-xkwIDf46YHVR62yZPCqTdRO_WWft8` |
| Redirect URI (in Strety app) | `https://localhost:8888/callback` |
| Authorization URL | `https://2.strety.com/api/v1/oauth/authorize` |
| Token URL | `https://2.strety.com/api/v1/oauth/token` |
| Token File | `~/.mcp-strety/token.json` |

## Scopes

| Scope | Purpose |
|-------|---------|
| `read` | List and view todos, people |
| `write` | Complete/update todos |

**Current scope needed:** `read+write`

---

## STEP-BY-STEP: Getting New Tokens

### Step 1: Start the listener

In a **separate terminal**:
```bash
nc -l 8888
```

### Step 2: Open the authorization URL

**COPY THIS EXACT URL:**
```
https://2.strety.com/api/v1/oauth/authorize?client_id=FpZSRlALHMghs8wq485b_qjh_SjXn6yQwLa3kM8fz7E&redirect_uri=https://localhost:8888/callback&response_type=code&scope=read+write
```

**IMPORTANT:**
- URL uses `https://localhost` (NOT http)
- Must match the Redirect URI in Strety app settings exactly
- Authorization endpoint is `/api/v1/oauth/authorize`

### Step 3: Authorize in browser

Click "Authorize" when prompted.

### Step 4: Get the code from nc terminal

The nc terminal will show something like:
```
GET /callback?code=XXXXXXXXXXXXXXXXXX HTTP/1.1
```

Copy the code value (everything after `code=` and before ` HTTP` or `&`).

### Step 5: Exchange code for tokens

```bash
curl -X POST "https://2.strety.com/api/v1/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=PASTE_CODE_HERE" \
  -d "client_id=FpZSRlALHMghs8wq485b_qjh_SjXn6yQwLa3kM8fz7E" \
  -d "client_secret=8jDvgnFtOvp1H-xkwIDf46YHVR62yZPCqTdRO_WWft8" \
  -d "redirect_uri=https://localhost:8888/callback"
```

### Step 6: Save tokens

Save the response to `~/.mcp-strety/token.json`:
```bash
cat > ~/.mcp-strety/token.json << 'EOF'
{
  "access_token": "PASTE_ACCESS_TOKEN",
  "refresh_token": "PASTE_REFRESH_TOKEN",
  "saved_at": "2026-01-27T00:00:00.000Z"
}
EOF
```

Also update `.mcp.json` with the new tokens.

### Step 7: Restart Claude Code

The MCP server needs to restart to load new tokens.

---

## Troubleshooting

### "Not Found" on authorize URL

- **Check:** Redirect URI must match EXACTLY what's in Strety app settings
- **Check:** Use `https://` not `http://` for localhost
- **Check:** URL is `/oauth/authorize` not `/api/v1/oauth/authorize`

### "Invalid scope" error

- The refresh token inherits scope from original authorization
- Must re-authorize (full flow) to change scopes
- Cannot just refresh to get new scopes

### Token expired

```bash
# Refresh the token
curl -X POST "https://2.strety.com/api/v1/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=CURRENT_REFRESH_TOKEN" \
  -d "client_id=FpZSRlALHMghs8wq485b_qjh_SjXn6yQwLa3kM8fz7E" \
  -d "client_secret=8jDvgnFtOvp1H-xkwIDf46YHVR62yZPCqTdRO_WWft8"
```

---

## Files That Need Updating After Token Change

1. `~/.mcp-strety/token.json` - Primary token storage (auto-refresh writes here)
2. `/Users/brent/scripts/CB-Workspace/.mcp.json` - MCP server config
3. `/Users/brent/scripts/CB-Workspace/.claude/local/workspace.env` - Backup

---

## Strety App Settings Location

**URL:** https://2.strety.com (login) > My Integrations > My Apps > Strety-MCP

**Settings to verify:**
- Redirect URI: `https://localhost:8888/callback`
- Scopes: `read`, `write` (both checked)
