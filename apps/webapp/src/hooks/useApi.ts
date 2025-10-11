import { useState, useCallback } from 'react';
import { apiClient, ApiResponse } from '../api/client';

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export const useApi = <T>() => {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (apiCall: () => Promise<ApiResponse<T>>) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await apiCall();
      
      if (response.error) {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: response.error || 'An error occurred' 
        }));
        return response;
      }
      
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        data: response.data || null 
      }));
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage 
      }));
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
};



// Hook for authentication status
export const useAuthStatus = () => {
  const isAuthenticated = apiClient.isAuthenticated();
  const token = apiClient.getToken();
  
  return {
    isAuthenticated,
    token,
  };
}; 