import { useEffect, useState, useCallback } from "react";
import { useAppStore, useProjectStore } from "../stores/StoresIndex";
import AuthService from "../services/AuthService";

// Helper function to check if token is expired
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch {
    return true; // If we can't decode, consider it expired
  }
};

// Generic fetch function type
type FetchFunction<T = any, P = any> = (_params?: P) => Promise<T>;

interface UseFetchDataOptions<T, P> {
  fetchFunction: FetchFunction<T, P>;
  params?: P;
  dependencies?: any[];
  enabled?: boolean;
  onSuccess?: (_data: T) => void;
  onError?: (_error: string) => void;
}

interface UseFetchDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  clearError: () => void;
}

export const useFetchData = <T = any, P = any>({
  fetchFunction,
  params,
  dependencies = [],
  enabled = true,
  onSuccess,
  onError
}: UseFetchDataOptions<T, P>): UseFetchDataReturn<T> => {
  const { user, setUser } = useAppStore();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    // Check if user is authenticated
    if (!user) {
      setError('User not authenticated');
      onError?.('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFunction(params);
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, params, enabled, user, onSuccess, onError]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...(dependencies || [])]);

  return {
    data,
    loading,
    error,
    refetch,
    clearError
  };
};

// Specialized hook for project data fetching
export const useProjectData = (projectId?: string) => {
  const { getProjectStats, projectStats } = useProjectStore();
  
  return useFetchData({
    fetchFunction: async () => {
      if (!projectId) throw new Error('Project ID is required');
      await getProjectStats(projectId);
      return projectStats;
    },
    params: projectId,
    dependencies: [projectId],
    enabled: !!projectId
  });
};

// Specialized hook for user projects fetching
export const useUserProjects = (userId?: string) => {
  const { fetchProjects, projects } = useProjectStore();
  
  return useFetchData({
    fetchFunction: async () => {
      if (!userId) throw new Error('User ID is required');
      await fetchProjects(userId);
      return projects;
    },
    params: userId,
    dependencies: [userId],
    enabled: !!userId
  });
};

export default useFetchData;
