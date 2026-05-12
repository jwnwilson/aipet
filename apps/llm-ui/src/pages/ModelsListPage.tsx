import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listModels, triggerRun } from '@/api/models'
import { ModelCard } from '@/components/ModelCard'
import { Button } from '@/components/ui/button'

export function ModelsListPage() {
  const queryClient = useQueryClient()
  const { data: models = [], isLoading } = useQuery({ queryKey: ['models'], queryFn: listModels })

  const triggerMutation = useMutation({
    mutationFn: triggerRun,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runs'] }),
  })

  if (isLoading) return <p className="p-8 text-gray-500">Loading…</p>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Training Models</h1>
        <Button asChild>
          <Link to="/models/new"><Plus className="h-4 w-4 mr-1" />New model</Link>
        </Button>
      </div>

      {models.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="mb-4">No models yet.</p>
          <Button asChild variant="outline">
            <Link to="/models/new">Create your first model</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map(model => (
            <ModelCard
              key={model.id}
              model={model}
              onTrigger={id => triggerMutation.mutate(id)}
              isTriggering={triggerMutation.isPending && triggerMutation.variables === model.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
