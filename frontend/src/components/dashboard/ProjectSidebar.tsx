import { NavLink, useParams } from 'react-router-dom';
import { Database, Cloud, Settings, Layers, LucideIcon } from 'lucide-react';

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

  const navItems: NavItem[] = [
    { path: 'overview', icon: Layers, label: 'Overview' },
    { path: 'database', icon: Database, label: 'Database' },
    { path: 'storage', icon: Cloud, label: 'Storage' },
    { path: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside
      className={`${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed lg:relative lg:translate-x-0 inset-y-0 left-0 z-30 w-64 bg-white dark:bg-dark-800 border-r border-dark-200 dark:border-dark-700 transition-transform duration-200 ease-in-out flex flex-col`}
    >
      {/* Project Info */}
      <div className="p-4 border-b border-dark-200 dark:border-dark-700">
        <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-1 truncate">
          {projectName}
        </h2>
        {projectDescription && (
          <p className="text-sm text-dark-600 dark:text-dark-400 line-clamp-2">
            {projectDescription}
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          // Use absolute paths to prevent URL stacking
          const to = item.path === 'overview'
            ? `/projects/${projectId}`
            : `/projects/${projectId}/${item.path}`;

          return (
            <NavLink
              key={item.path}
              to={to}
              end={item.path === 'overview'}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 hover:text-dark-900 dark:hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-dark-200 dark:border-dark-700">
        <div className="text-xs text-dark-500 dark:text-dark-400">
          <div className="flex items-center justify-between mb-1">
            <span>Project ID:</span>
            <span className="font-mono">{projectId}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ProjectSidebar;

