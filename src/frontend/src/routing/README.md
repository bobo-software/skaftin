# React Router Implementation

This document outlines the routing implementation using `react-router-dom` for the Skaftin frontend application.

## Architecture

### Route Structure
```
/ (Home)
├── /login (Login)
├── /projects (Projects Overview) - Protected
├── /create-project (Project Creation) - Protected
└── /dashboard (Project Dashboard) - Protected
```

### Route Protection
- **Public Routes**: Accessible without authentication
  - `/` - Home page
  - `/login` - Login/Register page

- **Protected Routes**: Require authentication
  - `/projects` - Projects overview
  - `/create-project` - Project creation loading
  - `/dashboard` - Project dashboard

## Components

### ProtectedRoute
Wraps components that require authentication. Redirects to `/login` if user is not authenticated.

```tsx
<ProtectedRoute>
  <DashboardPage />
</ProtectedRoute>
```

### PublicRoute
Wraps components that should only be accessible to unauthenticated users. Redirects to `/projects` if user is already authenticated.

```tsx
<PublicRoute>
  <LoginPage />
</PublicRoute>
```

## Navigation

### Programmatic Navigation
Use the `useNavigate` hook for programmatic navigation:

```tsx
import { useNavigate } from 'react-router-dom';

const MyComponent = () => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    navigate('/dashboard');
  };
  
  return <button onClick={handleClick}>Go to Dashboard</button>;
};
```

### Navigation Utilities
Use the custom `useNavigation` hook for enhanced navigation:

```tsx
import { useNavigation, ROUTES } from '../utils/navigation';

const MyComponent = () => {
  const { goTo, goBack, isCurrentPath } = useNavigation();
  
  return (
    <div>
      <button onClick={() => goTo(ROUTES.PROJECTS)}>Projects</button>
      <button onClick={goBack}>Back</button>
      {isCurrentPath('/dashboard') && <div>On Dashboard</div>}
    </div>
  );
};
```

## Route Parameters

### Query Parameters
Access query parameters using `useSearchParams`:

```tsx
import { useSearchParams } from 'react-router-dom';

const MyComponent = () => {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');
  
  return <div>Project: {projectId}</div>;
};
```

### State Parameters
Pass state between routes:

```tsx
// Navigate with state
navigate('/dashboard', { 
  state: { projectId: '123', from: 'projects' } 
});

// Access state
const location = useLocation();
const projectId = location.state?.projectId;
```

## Data Persistence

### Session Storage
For temporary data that persists during the session:

```tsx
// Store data
sessionStorage.setItem('projectCreationData', JSON.stringify(data));

// Retrieve data
const data = sessionStorage.getItem('projectCreationData');
const parsedData = data ? JSON.parse(data) : null;
```

### Local Storage
For persistent data across sessions:

```tsx
// Store theme preference
localStorage.setItem('skaftin-theme', 'dark');

// Retrieve theme
const theme = localStorage.getItem('skaftin-theme');
```

## Route Guards

### Authentication Guard
Automatically redirects unauthenticated users to login:

```tsx
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAppStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};
```

### Role-Based Guards
For future role-based access control:

```tsx
const AdminRoute = ({ children }) => {
  const { user } = useAppStore();
  
  if (!user?.isAdmin) {
    return <Navigate to="/projects" replace />;
  }
  
  return children;
};
```

## URL Structure

### Clean URLs
- `/projects` - Projects overview
- `/dashboard` - Project dashboard
- `/create-project` - Project creation

### Query Parameters
- `/dashboard?project=123` - Dashboard for specific project
- `/create-project?step=2` - Project creation step 2

### Future Nested Routes
```
/dashboard
├── /dashboard/overview
├── /dashboard/database
├── /dashboard/storage
└── /dashboard/settings
```

## Error Handling

### 404 Handling
Catch-all route redirects to home:

```tsx
<Route path="*" element={<Navigate to="/" replace />} />
```

### Route Error Boundaries
Wrap routes with error boundaries for better error handling:

```tsx
<Route 
  path="/dashboard" 
  element={
    <ErrorBoundary>
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    </ErrorBoundary>
  } 
/>
```

## Best Practices

1. **Use Route Constants**: Define routes in constants file
2. **Protect Sensitive Routes**: Always wrap protected content
3. **Handle Loading States**: Show loading during route transitions
4. **Clean URLs**: Use descriptive, clean URLs
5. **State Management**: Use appropriate storage for different data types
6. **Error Boundaries**: Implement error boundaries for route components
7. **Lazy Loading**: Implement lazy loading for better performance

## Examples

### Complete Route Setup
```tsx
<Routes>
  <Route path="/" element={<PublicRoute><HomePage /></PublicRoute>} />
  <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
  <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
  <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

### Navigation with State
```tsx
const handleProjectSelect = (project) => {
  navigate('/dashboard', { 
    state: { project, from: 'projects' } 
  });
};
```

### Conditional Rendering Based on Route
```tsx
const { isCurrentPath } = useNavigation();

return (
  <div>
    {isCurrentPath('/dashboard') && <DashboardSidebar />}
    {isCurrentPath('/projects') && <ProjectsHeader />}
  </div>
);
```
