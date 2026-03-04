import { doesSessionExist } from '../config/supertokens';
import useOrganizationStore from '../stores/data/useOrganizationStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const REDIRECT_STORAGE_KEY = 'redirectAfterLogin';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  roles?: Array<{
    id: number;
    role_name: string;
    role_key: string;
  }>;
}

interface BootstrapOptions {
  force?: boolean;
  preloadOrganizations?: boolean;
}

interface BootstrapResult {
  sessionExists: boolean;
  user: AuthenticatedUser | null;
  profileLoaded: boolean;
}

let inFlightBootstrap: Promise<BootstrapResult> | null = null;

const traceAuth = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.debug('[auth-flow]', ...args);
  }
};

const normalizeUser = (user: any): AuthenticatedUser => ({
  ...user,
  roles: Array.isArray(user?.roles)
    ? user.roles
      .filter((role: any) => role && typeof role === 'object')
      .map((role: any) => ({
        id: typeof role.id === 'number' ? role.id : 0,
        role_name: typeof role.role_name === 'string' ? role.role_name : '',
        role_key: typeof role.role_key === 'string' ? role.role_key : '',
      }))
    : [],
});

const loadCurrentUser = async (): Promise<AuthenticatedUser | null> => {
  const response = await fetch(`${API_BASE_URL}/api/users/me`, {
    credentials: 'include',
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!data?.success || !data?.data?.user) {
    return null;
  }

  return normalizeUser(data.data.user);
};

export async function bootstrapAuth(options: BootstrapOptions = {}): Promise<BootstrapResult> {
  const { force = false, preloadOrganizations = true } = options;

  if (!force && inFlightBootstrap) {
    traceAuth('reusing in-flight bootstrap request');
    return inFlightBootstrap;
  }

  inFlightBootstrap = (async () => {
    traceAuth('bootstrap start', { force, preloadOrganizations });
    const hasSession = await doesSessionExist();
    if (!hasSession) {
      traceAuth('no active session');
      return {
        sessionExists: false,
        user: null,
        profileLoaded: false,
      };
    }

    const user = await loadCurrentUser();
    if (!user) {
      traceAuth('session exists but profile failed to load');
      return {
        sessionExists: true,
        user: null,
        profileLoaded: false,
      };
    }

    if (preloadOrganizations) {
      traceAuth('preloading organizations');
      await useOrganizationStore.getState().fetchOrganizations({ skipIfFresh: true });
    }

    traceAuth('bootstrap complete', { userId: user.id });
    return {
      sessionExists: true,
      user,
      profileLoaded: true,
    };
  })();

  try {
    return await inFlightBootstrap;
  } finally {
    inFlightBootstrap = null;
  }
}

export function storeLoginRedirect(redirect: string | null | undefined): void {
  if (!redirect || !isSafeInternalRedirect(redirect)) {
    return;
  }
  sessionStorage.setItem(REDIRECT_STORAGE_KEY, redirect);
}

export function consumeStoredLoginRedirect(): string | null {
  const redirect = sessionStorage.getItem(REDIRECT_STORAGE_KEY);
  if (!redirect) {
    return null;
  }

  sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
  return isSafeInternalRedirect(redirect) ? redirect : null;
}

export async function resolvePostLoginRedirect(explicitRedirect?: string | null): Promise<string> {
  const preferredRedirect = explicitRedirect && isSafeInternalRedirect(explicitRedirect)
    ? explicitRedirect
    : consumeStoredLoginRedirect();

  if (preferredRedirect) {
    traceAuth('redirect resolved from explicit/stored value', preferredRedirect);
    return preferredRedirect;
  }

  const organizations = useOrganizationStore.getState().organizations;
  if (organizations.length > 1) {
    traceAuth('redirect resolved by org count', '/organizations/select');
    return '/organizations/select';
  }

  traceAuth('redirect resolved by default', '/projects');
  return '/projects';
}

function isSafeInternalRedirect(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}
