import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { TokenSync } from '@/components/TokenSync'

const { mockSetTokenGetter, mockGetToken } = vi.hoisted(() => ({
  mockSetTokenGetter: vi.fn(),
  mockGetToken: vi.fn().mockResolvedValue('test-access-token'),
}))

vi.mock('@/api/client', () => ({
  setTokenGetter: mockSetTokenGetter,
  apiClient: {},
}))

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isAuthenticated: true,
    getAccessTokenSilently: mockGetToken,
  }),
}))

describe('TokenSync', () => {
  beforeEach(() => {
    mockSetTokenGetter.mockClear()
    mockGetToken.mockClear()
  })

  it('calls setTokenGetter when user is authenticated', () => {
    render(<TokenSync />)
    expect(mockSetTokenGetter).toHaveBeenCalledOnce()
  })

  it('registered getter resolves to an Auth0 access token', async () => {
    render(<TokenSync />)
    const getter: () => Promise<string> = mockSetTokenGetter.mock.calls[0][0]
    const token = await getter()
    expect(token).toBe('test-access-token')
  })
})
