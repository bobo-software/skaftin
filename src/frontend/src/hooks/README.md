# useFetchData Hook Documentation

The `useFetchData` hook is a powerful, generic data fetching hook that provides automatic loading states, error handling, authentication checks, and retry capabilities.

## Features

- ✅ **Automatic Authentication**: Checks user authentication and token validity
- ✅ **Loading States**: Built-in loading state management
- ✅ **Error Handling**: Comprehensive error handling with retry capabilities
- ✅ **Parameter Support**: Fetch data with dynamic parameters
- ✅ **Dependency Tracking**: Automatic refetching when dependencies change
- ✅ **Conditional Fetching**: Enable/disable fetching based on conditions
- ✅ **TypeScript Support**: Full type safety with generics
- ✅ **Callbacks**: Success and error callbacks for custom handling

## Basic Usage

```tsx
import { useFetchData } from '../hooks/useFetchData';
import McpService from '../services/McpService';

const MyComponent = ({ projectId }: { projectId: string }) => {
  const { 
    data, 
    loading, 
    error, 
    refetch, 
    clearError 
  } = useFetchData({
    fetchFunction: async (params) => {
      return await McpService.listTables(params.projectId);
    },
    params: { projectId },
    dependencies: [projectId]
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <button onClick={refetch}>Refresh</button>
      {data?.map(table => <div key={table.id}>{table.name}</div>)}
    </div>
  );
};
```

## Specialized Hooks

### useUserProjects
Fetches all projects for a specific user.

```tsx
import { useUserProjects } from '../hooks/useFetchData';

const ProjectsList = ({ userId }: { userId: string }) => {
  const { data: projects, loading, error } = useUserProjects(userId);
  
  if (loading) return <div>Loading projects...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      {projects?.map(project => (
        <div key={project.id}>{project.name}</div>
      ))}
    </div>
  );
};
```

### useProjectData
Fetches statistics and data for a specific project.

```tsx
import { useProjectData } from '../hooks/useFetchData';

const ProjectDashboard = ({ projectId }: { projectId: string }) => {
  const { data: stats, loading, error } = useProjectData(projectId);
  
  if (loading) return <div>Loading project data...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h3>Project Statistics</h3>
      <p>Tables: {stats?.tableCount || 0}</p>
      <p>Files: {stats?.fileCount || 0}</p>
    </div>
  );
};
```

## Advanced Usage

### Conditional Fetching
Only fetch data when certain conditions are met.

```tsx
const ConditionalComponent = ({ shouldFetch, projectId }: { 
  shouldFetch: boolean; 
  projectId: string; 
}) => {
  const { data, loading, error } = useFetchData({
    fetchFunction: async () => McpService.listTables(projectId),
    params: projectId,
    enabled: shouldFetch, // Only fetch when shouldFetch is true
    dependencies: [shouldFetch, projectId]
  });

  if (!shouldFetch) return <div>Fetching disabled</div>;
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>{/* Render data */}</div>;
};
```

### Custom Error Handling
Handle errors with custom callbacks.

```tsx
const ErrorHandlingComponent = ({ projectId }: { projectId: string }) => {
  const { data, loading, error, refetch, clearError } = useFetchData({
    fetchFunction: async () => McpService.listTables(projectId),
    params: projectId,
    onSuccess: (data) => {
      console.log('Tables loaded successfully:', data);
      // Could trigger analytics, show success toast, etc.
    },
    onError: (error) => {
      console.error('Failed to load tables:', error);
      // Could trigger error reporting, show error toast, etc.
    }
  });

  return (
    <div>
      {loading && <div>Loading...</div>}
      {error && (
        <div>
          <p>Error: {error}</p>
          <button onClick={clearError}>Clear Error</button>
          <button onClick={refetch}>Retry</button>
        </div>
      )}
      {data && <div>Data loaded!</div>}
    </div>
  );
};
```

### Multiple Data Sources
Fetch multiple data sources simultaneously.

```tsx
const DashboardComponent = ({ projectId }: { projectId: string }) => {
  const projectsQuery = useUserProjects('user-id');
  const projectStatsQuery = useProjectData(projectId);
  const tablesQuery = useFetchData({
    fetchFunction: async () => McpService.listTables(projectId),
    params: projectId
  });
  const filesQuery = useFetchData({
    fetchFunction: async () => McpService.listFiles(projectId),
    params: projectId
  });

  const isLoading = projectsQuery.loading || projectStatsQuery.loading || 
                   tablesQuery.loading || filesQuery.loading;
  
  const hasError = projectsQuery.error || projectStatsQuery.error || 
                  tablesQuery.error || filesQuery.error;

  if (isLoading) return <div>Loading dashboard...</div>;
  if (hasError) return <div>Error loading dashboard data</div>;

  return (
    <div>
      <h2>Dashboard</h2>
      <p>Projects: {projectsQuery.data?.length || 0}</p>
      <p>Tables: {tablesQuery.data?.length || 0}</p>
      <p>Files: {filesQuery.data?.length || 0}</p>
    </div>
  );
};
```

## API Reference

### useFetchData Options

```typescript
interface UseFetchDataOptions<T, P> {
  fetchFunction: FetchFunction<T, P>;  // Function to fetch data
  params?: P;                          // Parameters to pass to fetchFunction
  dependencies?: any[];                // Dependencies that trigger refetch
  enabled?: boolean;                   // Whether to enable fetching
  onSuccess?: (data: T) => void;      // Success callback
  onError?: (error: string) => void;  // Error callback
}
```

### Return Value

```typescript
interface UseFetchDataReturn<T> {
  data: T | null;           // Fetched data
  loading: boolean;         // Loading state
  error: string | null;    // Error message
  refetch: () => Promise<void>;  // Manual refetch function
  clearError: () => void;   // Clear error function
}
```

## Best Practices

1. **Use specialized hooks** when available (`useUserProjects`, `useProjectData`)
2. **Handle loading and error states** in your components
3. **Use dependencies array** to trigger refetches when data changes
4. **Implement error boundaries** for better error handling
5. **Use TypeScript generics** for type safety
6. **Clear errors** before retrying failed requests
7. **Use conditional fetching** to avoid unnecessary API calls

## Examples

See `src/frontend/src/examples/DataFetchingExamples.tsx` for comprehensive usage examples.
