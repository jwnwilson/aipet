# Models CRUD Screen — Design Spec

**Date:** 2026-05-12  
**App:** `apps/llm-ui`  
**Status:** Approved

---

## Goal

Replace the card-grid `ModelsListPage` with a searchable table that supports inline Run (with parameter overrides) and Edit actions. Also align all frontend types and API calls to the current `aipet_llm` OpenAPI schema (`http://localhost:8000/openapi.json`).

---

## 1. Models List Page (`/models`)

### Layout

A full-width table replacing the current card grid. Toolbar above the table with:

- **Search input** (left) — filters rows client-side by `name`, `description`, and `base_model` (case-insensitive substring match)
- **"+ New model" button** (right) — navigates to `/models/new` (unchanged)

### Table columns

| Column | Source field | Notes |
|---|---|---|
| Name | `model.name` | Bold; `model.description` as muted sub-line |
| Base model | `model.base_model` | Monospace font |
| Backend | `model.remote_backend` | |
| Epochs | `model.epochs` | |
| Active | `model.is_active` | Green badge if true, dash if false |
| Actions | — | Run, Edit, Delete buttons |

### Row actions

- **▶ Run** — opens the Run modal (see §2) with that model pre-loaded
- **✏ Edit** — navigates to `/models/:id/edit`
- **🗑 Delete** — calls `DELETE /api/models/:id`; row is optimistically removed

The "New model" button and the existing `ModelFormPage` / `ModelDetailPage` routes are kept unchanged.

---

## 2. Run Modal

Opened by clicking **▶ Run** on any table row. It is a dialog overlay (using the existing shadcn Dialog or a simple modal).

### Fields

All fields are optional overrides — pre-filled with the model's saved values. Sending `null` (or omitting) means "use the model default" on the backend.

| Field | Type | Input | Options |
|---|---|---|---|
| Epochs | `number \| null` | Number input | — |
| Patience | `number \| null` | Number input | — |
| Warmup ratio | `number \| null` | Number input (step 0.01) | — |
| Remote backend | `string \| null` | Select dropdown | local, kaggle, ssh, colab |
| Base model | `string \| null` | Combobox (reuse existing) | Same list as `ModelForm` |
| Skip generate | `boolean \| null` | Checkbox | — |

### Submission

Posts to `POST /api/runs/trigger` with body:

```json
{
  "model_id": "<id>",
  "epochs": <value or null>,
  "patience": <value or null>,
  "warmup_ratio": <value or null>,
  "remote_backend": "<value or null>",
  "base_model": "<value or null>",
  "skip_generate": <value or null>
}
```

Null fields are omitted from the request body (not sent). On success, invalidate the `['runs']` query and close the modal.

> **Note:** A label/tag field is not included — the API's `TriggerRunRequest` does not support it yet.

---

## 3. API & Type Alignment

### `src/types/index.ts`

Replace the `Run` and `RunStatus` types; add `TriggerRunRequest`; extend model types.

```ts
// RunStatus — lowercase to match new API enum
export type RunStatus =
  | 'pending' | 'generating' | 'training'
  | 'evaluating' | 'exporting' | 'running'
  | 'completed' | 'failed'

// RunRecord — replaces Run
export interface RunRecord {
  id: string
  workflow_id: string
  model_id: string
  status: RunStatus
  eval_valid_pct: number | null
  progress: number | null
  progress_detail: string | null
  created_at: string
  updated_at: string
}

// TriggerRunRequest
export interface TriggerRunRequest {
  model_id: string
  epochs?: number | null
  patience?: number | null
  warmup_ratio?: number | null
  skip_generate?: boolean | null
  remote_backend?: string | null
  base_model?: string | null
}

// TrainingModelConfig & TrainingModel — add new fields
export interface TrainingModelConfig {
  name: string
  description: string
  base_model: string
  train_data: string
  eval_data: string
  epochs: number
  patience: number
  warmup_ratio: number
  remote_backend: string
  skip_generate: boolean
  gguf_path: string
  is_active: boolean
}
```

### `src/api/runs.ts`

- `listRuns()` → `GET /api/runs` → returns `RunRecord[]`
- `getRun(id)` → `GET /api/runs/:id` (uses `run.id`, not `workflow_id`)
- `triggerRun(req: TriggerRunRequest)` → `POST /api/runs/trigger` — moved here from `models.ts`
- `isRunActive(run)` → checks `run.status === 'running'`

### `src/api/models.ts`

- Remove `triggerRun` (moved to `runs.ts`)
- Everything else unchanged

### `src/components/RunStatusBadge.tsx`

Update `STATUS_CONFIG` for the new lowercase status values:

| Status | Colour |
|---|---|
| pending | gray |
| generating | purple |
| training | blue |
| evaluating | indigo |
| exporting | teal |
| running | blue |
| completed | green |
| failed | red |

### `src/pages/RunDetailPage.tsx`

- Use `run.id` for the query key and URL param
- Replace `run.run_id`, `run.start_time`, `run.close_time` with `run.id`, `run.created_at`, `run.updated_at`
- Update `buildStages` to map new status values (`'generating'` → Generate active, `'training'` → Train active, etc.)
- Update `isRunActive` call signature

### `src/pages/RunsListPage.tsx`

- Use `run.id` as the key and link target
- Replace `run.start_time` with `run.created_at`

### `src/App.tsx` routing

Route `/runs/:workflowId` → `/runs/:runId` (param rename only; no user-visible URL change needed since existing links come from the list page which we're rewriting).

---

## 4. Files to Create / Modify

| File | Change |
|---|---|
| `src/types/index.ts` | Replace `Run`, `RunStatus`; add `RunRecord`, `TriggerRunRequest`; extend model types |
| `src/api/runs.ts` | Update all functions for new schema; add `triggerRun` |
| `src/api/models.ts` | Remove `triggerRun` |
| `src/pages/ModelsListPage.tsx` | Full rewrite → table + search + Run modal trigger |
| `src/components/RunModal.tsx` | **New** — run parameter override dialog |
| `src/components/RunStatusBadge.tsx` | Update status config for new enum |
| `src/pages/RunDetailPage.tsx` | Field name updates + new stage mapping |
| `src/pages/RunsListPage.tsx` | Field name updates |
| `src/App.tsx` | Param rename on runs route |

---

## 5. Out of Scope

- `ModelDetailPage` — minor update only: replace the `workflow_id.includes(name)` run filter with `r.model_id === model.id` now that `RunRecord` carries `model_id`
- `ModelFormPage` / `ModelForm` — kept as-is (form for create/edit is fine)
- `EvalMetrics`, `PipelineStages` — kept as-is
- Activate model / activate run / evaluate run / export run endpoints — not surfaced in UI yet
- Run label/tag field — API does not support it
