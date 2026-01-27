# Strety API Mapping

**API Version:** 1.0.0
**Base URL:** https://2.strety.com
**OpenAPI Spec:** /api/docs/v1/openapi.yaml

## Rate Limiting

| Endpoint Type | Limit | Period |
|--------------|-------|--------|
| General API endpoints | 10 requests | per 10 seconds per application |
| OAuth endpoints (token, revoke, introspect) | 30 requests | per minute per IP address |

**Rate Limit Headers:**
- `RateLimit-Limit`: Total requests allowed per period
- `RateLimit-Remaining`: Requests remaining in current period
- `RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds to wait before retrying

## API Resources

### Goals

Full CRUD operations for managing organizational goals.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/goals` | List goals |
| POST | `/api/v1/goals` | Create a Goal |
| GET | `/api/v1/goals/{id}` | Get a single goal |
| PATCH | `/api/v1/goals/{id}` | Update an existing Goal |
| DELETE | `/api/v1/goals/{id}` | Delete a Goal |
| POST | `/api/v1/goals/{goal_id}/backlog` | Backlog a goal |
| DELETE | `/api/v1/goals/{goal_id}/backlog` | Remove a goal from backlog |

**Goal Check-ins:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/goals/{goal_id}/check_ins` | List check-ins for a goal |
| POST | `/api/v1/goals/{goal_id}/check_ins` | Create a new check-in |
| GET | `/api/v1/goals/{goal_id}/check_ins/{id}` | Get a single check-in |
| PATCH | `/api/v1/goals/{goal_id}/check_ins/{id}` | Update an existing check-in |
| DELETE | `/api/v1/goals/{goal_id}/check_ins/{id}` | Delete a check-in |

### Headlines

Brief people-related updates or concerns.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/headlines` | List headlines |
| POST | `/api/v1/headlines` | Create a Headline |
| GET | `/api/v1/headlines/{id}` | Get a headline |
| PATCH | `/api/v1/headlines/{id}` | Update an existing Headline |
| DELETE | `/api/v1/headlines/{id}` | Delete a Headline |

### Issues

Issues that need to be discussed and resolved.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/issues` | List issues |
| POST | `/api/v1/issues` | Create an Issue |
| GET | `/api/v1/issues/{id}` | Get a single issue |
| PATCH | `/api/v1/issues/{id}` | Update an existing Issue |
| DELETE | `/api/v1/issues/{id}` | Delete an Issue |

### Meetings

Meeting management (read-only for listing).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/meetings` | List meetings |
| GET | `/api/v1/meetings/{id}` | Get a single meeting |

**Note:** No POST/PATCH/DELETE for meetings, suggesting meetings may be created through UI only.

### Messages

Organization-wide messages.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/messages` | List messages |
| POST | `/api/v1/messages` | Create a Message |
| GET | `/api/v1/messages/{id}` | Get a single message |
| PATCH | `/api/v1/messages/{id}` | Update an existing Message |
| DELETE | `/api/v1/messages/{id}` | Delete a Message |

### Metrics

Metrics and their check-ins for tracking KPIs.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/metrics` | List metrics |
| POST | `/api/v1/metrics` | Create a Metric |
| GET | `/api/v1/metrics/{id}` | Get a single metric |
| PATCH | `/api/v1/metrics/{id}` | Update an existing Metric |
| DELETE | `/api/v1/metrics/{id}` | Delete a Metric |

**Metric Check-ins:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/metrics/{metric_id}/check_ins` | List check-ins for a metric |
| POST | `/api/v1/metrics/{metric_id}/check_ins` | Create a new check-in |
| GET | `/api/v1/metrics/{metric_id}/check_ins/{id}` | Get a single check-in |
| PATCH | `/api/v1/metrics/{metric_id}/check_ins/{id}` | Update an existing check-in |
| DELETE | `/api/v1/metrics/{metric_id}/check_ins/{id}` | Delete a check-in |

### People

User profiles (read-only).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/people` | List people |

### Playbooks

Playbook management with folder organization.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/playbooks` | List playbooks |
| POST | `/api/v1/playbooks` | Create a Playbook |
| GET | `/api/v1/playbooks/{id}` | Get a single playbook |
| PATCH | `/api/v1/playbooks/{id}` | Update an existing Playbook |
| DELETE | `/api/v1/playbooks/{id}` | Delete a Playbook |

**Playbook Folders:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/playbooks/folders` | List playbook folders |
| POST | `/api/v1/playbooks/folders` | Create a Playbook Folder |
| GET | `/api/v1/playbooks/folders/{id}` | Get a single playbook folder |
| PATCH | `/api/v1/playbooks/folders/{id}` | Update an existing Playbook Folder |
| DELETE | `/api/v1/playbooks/folders/{id}` | Delete a Playbook Folder |

### Projects

Project management (read-only).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/projects` | List projects |
| GET | `/api/v1/projects/{id}` | Get a project |

### Teams

Team management (read-only).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/teams` | List teams |
| GET | `/api/v1/teams/{id}` | Get a team |

### Todos

Task management.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/todos` | List todos |
| POST | `/api/v1/todos` | Create a Todo |
| GET | `/api/v1/todos/{id}` | Get a single todo |
| PATCH | `/api/v1/todos/{id}` | Update an existing Todo |
| DELETE | `/api/v1/todos/{id}` | Delete a Todo |

## Data Models Summary

| Model | Purpose |
|-------|---------|
| Goal | Organizational objectives with progress tracking |
| GoalCheckIn | Progress updates for goals |
| Headline | People-related updates/concerns |
| Issue | Problems to discuss and resolve |
| Meeting / MeetingLight | Meeting data with invitations and rankings |
| Message | Organization-wide communications |
| Metric | KPIs and measurable indicators |
| MetricCheckIn | Progress updates for metrics |
| Person | User profiles |
| Playbook | Reusable process templates |
| PlaybookFolder | Organization for playbooks |
| Project | Project containers |
| Team | Team groupings |
| Todo | Action items and tasks |

## API Patterns

1. **Pagination:** Uses `ListResponseMeta` and `ListResponseLinks` for paginated responses
2. **Error Handling:** Uses `ResponseErrors` schema
3. **Input Types:** Separate Create/Update input schemas (e.g., `GoalCreateInput`, `GoalUpdateInput`)
4. **Nested Resources:** Check-ins are nested under their parent (goals, metrics)
5. **ETag Required for Updates:** PATCH requests require `If-Match` header with ETag from GET response

## ETag Requirement for PATCH

**All PATCH requests require the ETag header.** Without it, you get 412 Precondition Failed.

**Workflow:**
1. GET the resource to get its current ETag (in response headers)
2. Send PATCH with `If-Match: <etag>` header

**Example:**
```bash
# 1. Get current ETag
ETAG=$(curl -sI "https://2.strety.com/api/v1/todos/{id}" \
  -H "Authorization: Bearer $TOKEN" | grep -i etag | awk '{print $2}' | tr -d '\r')

# 2. Update with ETag
curl -X PATCH "https://2.strety.com/api/v1/todos/{id}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/vnd.api+json" \
  -H "If-Match: $ETAG" \
  -d '{"data":{"type":"todos","id":"{id}","attributes":{"completed_at":"2026-01-27T00:00:00.000Z"}}}'
```

## Completing a Todo

To mark a todo complete, set `completed_at` to a timestamp:

```json
{
  "data": {
    "type": "todos",
    "id": "todo-uuid",
    "attributes": {
      "completed_at": "2026-01-27T18:00:00.000Z"
    }
  }
}
```

To un-complete, set `completed_at` to `null`.
