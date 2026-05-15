# User Approval Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin page in llm-ui that shows Auth0 users awaiting approval and the approved users list, backed by a new `?status=pending` query param on `GET /api/admin/users`.

**Architecture:** Backend gains a `status` field on `UserContext` and a `?status=pending` branch on the existing list endpoint that calls the Auth0 Management API (M2M token from env vars). Frontend adds a `UsersPage` with two tables (pending / approved) wired to the existing `apiClient`.

**Tech Stack:** Python / FastAPI / SQLAlchemy / httpx (backend); React / TypeScript / TanStack Query / MSW / Vitest (frontend)

---

## File Map

**Backend** (`/Users/noel/projects/aipet_llm_api/`)
- Modify: `src/domain/models.py` — add `status` field to `UserContext`
- Modify: `src/adapters/database/user_store.py` — set `status="approved"` in `list_approved()`
- Create: `src/adapters/auth/auth0_management.py` — M2M token fetch + user list
- Modify: `src/interactors/api/routes/admin.py` — add `status` query param; call management API for pending
- Modify: `tests/integration/test_approval.py` — replace X-Admin-Secret tests with Bearer token; add `status` and pending assertions

**Frontend** (`/Users/noel/projects/aipet/apps/llm-ui/`)
- Modify: `src/types/index.ts` — add `UserContext` interface
- Create: `src/api/admin.ts` — `listUsers`, `approveUser`, `revokeUser`
- Modify: `src/test/msw/fixtures.ts` — add user fixtures
- Modify: `src/test/msw/handlers.ts` — add admin user MSW handlers
- Create: `src/pages/UsersPage.tsx` — two-table admin page
- Create: `src/test/pages/UsersPage.test.tsx` — page tests
- Modify: `src/App.tsx` — add route + nav link

---

## Task 1: Add `status` to `UserContext` and update `list_approved()`

**Files:**
- Modify: `src/domain/models.py`
- Modify: `src/adapters/database/user_store.py`
- Modify: `tests/integration/test_approval.py`

- [ ] **Step 1: Write the failing test**

In `tests/integration/test_approval.py`, inside `TestAdminEndpoint`, replace the three tests that use `X-Admin-Secret` / `monkeypatch.setenv("ADMIN_SECRET", ...)` with Bearer-token versions, and add a `status` assertion to the list test. The full updated `TestAdminEndpoint` class:

```python
class TestAdminEndpoint:
    @pytest.mark.asyncio
    async def test_no_token_returns_401(self, client) -> None:
        resp = await client.post("/api/admin/users", json={"user_id": "auth0|x"})
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_token_returns_401(self, client) -> None:
        resp = await client.post(
            "/api/admin/users",
            json={"user_id": "auth0|x"},
            headers={"Authorization": "Bearer bad-token"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_approve_user(self, client) -> None:
        resp = await client.post(
            "/api/admin/users",
            json={"user_id": "auth0|new", "email": "new@example.com"},
            headers=VALID_HEADERS,
        )
        assert resp.status_code == 201
        assert get_user_store().is_approved("auth0|new")

    @pytest.mark.asyncio
    async def test_list_approved_users(self, client) -> None:
        get_user_store().approve("auth0|existing", "existing@example.com")
        resp = await client.get("/api/admin/users", headers=VALID_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert any(u["user_id"] == "auth0|existing" for u in data)
        assert all(u["status"] == "approved" for u in data)

    @pytest.mark.asyncio
    async def test_revoke_user(self, client) -> None:
        get_user_store().approve("auth0|todelete")
        resp = await client.delete(
            "/api/admin/users/auth0%7Ctodelete",
            headers=VALID_HEADERS,
        )
        assert resp.status_code == 204
        assert not get_user_store().is_approved("auth0|todelete")
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd /Users/noel/projects/aipet_llm_api
uv run pytest tests/integration/test_approval.py::TestAdminEndpoint -v
```

Expected: `test_list_approved_users` fails asserting `status == "approved"` (KeyError or AssertionError). The token-based tests may pass or fail depending on current state.

- [ ] **Step 3: Add `status` to `UserContext` in `src/domain/models.py`**

Replace the existing `UserContext` class:

```python
class UserContext(BaseModel):
    user_id: str
    email: str | None = None
    status: Literal["pending", "approved"] | None = None
```

(`Literal` is already imported at the top of the file.)

