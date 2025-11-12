import { Routes, Route, Navigate, NavLink, useParams } from 'react-router-dom';
import { Users, Shield, Settings, Mail, Lock, Sliders } from 'lucide-react';

const AuthTab = () => {
  const { projectId } = useParams<{ projectId: string }>();

  const navItems = [
    { path: 'users', icon: Users, label: 'Users' },
    { path: 'roles', icon: Shield, label: 'Roles' },
    { path: 'fields', icon: Sliders, label: 'Custom Fields' },
    { path: 'email-settings', icon: Mail, label: 'Email Settings' },
    { path: 'security', icon: Lock, label: 'Security' },
    { path: 'general', icon: Settings, label: 'General' },
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
          <Route path="users" element={<UsersPlaceholder />} />
          <Route path="roles" element={<RolesPlaceholder />} />
          <Route path="fields" element={<FieldsPlaceholder />} />
          <Route path="email-settings" element={<EmailSettingsPlaceholder />} />
          <Route path="security" element={<SecurityPlaceholder />} />
          <Route path="general" element={<GeneralPlaceholder />} />
          <Route path="*" element={<Navigate to="users" replace />} />
        </Routes>
      </div>
    </div>
  );
};

// Placeholder components
const UsersPlaceholder = () => (
  <div className="p-6">
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">User Management</h1>
      <p className="text-dark-600 dark:text-dark-400 mb-6">
        Manage application users, assign roles, and control access.
      </p>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          ℹ️ User management UI coming soon. You can use the API endpoints to manage users programmatically.
        </p>
      </div>
    </div>
  </div>
);

const RolesPlaceholder = () => (
  <div className="p-6">
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">Role Management</h1>
      <p className="text-dark-600 dark:text-dark-400 mb-6">
        Create and manage user roles with custom permissions and session durations.
      </p>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          ℹ️ Role management UI coming soon. Default roles (Admin, User) are already created for your project.
        </p>
      </div>
    </div>
  </div>
);

const FieldsPlaceholder = () => (
  <div className="p-6">
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">Custom Fields</h1>
      <p className="text-dark-600 dark:text-dark-400 mb-6">
        Add custom fields to your user schema like role, idNumber, gender, etc.
      </p>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          ℹ️ Custom fields UI coming soon. You can add fields programmatically via the API.
        </p>
      </div>
    </div>
  </div>
);

const EmailSettingsPlaceholder = () => (
  <div className="p-6">
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">Email Settings</h1>
      <p className="text-dark-600 dark:text-dark-400 mb-6">
        Configure email templates for registration, verification, and password reset.
      </p>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          ℹ️ Email settings UI coming soon. Make sure you have an email provider configured in Communications.
        </p>
      </div>
    </div>
  </div>
);

const SecurityPlaceholder = () => (
  <div className="p-6">
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">Security Settings</h1>
      <p className="text-dark-600 dark:text-dark-400 mb-6">
        Configure session lengths for different roles and security policies.
      </p>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          ℹ️ Security settings UI coming soon. Default session durations: Admin (60 min), User (7 days).
        </p>
      </div>
    </div>
  </div>
);

const GeneralPlaceholder = () => (
  <div className="p-6">
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">General Settings</h1>
      <p className="text-dark-600 dark:text-dark-400 mb-6">
        Configure authentication settings and feature toggles.
      </p>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          ℹ️ General settings UI coming soon. Toggle email verification, password reset, and more.
        </p>
      </div>
    </div>
  </div>
);

export default AuthTab;

