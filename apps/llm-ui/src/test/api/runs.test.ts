import { describe, it, expect } from 'vitest'
import { listRuns, getRun, isRunActive } from '@/api/runs'
import { RUN_FIXTURE } from '../msw/fixtures'

describe('listRuns', () => {
  it('returns array of runs', async () => {
    const runs = await listRuns()
    expect(Array.isArray(runs)).toBe(true)
    expect(runs[0].workflow_id).toBe(RUN_FIXTURE.workflow_id)
  })
})

describe('getRun', () => {
  it('returns run by workflow id', async () => {
    const run = await getRun(RUN_FIXTURE.workflow_id)
    expect(run.status).toBe('RUNNING')
  })

  it('throws on unknown workflow id', async () => {
    await expect(getRun('does-not-exist')).rejects.toThrow()
  })
})

describe('isRunActive', () => {
  it('returns true for RUNNING status', () => {
    expect(isRunActive({ ...RUN_FIXTURE, status: 'RUNNING' })).toBe(true)
  })

  it('returns false for COMPLETED status', () => {
    expect(isRunActive({ ...RUN_FIXTURE, status: 'COMPLETED' })).toBe(false)
  })

  it('returns false for FAILED status', () => {
    expect(isRunActive({ ...RUN_FIXTURE, status: 'FAILED' })).toBe(false)
  })
})
