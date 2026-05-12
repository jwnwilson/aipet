import type { RunStatus } from '@/types'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<RunStatus, { label: string; className: string }> = {
  RUNNING: { label: 'Running', className: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'Completed', className: 'bg-green-100 text-green-800' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-800' },
  TIMED_OUT: { label: 'Timed Out', className: 'bg-orange-100 text-orange-800' },
  CANCELED: { label: 'Canceled', className: 'bg-gray-100 text-gray-600' },
  UNKNOWN: { label: 'Unknown', className: 'bg-gray-100 text-gray-500' },
}

interface RunStatusBadgeProps {
  status: RunStatus
  className?: string
}

export function RunStatusBadge({ status, className }: RunStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.UNKNOWN
  return (
    <span
      data-testid="run-status-badge"
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className, className)}
    >
      {config.label}
    </span>
  )
}
