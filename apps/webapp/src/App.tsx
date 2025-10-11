import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context';
import { useAuth } from './hooks';
import Login from './components/Login';
import Signup from './components/Signup';
import BabylonScene from './components/BabylonScene';
import './css/main.css';

type Page = 'login' | 'signup' | 'app';

// Wrapper component that conditionally applies StrictMode
const StrictModeWrapper: React.FC<{ children: React.ReactNode; enableStrictMode: boolean }> = ({ 
  children, 
  enableStrictMode 
}) => {
  if (enableStrictMode) {
    return <React.StrictMode>{children}</React.StrictMode>;
  }
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  // Check if authentication is disabled for testing
  const isAuthDisabled = import.meta.env.VITE_DISABLE_AUTH === 'true';
  const [currentPage, setCurrentPage] = useState<Page>(isAuthDisabled ? 'app' : 'login');
  const { isAuthenticated } = useAuth();

  // Check for valid login on initial load
  useEffect(() => {
    if (isAuthenticated || isAuthDisabled) {
      setCurrentPage('app');
    }
  }, [isAuthenticated, isAuthDisabled]);

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return (
          <StrictModeWrapper enableStrictMode={true}>
            <Login onNavigate={setCurrentPage} />
          </StrictModeWrapper>
        );
      case 'signup':
        return (
          <StrictModeWrapper enableStrictMode={true}>
            <Signup onNavigate={setCurrentPage} />
          </StrictModeWrapper>
        );
      case 'app':
        return (
          <StrictModeWrapper enableStrictMode={false}>
            <BabylonScene className="babylon-canvas" />
          </StrictModeWrapper>
        );
      default:
        return (
          <StrictModeWrapper enableStrictMode={true}>
            <Login onNavigate={setCurrentPage} />
          </StrictModeWrapper>
        );
    }
  };

  return (
    <div className="app">
      {renderPage()}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App; 