- [ ] **Step 4: Update `list_approved()` in `src/adapters/database/user_store.py`**

In `SQLAlchemyUserStore.list_approved()`, change the return to include `status="approved"`:

```python
    def list_approved(self) -> list[UserContext]:
        with Session(self._engine) as db:
            rows = db.scalars(select(_ApprovedUserRow)).all()
            return [
                UserContext(user_id=r.user_id, email=r.email, status="approved")
                for r in rows
            ]
```

- [ ] **Step 5: Update `_InMemoryUserStore.list_approved()` in `tests/integration/test_approval.py`**

In the `_InMemoryUserStore` fixture class, update `list_approved()`:

```python
    def list_approved(self) -> list[UserContext]:
        return [UserContext(user_id=uid, status="approved") for uid in self._approved]
```

- [ ] **Step 6: Run the tests to confirm they pass**

```bash
cd /Users/noel/projects/aipet_llm_api
uv run pytest tests/integration/test_approval.py::TestAdminEndpoint -v
```

Expected: all 5 tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/noel/projects/aipet_llm_api
git add src/domain/models.py src/adapters/database/user_store.py tests/integration/test_approval.py
git commit -m "feat: add status field to UserContext; list_approved returns status=approved"
```

---

## Task 2: Add Auth0 Management API helper

**Files:**
- Create: `src/adapters/auth/auth0_management.py`

- [ ] **Step 1: Create the module**

```python
# src/adapters/auth/auth0_management.py
"""Thin wrapper around the Auth0 Management API v2."""
from __future__ import annotations

import httpx


