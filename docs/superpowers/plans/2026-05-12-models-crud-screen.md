# Models CRUD Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the card-grid models list with a searchable table, add a run-parameter-override modal, and align all frontend types/API calls to the current `aipet_llm` OpenAPI schema.

**Architecture:** Bottom-up migration — types first, then MSW test infrastructure, then API layer, then components, then pages. Each layer is tested before the next builds on it. `RunModal` is a standalone component that owns its own mutation; `ModelsListPage` passes the selected model to it via local state.

**Tech Stack:** React 19, TypeScript, Vite, Vitest + Testing Library + MSW, react-hook-form + zod, TanStack Query, Radix UI (existing select/combobox), Tailwind CSS 4

---

## File Map

| File | Action |
|---|---|
| `src/types/index.ts` | Replace `Run`/`RunStatus`; add `RunRecord`, `TriggerRunRequest`; add `gguf_path`/`is_active` to model types |
| `src/test/msw/fixtures.ts` | Update `RUN_FIXTURE` to `RunRecord` shape; add `gguf_path`/`is_active` to `MODEL_FIXTURE` |
| `src/test/msw/handlers.ts` | Remove old trigger handler; add `POST /api/runs/trigger`; update `GET /api/runs/:id` to use `run.id` |
| `src/api/runs.ts` | Add `triggerRun`; update return types for `RunRecord`; update `isRunActive` |
| `src/api/models.ts` | Remove `triggerRun` |
| `src/test/api/runs.test.ts` | Update for new schema; add `triggerRun` test |
| `src/test/api/models.test.ts` | Remove `triggerRun` test |
| `src/components/RunStatusBadge.tsx` | Replace status config with lowercase API enum values |
| `src/test/components/RunStatusBadge.test.tsx` | Update status cases to lowercase |
| `src/components/RunModal.tsx` | **New** — run override dialog (form + mutation) |
| `src/test/components/RunModal.test.tsx` | **New** — render, pre-fill, submit, cancel |
| `src/pages/ModelsListPage.tsx` | Full rewrite → table + search + `RunModal` trigger |
| `src/test/pages/ModelsListPage.test.tsx` | Update for table; add search filter + modal open tests |
| `src/pages/RunDetailPage.tsx` | Field renames (`run.id`, `run.created_at`); updated `buildStages` |
| `src/test/pages/RunDetailPage.test.tsx` | Use `RUN_FIXTURE.id` as route param |
| `src/pages/RunsListPage.tsx` | Use `run.id` for links; `run.created_at` for timestamp |
| `src/pages/ModelDetailPage.tsx` | Update trigger import + call; filter runs by `model_id` |
| `src/App.tsx` | Route `/runs/:workflowId` → `/runs/:runId` |

---

## Task 1: Update types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
// src/types/index.ts
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
  gguf_path?: string   // optional — backend defaults to ''
  is_active?: boolean  // optional — backend defaults to false
}

export interface TrainingModel extends TrainingModelConfig {
  id: string
  created_at: string
  updated_at: string
}

export type RunStatus =
  | 'pending'
  | 'generating'
  | 'training'
  | 'evaluating'
  | 'exporting'
  | 'running'
  | 'completed'
  | 'failed'

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

export interface TriggerRunRequest {
  model_id: string
  epochs?: number | null
  patience?: number | null
  warmup_ratio?: number | null
  skip_generate?: boolean | null
  remote_backend?: string | null
  base_model?: string | null
}
```

- [ ] **Step 2: Verify TypeScript sees the errors (expected)**

Run: `pnpm --filter llm-ui exec tsc --noEmit 2>&1 | head -30`

Expected: multiple errors referencing `Run`, `RUNNING`, `COMPLETED`, `run_id`, `start_time`, `close_time`. That's correct — we'll fix them task by task.

---

## Task 2: Update MSW test fixtures and handlers

**Files:**
- Modify: `src/test/msw/fixtures.ts`
- Modify: `src/test/msw/handlers.ts`

- [ ] **Step 1: Replace fixtures.ts**

```typescript
// src/test/msw/fixtures.ts
import type { TrainingModel, RunRecord } from '@/types'

