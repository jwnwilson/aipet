# User Approval Page Design

**Date:** 2026-05-15
**Scope:** aipet_llm_api (backend) + apps/llm-ui (frontend)

## Overview

Add an admin page to llm-ui that lets administrators see Auth0 users who have tried to log in but are not yet approved, and manage the approved-users allowlist (approve pending users, revoke approved users).

## Backend Changes (aipet_llm_api)

### Domain model — `UserContext`

Add a `status` field:

```python
class UserContext(BaseModel):
    user_id: str
    email: str | None = None
    status: Literal["pending", "approved"]
```

Status is derived, not stored: rows in `approved_users` are `"approved"`, Auth0 users absent from that table are `"pending"`.

### `GET /api/admin/users?status=pending`

The existing list endpoint gains an optional `status` query param.

- **`status` omitted or `"approved"`** — existing behaviour: returns `UserContext[]` from the DB with `status: "approved"`.
- **`status="pending"`** — new behaviour:
  1. Fetch a short-lived M2M token from `https://{AUTH0_DOMAIN}/oauth/token` using `AUTH0_CLIENT_ID` + `AUTH0_CLIENT_SECRET` with audience `https://{AUTH0_DOMAIN}/api/v2/`.
  2. Call `GET https://{AUTH0_DOMAIN}/api/v2/users` (fields: `user_id`, `email`; paginated).
  3. Load the approved `user_id` set from `UserStorePort`.
  4. Return Auth0 users whose `user_id` is not in the approved set, each with `status: "pending"`.

The M2M token is fetched per-request (no caching for now).

### Cleanup

Remove any dead `_require_admin` / `x-admin-secret` code from `admin.py` — all admin routes now use the standard `require_auth` dependency.

### Auth0 Management API env vars required

`AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` are already present in `.env`. No new env vars needed; the Management API audience is derived from `AUTH0_DOMAIN`.

## Frontend Changes (apps/llm-ui)

### New file: `src/api/admin.ts`

```ts
listUsers(status?: "pending" | "approved"): Promise<UserContext[]>
approveUser(user_id: string, email?: string): Promise<void>
revokeUser(user_id: string): Promise<void>
```

All calls go through the existing `apiClient` (Bearer token injected automatically).

`UserContext` type: `{ user_id: string; email: string | null; status: "pending" | "approved" }` — add to `src/types/index.ts`.

### New file: `src/pages/UsersPage.tsx`

Single page at `/admin/users` with two tables using the existing table style:

**"Awaiting Approval" table**
- Query key: `["users", "pending"]`, fetches `GET /api/admin/users?status=pending`
- Columns: Email, User ID, Approve button
- Approve → `POST /api/admin/users` → invalidates `["users", "pending"]` and `["users", "approved"]`

**"Approved Users" table**
- Query key: `["users", "approved"]`, fetches `GET /api/admin/users`
- Columns: Email, User ID, Revoke button
- Revoke → `DELETE /api/admin/users/{user_id}` → invalidates both query keys

Both tables show a loading state and an empty state message.

### Changes to `src/App.tsx`

- Import and add route: `<Route path="/admin/users" element={<UsersPage />} />`
- Add `<Link to="/admin/users">Users</Link>` in `Nav`, between Runs and the logout button

## Data Flow

```
UsersPage
  ├── useQuery(["users","pending"]) → GET /api/admin/users?status=pending
  │     backend: M2M token → Auth0 Mgmt API → filter by approved_users table
  ├── useQuery(["users","approved"]) → GET /api/admin/users
  │     backend: approved_users table
  ├── approveMutation → POST /api/admin/users → invalidate both
  └── revokeMutation  → DELETE /api/admin/users/{id} → invalidate both
```

## Out of Scope

- Caching the M2M token (per-request fetch is fine for admin usage frequency)
- Role-based gating of the UI page (any authenticated Auth0 user can reach it; enforcement is on the backend)
- Pagination of the Auth0 user list (acceptable for small tenants)
