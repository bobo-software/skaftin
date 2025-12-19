import { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '../stores/StoresIndex';

interface ProtectedRouteProps {
  children: ReactElement;
  requiredRoles?: string[]; // Role keys required to access this route
}

/**
 * Protected Route Component
 * Checks authentication and optionally role-based access
 */
export const ProtectedRoute = ({ children, requiredRoles }: ProtectedRouteProps) => {
  const { user, isLoading } = useAppStore();

  // Wait for session check to complete before redirecting
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '18px',
        }}
      >
        Loading...
      </div>
    );
  }

  // Check authentication
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check roles if required
  if (requiredRoles && requiredRoles.length > 0) {
    const userRoles = user.roles || [];
    const userRoleKeys = userRoles.map((role) => role.role_key);

    // Check if user has at least one of the required roles
    const hasRequiredRole = requiredRoles.some((requiredRole) =>
      userRoleKeys.includes(requiredRole)
    );

    if (!hasRequiredRole) {
      // Redirect to unauthorized page or show error
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            fontSize: '18px',
          }}
        >
          <h1>Access Denied</h1>
          <p>You do not have the required role(s) to access this page.</p>
          <p>Required roles: {requiredRoles.join(', ')}</p>
        </div>
      );
    }
  }

  return children;
};

/**
 * Role-Protected Route Component (alias for ProtectedRoute with roles)
 */
export const RoleProtectedRoute = ProtectedRoute;
