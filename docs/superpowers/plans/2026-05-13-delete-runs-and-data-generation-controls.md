# Delete Runs & Data Generation Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a delete button to the run detail page and add `num_train_samples` / `num_eval_samples` fields to the run trigger modal.

**Architecture:** Three layers change in lockstep — types define the contract, the API layer implements it, and UI components consume it. All tests use Vitest + MSW (already wired in `src/test/setup.ts`). TDD: write each failing test before adding implementation code.

**Tech Stack:** React 19, TypeScript, TanStack Query, react-hook-form + Zod, MSW v2, Vitest + @testing-library/react.

---

## File Map

| File | Change |
|---|---|
| `apps/llm-ui/src/types/index.ts` | Add `num_train_samples?` and `num_eval_samples?` to `TriggerRunRequest` |
| `apps/llm-ui/src/api/runs.ts` | Add `deleteRun(id: string): Promise<void>` |
| `apps/llm-ui/src/test/msw/handlers.ts` | Add `DELETE /api/runs/:id` mock handler (204) |
| `apps/llm-ui/src/test/api/runs.test.ts` | Add `deleteRun` tests |
| `apps/llm-ui/src/pages/RunDetailPage.tsx` | Add delete button + confirm dialog + post-delete navigation |
| `apps/llm-ui/src/test/pages/RunDetailPage.test.tsx` | Add delete button tests |
| `apps/llm-ui/src/components/RunModal.tsx` | Add `num_train_samples` and `num_eval_samples` fields; disable when `skip_generate` |
| `apps/llm-ui/src/test/components/RunModal.test.tsx` | Add sample count field tests |

---

## Task 1: Types + API + MSW handler

**Files:**
- Modify: `apps/llm-ui/src/types/index.ts`
- Modify: `apps/llm-ui/src/api/runs.ts`
- Modify: `apps/llm-ui/src/test/msw/handlers.ts`
- Modify: `apps/llm-ui/src/test/api/runs.test.ts`

- [ ] **Step 1: Add fields to TriggerRunRequest in `src/types/index.ts`**

Replace the `TriggerRunRequest` interface (lines 45–53):

```typescript
export interface TriggerRunRequest {
  model_id: string
  epochs?: number | null
  patience?: number | null
  warmup_ratio?: number | null
  skip_generate?: boolean | null
  remote_backend?: string | null
  base_model?: string | null
  num_train_samples?: number | null
  num_eval_samples?: number | null
}
```

- [ ] **Step 2: Add `deleteRun` to `src/api/runs.ts`**

Add after `triggerRun`:

```typescript
export async function deleteRun(id: string): Promise<void> {
  await apiClient.delete(`/api/runs/${id}`)
}
```

Also add `deleteRun` to the import line in runs.test.ts (next step).

- [ ] **Step 3: Add DELETE /api/runs/:id handler to `src/test/msw/handlers.ts`**

Add after the `http.get('/api/runs/:id', ...)` handler:

```typescript
  http.delete(`${BASE}/api/runs/:id`, ({ params }) => {
    if (params.id === RUN_FIXTURE.id) return new HttpResponse(null, { status: 204 })
    return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
  }),
```

- [ ] **Step 4: Write failing tests for `deleteRun` in `src/test/api/runs.test.ts`**

Update the import line (line 1):
```typescript
import { listRuns, getRun, isRunActive, triggerRun, deleteRun } from '@/api/runs'
```

Add this describe block at the end of the file:

```typescript
describe('deleteRun', () => {
  it('resolves for an existing run id', async () => {
    await expect(deleteRun(RUN_FIXTURE.id)).resolves.toBeUndefined()
  })

  it('throws for an unknown run id', async () => {
    await expect(deleteRun('does-not-exist')).rejects.toThrow()
  })
})
```

- [ ] **Step 5: Run the tests — expect them to fail (deleteRun not yet imported correctly, but function exists)**

```bash
cd apps/llm-ui && pnpm test --run src/test/api/runs.test.ts
```

Expected: all `deleteRun` tests pass (the function exists and the MSW handler is wired). If any fail, check the handler is in the `handlers` array above the file's closing bracket.

- [ ] **Step 6: Commit**

