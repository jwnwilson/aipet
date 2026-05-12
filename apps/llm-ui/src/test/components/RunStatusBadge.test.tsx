import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunStatusBadge } from '@/components/RunStatusBadge'
import type { RunStatus } from '@/types'

const cases: Array<[RunStatus, string]> = [
  ['RUNNING', 'Running'],
  ['COMPLETED', 'Completed'],
  ['FAILED', 'Failed'],
  ['TIMED_OUT', 'Timed Out'],
  ['CANCELED', 'Canceled'],
  ['UNKNOWN', 'Unknown'],
]

describe('RunStatusBadge', () => {
  it.each(cases)('renders label "%s" for status %s', (status, label) => {
    render(<RunStatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('applies correct colour class for RUNNING', () => {
    render(<RunStatusBadge status="RUNNING" />)
    expect(screen.getByTestId('run-status-badge')).toHaveClass('bg-blue-100')
  })

  it('applies correct colour class for FAILED', () => {
    render(<RunStatusBadge status="FAILED" />)
    expect(screen.getByTestId('run-status-badge')).toHaveClass('bg-red-100')
  })

  it('applies correct colour class for COMPLETED', () => {
    render(<RunStatusBadge status="COMPLETED" />)
    expect(screen.getByTestId('run-status-badge')).toHaveClass('bg-green-100')
  })
})
