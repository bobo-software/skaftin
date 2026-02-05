import { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { SessionAuth, useSessionContext } from 'supertokens-auth-react/recipe/session';
import { useAppStore } from '../stores/StoresIndex';

interface ProtectedRouteProps {
  children: ReactElement;
  requiredRoles?: string[]; // Role keys required to access this route
}

/**
 * Component that handles redirect when session doesn't exist
 */
const SessionHandler = ({ children }: { children: ReactElement }) => {
  const session = useSessionContext();

  if (session.loading === true) {
    return <LoadingScreen />;
  }

  if (session.doesSessionExist === false) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

/**
 * Loading component for session check
 */
const LoadingScreen = () => (
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

/**
 * Access Denied component for role failures
 */
const AccessDenied = ({ requiredRoles }: { requiredRoles: string[] }) => (
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

/**
 * Inner component that handles role checking after session is validated
 */
const RoleChecker = ({ children, requiredRoles }: ProtectedRouteProps) => {
  const { user, isLoading } = useAppStore();

  // Wait for user data to be loaded from API
  if (isLoading) {
    return <LoadingScreen />;
  }

  // If we have a session but user data hasn't loaded yet, wait
  if (!user) {
    return <LoadingScreen />;
  }

  // Check roles if required
  if (requiredRoles && requiredRoles.length > 0) {
    const userRoles = user.roles || [];
    const userRoleKeys = userRoles.map((role: any) => role.role_key);

    // Check if user has at least one of the required roles
    const hasRequiredRole = requiredRoles.some((requiredRole) =>
      userRoleKeys.includes(requiredRole)
    );

    if (!hasRequiredRole) {
      return <AccessDenied requiredRoles={requiredRoles} />;
    }
  }

  return children;
};

/**
 * Protected Route Component
 * Uses SuperTokens SessionAuth for session validation,
 * then checks role-based access using our user store
 */
export const ProtectedRoute = ({ children, requiredRoles }: ProtectedRouteProps) => {
  return (
    <SessionAuth requireAuth={true}>
      <SessionHandler>
        <RoleChecker requiredRoles={requiredRoles}>{children}</RoleChecker>
      </SessionHandler>
    </SessionAuth>
  );
};

/**
 * Role-Protected Route Component (alias for ProtectedRoute with roles)
 */
export const RoleProtectedRoute = ProtectedRoute;
