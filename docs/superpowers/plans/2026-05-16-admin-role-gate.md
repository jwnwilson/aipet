# Admin Role Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the `/admin/users` route and nav link so only users with the Auth0 `admin` role can see or reach it.

**Architecture:** All changes are in `apps/llm-ui/src/App.tsx`. A `useIsAdmin()` hook reads the `https://aipet/roles` custom claim from `useAuth0().user`. `Nav` conditionally renders the Users link; a new `AdminRoute` wrapper component redirects non-admins to `/models`.

**Tech Stack:** React 18, `@auth0/auth0-react`, `react-router-dom` v6, TypeScript, Vitest

---

### Task 1: Add admin gate to App.tsx

The currently open file is `apps/llm-ui/src/App.tsx`. It already imports `useAuth0`, `Navigate`, and `ReactNode` is the only missing import. The existing `UsersPage.test.tsx` mounts `UsersPage` directly (not through `App`), so it continues to pass without changes.

**Files:**
- Modify: `apps/llm-ui/src/App.tsx`

- [ ] **Step 1: Add `ReactNode` to the React import**

Replace line 1:
```tsx
import { useEffect, useState } from 'react'
```
with:
```tsx
import { type ReactNode, useEffect, useState } from 'react'
```

- [ ] **Step 2: Add the `useIsAdmin` hook directly after the `AuthButton` function (around line 26)**

Insert after the closing `}` of `AuthButton` and before `function Nav()`:
```tsx
function useIsAdmin(): boolean {
  const { user } = useAuth0()
  const roles: string[] = user?.['https://aipet/roles'] ?? []
  return roles.includes('admin')
}
```

- [ ] **Step 3: Update `Nav` to conditionally render the Users link**

Replace the entire `Nav` function:
```tsx
function Nav() {
  const isAdmin = useIsAdmin()
  return (
    <nav className="border-b bg-white px-8 py-3 flex gap-6 text-sm font-medium items-center">
      <Link to="/models" className="text-gray-700 hover:text-gray-900">Models</Link>
      <Link to="/runs" className="text-gray-700 hover:text-gray-900">Runs</Link>
      {isAdmin && <Link to="/admin/users" className="text-gray-700 hover:text-gray-900">Users</Link>}
      <AuthButton />
    </nav>
  )
}
```

- [ ] **Step 4: Add `AdminRoute` component after `Nav`**

Insert after the closing `}` of `Nav` and before `function AppContent()`:
```tsx
function AdminRoute({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin()
  return isAdmin ? <>{children}</> : <Navigate to="/models" replace />
}
```

- [ ] **Step 5: Wrap the `/admin/users` route with `AdminRoute`**

In `AppContent`, replace:
```tsx
<Route path="/admin/users" element={<UsersPage />} />
```
with:
```tsx
<Route path="/admin/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
```

- [ ] **Step 6: Run the full test suite to confirm nothing is broken**

```bash
cd /Users/noel/projects/aipet
pnpm --filter llm-ui test run
```

Expected: all existing tests pass (UsersPage tests use `MemoryRouter` directly, not `App`, so they are unaffected by the route guard).

- [ ] **Step 7: Commit**

```bash
git add apps/llm-ui/src/App.tsx
git commit -m "feat(llm-ui): gate admin users route and nav link to admin role"
```
