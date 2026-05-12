import type { TrainingModel, Run } from '@/types'

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
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

export const RUN_FIXTURE: Run = {
  workflow_id: 'training-test-model-abc12345',
  run_id: 'run-uuid',
  status: 'RUNNING',
  start_time: '2024-01-01T00:00:00Z',
  close_time: null,
}