export const MODEL_FIXTURE: TrainingModel = {
  id: 'test-id-1',
  name: 'test-model',
  description: 'A test model',
  base_model: 'HuggingFaceTB/SmolLM2-360M',
  train_data: 'data/train.jsonl',
  eval_data: 'data/eval.jsonl',
  epochs: 5,
  patience: 3,
  warmup_ratio: 0.05,
  remote_backend: 'local',
  skip_generate: false,
  gguf_path: '',
  is_active: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

export const RUN_FIXTURE: RunRecord = {
  id: 'run-uuid',
  workflow_id: 'training-test-model-abc12345',
  model_id: 'test-id-1',
  status: 'running',
  eval_valid_pct: null,
  progress: null,
  progress_detail: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}
```

- [ ] **Step 2: Replace handlers.ts**

```typescript
// src/test/msw/handlers.ts
import { http, HttpResponse } from 'msw'
import type { TrainingModel, TrainingModelConfig, TriggerRunRequest } from '@/types'
import { MODEL_FIXTURE, RUN_FIXTURE } from './fixtures'

const BASE = 'http://localhost:8000'

let models: TrainingModel[] = [MODEL_FIXTURE]

export const handlers = [
  http.get(`${BASE}/api/models`, () => HttpResponse.json(models)),

  http.post(`${BASE}/api/models`, async ({ request }) => {
    const config = await request.json() as TrainingModelConfig
    const created: TrainingModel = {
      ...config,
      id: 'new-id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    models = [...models, created]
    return HttpResponse.json(created, { status: 201 })
  }),

  http.get(`${BASE}/api/models/:id`, ({ params }) => {
    const model = models.find(m => m.id === params.id)
    if (!model) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json(model)
  }),

  http.put(`${BASE}/api/models/:id`, async ({ params, request }) => {
    const config = await request.json() as TrainingModelConfig
    const idx = models.findIndex(m => m.id === params.id)
    if (idx === -1) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    const updated = { ...models[idx], ...config, updated_at: new Date().toISOString() }
    models = [...models.slice(0, idx), updated, ...models.slice(idx + 1)]
    return HttpResponse.json(updated)
  }),

  http.delete(`${BASE}/api/models/:id`, ({ params }) => {
    const idx = models.findIndex(m => m.id === params.id)
    if (idx === -1) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    models = models.filter(m => m.id !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${BASE}/api/runs/trigger`, async ({ request }) => {
    const body = await request.json() as TriggerRunRequest
    const model = models.find(m => m.id === body.model_id)
    if (!model) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json({ run_id: RUN_FIXTURE.id }, { status: 202 })
  }),

  http.get(`${BASE}/api/runs`, () => HttpResponse.json([RUN_FIXTURE])),

  http.get(`${BASE}/api/runs/:id`, ({ params }) => {
    if (params.id === RUN_FIXTURE.id) return HttpResponse.json(RUN_FIXTURE)
    return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
  }),
]

export function resetHandlerState() {
  models = [MODEL_FIXTURE]
}
```

---

## Task 3: Update `api/runs.ts` and its tests

**Files:**
- Modify: `src/api/runs.ts`
- Modify: `src/test/api/runs.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/test/api/runs.test.ts
import { describe, it, expect } from 'vitest'
import { listRuns, getRun, isRunActive, triggerRun } from '@/api/runs'
import { MODEL_FIXTURE, RUN_FIXTURE } from '../msw/fixtures'

describe('listRuns', () => {
  it('returns array of RunRecords with id field', async () => {
    const runs = await listRuns()
    expect(Array.isArray(runs)).toBe(true)
    expect(runs[0].id).toBe(RUN_FIXTURE.id)
  })
})

describe('getRun', () => {
  it('returns run by id', async () => {
    const run = await getRun(RUN_FIXTURE.id)
    expect(run.status).toBe('running')
    expect(run.model_id).toBe(MODEL_FIXTURE.id)
  })

  it('throws on unknown id', async () => {
    await expect(getRun('does-not-exist')).rejects.toThrow()
  })
})

describe('triggerRun', () => {
  it('posts to /api/runs/trigger and returns run_id', async () => {
    const result = await triggerRun({ model_id: MODEL_FIXTURE.id })
    expect(result.run_id).toBe(RUN_FIXTURE.id)
  })
})

describe('isRunActive', () => {
  it('returns true for running status', () => {
    expect(isRunActive({ ...RUN_FIXTURE, status: 'running' })).toBe(true)
  })

  it('returns false for completed status', () => {
    expect(isRunActive({ ...RUN_FIXTURE, status: 'completed' })).toBe(false)
  })

  it('returns false for failed status', () => {
    expect(isRunActive({ ...RUN_FIXTURE, status: 'failed' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect failures**

Run: `pnpm --filter llm-ui test src/test/api/runs.test.ts`

Expected: failures on `id`, `model_id`, `triggerRun` (not exported yet), and `running` status.

- [ ] **Step 3: Replace `src/api/runs.ts`**

```typescript
// src/api/runs.ts
import type { RunRecord, TriggerRunRequest } from '@/types'
import { apiClient } from './client'

export async function listRuns(): Promise<RunRecord[]> {
  const { data } = await apiClient.get<RunRecord[]>('/api/runs')
  return data
}

export async function getRun(id: string): Promise<RunRecord> {
  const { data } = await apiClient.get<RunRecord>(`/api/runs/${id}`)
  return data
}

export async function triggerRun(req: TriggerRunRequest): Promise<{ run_id: string }> {
  const { data } = await apiClient.post<{ run_id: string }>('/api/runs/trigger', req)
  return data
}

export function isRunActive(run: RunRecord): boolean {
  return run.status === 'running'
}
```

- [ ] **Step 4: Run test — expect all pass**

Run: `pnpm --filter llm-ui test src/test/api/runs.test.ts`

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/test/msw/fixtures.ts src/test/msw/handlers.ts src/api/runs.ts src/test/api/runs.test.ts
git commit -m "feat(llm-ui): update types and runs API to new OpenAPI schema"
```

---

## Task 4: Update `api/models.ts` and its tests

**Files:**
- Modify: `src/api/models.ts`
- Modify: `src/test/api/models.test.ts`

- [ ] **Step 1: Write the updated test (remove triggerRun)**

```typescript
// src/test/api/models.test.ts
import { describe, it, expect } from 'vitest'
import { listModels, getModel, createModel, updateModel, deleteModel } from '@/api/models'
import { MODEL_FIXTURE } from '../msw/fixtures'

describe('listModels', () => {
  it('returns array of models', async () => {
    const models = await listModels()
    expect(Array.isArray(models)).toBe(true)
    expect(models[0].id).toBe(MODEL_FIXTURE.id)
  })
})

describe('getModel', () => {
  it('returns model by id', async () => {
    const model = await getModel(MODEL_FIXTURE.id)
    expect(model.name).toBe(MODEL_FIXTURE.name)
  })

  it('throws on unknown id', async () => {
    await expect(getModel('does-not-exist')).rejects.toThrow()
  })
})

describe('createModel', () => {
  it('creates and returns model with id', async () => {
    const config = { ...MODEL_FIXTURE, name: 'new-model' }
    const model = await createModel(config)
    expect(model.id).toBeDefined()
    expect(model.name).toBe('new-model')
  })
})

describe('updateModel', () => {
  it('updates and returns model', async () => {
    const updated = await updateModel(MODEL_FIXTURE.id, { ...MODEL_FIXTURE, epochs: 10 })
    expect(updated.epochs).toBe(10)
  })
})

describe('deleteModel', () => {
  it('resolves without error', async () => {
    await expect(deleteModel(MODEL_FIXTURE.id)).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test — expect pass (triggerRun removal will be a compile error first)**

Run: `pnpm --filter llm-ui test src/test/api/models.test.ts`

- [ ] **Step 3: Replace `src/api/models.ts`**

```typescript
// src/api/models.ts
import type { TrainingModel, TrainingModelConfig } from '@/types'
import { apiClient } from './client'

export async function listModels(): Promise<TrainingModel[]> {
  const { data } = await apiClient.get<TrainingModel[]>('/api/models')
  return data
}

export async function getModel(id: string): Promise<TrainingModel> {
  const { data } = await apiClient.get<TrainingModel>(`/api/models/${id}`)
  return data
}

export async function createModel(config: TrainingModelConfig): Promise<TrainingModel> {
  const { data } = await apiClient.post<TrainingModel>('/api/models', config)
  return data
}

export async function updateModel(id: string, config: TrainingModelConfig): Promise<TrainingModel> {
  const { data } = await apiClient.put<TrainingModel>(`/api/models/${id}`, config)
  return data
}

export async function deleteModel(id: string): Promise<void> {
  await apiClient.delete(`/api/models/${id}`)
}
```

- [ ] **Step 4: Run test — expect all pass**

Run: `pnpm --filter llm-ui test src/test/api/models.test.ts`

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/api/models.ts src/test/api/models.test.ts
git commit -m "feat(llm-ui): remove triggerRun from models API (moved to runs)"
```

---

## Task 5: Update `RunStatusBadge`

**Files:**
- Modify: `src/components/RunStatusBadge.tsx`
- Modify: `src/test/components/RunStatusBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/test/components/RunStatusBadge.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunStatusBadge } from '@/components/RunStatusBadge'
import type { RunStatus } from '@/types'

const cases: Array<[RunStatus, string]> = [
  ['pending', 'Pending'],
  ['generating', 'Generating'],
  ['training', 'Training'],
  ['evaluating', 'Evaluating'],
  ['exporting', 'Exporting'],
  ['running', 'Running'],
  ['completed', 'Completed'],
  ['failed', 'Failed'],
]

describe('RunStatusBadge', () => {
  it.each(cases)('renders label for status %s', (status, label) => {
    render(<RunStatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('applies green class for completed', () => {
    render(<RunStatusBadge status="completed" />)
    expect(screen.getByTestId('run-status-badge')).toHaveClass('bg-green-100')
  })

  it('applies red class for failed', () => {
    render(<RunStatusBadge status="failed" />)
    expect(screen.getByTestId('run-status-badge')).toHaveClass('bg-red-100')
  })

  it('applies blue class for running', () => {
    render(<RunStatusBadge status="running" />)
    expect(screen.getByTestId('run-status-badge')).toHaveClass('bg-blue-100')
  })
})
```

- [ ] **Step 2: Run test — expect failures**

Run: `pnpm --filter llm-ui test src/test/components/RunStatusBadge.test.tsx`

Expected: fails because the component still has uppercase statuses.

- [ ] **Step 3: Replace `src/components/RunStatusBadge.tsx`**

```typescript
// src/components/RunStatusBadge.tsx
import type { RunStatus } from '@/types'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<RunStatus, { label: string; className: string }> = {
  pending:    { label: 'Pending',    className: 'bg-gray-100 text-gray-600' },
  generating: { label: 'Generating', className: 'bg-purple-100 text-purple-800' },
  training:   { label: 'Training',   className: 'bg-blue-100 text-blue-800' },
  evaluating: { label: 'Evaluating', className: 'bg-indigo-100 text-indigo-800' },
  exporting:  { label: 'Exporting',  className: 'bg-teal-100 text-teal-800' },
  running:    { label: 'Running',    className: 'bg-blue-100 text-blue-800' },
  completed:  { label: 'Completed',  className: 'bg-green-100 text-green-800' },
  failed:     { label: 'Failed',     className: 'bg-red-100 text-red-800' },
}

interface RunStatusBadgeProps {
  status: RunStatus
  className?: string
}

export function RunStatusBadge({ status, className }: RunStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      data-testid="run-status-badge"
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className, className)}
    >
      {config.label}
    </span>
  )
}
```

- [ ] **Step 4: Run test — expect all pass**

Run: `pnpm --filter llm-ui test src/test/components/RunStatusBadge.test.tsx`

Expected: all 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/RunStatusBadge.tsx src/test/components/RunStatusBadge.test.tsx
git commit -m "feat(llm-ui): update RunStatusBadge for new lowercase status enum"
```

---

## Task 6: Create `RunModal` component

**Files:**
- Create: `src/components/RunModal.tsx`
- Create: `src/test/components/RunModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/test/components/RunModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RunModal } from '@/components/RunModal'
import { MODEL_FIXTURE } from '../msw/fixtures'

function renderModal(onClose = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <RunModal model={MODEL_FIXTURE} onClose={onClose} />
    </QueryClientProvider>
  )
  return { onClose }
}

describe('RunModal', () => {
  it('renders with model name in the heading', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/trigger run — test-model/i)).toBeInTheDocument()
  })

  it('pre-fills epochs with the model default', () => {
    renderModal()
    const input = screen.getByLabelText(/^epochs$/i)
    expect(input).toHaveValue(MODEL_FIXTURE.epochs)
  })

  it('closes on successful submission', async () => {
    const { onClose } = renderModal()
    await userEvent.click(screen.getByRole('button', { name: /start run/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('calls onClose when Cancel is clicked', async () => {
    const { onClose } = renderModal()
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const { onClose } = renderModal()
    await userEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test — expect module-not-found failure**

Run: `pnpm --filter llm-ui test src/test/components/RunModal.test.tsx`

Expected: `Cannot find module '@/components/RunModal'`.

- [ ] **Step 3: Create `src/components/RunModal.tsx`**

```typescript
// src/components/RunModal.tsx
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import type { TrainingModel } from '@/types'
import { triggerRun } from '@/api/runs'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Combobox } from './ui/combobox'

const REMOTE_BACKEND_OPTIONS = ['local', 'kaggle', 'ssh', 'colab'] as const

const BASE_MODEL_OPTIONS = [
  'HuggingFaceTB/SmolLM2-360M',
  'HuggingFaceTB/SmolLM2-1.7B',
  'Qwen/Qwen2.5-0.5B',
  'Qwen/Qwen2.5-1.5B',
  'microsoft/phi-2',
  'google/gemma-2-2b',
  'meta-llama/Llama-3.2-1B',
  'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
]

const schema = z.object({
  epochs:         z.coerce.number().int().positive().nullable(),
  patience:       z.coerce.number().int().positive().nullable(),
  warmup_ratio:   z.coerce.number().min(0).max(1).nullable(),
  remote_backend: z.string().nullable(),
  base_model:     z.string().nullable(),
  skip_generate:  z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface RunModalProps {
  model: TrainingModel
  onClose: () => void
}

export function RunModal({ model, onClose }: RunModalProps) {
  const queryClient = useQueryClient()

  const { register, handleSubmit, control } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      epochs:         model.epochs,
      patience:       model.patience,
      warmup_ratio:   model.warmup_ratio,
      remote_backend: model.remote_backend,
      base_model:     model.base_model,
      skip_generate:  model.skip_generate,
    },
  })

  const mutation = useMutation({
    mutationFn: triggerRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] })
      onClose()
    },
  })

  function onSubmit(values: FormValues) {
    const req = { model_id: model.id }
    if (values.epochs         != null) Object.assign(req, { epochs:         values.epochs })
    if (values.patience        != null) Object.assign(req, { patience:       values.patience })
    if (values.warmup_ratio    != null) Object.assign(req, { warmup_ratio:   values.warmup_ratio })
    if (values.remote_backend  != null) Object.assign(req, { remote_backend: values.remote_backend })
    if (values.base_model      != null) Object.assign(req, { base_model:     values.base_model })
    if (values.skip_generate   != null) Object.assign(req, { skip_generate:  values.skip_generate })
    mutation.mutate(req)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-modal-title"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 id="run-modal-title" className="text-base font-semibold">
            Trigger run — {model.name}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Override config values for this run only. Leave fields as-is to use model defaults.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="epochs">Epochs</Label>
              <Input id="epochs" type="number" {...register('epochs')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="patience">Patience</Label>
              <Input id="patience" type="number" {...register('patience')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="warmup_ratio">Warmup ratio</Label>
              <Input id="warmup_ratio" type="number" step="0.01" {...register('warmup_ratio')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Remote backend</Label>
              <Controller
                name="remote_backend"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger onBlur={field.onBlur} ref={field.ref}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REMOTE_BACKEND_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Base model</Label>
            <Controller
              name="base_model"
              control={control}
              render={({ field }) => (
                <Combobox
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={BASE_MODEL_OPTIONS}
                />
              )}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="modal_skip_generate"
              {...register('skip_generate')}
              className="h-4 w-4"
            />
            <Label htmlFor="modal_skip_generate">Skip dataset generation</Label>
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600">Failed to start run. Please try again.</p>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Starting…' : '▶ Start run'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test — expect all pass**

Run: `pnpm --filter llm-ui test src/test/components/RunModal.test.tsx`

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/RunModal.tsx src/test/components/RunModal.test.tsx
git commit -m "feat(llm-ui): add RunModal component for run parameter overrides"
```

---

## Task 7: Rewrite `ModelsListPage`

**Files:**
- Modify: `src/pages/ModelsListPage.tsx`
- Modify: `src/test/pages/ModelsListPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/test/pages/ModelsListPage.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ModelsListPage } from '@/pages/ModelsListPage'
import { MODEL_FIXTURE } from '../msw/fixtures'

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ModelsListPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ModelsListPage', () => {
  it('renders model name in table after loading', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(MODEL_FIXTURE.name)).toBeInTheDocument())
  })

  it('renders New model link to /models/new', async () => {
    renderPage()
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /new model/i })
      expect(link).toHaveAttribute('href', '/models/new')
    })
  })

  it('renders search input', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search/i })).toBeInTheDocument())
  })

  it('hides rows that do not match the search query', async () => {
    renderPage()
    await waitFor(() => screen.getByText(MODEL_FIXTURE.name))
    await userEvent.type(screen.getByRole('textbox', { name: /search/i }), 'zzznomatch')
    expect(screen.queryByText(MODEL_FIXTURE.name)).not.toBeInTheDocument()
  })

  it('opens RunModal when Run button is clicked', async () => {
    renderPage()
    await waitFor(() => screen.getByText(MODEL_FIXTURE.name))
    await userEvent.click(
      screen.getByRole('button', { name: new RegExp(`trigger run for ${MODEL_FIXTURE.name}`, 'i') })
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect failures**

Run: `pnpm --filter llm-ui test src/test/pages/ModelsListPage.test.tsx`

Expected: "search input" and "opens RunModal" tests fail (not present in current card grid).

- [ ] **Step 3: Replace `src/pages/ModelsListPage.tsx`**

```typescript
// src/pages/ModelsListPage.tsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { deleteModel, listModels } from '@/api/models'
import { RunModal } from '@/components/RunModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { TrainingModel } from '@/types'

export function ModelsListPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [runTarget, setRunTarget] = useState<TrainingModel | null>(null)

  const { data: models = [], isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: listModels,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteModel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['models'] }),
  })

  const filtered = models.filter(m => {
    const q = search.toLowerCase()
    return (
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.base_model.toLowerCase().includes(q)
    )
  })

  if (isLoading) return <p className="p-8 text-gray-500">Loading…</p>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Training Models</h1>
        <Button asChild>
          <Link to="/models/new">
            <Plus className="h-4 w-4 mr-1" />New model
          </Link>
        </Button>
      </div>

      {models.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="mb-4">No models yet.</p>
          <Button asChild variant="outline">
            <Link to="/models/new">Create your first model</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <Input
              className="max-w-xs"
              placeholder="Search by name, description, base model…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search models"
            />
          </div>

          <div className="rounded-md border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 font-semibold">Base model</th>
                  <th className="text-left px-4 py-3 font-semibold">Backend</th>
                  <th className="text-left px-4 py-3 font-semibold">Epochs</th>
                  <th className="text-left px-4 py-3 font-semibold">Active</th>
                  <th className="text-left px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      No models match "{search}"
                    </td>
                  </tr>
                ) : (
                  filtered.map(model => (
                    <tr key={model.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{model.name}</div>
                        {model.description && (
                          <div className="text-xs text-gray-400 mt-0.5">{model.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700 text-xs">{model.base_model}</td>
                      <td className="px-4 py-3 text-gray-700">{model.remote_backend}</td>
                      <td className="px-4 py-3 text-gray-700">{model.epochs}</td>
                      <td className="px-4 py-3">
                        {model.is_active ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">
                            Active
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => setRunTarget(model)}
                            aria-label={`Trigger run for ${model.name}`}
                          >
                            <Play className="h-3.5 w-3.5 mr-1" />Run
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <Link
                              to={`/models/${model.id}/edit`}
                              aria-label={`Edit ${model.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteMutation.mutate(model.id)}
                            disabled={
                              deleteMutation.isPending &&
                              deleteMutation.variables === model.id
                            }
                            aria-label={`Delete ${model.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {runTarget && (
        <RunModal model={runTarget} onClose={() => setRunTarget(null)} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test — expect all pass**

Run: `pnpm --filter llm-ui test src/test/pages/ModelsListPage.test.tsx`

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ModelsListPage.tsx src/test/pages/ModelsListPage.test.tsx
git commit -m "feat(llm-ui): rewrite ModelsListPage as searchable table with RunModal"
```

---

## Task 8: Update `RunDetailPage`

**Files:**
- Modify: `src/pages/RunDetailPage.tsx`
- Modify: `src/test/pages/RunDetailPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/test/pages/RunDetailPage.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RunDetailPage } from '@/pages/RunDetailPage'
import { RUN_FIXTURE } from '../msw/fixtures'

function renderPage(runId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/runs/${runId}`]}>
        <Routes>
          <Route path="/runs/:runId" element={<RunDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RunDetailPage', () => {
  it('renders workflow_id and status badge', async () => {
    renderPage(RUN_FIXTURE.id)
    await waitFor(() => {
      expect(screen.getByText(RUN_FIXTURE.workflow_id)).toBeInTheDocument()
      expect(screen.getByText('Running')).toBeInTheDocument()
    })
  })

  it('shows not found for unknown run id', async () => {
    renderPage('does-not-exist')
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test — expect failures**

Run: `pnpm --filter llm-ui test src/test/pages/RunDetailPage.test.tsx`

Expected: fails — param is `workflowId` not `runId`, and `RUN_FIXTURE.id` won't match the old handler.

- [ ] **Step 3: Replace `src/pages/RunDetailPage.tsx`**

```typescript
// src/pages/RunDetailPage.tsx
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getRun, isRunActive } from '@/api/runs'
import { RunStatusBadge } from '@/components/RunStatusBadge'
import { PipelineStages } from '@/components/PipelineStages'
import type { PipelineStage, StageStatus } from '@/components/PipelineStages'
import type { RunStatus } from '@/types'

function buildStages(status: RunStatus): PipelineStage[] {
  const stageNames = ['Generate', 'Train', 'Evaluate', 'Export']
  const activeMap: Partial<Record<RunStatus, number>> = {
    generating: 0,
    training:   1,
    evaluating: 2,
    exporting:  3,
  }

  if (status === 'completed') {
    return stageNames.map(name => ({ name, status: 'completed' as StageStatus }))
  }
  if (status === 'failed') {
    return stageNames.map((name, i): PipelineStage => ({
      name,
      status: i === 0 ? 'failed' : 'pending',
    }))
  }

  const activeIdx = activeMap[status] ?? -1
  return stageNames.map((name, i): PipelineStage => ({
    name,
    status: i < activeIdx ? 'completed' : i === activeIdx ? 'active' : 'pending',
  }))
}

export function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>()

  const { data: run, isLoading } = useQuery({
    queryKey: ['runs', runId],
    queryFn: () => getRun(runId!),
    refetchInterval: (query) => {
      const data = query.state.data
      return data && isRunActive(data) ? 5000 : false
    },
  })

  if (isLoading) return <p className="p-8 text-gray-500">Loading…</p>
  if (!run) return <p className="p-8 text-red-600">Run not found.</p>

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold font-mono truncate">{run.workflow_id}</h1>
        <RunStatusBadge status={run.status} />
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Pipeline stages</h2>
        <PipelineStages stages={buildStages(run.status)} />
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <dt className="text-gray-500">Run ID</dt>
        <dd className="font-mono text-gray-900">{run.id}</dd>
        <dt className="text-gray-500">Started</dt>
        <dd className="text-gray-900">{new Date(run.created_at).toLocaleString()}</dd>
        <dt className="text-gray-500">Updated</dt>
        <dd className="text-gray-900">{new Date(run.updated_at).toLocaleString()}</dd>
        {run.progress != null && (
          <>
            <dt className="text-gray-500">Progress</dt>
            <dd className="text-gray-900">{Math.round(run.progress * 100)}%</dd>
          </>
        )}
        {run.eval_valid_pct != null && (
          <>
            <dt className="text-gray-500">Eval valid</dt>
            <dd className="text-gray-900">{Math.round(run.eval_valid_pct * 100)}%</dd>
          </>
        )}
        {run.progress_detail && (
          <>
            <dt className="text-gray-500">Detail</dt>
            <dd className="text-gray-900">{run.progress_detail}</dd>
          </>
        )}
      </dl>
    </div>
  )
}
```

- [ ] **Step 4: Run test — expect all pass**

Run: `pnpm --filter llm-ui test src/test/pages/RunDetailPage.test.tsx`

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/RunDetailPage.tsx src/test/pages/RunDetailPage.test.tsx
git commit -m "feat(llm-ui): update RunDetailPage for new RunRecord schema and stage mapping"
```

---

## Task 9: Update `RunsListPage`, `ModelDetailPage`, and `App.tsx`

**Files:**
- Modify: `src/pages/RunsListPage.tsx`
- Modify: `src/pages/ModelDetailPage.tsx`
- Modify: `src/App.tsx`

No new tests needed — existing rendering behaviour is preserved; changes are field renames.

- [ ] **Step 1: Replace `src/pages/RunsListPage.tsx`**

```typescript
// src/pages/RunsListPage.tsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listRuns } from '@/api/runs'
import { RunStatusBadge } from '@/components/RunStatusBadge'

export function RunsListPage() {
  const { data: runs = [], isLoading } = useQuery({ queryKey: ['runs'], queryFn: listRuns })

  if (isLoading) return <p className="p-8 text-gray-500">Loading…</p>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Training Runs</h1>
      {runs.length === 0 ? (
        <p className="text-gray-500">No runs yet. Trigger one from a model.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {runs.map(run => (
            <Link
              key={run.id}
              to={`/runs/${run.id}`}
              className="flex items-center justify-between rounded-md border p-4 text-gray-900 hover:bg-gray-50"
            >
              <div>
                <p className="font-mono text-sm font-medium text-gray-900">{run.workflow_id}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(run.created_at).toLocaleString()}
                </p>
              </div>
              <RunStatusBadge status={run.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `src/pages/ModelDetailPage.tsx`**

Three changes: (a) import `triggerRun` from `@/api/runs`, (b) update trigger call to pass `{ model_id: id! }`, (c) filter runs by `model_id`, (d) link to `run.id`.

```typescript
// src/pages/ModelDetailPage.tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Play, Pencil, Trash2 } from 'lucide-react'
import { deleteModel, getModel } from '@/api/models'
import { listRuns, triggerRun } from '@/api/runs'
import { RunStatusBadge } from '@/components/RunStatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ModelDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: model, isLoading } = useQuery({
    queryKey: ['models', id],
    queryFn: () => getModel(id!),
  })

  const { data: allRuns = [] } = useQuery({ queryKey: ['runs'], queryFn: listRuns })
  const runs = allRuns.filter(r => r.model_id === model?.id)

  const triggerMutation = useMutation({
    mutationFn: () => triggerRun({ model_id: id! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runs'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteModel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] })
      navigate('/models')
    },
  })

  if (isLoading || !model) return <p className="p-8 text-gray-500">Loading…</p>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{model.name}</h1>
          {model.description && <p className="text-gray-500 mt-1">{model.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => triggerMutation.mutate()} disabled={triggerMutation.isPending}>
            <Play className="h-4 w-4 mr-1" />
            {triggerMutation.isPending ? 'Starting…' : 'Run'}
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/models/${id}/edit`}><Pencil className="h-4 w-4 mr-1" />Edit</Link>
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ['Base model',     model.base_model],
              ['Training data',  model.train_data],
              ['Eval data',      model.eval_data],
              ['Epochs',         model.epochs],
              ['Patience',       model.patience],
              ['Warmup ratio',   model.warmup_ratio],
              ['Remote backend', model.remote_backend],
              ['Skip generate',  model.skip_generate ? 'Yes' : 'No'],
              ['GGUF path',      model.gguf_path || '—'],
            ].map(([key, val]) => (
              <div key={String(key)} className="contents">
                <dt className="text-gray-500">{key}</dt>
                <dd className="font-medium text-gray-900">{String(val)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <h2 className="text-lg font-medium mb-3">Recent runs</h2>
      {runs.length === 0 ? (
        <p className="text-gray-500 text-sm">No runs yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {runs.map(run => (
            <Link
              key={run.id}
              to={`/runs/${run.id}`}
              className="flex items-center justify-between rounded-md border p-3 text-gray-900 hover:bg-gray-50"
            >
              <span className="font-mono text-sm truncate">{run.workflow_id}</span>
              <RunStatusBadge status={run.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update the runs route param in `src/App.tsx`**

Change `:workflowId` to `:runId` on the runs detail route:

```typescript
// src/App.tsx — change only this one line:
<Route path="/runs/:runId" element={<RunDetailPage />} />
```

The full file should look like:

```typescript
// src/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { ModelsListPage } from './pages/ModelsListPage'
import { ModelFormPage } from './pages/ModelFormPage'
import { ModelDetailPage } from './pages/ModelDetailPage'
import { RunsListPage } from './pages/RunsListPage'
import { RunDetailPage } from './pages/RunDetailPage'

const queryClient = new QueryClient()

function Nav() {
  return (
    <nav className="border-b bg-white px-8 py-3 flex gap-6 text-sm font-medium">
      <Link to="/models" className="text-gray-700 hover:text-gray-900">Models</Link>
      <Link to="/runs" className="text-gray-700 hover:text-gray-900">Runs</Link>
    </nav>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <Nav />
          <Routes>
            <Route path="/" element={<Navigate to="/models" replace />} />
            <Route path="/models" element={<ModelsListPage />} />
            <Route path="/models/new" element={<ModelFormPage />} />
            <Route path="/models/:id" element={<ModelDetailPage />} />
            <Route path="/models/:id/edit" element={<ModelFormPage />} />
            <Route path="/runs" element={<RunsListPage />} />
            <Route path="/runs/:runId" element={<RunDetailPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 4: Run the full test suite — expect all pass**

Run: `pnpm --filter llm-ui test`

Expected: all tests pass with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/RunsListPage.tsx src/pages/ModelDetailPage.tsx src/App.tsx
git commit -m "feat(llm-ui): update remaining pages and routes for new API schema"
```

---

## Task 10: Final verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm --filter llm-ui test`

Expected: all tests pass.

- [ ] **Step 2: TypeScript check**

Run: `pnpm --filter llm-ui exec tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Dev server smoke test**

Run: `pnpm --filter llm-ui dev`

Open `http://localhost:5173`:
- `/models` — table renders, search filters rows, Run button opens modal with pre-filled fields, Edit navigates to form
- Click ▶ Start run in modal — modal closes (or shows error if backend is not running, which is fine)
- `/runs` — list renders with `created_at` timestamps
- `/runs/<id>` — detail page shows pipeline stages, run fields

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(llm-ui): models CRUD table with search and run parameter overrides"
```
