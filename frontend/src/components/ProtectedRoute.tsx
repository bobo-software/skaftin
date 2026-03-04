import { ReactElement, useState } from 'react';
import { SessionAuth, useSessionContext } from 'supertokens-auth-react/recipe/session';
import { useAppStore } from '../stores/StoresIndex';
import { bootstrapAuth } from '../services/AuthFlowService';

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

const ProfileLoadError = ({ onRetry }: { onRetry: () => Promise<void> }) => {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    try {
      setRetrying(true);
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        gap: '12px',
      }}
    >
      <h1>Unable to load your profile</h1>
      <p>Please retry loading your session details.</p>
      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        style={{
          padding: '8px 16px',
          borderRadius: '6px',
          border: '1px solid #ccc',
          cursor: retrying ? 'not-allowed' : 'pointer',
        }}
      >
        {retrying ? 'Retrying...' : 'Retry'}
      </button>
    </div>
  );
};

/**
 * Inner component that handles role checking after session is validated
 */
const RoleChecker = ({ children, requiredRoles }: ProtectedRouteProps) => {
  const session = useSessionContext();
  const { user, isLoading, setLoading, setUser } = useAppStore();

  const authState: 'bootstrapping' | 'authenticated_no_profile' | 'ready' = (() => {
    if (session.loading || isLoading) {
      return 'bootstrapping';
    }

    if (!user) {
      return 'authenticated_no_profile';
    }

    return 'ready';
  })();

  if (authState === 'bootstrapping') {
    return <LoadingScreen />;
  }

  if (authState === 'authenticated_no_profile') {
    return (
      <ProfileLoadError
        onRetry={async () => {
          setLoading(true);
          try {
            const bootstrap = await bootstrapAuth({ preloadOrganizations: true, force: true });
            setUser(bootstrap.user);
          } finally {
            setLoading(false);
          }
        }}
      />
    );
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
        {/*
          SessionAuth handles unauthenticated redirects before this component renders.
          RoleChecker focuses on profile bootstrap and role checks.
        */}
        <RoleChecker requiredRoles={requiredRoles}>{children}</RoleChecker>
      </SessionHandler>
    </SessionAuth>
  );
};

/**
 * Role-Protected Route Component (alias for ProtectedRoute with roles)
 */
export const RoleProtectedRoute = ProtectedRoute;
