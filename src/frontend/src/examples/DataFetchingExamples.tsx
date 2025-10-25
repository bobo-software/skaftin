import React from 'react';
import { useFetchData, useProjectData, useUserProjects } from '../hooks/useFetchData';
import { useAppStore, useProjectStore } from '../stores/StoresIndex';
import McpService from '../services/McpService';

// Example 1: Basic data fetching with parameters
const BasicDataFetchingExample = () => {
  const { user } = useAppStore();
  
  // Fetch user projects with automatic loading states
  const { 
    data: projects, 
    loading, 
    error, 
    refetch 
  } = useUserProjects(user?.id);

  if (loading) return <div>Loading projects...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h3>User Projects</h3>
      <button onClick={refetch}>Refresh</button>
      {projects?.map(project => (
        <div key={project.id}>{project.name}</div>
      ))}
    </div>
  );
};

// Example 2: Project-specific data fetching
const ProjectDataExample = ({ projectId }: { projectId: string }) => {
  const { 
    data: projectStats, 
    loading, 
    error 
  } = useProjectData(projectId);

  if (loading) return <div>Loading project stats...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h3>Project Statistics</h3>
      <p>Tables: {projectStats?.tableCount || 0}</p>
      <p>Files: {projectStats?.fileCount || 0}</p>
    </div>
  );
};

// Example 3: Custom data fetching with parameters
const CustomDataFetchingExample = ({ projectId }: { projectId: string }) => {
  const { 
    data: tables, 
    loading, 
    error, 
    refetch 
  } = useFetchData({
    fetchFunction: async (params: { projectId: string }) => {
      return await McpService.listTables(params.projectId);
    },
    params: { projectId },
    dependencies: [projectId],
    enabled: !!projectId,
    onSuccess: (data) => {
      console.log('Tables loaded:', data);
    },
    onError: (error) => {
      console.error('Failed to load tables:', error);
    }
  });

  if (loading) return <div>Loading tables...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h3>Project Tables</h3>
      <button onClick={refetch}>Refresh Tables</button>
      {tables?.map((table: any, index: number) => (
        <div key={index}>{table.table_name}</div>
      ))}
    </div>
  );
};

// Example 4: Conditional data fetching
const ConditionalDataExample = ({ shouldFetch }: { shouldFetch: boolean }) => {
  const { 
    data: files, 
    loading, 
    error 
  } = useFetchData({
    fetchFunction: async (params: { projectId: string }) => {
      return await McpService.listFiles(params.projectId);
    },
    params: { projectId: 'some-project-id' },
    enabled: shouldFetch, // Only fetch when shouldFetch is true
    onSuccess: (data) => {
      console.log('Files loaded:', data);
    }
  });

  if (!shouldFetch) return <div>Fetching disabled</div>;
  if (loading) return <div>Loading files...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h3>Project Files</h3>
      {files?.map((file: any, index: number) => (
        <div key={index}>{file.name}</div>
      ))}
    </div>
  );
};

// Example 5: Multiple data sources
const MultipleDataSources = ({ projectId }: { projectId: string }) => {
  // Fetch multiple data sources simultaneously
  const projectsQuery = useUserProjects('user-id');
  const projectStatsQuery = useProjectData(projectId);
  const tablesQuery = useFetchData({
    fetchFunction: async () => McpService.listTables(projectId),
    params: projectId,
    dependencies: [projectId]
  });
  const filesQuery = useFetchData({
    fetchFunction: async () => McpService.listFiles(projectId),
    params: projectId,
    dependencies: [projectId]
  });

  const isLoading = projectsQuery.loading || projectStatsQuery.loading || 
                   tablesQuery.loading || filesQuery.loading;
  
  const hasError = projectsQuery.error || projectStatsQuery.error || 
                  tablesQuery.error || filesQuery.error;

  if (isLoading) return <div>Loading all data...</div>;
  if (hasError) return <div>Error loading data</div>;

  return (
    <div>
      <h2>Dashboard Data</h2>
      <div>
        <h3>Projects: {projectsQuery.data?.length || 0}</h3>
        <h3>Tables: {tablesQuery.data?.length || 0}</h3>
        <h3>Files: {filesQuery.data?.length || 0}</h3>
        <h3>Project Stats: {JSON.stringify(projectStatsQuery.data)}</h3>
      </div>
    </div>
  );
};

// Example 6: Error handling with retry
const ErrorHandlingExample = ({ projectId }: { projectId: string }) => {
  const { 
    data, 
    loading, 
    error, 
    refetch, 
    clearError 
  } = useFetchData({
    fetchFunction: async () => {
      // Simulate a potentially failing API call
      const response = await McpService.listTables(projectId);
      if (!response) throw new Error('No data received');
      return response;
    },
    params: projectId,
    onError: (error) => {
      console.error('Data fetch failed:', error);
      // Could trigger analytics, show toast, etc.
    }
  });

  return (
    <div>
      <h3>Error Handling Example</h3>
      {loading && <div>Loading...</div>}
      {error && (
        <div>
          <p>Error: {error}</p>
          <button onClick={clearError}>Clear Error</button>
          <button onClick={refetch}>Retry</button>
        </div>
      )}
      {data && <div>Data loaded successfully!</div>}
    </div>
  );
};

export {
  BasicDataFetchingExample,
  ProjectDataExample,
  CustomDataFetchingExample,
  ConditionalDataExample,
  MultipleDataSources,
  ErrorHandlingExample
};
