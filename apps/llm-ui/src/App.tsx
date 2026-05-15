import { useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { ModelsListPage } from './pages/ModelsListPage'
import { ModelFormPage } from './pages/ModelFormPage'
import { ModelDetailPage } from './pages/ModelDetailPage'
import { RunsListPage } from './pages/RunsListPage'
import { RunDetailPage } from './pages/RunDetailPage'
import { TokenSync } from './components/TokenSync'

const queryClient = new QueryClient()

function AuthButton() {
  const { loginWithRedirect, logout, isAuthenticated, user } = useAuth0()
  if (isAuthenticated) {
    return (
      <button
        onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        className="ml-auto text-gray-700 hover:text-gray-900"
      >
        {user?.email} · Logout
      </button>
    )
  }
  return (
    <button
      onClick={() => loginWithRedirect()}
      className="ml-auto text-gray-700 hover:text-gray-900"
    >
      Login
    </button>
  )
}

function Nav() {
  return (
    <nav className="border-b bg-white px-8 py-3 flex gap-6 text-sm font-medium items-center">
      <Link to="/models" className="text-gray-700 hover:text-gray-900">Models</Link>
      <Link to="/runs" className="text-gray-700 hover:text-gray-900">Runs</Link>
      <AuthButton />
    </nav>
  )
}

function AppContent() {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect()
    }
  }, [isLoading, isAuthenticated, loginWithRedirect])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TokenSync />
      <Nav />
      <Routes>
        <Route path="/" element={<Navigate to="/models" replace />} />
        <Route path="/models" element={<ModelsListPage />} />
        <Route path="/models/new" element={<ModelFormPage />} />
        <Route path="/models/:id" element={<ModelDetailPage />} />
        <Route path="/models/:id/edit" element={<ModelFormPage />} />
        <Route path="/runs" element={<RunsListPage />} />
        <Route path="/runs/:runId" element={<RunDetailPage />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
