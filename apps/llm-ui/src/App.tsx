import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { ModelsListPage } from './pages/ModelsListPage'
import { ModelFormPage } from './pages/ModelFormPage'
import { ModelDetailPage } from './pages/ModelDetailPage'
import { RunsListPage } from './pages/RunsListPage'
import { RunDetailPage } from './pages/RunDetailPage'

const queryClient = new QueryClient()

function Nav() {
  return (
    <nav className="border-b bg-white px-8 py-3 flex gap-6 text-sm font-medium">
      <Link to="/models" className="text-gray-700 hover:text-gray-900">Models</Link>
      <Link to="/runs" className="text-gray-700 hover:text-gray-900">Runs</Link>
    </nav>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <Nav />
          <Routes>
            <Route path="/" element={<Navigate to="/models" replace />} />
            <Route path="/models" element={<ModelsListPage />} />
            <Route path="/models/new" element={<ModelFormPage />} />
            <Route path="/models/:id" element={<ModelDetailPage />} />
            <Route path="/models/:id/edit" element={<ModelFormPage />} />
            <Route path="/runs" element={<RunsListPage />} />
            <Route path="/runs/:workflowId" element={<RunDetailPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
