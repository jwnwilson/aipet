import { describe, it, expect, vi, afterEach } from 'vitest'
import { setTokenGetter, apiClient } from '@/api/client'

afterEach(() => {
  // Reset to no token getter between tests
  setTokenGetter(null as unknown as () => Promise<string>)
})

describe('setTokenGetter', () => {
  it('is exported from api/client', () => {
    expect(typeof setTokenGetter).toBe('function')
  })
})
