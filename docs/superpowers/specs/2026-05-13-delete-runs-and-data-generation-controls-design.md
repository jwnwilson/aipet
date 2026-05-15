# Delete Runs & Data Generation Controls

**Date:** 2026-05-13
**Status:** Approved

## Context

The llm-ui currently lets users trigger training runs and monitor their progress, but offers no way to remove old or failed runs. There is also no way to control how much training or evaluation data is generated per run — the backend decides unilaterally. This spec adds both capabilities.

## Features

### 1. Delete run

A destructive action available on the run detail page only. The list page is intentionally excluded to prevent accidental bulk deletion.

**UX:**
- A "Delete run" button (red outline style) appears on `RunDetailPage` alongside the run status badge
- Clicking it triggers a browser `confirm()` dialog: _"Delete this run? This cannot be undone."_
- On confirm: calls `DELETE /api/runs/:id`, then navigates to `/runs`
- On cancel: nothing happens
- If the API call fails, an inline error message is shown

**API:**
- New `deleteRun(id: string): Promise<void>` function in `src/api/runs.ts`
- Calls `DELETE /api/runs/:id`, expects 204 No Content

### 2. Data generation sample counts

Two new per-run override fields — `num_train_samples` and `num_eval_samples` — added to the run trigger modal. They control how many examples the backend generates for the training and evaluation datasets. Leaving them blank means the backend uses its own default.

**UX:**
- Added as the 5th and 6th cells in the existing 2-col grid in `RunModal`, after warmup ratio and remote backend
- Both fields are `type="number"`, integer, positive, nullable
- Both are **disabled** when "Skip dataset generation" is checked (they're irrelevant if generation is skipped)
- Default value: null (blank input, no override sent to backend)

**API:**
- `TriggerRunRequest` gains `num_train_samples?: number | null` and `num_eval_samples?: number | null`
- Both are omitted from the request payload if null (same pattern as other nullable override fields)

## Files Changed

| File | Change |
|---|---|
| `apps/llm-ui/src/types/index.ts` | Add `num_train_samples` and `num_eval_samples` to `TriggerRunRequest` |
| `apps/llm-ui/src/api/runs.ts` | Add `deleteRun(id: string): Promise<void>` |
| `apps/llm-ui/src/components/RunModal.tsx` | Add fields to schema, grid, and submit logic; disable when skip_generate |
| `apps/llm-ui/src/pages/RunDetailPage.tsx` | Add delete button with confirm dialog and post-delete navigation |
| `apps/llm-ui/src/test/msw/handlers.ts` | Add `DELETE /api/runs/:id` mock handler (204 response) |

**Active runs:** The delete button is shown regardless of run status. If the backend rejects a delete for an active run (e.g., 409 Conflict), the UI shows a generic error message. No client-side guard is added — keeping that logic server-authoritative.

## Out of Scope

- Bulk delete from the runs list
- Soft delete / archive
- Adding `num_train_samples` / `num_eval_samples` as persistent model config fields (per-run override only for now)

## Verification

1. **Delete:** Open a run detail page → click "Delete run" → confirm → redirected to `/runs`, run no longer in list
2. **Delete cancel:** Click "Delete run" → cancel → run detail page unchanged
3. **Sample counts:** Open run modal → enter num_train=500, num_eval=100 → trigger run → check network request includes both fields
4. **Disabled when skipping:** Check "Skip dataset generation" → num_train and num_eval inputs become disabled
5. **Null omission:** Leave num_train/num_eval blank → trigger run → request payload does not include those keys
