import { http, HttpResponse } from 'msw'
import type { TrainingModel, TrainingModelConfig } from '@/types'
import { MODEL_FIXTURE, RUN_FIXTURE } from './fixtures'

const BASE = 'http://localhost:8000'

let models: TrainingModel[] = [MODEL_FIXTURE]

export const handlers = [
  http.get(`${BASE}/api/models`, () => {
    return HttpResponse.json(models)
  }),

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

  http.post(`${BASE}/api/models/:id/trigger`, ({ params }) => {
    const model = models.find(m => m.id === params.id)
    if (!model) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    return HttpResponse.json({ workflow_id: 'training-test-abc12345' }, { status: 202 })
  }),

  http.get(`${BASE}/api/runs`, () => {
    return HttpResponse.json([RUN_FIXTURE])
  }),

  http.get(`${BASE}/api/runs/:workflowId`, ({ params }) => {
    if (params.workflowId === RUN_FIXTURE.workflow_id) {
      return HttpResponse.json(RUN_FIXTURE)
    }
    return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
  }),
]

export function resetHandlerState() {
  models = [MODEL_FIXTURE]
}
