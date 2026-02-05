import { NavLink } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  isCollapsed?: boolean;
  end?: boolean;
}

const SidebarItem = ({ to, icon: Icon, label, isCollapsed = false, end = false }: SidebarItemProps) => {
  const shouldShowFull = !isCollapsed;

  return (
    <NavLink
      to={to}
      end={end}
      title={isCollapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center ${shouldShowFull ? 'space-x-3 px-4' : 'justify-center px-2'} py-3 rounded-lg transition-colors ${
          isActive
            ? 'bg-primary-600 text-white'
            : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 hover:text-dark-900 dark:hover:text-white'
        }`
      }
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {shouldShowFull && <span className="font-medium">{label}</span>}
    </NavLink>
  );
};

export default SidebarItem;