import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu, X, Moon, Sun, LogOut } from 'lucide-react';
import AuthService from '../../services/AuthService';

interface DashboardNavbarProps {
  projectName: string;
  theme: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
}

const DashboardNavbar = ({
  projectName,
  theme,
  sidebarOpen,
  onToggleSidebar,
  onToggleTheme,
  onLogout,
}: DashboardNavbarProps) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    AuthService.logout();
    onLogout();
    navigate('/login');
  };

  return (
    <div className="h-16 border-b border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center space-x-4">
        {/* Sidebar Toggle (Mobile) */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
        >
          {sidebarOpen ? (
            <X className="w-5 h-5 text-dark-600 dark:text-dark-300" />
          ) : (
            <Menu className="w-5 h-5 text-dark-600 dark:text-dark-300" />
          )}
        </button>

        {/* Back Button */}
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline font-medium">Back to Projects</span>
        </button>

        {/* Project Name (Mobile) */}
        <h1 className="lg:hidden text-lg font-semibold text-dark-900 dark:text-white truncate max-w-[150px]">
          {projectName}
        </h1>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center space-x-2">
        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-dark-400" />
          ) : (
            <Moon className="w-5 h-5 text-dark-600" />
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-dark-600 dark:text-dark-300 hover:text-red-600 dark:hover:text-red-400"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardNavbar;