```bash
git add apps/llm-ui/src/types/index.ts apps/llm-ui/src/api/runs.ts apps/llm-ui/src/test/msw/handlers.ts apps/llm-ui/src/test/api/runs.test.ts
git commit -m "feat(llm-ui): add deleteRun API and num_train/eval_samples to TriggerRunRequest"
```

---

## Task 2: Delete button on RunDetailPage

**Files:**
- Modify: `apps/llm-ui/src/test/pages/RunDetailPage.test.tsx`
- Modify: `apps/llm-ui/src/pages/RunDetailPage.tsx`

- [ ] **Step 1: Write failing tests in `src/test/pages/RunDetailPage.test.tsx`**

Replace the entire file with:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RunDetailPage } from '@/pages/RunDetailPage'
import { RUN_FIXTURE } from '../msw/fixtures'

function renderPage(runId: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/runs/${runId}`]}>
        <Routes>
          <Route path="/runs/:runId" element={<RunDetailPage />} />
          <Route path="/runs" element={<div>runs-list</div>} />
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

  it('renders a Delete run button', async () => {
    renderPage(RUN_FIXTURE.id)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /delete run/i })).toBeInTheDocument()
    )
  })

  it('navigates to /runs after confirming delete', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage(RUN_FIXTURE.id)
    await waitFor(() => screen.getByRole('button', { name: /delete run/i }))
    await userEvent.click(screen.getByRole('button', { name: /delete run/i }))
    await waitFor(() => expect(screen.getByText('runs-list')).toBeInTheDocument())
  })

  it('stays on the page when delete is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage(RUN_FIXTURE.id)
    await waitFor(() => screen.getByRole('button', { name: /delete run/i }))
    await userEvent.click(screen.getByRole('button', { name: /delete run/i }))
    expect(screen.queryByText('runs-list')).not.toBeInTheDocument()
    expect(screen.getByText(RUN_FIXTURE.workflow_id)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/llm-ui && pnpm test --run src/test/pages/RunDetailPage.test.tsx
```

Expected: "renders a Delete run button", "navigates to /runs", and "stays on the page" tests fail with "Unable to find role 'button' with name /delete run/i".

- [ ] **Step 3: Implement delete button in `src/pages/RunDetailPage.tsx`**

Replace the entire file with:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteRun, getRun, isRunActive } from '@/api/runs'
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
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: run, isLoading } = useQuery({
    queryKey: ['runs', runId],
    queryFn: () => getRun(runId!),
    refetchInterval: (query) => {
      const data = query.state.data
      return data && isRunActive(data) ? 5000 : false
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteRun(run!.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['runs', runId] })
      navigate('/runs')
    },
  })

  function handleDelete() {
    if (window.confirm('Delete this run? This cannot be undone.')) {
      deleteMutation.mutate()
    }
  }

  if (isLoading) return <p className="p-8 text-gray-500">Loading…</p>
  if (!run) return <p className="p-8 text-red-600">Run not found.</p>

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-xl font-semibold font-mono truncate">{run.workflow_id}</h1>
        <RunStatusBadge status={run.status} />
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="ml-auto text-sm text-red-600 border border-red-300 rounded px-3 py-1 hover:bg-red-50 disabled:opacity-50"
        >
          {deleteMutation.isPending ? 'Deleting…' : 'Delete run'}
        </button>
      </div>

      {deleteMutation.isError && (
        <p className="text-sm text-red-600 mb-4">Failed to delete run. Please try again.</p>
      )}

      <div className="mb-8 mt-6">
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/llm-ui && pnpm test --run src/test/pages/RunDetailPage.test.tsx
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/llm-ui/src/pages/RunDetailPage.tsx apps/llm-ui/src/test/pages/RunDetailPage.test.tsx
git commit -m "feat(llm-ui): add delete run button to RunDetailPage"
```

---

## Task 3: Sample count fields in RunModal

**Files:**
- Modify: `apps/llm-ui/src/test/components/RunModal.test.tsx`
- Modify: `apps/llm-ui/src/components/RunModal.tsx`

- [ ] **Step 1: Write failing tests in `src/test/components/RunModal.test.tsx`**

Replace the entire file with:

```typescript
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

  it('renders num_train_samples and num_eval_samples fields', () => {
    renderModal()
    expect(screen.getByLabelText(/train samples/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/eval samples/i)).toBeInTheDocument()
  })

  it('num_train_samples and num_eval_samples start enabled when skip_generate is false', () => {
    renderModal()
    expect(screen.getByLabelText(/train samples/i)).not.toBeDisabled()
    expect(screen.getByLabelText(/eval samples/i)).not.toBeDisabled()
  })

  it('disables num_train_samples and num_eval_samples when skip_generate is checked', async () => {
    renderModal()
    const skipCheckbox = screen.getByLabelText(/skip dataset generation/i)
    await userEvent.click(skipCheckbox)
    expect(screen.getByLabelText(/train samples/i)).toBeDisabled()
    expect(screen.getByLabelText(/eval samples/i)).toBeDisabled()
  })

  it('re-enables num_train_samples and num_eval_samples when skip_generate is unchecked', async () => {
    renderModal()
    const skipCheckbox = screen.getByLabelText(/skip dataset generation/i)
    await userEvent.click(skipCheckbox) // check
    await userEvent.click(skipCheckbox) // uncheck
    expect(screen.getByLabelText(/train samples/i)).not.toBeDisabled()
    expect(screen.getByLabelText(/eval samples/i)).not.toBeDisabled()
  })
})
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
cd apps/llm-ui && pnpm test --run src/test/components/RunModal.test.tsx
```

Expected: the 4 new sample count tests fail with "Unable to find label with text /train samples/i".

- [ ] **Step 3: Implement sample count fields in `src/components/RunModal.tsx`**

Replace the entire file with:

```typescript
import { useForm, Controller } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
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
  epochs:             z.coerce.number().int().positive().nullable(),
  patience:           z.coerce.number().int().positive().nullable(),
  warmup_ratio:       z.coerce.number().min(0).max(1).nullable(),
  remote_backend:     z.string().nullable(),
  base_model:         z.string().nullable(),
  skip_generate:      z.boolean(),
  num_train_samples:  z.coerce.number().int().positive().nullable(),
  num_eval_samples:   z.coerce.number().int().positive().nullable(),
})

