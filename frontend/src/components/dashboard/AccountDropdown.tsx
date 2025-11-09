import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun, User, Settings, ChevronDown } from 'lucide-react';
import useAppStore from '../../stores/state/useAppStore';
import AuthService from '../../services/AuthService';

interface AccountDropdownProps {
  onLogout: () => void;
}

const AccountDropdown = ({ onLogout }: AccountDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  const { user, theme, setTheme } = useAppStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    await AuthService.logout();
    onLogout();
    navigate('/login');
    setIsOpen(false);
  };

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user?.name) {
      return user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  // Get display name
  const getDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.email) return user.email.split('@')[0];
    return 'User';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Account Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-2 md:px-3 py-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors text-dark-700 dark:text-dark-300"
        title="Account menu"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
          {getUserInitials()}
        </div>
        
        {/* User Name (Desktop Only) */}
        <span className="hidden md:inline font-medium text-sm max-w-[120px] truncate">
          {getDisplayName()}
        </span>
        
        {/* Chevron Icon */}
        <ChevronDown 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-dark-200 dark:border-dark-700 py-1 z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-dark-200 dark:border-dark-700">
            <p className="text-sm font-semibold text-dark-900 dark:text-white truncate">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-dark-500 dark:text-dark-400 truncate">
              {user?.email}
            </p>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {/* Profile/Settings (optional for future) */}
            <button
              onClick={() => {
                setIsOpen(false);
                // navigate to profile/settings when available
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                // navigate to settings when available
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={handleToggleTheme}
              className="w-full flex items-center justify-between px-4 py-2 text-sm text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
            >
              <div className="flex items-center space-x-3">
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-yellow-500" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-600" />
                )}
                <span>
                  {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </span>
              </div>
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-dark-200 dark:border-dark-700 py-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountDropdown;




