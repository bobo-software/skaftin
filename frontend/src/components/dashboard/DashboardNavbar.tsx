import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Menu, X, Database, Cloud, Home, Settings, ChevronRight } from 'lucide-react';
import AccountDropdown from './AccountDropdown';

interface DashboardNavbarProps {
  projectName: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

const DashboardNavbar = ({
  projectName,
  sidebarOpen,
  onToggleSidebar,
  onLogout,
}: DashboardNavbarProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Get current section from URL
  const getCurrentSection = () => {
    const path = location.pathname;
    if (path.includes('/database')) return { name: 'Database', icon: Database, color: 'text-blue-600 dark:text-blue-400' };
    if (path.includes('/storage')) return { name: 'Storage', icon: Cloud, color: 'text-purple-600 dark:text-purple-400' };
    if (path.includes('/settings')) return { name: 'Settings', icon: Settings, color: 'text-gray-600 dark:text-gray-400' };
    return { name: 'Overview', icon: Home, color: 'text-primary-600 dark:text-primary-400' };
  };

  const currentSection = getCurrentSection();
  const SectionIcon = currentSection.icon;

  return (
    <div className="h-16 border-b border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 flex items-center justify-between px-4 md:px-6 flex-shrink-0 shadow-sm">
      <div className="flex items-center space-x-3 md:space-x-4 flex-1 min-w-0">
        {/* Sidebar Toggle (Mobile) */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors flex-shrink-0"
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? (
            <X className="w-5 h-5 text-dark-600 dark:text-dark-300" />
          ) : (
            <Menu className="w-5 h-5 text-dark-600 dark:text-dark-300" />
          )}
        </button>

        {/* Back Button - Icon Only */}
        <button
          onClick={() => navigate('/projects')}
          className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-white flex-shrink-0"
          title="Back to Projects"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Breadcrumb with Project Name and Current Section */}
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          {/* Project Name */}
          <div className="flex items-center space-x-2 min-w-0">
            <h1 className="text-base md:text-lg font-semibold text-dark-900 dark:text-white truncate">
              {projectName}
            </h1>
            
            {/* Separator and Current Section (Desktop) */}
            <div className="hidden sm:flex items-center space-x-2">
              <ChevronRight className="w-4 h-4 text-dark-400 dark:text-dark-500 flex-shrink-0" />
              <div className={`flex items-center space-x-2 ${currentSection.color}`}>
                <SectionIcon className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium text-sm">{currentSection.name}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center space-x-1 md:space-x-2 flex-shrink-0">
        {/* Current Section Badge (Mobile Only) */}
        <div className={`sm:hidden flex items-center space-x-1 px-2 py-1 rounded-lg bg-dark-50 dark:bg-dark-700 ${currentSection.color}`}>
          <SectionIcon className="w-4 h-4" />
        </div>

        {/* Account Dropdown */}
        <AccountDropdown onLogout={onLogout} />
      </div>
    </div>
  );
};

export default DashboardNavbar;

