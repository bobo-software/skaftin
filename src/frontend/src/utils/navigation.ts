import { useNavigate, useLocation } from 'react-router-dom';

// Navigation utilities
export const useNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return {
    navigate,
    location,
    goTo: (path: string) => navigate(path),
    goBack: () => navigate(-1),
    goForward: () => navigate(1),
    replace: (path: string) => navigate(path, { replace: true }),
    push: (path: string, state?: any) => navigate(path, { state }),
    getCurrentPath: () => location.pathname,
    getSearchParams: () => new URLSearchParams(location.search),
    getState: () => location.state,
    isCurrentPath: (path: string) => location.pathname === path,
    isCurrentPathStartsWith: (path: string) => location.pathname.startsWith(path)
  };
};

// Route constants
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  PROJECTS: '/projects',
  CREATE_PROJECT: '/create-project',
  DASHBOARD: '/dashboard',
  SETTINGS: '/settings',
  PROFILE: '/profile'
} as const;

// Route helpers
export const getProjectRoute = (projectId: string) => `/dashboard?project=${projectId}`;
export const getCreateProjectRoute = (step?: string) => 
  step ? `/create-project?step=${step}` : '/create-project';

// Navigation guards
export const isPublicRoute = (pathname: string): boolean => {
  return [ROUTES.HOME, ROUTES.LOGIN].includes(pathname as any);
};

export const isProtectedRoute = (pathname: string): boolean => {
  return [ROUTES.PROJECTS, ROUTES.CREATE_PROJECT, ROUTES.DASHBOARD, ROUTES.SETTINGS, ROUTES.PROFILE]
    .some(route => pathname.startsWith(route));
};

// Breadcrumb utilities
export const getBreadcrumbs = (pathname: string) => {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = [{ label: 'Home', path: '/' }];

  let currentPath = '';
  segments.forEach(segment => {
    currentPath += `/${segment}`;
    const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' ');
    breadcrumbs.push({ label, path: currentPath });
  });

  return breadcrumbs;
};

export default useNavigation;
