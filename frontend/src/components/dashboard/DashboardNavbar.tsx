import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Menu, X, Database, Cloud, Home, Settings, ChevronRight, Mail, Shield, BarChart3 } from 'lucide-react';
import AccountDropdown from './AccountDropdown';
import OrganizationSwitcher from './OrganizationSwitcher';
import AppText from '../forms/AppText';
import socketService from '../../services/SocketService';

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
  const [wsStatus, setWsStatus] = useState(socketService.getConnectionStatus());

  // Get current section from URL
  const getCurrentSection = () => {
    const path = location.pathname;
    if (path.includes('/database')) return { name: 'Database', icon: Database, color: 'text-blue-600 dark:text-blue-400' };
    if (path.includes('/storage')) return { name: 'Storage', icon: Cloud, color: 'text-purple-600 dark:text-purple-400' };
    if (path.includes('/analytics')) return { name: 'Analytics', icon: BarChart3, color: 'text-orange-600 dark:text-orange-400' };
    if (path.includes('/auth')) return { name: 'Auth', icon: Shield, color: 'text-indigo-600 dark:text-indigo-400' };
    if (path.includes('/communications')) return { name: 'Communications', icon: Mail, color: 'text-green-600 dark:text-green-400' };
    if (path.includes('/settings')) return { name: 'Settings', icon: Settings, color: 'text-gray-600 dark:text-gray-400' };
    return { name: 'Overview', icon: Home, color: 'text-primary-600 dark:text-primary-400' };
  };

  const currentSection = getCurrentSection();
  const SectionIcon = currentSection.icon;

  useEffect(() => {
    const updateStatus = () => setWsStatus(socketService.getConnectionStatus());
    updateStatus();
    const timer = window.setInterval(updateStatus, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const getWsStatusColor = () => {
    if (wsStatus.isConnected) return 'bg-green-500';
    if (wsStatus.reconnectAttempts > 0) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const handleWsStatusClick = () => {
    const before = socketService.getConnectionStatus();
    console.log('🛠️ WebSocket debug reconnect triggered from navbar', {
      before,
      projectName,
      route: location.pathname,
    });

    socketService.reconnect();

    setTimeout(() => {
      const after = socketService.getConnectionStatus();
      console.log('🛠️ WebSocket debug reconnect status after trigger', { after });
      setWsStatus(after);
    }, 500);
  };

  return (
    <div className="sticky top-0 z-40 h-12 border-b border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 flex items-center justify-between px-4 md:px-6 flex-shrink-0 shadow-sm">
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

        {/* Organization Switcher */}
        <OrganizationSwitcher />

        {/* Separator */}
        <ChevronRight className="w-4 h-4 text-dark-400 dark:text-dark-500 flex-shrink-0 hidden lg:block" />

        {/* Breadcrumb with Project Name and Current Section */}
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          {/* Project Name */}
          <div className="flex items-center space-x-2 min-w-0">
            <AppText
              children={projectName}
              size="xs"
              color="default"
              weight="medium"
              align="left"
              truncate={true}
            />
            
            {/* Separator and Current Section (Desktop) */}
            <div className="hidden sm:flex items-center space-x-2">
              <ChevronRight className="w-4 h-4 text-dark-400 dark:text-dark-500 flex-shrink-0" />
              <div className="flex items-center space-x-2">
                <SectionIcon className={`w-4 h-4 flex-shrink-0 ${currentSection.color}`} />
                <AppText
                  children={currentSection.name}
                  size="xs"
                  color="default"
                  weight="medium"
                  align="left"
                  truncate={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center space-x-1 md:space-x-2 flex-shrink-0">
        {/* WebSocket Connectivity Indicator */}
        <button
          type="button"
          onClick={handleWsStatusClick}
          className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md bg-dark-50 dark:bg-dark-700 hover:bg-dark-100 dark:hover:bg-dark-600 transition-colors cursor-pointer"
          title={
            wsStatus.isConnected
              ? 'WebSocket connected (click to re-test connection)'
              : `WebSocket disconnected${wsStatus.reconnectAttempts > 0 ? ` (retries: ${wsStatus.reconnectAttempts})` : ''} - click to reconnect`
          }
        >
          <span className={`w-2 h-2 rounded-full ${getWsStatusColor()}`} />
          <AppText
            children={wsStatus.isConnected ? 'Realtime' : 'Offline'}
            size="xs"
            color="default"
            weight="medium"
            align="left"
          />
        </button>

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

