import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Database, Cloud, Settings, Layers, LucideIcon, ChevronRight, ChevronLeft } from 'lucide-react';

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
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  const navItems: NavItem[] = [
    { path: 'overview', icon: Layers, label: 'Overview' },
    { path: 'database', icon: Database, label: 'Database' },
    { path: 'storage', icon: Cloud, label: 'Storage' },
    { path: 'settings', icon: Settings, label: 'Settings' },
  ];

  const shouldShowFull = !isCollapsed || isHovering;

  const handleToggle = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleMouseEnter = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setIsHovering(false);
    }, 500);
    setHoverTimeout(timeout);
  };

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed lg:relative lg:translate-x-0 inset-y-0 left-0 z-30 ${
        shouldShowFull ? 'w-64' : 'w-16'
      } bg-white dark:bg-dark-800 border-r border-dark-200 dark:border-dark-700 transition-all duration-200 ease-in-out flex flex-col`}
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
        {navItems.map((item) => {
          const Icon = item.icon;
          const to = item.path === 'overview'
            ? `/projects/${projectId}`
            : `/projects/${projectId}/${item.path}`;

          return (
            <NavLink
              key={item.path}
              to={to}
              end={item.path === 'overview'}
              title={!shouldShowFull ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center ${shouldShowFull ? 'space-x-3 px-4' : 'justify-center px-2'} py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 hover:text-dark-900 dark:hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {shouldShowFull && <span className="font-medium">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Toggle Button & Footer */}
      <div className="border-t border-dark-200 dark:border-dark-700">
        {/* Toggle Button - Always visible on desktop */}
        <button
          onClick={handleToggle}
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

