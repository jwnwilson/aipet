import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RunDetailPage } from '@/pages/RunDetailPage'
import { RUN_FIXTURE } from '../msw/fixtures'

function renderPage(workflowId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/runs/${workflowId}`]}>
        <Routes>
          <Route path="/runs/:workflowId" element={<RunDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RunDetailPage', () => {
  it('renders workflow id and status badge', async () => {
    renderPage(RUN_FIXTURE.workflow_id)
    await waitFor(() => {
      expect(screen.getByText(RUN_FIXTURE.workflow_id)).toBeInTheDocument()
      expect(screen.getByText('Running')).toBeInTheDocument()
    })
  })

  it('shows not found message for unknown workflow id', async () => {
    renderPage('does-not-exist')
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument())
  })
})
