import type { Run } from '@/types'
import { apiClient } from './client'

export async function listRuns(): Promise<Run[]> {
  const { data } = await apiClient.get<Run[]>('/api/runs')
  return data
}

export async function getRun(workflowId: string): Promise<Run> {
  const { data } = await apiClient.get<Run>(`/api/runs/${workflowId}`)
  return data
}

export function isRunActive(run: Run): boolean {
  return run.status === 'RUNNING'
}
