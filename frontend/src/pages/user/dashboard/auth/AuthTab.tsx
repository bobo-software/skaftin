import { Routes, Route, Navigate, NavLink, useParams } from 'react-router-dom';
import { Users, Shield, Settings, MessageSquare, Lock, Sliders, Database } from 'lucide-react';
import AuthUsersTab from './tabs/AuthUsersTab';
import AuthRolesTab from './tabs/AuthRolesTab';
import AuthCustomFieldsTab from './tabs/AuthCustomFieldsTab';
import AuthEmailSettingsTab from './tabs/AuthEmailSettingsTab';
import AuthGeneralSettingsTab from './tabs/AuthGeneralSettingsTab';
import AuthSuperTokensTab from './tabs/AuthSuperTokensTab';
import UserDetailsPage from './UserDetailsPage';

const AuthTab = () => {
  const { projectId } = useParams<{ projectId: string }>();

  const navItems = [
    { path: 'users', icon: Users, label: 'Users' },
    { path: 'roles', icon: Shield, label: 'Roles' },
    { path: 'fields', icon: Sliders, label: 'Custom Fields' },
    { path: 'messaging', icon: MessageSquare, label: 'Messaging' },
    { path: 'security', icon: Lock, label: 'Security' },
    { path: 'general', icon: Settings, label: 'General' },
    { path: 'supertokens', icon: Database, label: 'SuperTokens' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Sub-navigation tabs */}
      <div className="bg-white dark:bg-dark-800 border-b border-dark-200 dark:border-dark-700 px-6">
        <div className="flex space-x-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={`/projects/${projectId}/auth/${item.path}`}
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Sub-route content */}
      <div className="flex-1 overflow-y-auto">
        <Routes>
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<AuthUsersTab />} />
          <Route path="users/:userId" element={<UserDetailsPage />} />
          <Route path="roles" element={<AuthRolesTab />} />
          <Route path="fields" element={<AuthCustomFieldsTab />} />
          <Route path="messaging" element={<AuthEmailSettingsTab />} />
          <Route path="security" element={<SecurityPlaceholder />} />
          <Route path="general" element={<AuthGeneralSettingsTab />} />
          <Route path="supertokens" element={<AuthSuperTokensTab />} />
          <Route path="*" element={<Navigate to="users" replace />} />
        </Routes>
      </div>
    </div>
  );
};

// Security Placeholder (will be merged with general settings)
const SecurityPlaceholder = () => (
  <div className="p-6">
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">Security Settings</h1>
      <p className="text-dark-600 dark:text-dark-400 mb-6">
        Configure session lengths for different roles - managed in General Settings.
      </p>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          ℹ️ Session duration management is available in Roles tab. Default durations: Admin (60 min), User (7 days).
        </p>
      </div>
    </div>
  </div>
);

export default AuthTab;

