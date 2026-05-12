import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getRun, isRunActive } from '@/api/runs'
import { RunStatusBadge } from '@/components/RunStatusBadge'
import { PipelineStages } from '@/components/PipelineStages'
import type { PipelineStage } from '@/components/PipelineStages'
import type { RunStatus } from '@/types'

function buildStages(status: RunStatus): PipelineStage[] {
  const stages: Array<PipelineStage['name']> = ['Generate', 'Train', 'Evaluate', 'Export']
  const order: Record<string, number> = { Generate: 0, Train: 1, Evaluate: 2, Export: 3 }

  if (status === 'FAILED') {
    return stages.map(name => ({ name, status: order[name] < 2 ? 'completed' : name === 'Train' ? 'failed' : 'pending' }))
  }
  if (status === 'COMPLETED') {
    return stages.map(name => ({ name, status: 'completed' as const }))
  }
  if (status === 'RUNNING') {
    return stages.map((name, i) => ({
      name,
      status: i === 0 ? 'active' : 'pending',
    } as PipelineStage))
  }
  return stages.map(name => ({ name, status: 'pending' as const }))
}

export function RunDetailPage() {
  const { workflowId } = useParams<{ workflowId: string }>()

  const { data: run, isLoading } = useQuery({
    queryKey: ['runs', workflowId],
    queryFn: () => getRun(workflowId!),
    refetchInterval: (query) => {
      const data = query.state.data
      return data && isRunActive(data) ? 5000 : false
    },
  })

  if (isLoading) return <p className="p-8 text-gray-500">Loading…</p>
  if (!run) return <p className="p-8 text-red-600">Run not found.</p>

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold font-mono truncate">{run.workflow_id}</h1>
        <RunStatusBadge status={run.status} />
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Pipeline stages</h2>
        <PipelineStages stages={buildStages(run.status)} />
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <dt className="text-gray-500">Run ID</dt>
        <dd className="font-mono text-gray-900">{run.run_id}</dd>
        {run.start_time && (
          <>
            <dt className="text-gray-500">Started</dt>
            <dd className="text-gray-900">{new Date(run.start_time).toLocaleString()}</dd>
          </>
        )}
        {run.close_time && (
          <>
            <dt className="text-gray-500">Finished</dt>
            <dd className="text-gray-900">{new Date(run.close_time).toLocaleString()}</dd>
          </>
        )}
      </dl>
    </div>
  )
}
