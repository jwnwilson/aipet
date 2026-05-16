# Admin Role Gate Design

**Date:** 2026-05-16
**Scope:** apps/llm-ui frontend only

## Overview

Gate the user approval page so it is only visible to users with the `admin` Auth0 role. Non-admin users should see no trace of the feature (no nav link, redirect if they hit the URL directly).

## Context

The backend already enforces `require_admin` on all `/api/admin/users` endpoints — any non-admin API call returns 403. This change adds the matching frontend guard so the UI never shows the page to non-admins in the first place.

Auth0 is configured to include roles at the `https://aipet/roles` custom claim in the **ID token**, so roles are available immediately via `useAuth0().user?.['https://aipet/roles']`.

## Design

All changes are in `src/App.tsx`. No new files.

### `useIsAdmin()` hook

```ts
function useIsAdmin(): boolean {
  const { user } = useAuth0()
  const roles: string[] = user?.['https://aipet/roles'] ?? []
  return roles.includes('admin')
}
```

Defined at the top of `App.tsx` alongside `AuthButton` and `Nav`. The claim namespace matches what the backend reads from the access token.

### Nav — conditional link

```tsx
function Nav() {
  const isAdmin = useIsAdmin()
  return (
    <nav ...>
      <Link to="/models" ...>Models</Link>
      <Link to="/runs" ...>Runs</Link>
      {isAdmin && <Link to="/admin/users" ...>Users</Link>}
      <AuthButton />
    </nav>
  )
}
```

### Route guard

```tsx
function AdminRoute({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin()
  return isAdmin ? <>{children}</> : <Navigate to="/models" replace />
}
```

Used in `AppContent`:

```tsx
<Route path="/admin/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
```

### Testing

The existing `App.tsx` is not directly tested (Auth0 mock complexity). Update the `UsersPage.test.tsx` to verify the page renders for admin users (already covered). No new App-level test needed — the `AdminRoute` logic is trivial and the behaviour is covered end-to-end by the MSW tests.

## Out of Scope

- Backend changes (already done)
- Showing an "Access Denied" page instead of redirect (redirect to `/models` is sufficient)
- Caching or memoising the admin check (Auth0's `useAuth0` hook already memoises `user`)
