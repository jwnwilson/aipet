import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ModelsListPage } from '@/pages/ModelsListPage'
import { MODEL_FIXTURE } from '../msw/fixtures'

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ModelsListPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ModelsListPage', () => {
  it('renders model name after loading', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(MODEL_FIXTURE.name)).toBeInTheDocument())
  })

  it('renders create button linking to /models/new', async () => {
    renderPage()
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /new model/i })
      expect(link).toHaveAttribute('href', '/models/new')
    })
  })
})