def list_auth0_users(domain: str, client_id: str, client_secret: str) -> list[dict]:
    """Return all Auth0 users as dicts with keys user_id and email.

    Fetches a short-lived M2M token using client credentials, then pages through
    GET /api/v2/users (100 per page) until exhausted.
    """
    token = _get_mgmt_token(domain, client_id, client_secret)
    users: list[dict] = []
    page = 0
    while True:
        resp = httpx.get(
            f"https://{domain}/api/v2/users",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "fields": "user_id,email",
                "include_fields": "true",
                "per_page": 100,
                "page": page,
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        batch: list[dict] = resp.json()
        if not batch:
            break
        users.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return users


def _get_mgmt_token(domain: str, client_id: str, client_secret: str) -> str:
    resp = httpx.post(
        f"https://{domain}/oauth/token",
        json={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "audience": f"https://{domain}/api/v2/",
        },
        timeout=10.0,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]
```

- [ ] **Step 2: Commit**

```bash
cd /Users/noel/projects/aipet_llm_api
git add src/adapters/auth/auth0_management.py
git commit -m "feat: add Auth0 Management API helper for listing users"
```

---

## Task 3: Add `?status=pending` to `GET /api/admin/users`

**Files:**
- Modify: `src/interactors/api/routes/admin.py`
- Modify: `tests/integration/test_approval.py`

- [ ] **Step 1: Write the failing test**

Add a new test class to `tests/integration/test_approval.py`:

```python
class TestListPendingUsers:
    @pytest.mark.asyncio
    async def test_returns_only_unapproved_users(self, client, monkeypatch) -> None:
        get_user_store().approve("auth0|alpha")

        import adapters.auth.auth0_management as mgmt
        monkeypatch.setattr(
            mgmt,
            "list_auth0_users",
            lambda domain, client_id, client_secret: [
                {"user_id": "auth0|alpha", "email": "alpha@example.com"},
                {"user_id": "auth0|beta", "email": "beta@example.com"},
            ],
        )

        resp = await client.get("/api/admin/users?status=pending", headers=VALID_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["user_id"] == "auth0|beta"
        assert data[0]["status"] == "pending"

    @pytest.mark.asyncio
    async def test_no_token_returns_401(self, client) -> None:
        resp = await client.get("/api/admin/users?status=pending")
        assert resp.status_code == 401
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd /Users/noel/projects/aipet_llm_api
uv run pytest tests/integration/test_approval.py::TestListPendingUsers -v
```

Expected: fail — the endpoint does not yet accept `status` param.

- [ ] **Step 3: Update `src/interactors/api/routes/admin.py`**

Replace the entire file:

```python
"""Admin endpoints for managing the approved-users allowlist."""
from __future__ import annotations

import os
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from domain.models import UserContext
from domain.ports import UserStorePort
from interactors.api.auth import require_auth
from interactors.api.deps import get_user_store

router = APIRouter(prefix="/api/admin", tags=["admin"])


class ApproveUserRequest(BaseModel):
    user_id: str
    email: str | None = None


@router.post("/users", status_code=201, dependencies=[Depends(require_auth)])
def approve_user(
    payload: ApproveUserRequest,
    user_store: UserStorePort = Depends(get_user_store),
) -> dict:
    user_store.approve(payload.user_id, payload.email)
    return {"approved": payload.user_id}


@router.get("/users", dependencies=[Depends(require_auth)])
def list_users(
    status: Literal["approved", "pending"] = Query(default="approved"),
    user_store: UserStorePort = Depends(get_user_store),
) -> list[UserContext]:
    if status == "pending":
        from adapters.auth.auth0_management import list_auth0_users

        domain = os.environ.get("AUTH0_DOMAIN", "")
        client_id = os.environ.get("AUTH0_CLIENT_ID", "")
        client_secret = os.environ.get("AUTH0_CLIENT_SECRET", "")
        auth0_users = list_auth0_users(domain, client_id, client_secret)
        approved_ids = {u.user_id for u in user_store.list_approved()}
        return [
            UserContext(user_id=u["user_id"], email=u.get("email"), status="pending")
            for u in auth0_users
            if u["user_id"] not in approved_ids
        ]
    return user_store.list_approved()


@router.delete("/users/{user_id}", status_code=204, dependencies=[Depends(require_auth)])
def revoke_user(
    user_id: str,
    user_store: UserStorePort = Depends(get_user_store),
) -> None:
    user_store.revoke(user_id)
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd /Users/noel/projects/aipet_llm_api
uv run pytest tests/integration/test_approval.py -v
```

Expected: all tests pass (both `TestAdminEndpoint` and `TestListPendingUsers`).

- [ ] **Step 5: Commit**

```bash
cd /Users/noel/projects/aipet_llm_api
git add src/interactors/api/routes/admin.py tests/integration/test_approval.py
git commit -m "feat: add ?status=pending to GET /api/admin/users via Auth0 Management API"
```

---

## Task 4: Add `UserContext` type, `api/admin.ts`, and MSW fixtures

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/api/admin.ts`
- Modify: `src/test/msw/fixtures.ts`
- Modify: `src/test/msw/handlers.ts`

- [ ] **Step 1: Add `UserContext` to `src/types/index.ts`**

Append to the end of the file:

```ts
export interface UserContext {
  user_id: string
  email: string | null
  status: 'pending' | 'approved'
}
```

- [ ] **Step 2: Create `src/api/admin.ts`**

```ts
import type { UserContext } from '@/types'
import { apiClient } from './client'

export async function listUsers(status: 'approved' | 'pending' = 'approved'): Promise<UserContext[]> {
  const { data } = await apiClient.get<UserContext[]>('/api/admin/users', { params: { status } })
  return data
}

export async function approveUser(user_id: string, email?: string | null): Promise<void> {
  await apiClient.post('/api/admin/users', { user_id, email })
}

export async function revokeUser(user_id: string): Promise<void> {
  await apiClient.delete(`/api/admin/users/${encodeURIComponent(user_id)}`)
}
```

- [ ] **Step 3: Add user fixtures to `src/test/msw/fixtures.ts`**

Add `UserContext` to the existing type import at the top of the file:

```ts
import type { TrainingModel, RunRecord, UserContext } from '@/types'
```

Then append the fixtures to the end of the file:

```ts
export const PENDING_USER_FIXTURE: UserContext = {
  user_id: 'auth0|pending-user',
  email: 'pending@example.com',
  status: 'pending',
}

export const APPROVED_USER_FIXTURE: UserContext = {
  user_id: 'auth0|approved-user',
  email: 'approved@example.com',
  status: 'approved',
}
```

(The existing `import type { TrainingModel, RunRecord }` line at the top of `fixtures.ts` stays; just append these exports.)

- [ ] **Step 4: Add admin handlers to `src/test/msw/handlers.ts`**

Add `UserContext` to the existing type import at the top of the file:

```ts
import type { TrainingModel, TrainingModelConfig, TriggerRunRequest, UserContext } from '@/types'
```

Add the fixture import alongside the existing `MODEL_FIXTURE` import:

```ts
import { MODEL_FIXTURE, RUN_FIXTURE, PENDING_USER_FIXTURE, APPROVED_USER_FIXTURE } from './fixtures'
```

Add state variables after the existing `let models` line:

```ts
let pendingUsers: UserContext[] = [PENDING_USER_FIXTURE]
let approvedUsers: UserContext[] = [APPROVED_USER_FIXTURE]
```

Add these three handlers inside the `handlers` array (after the existing run handlers):

```ts
  http.get(`${BASE}/api/admin/users`, ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') ?? 'approved'
    return HttpResponse.json(status === 'pending' ? pendingUsers : approvedUsers)
  }),

  http.post(`${BASE}/api/admin/users`, async ({ request }) => {
    const body = await request.json() as { user_id: string; email?: string | null }
    const user: UserContext = { user_id: body.user_id, email: body.email ?? null, status: 'approved' }
    approvedUsers = [...approvedUsers, user]
    pendingUsers = pendingUsers.filter(u => u.user_id !== body.user_id)
    return HttpResponse.json({ approved: body.user_id }, { status: 201 })
  }),

  http.delete(`${BASE}/api/admin/users/:userId`, ({ params }) => {
    approvedUsers = approvedUsers.filter(
      u => u.user_id !== decodeURIComponent(params.userId as string)
    )
    return new HttpResponse(null, { status: 204 })
  }),
```

Update `resetHandlerState()` to reset user state too:

```ts
export function resetHandlerState() {
  models = [MODEL_FIXTURE]
  pendingUsers = [PENDING_USER_FIXTURE]
  approvedUsers = [APPROVED_USER_FIXTURE]
}
```

- [ ] **Step 5: Run the frontend type-check to confirm no errors**

```bash
cd /Users/noel/projects/aipet/apps/llm-ui
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/noel/projects/aipet
git add apps/llm-ui/src/types/index.ts apps/llm-ui/src/api/admin.ts \
        apps/llm-ui/src/test/msw/fixtures.ts apps/llm-ui/src/test/msw/handlers.ts
git commit -m "feat: add UserContext type, admin API module, and MSW fixtures"
```

---

## Task 5: Build `UsersPage.tsx`

**Files:**
- Create: `src/pages/UsersPage.tsx`
- Create: `src/test/pages/UsersPage.test.tsx`

- [ ] **Step 1: Write the failing tests in `src/test/pages/UsersPage.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UsersPage } from '@/pages/UsersPage'
import { PENDING_USER_FIXTURE, APPROVED_USER_FIXTURE } from '../msw/fixtures'
import { resetHandlerState } from '../msw/handlers'

beforeEach(() => resetHandlerState())

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('UsersPage', () => {
  it('renders pending user email in awaiting approval table', async () => {
    renderPage()
    await waitFor(() =>
      expect(screen.getByText(PENDING_USER_FIXTURE.email!)).toBeInTheDocument()
    )
  })

  it('renders approved user email in approved users table', async () => {
    renderPage()
    await waitFor(() =>
      expect(screen.getByText(APPROVED_USER_FIXTURE.email!)).toBeInTheDocument()
    )
  })

  it('shows Approve button for pending user', async () => {
    renderPage()
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: new RegExp(`approve ${PENDING_USER_FIXTURE.email}`, 'i'),
        })
      ).toBeInTheDocument()
    )
  })

  it('shows Revoke button for approved user', async () => {
    renderPage()
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: new RegExp(`revoke ${APPROVED_USER_FIXTURE.email}`, 'i'),
        })
      ).toBeInTheDocument()
    )
  })

  it('approving a pending user removes them from the pending table', async () => {
    renderPage()
    await waitFor(() => screen.getByText(PENDING_USER_FIXTURE.email!))
    await userEvent.click(
      screen.getByRole('button', {
        name: new RegExp(`approve ${PENDING_USER_FIXTURE.email}`, 'i'),
      })
    )
    await waitFor(() =>
      expect(screen.queryByText(PENDING_USER_FIXTURE.email!)).not.toBeInTheDocument()
    )
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd /Users/noel/projects/aipet/apps/llm-ui
pnpm vitest run src/test/pages/UsersPage.test.tsx
```

Expected: fail — `UsersPage` does not exist.

- [ ] **Step 3: Create `src/pages/UsersPage.tsx`**

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserCheck, UserX } from 'lucide-react'
import { approveUser, listUsers, revokeUser } from '@/api/admin'
import { Button } from '@/components/ui/button'
import type { UserContext } from '@/types'

export function UsersPage() {
  const queryClient = useQueryClient()

  const { data: pending = [], isLoading: loadingPending } = useQuery({
    queryKey: ['users', 'pending'],
    queryFn: () => listUsers('pending'),
  })

  const { data: approved = [], isLoading: loadingApproved } = useQuery({
    queryKey: ['users', 'approved'],
    queryFn: () => listUsers('approved'),
  })

  const approveMutation = useMutation({
    mutationFn: (user: UserContext) => approveUser(user.user_id, user.email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'pending'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'approved'] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (user_id: string) => revokeUser(user_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'pending'] })
      queryClient.invalidateQueries({ queryKey: ['users', 'approved'] })
    },
  })

  return (
    <div className="p-8 space-y-10">
      <section>
        <h2 className="text-xl font-semibold mb-4">Awaiting Approval</h2>
        {loadingPending ? (
          <p className="text-gray-500">Loading…</p>
        ) : (
          <div className="rounded-md border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-semibold">Email</th>
                  <th className="text-left px-4 py-3 font-semibold">User ID</th>
                  <th className="text-left px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-gray-400">
                      No users awaiting approval
                    </td>
                  </tr>
                ) : (
                  pending.map(user => (
                    <tr key={user.user_id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{user.email ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-gray-700 text-xs">{user.user_id}</td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(user)}
                          disabled={approveMutation.isPending}
                          aria-label={`Approve ${user.email ?? user.user_id}`}
                        >
                          <UserCheck className="h-3.5 w-3.5 mr-1" />Approve
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Approved Users</h2>
        {loadingApproved ? (
          <p className="text-gray-500">Loading…</p>
        ) : (
          <div className="rounded-md border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-semibold">Email</th>
                  <th className="text-left px-4 py-3 font-semibold">User ID</th>
                  <th className="text-left px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {approved.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-gray-400">
                      No approved users
                    </td>
                  </tr>
                ) : (
                  approved.map(user => (
                    <tr key={user.user_id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{user.email ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-gray-700 text-xs">{user.user_id}</td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => revokeMutation.mutate(user.user_id)}
                          disabled={
                            revokeMutation.isPending &&
                            revokeMutation.variables === user.user_id
                          }
                          aria-label={`Revoke ${user.email ?? user.user_id}`}
                        >
                          <UserX className="h-3.5 w-3.5 mr-1" />Revoke
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd /Users/noel/projects/aipet/apps/llm-ui
pnpm vitest run src/test/pages/UsersPage.test.tsx
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/noel/projects/aipet
git add apps/llm-ui/src/pages/UsersPage.tsx apps/llm-ui/src/test/pages/UsersPage.test.tsx
git commit -m "feat: add UsersPage with awaiting approval and approved users tables"
```

---

## Task 6: Wire route and nav link in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add import and route**

In `src/App.tsx`, add the import alongside the other page imports:

```tsx
import { UsersPage } from './pages/UsersPage'
```

Inside `<Routes>` in `AppContent`, add after the runs route:

```tsx
<Route path="/admin/users" element={<UsersPage />} />
```

- [ ] **Step 2: Add nav link**

In the `Nav` function, add a Users link after the Runs link:

```tsx
<Link to="/admin/users" className="text-gray-700 hover:text-gray-900">Users</Link>
```

The full updated `Nav`:

```tsx
function Nav() {
  return (
    <nav className="border-b bg-white px-8 py-3 flex gap-6 text-sm font-medium items-center">
      <Link to="/models" className="text-gray-700 hover:text-gray-900">Models</Link>
      <Link to="/runs" className="text-gray-700 hover:text-gray-900">Runs</Link>
      <Link to="/admin/users" className="text-gray-700 hover:text-gray-900">Users</Link>
      <AuthButton />
    </nav>
  )
}
```

- [ ] **Step 3: Run the full frontend test suite**

```bash
cd /Users/noel/projects/aipet/apps/llm-ui
pnpm vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Run the type-check**

```bash
cd /Users/noel/projects/aipet/apps/llm-ui
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/noel/projects/aipet
git add apps/llm-ui/src/App.tsx
git commit -m "feat: add /admin/users route and Users nav link"
```
