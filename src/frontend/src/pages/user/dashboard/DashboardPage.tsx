import { useState } from 'react';
import { useAppStore, useProjectStore } from '../../../stores/StoresIndex';
import { 
  Database, 
  Cloud, 
  Settings, 
  Menu, 
  X, 
  Plus,
  BarChart3,
  Bell,
  Search,
  ArrowLeft
} from 'lucide-react';
import ProjectOverviewTab from './overview/ProjectOverviewTab';
import ProjectDatabaseTab from './database/ProjectDatabaseTab';
import ProjectStorageTab from './storage/ProjectStoageTab';
import ProjectSettingsTab from './settings/ProjectSettingsTab';

interface DashboardPageProps {
  onBackToProjects?: () => void;
}

const DashboardPage = ({ onBackToProjects }: DashboardPageProps) => {
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const { currentProject } = useProjectStore();
  const [activeSection, setActiveSection] = useState('overview');

  const sidebarItems = [
    { id: 'overview', name: 'Project Overview', icon: BarChart3 },
    { id: 'database', name: 'Database', icon: Database },
    { id: 'storage', name: 'Storage', icon: Cloud },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <ProjectOverviewTab />;
      case 'database':
        return <ProjectDatabaseTab />;
      case 'storage':
        return <ProjectStorageTab />;
      case 'settings':
        return <ProjectSettingsTab />;
      default:
        return <ProjectOverviewTab />;
    }
  };

  return (
    <div className="min-h-screen bg-dark-50 dark:bg-dark-900">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-dark-800 border-r border-dark-200 dark:border-dark-700 transform transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-dark-900 dark:text-white">Skaftin</span>
          </div>
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700"
          >
            <X className="w-5 h-5 text-dark-600 dark:text-dark-300" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-dark-500 dark:text-dark-400 mb-3">Current Project</h3>
            {currentProject ? (
              <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-3">
                <h4 className="font-semibold text-primary-900 dark:text-primary-100">{currentProject.name}</h4>
                <p className="text-sm text-primary-700 dark:text-primary-300">{currentProject.description}</p>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-dark-500 dark:text-dark-400 text-sm mb-3">No project selected</p>
                <button className="btn-primary text-sm px-4 py-2">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </button>
              </div>
            )}
          </div>

          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors ${
                    activeSection === item.id
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="bg-white dark:bg-dark-800 border-b border-dark-200 dark:border-dark-700 h-16 flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700"
            >
              <Menu className="w-5 h-5 text-dark-600 dark:text-dark-300" />
            </button>
            {onBackToProjects && (
              <button
                onClick={onBackToProjects}
                className="flex items-center space-x-2 text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Projects</span>
              </button>
            )}
            <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
              {sidebarItems.find(item => item.id === activeSection)?.name}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-10 pr-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
            <button className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 relative">
              <Bell className="w-5 h-5 text-dark-600 dark:text-dark-300" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};


export default DashboardPage;
