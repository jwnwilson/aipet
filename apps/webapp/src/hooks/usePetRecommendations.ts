import { useState, useCallback } from 'react';
import { apiClient, SceneData, PetActionRecommendation } from '../api/client';

export const usePetRecommendations = () => {
  const [recommendations, setRecommendations] = useState<PetActionRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRecommendations = useCallback(async (sceneData: SceneData, model?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.getPetRecommendations(sceneData, model);
      
      if (response.error) {
        setError(response.error);
        return null;
      }
      
      if (response.data) {
        setRecommendations(response.data);
        return response.data;
      }
      
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get recommendations';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setRecommendations(null);
    setLoading(false);
    setError(null);
  }, []);

  return {
    recommendations,
    loading,
    error,
    getRecommendations,
    reset,
  };
}; 