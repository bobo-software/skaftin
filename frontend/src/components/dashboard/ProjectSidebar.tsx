import { useParams } from 'react-router-dom';
import { Database, Cloud, Settings, Home, Layers, LucideIcon, ChevronRight, ChevronLeft, Mail, Shield, BarChart3, GitBranch, Clock, CreditCard } from 'lucide-react';
import useSidebarStore from '../../stores/state/useSidebarStore';
import { SidebarItem } from '@components/ComponentsIndex';

interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
}

interface ProjectSidebarProps {
  projectName: string;
  projectDescription?: string;
  isOpen: boolean;
}

const ProjectSidebar = ({ projectName, projectDescription, isOpen }: ProjectSidebarProps) => {
  const { projectId } = useParams<{ projectId: string }>();
  const { isCollapsed, toggle } = useSidebarStore();

  const navItems: NavItem[] = [
    { path: 'overview', icon: Home, label: 'Overview' },
    { path: 'database', icon: Database, label: 'Database' },
    { path: 'storage', icon: Cloud, label: 'Storage' },
    { path: 'analytics', icon: BarChart3, label: 'Analytics' },
    { path: 'workflows', icon: GitBranch, label: 'Workflows' },
    { path: 'cron', icon: Clock, label: 'Cron' },
    { path: 'auth', icon: Shield, label: 'Auth' },
    { path: 'communications', icon: Mail, label: 'Communications' },
    { path: 'payments', icon: CreditCard, label: 'Payments' },
    { path: 'settings', icon: Settings, label: 'Settings' },
  ];

  const shouldShowFull = !isCollapsed;

  return (
    <aside
      className={`${ isOpen ? 'translate-x-0' : '-translate-x-full'} fixed lg:translate-x-0 inset-y-0 left-0 z-30 ${
        shouldShowFull ? 'w-64' : 'w-14'
      } bg-white dark:bg-dark-800 border-r border-dark-200 dark:border-dark-700 transition-all duration-200 ease-in-out flex flex-col shadow-lg z-50`}
    >
      {/* Project Info */}
      <div className="p-4 border-b border-dark-200 dark:border-dark-700 overflow-hidden">
        {shouldShowFull ? (
          <>
            <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-1 truncate">
              {projectName}
            </h2>
            {projectDescription && (
              <p className="text-sm text-dark-600 dark:text-dark-400 line-clamp-2">
                {projectDescription}
              </p>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center">
            <Layers className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <SidebarItem
            key={item.path}
            to={item.path === 'overview' ? `/projects/${projectId}` : `/projects/${projectId}/${item.path}`}
            icon={item.icon}
            label={item.label}
            isCollapsed={isCollapsed}
            end={item.path === 'overview'}
          />
        ))}
      </nav>

      {/* Toggle Button & Footer */}
      <div className="border-t border-dark-200 dark:border-dark-700">
        {/* Toggle Button - Always visible on desktop */}
        <button
          onClick={toggle}
          className={`hidden lg:flex items-center w-full p-3 text-dark-500 hover:text-dark-900 dark:text-dark-400 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors border-b border-dark-200 dark:border-dark-700 ${
            shouldShowFull ? 'justify-end' : 'justify-center'
          }`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {shouldShowFull ? (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="ml-2 text-sm font-medium">Collapse</span>
            </>
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </button>

        {/* Footer Info */}
        {shouldShowFull && (
          <div className="p-4">
            <div className="text-xs text-dark-500 dark:text-dark-400">
              <div className="flex items-center justify-between mb-1">
                <span>Project ID:</span>
                <span className="font-mono">{projectId}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default ProjectSidebar;