type FormValues = z.infer<typeof schema>

interface RunModalProps {
  model: TrainingModel
  onClose: () => void
}

export function RunModal({ model, onClose }: RunModalProps) {
  const queryClient = useQueryClient()

  const { register, handleSubmit, control, watch } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      epochs:            model.epochs,
      patience:          model.patience,
      warmup_ratio:      model.warmup_ratio,
      remote_backend:    model.remote_backend,
      base_model:        model.base_model,
      skip_generate:     model.skip_generate,
      num_train_samples: null,
      num_eval_samples:  null,
    },
  })

  const skipGenerate = watch('skip_generate')

  const mutation = useMutation({
    mutationFn: triggerRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] })
      onClose()
    },
  })

  function onSubmit(values: FormValues) {
    mutation.mutate({
      model_id: model.id,
      ...(values.epochs             != null && { epochs:            values.epochs }),
      ...(values.patience           != null && { patience:          values.patience }),
      ...(values.warmup_ratio       != null && { warmup_ratio:      values.warmup_ratio }),
      ...(values.remote_backend     != null && { remote_backend:    values.remote_backend }),
      ...(values.base_model         != null && { base_model:        values.base_model }),
      ...(values.num_train_samples  != null && { num_train_samples: values.num_train_samples }),
      ...(values.num_eval_samples   != null && { num_eval_samples:  values.num_eval_samples }),
      skip_generate: values.skip_generate,
    })
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="num_train_samples">Train samples</Label>
              <Input
                id="num_train_samples"
                type="number"
                {...register('num_train_samples')}
                disabled={skipGenerate}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="num_eval_samples">Eval samples</Label>
              <Input
                id="num_eval_samples"
                type="number"
                {...register('num_eval_samples')}
                disabled={skipGenerate}
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

- [ ] **Step 4: Run all RunModal tests to verify they pass**

```bash
cd apps/llm-ui && pnpm test --run src/test/components/RunModal.test.tsx
```

Expected: all 8 tests pass.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
cd apps/llm-ui && pnpm test --run
```

Expected: all tests pass with no failures.

- [ ] **Step 6: Commit**

```bash
git add apps/llm-ui/src/components/RunModal.tsx apps/llm-ui/src/test/components/RunModal.test.tsx
git commit -m "feat(llm-ui): add num_train_samples and num_eval_samples to RunModal"
```
