import { useEffect, useState } from 'react';
import { useAppStore, useProjectStore } from '../stores/StoresIndex';
import McpService from '../services/McpService';
import { 
  Database, 
  Cloud, 
  Settings, 
  Menu, 
  X, 
  Plus,
  BarChart3,
  Code,
  Bell,
  Search,
  ArrowLeft,
  Calendar,
  Clock,
  Trash2
} from 'lucide-react';

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
        return <ProjectOverview />;
      case 'database':
        return <DatabaseSection />;
      case 'storage':
        return <StorageSection />;
      case 'settings':
        return <SettingsSection />;
      default:
        return <ProjectOverview />;
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

// Project Overview Component
const ProjectOverview = () => {
  const { currentProject, projectStats, getProjectStats } = useProjectStore();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentProject) {
      loadProjectStats();
    }
  }, [currentProject]);

  const loadProjectStats = async () => {
    setIsLoading(true);
    await getProjectStats(currentProject.id);
    setIsLoading(false);
  };

  if (!currentProject) {
    return (
      <div className="text-center py-12">
        <Database className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">No Project Selected</h3>
        <p className="text-dark-600 dark:text-dark-300 mb-6">Create or select a project to get started</p>
        <button className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Create Project
        </button>
      </div>
    );
  }

  // Format creation date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Project Information Card */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">{currentProject.name}</h2>
            <p className="text-dark-600 dark:text-dark-300">{currentProject.description}</p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-dark-500 dark:text-dark-400">
            <Calendar className="w-4 h-4" />
            <span>Created {formatDate(currentProject.created_at)}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-dark-500 dark:text-dark-400">Database Schema</p>
              <p className="font-semibold text-dark-900 dark:text-white">{currentProject.name.toLowerCase()}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-dark-500 dark:text-dark-400">Storage Bucket</p>
              <p className="font-semibold text-dark-900 dark:text-white">{currentProject.name.toLowerCase()}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-dark-500 dark:text-dark-400">Status</p>
              <p className="font-semibold text-green-600 dark:text-green-400">Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-600 dark:text-dark-300">Database Tables</p>
              <p className="text-2xl font-bold text-dark-900 dark:text-white">
                {isLoading ? (
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  projectStats?.tableCount || 0
                )}
              </p>
            </div>
            <Database className="w-8 h-8 text-primary-500" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-600 dark:text-dark-300">Storage Files</p>
              <p className="text-2xl font-bold text-dark-900 dark:text-white">
                {isLoading ? (
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  projectStats?.fileCount || 0
                )}
              </p>
            </div>
            <Cloud className="w-8 h-8 text-primary-500" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-600 dark:text-dark-300">API Calls</p>
              <p className="text-2xl font-bold text-dark-900 dark:text-white">
                {isLoading ? (
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  projectStats?.apiCalls || 0
                )}
              </p>
            </div>
            <Code className="w-8 h-8 text-primary-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center text-sm text-dark-600 dark:text-dark-300">
              <div className="w-2 h-2 bg-primary-500 rounded-full mr-3"></div>
              Project created successfully
            </div>
            <div className="flex items-center text-sm text-dark-600 dark:text-dark-300">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              Database schema initialized
            </div>
            <div className="flex items-center text-sm text-dark-600 dark:text-dark-300">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              Storage bucket created
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full btn-secondary text-left">
              <Database className="w-4 h-4 mr-2" />
              Create Table
            </button>
            <button className="w-full btn-secondary text-left">
              <Cloud className="w-4 h-4 mr-2" />
              Upload File
            </button>
            <button className="w-full btn-secondary text-left">
              <Code className="w-4 h-4 mr-2" />
              Open SQL Editor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Database Section Component
const DatabaseSection = () => {
  const { currentProject } = useAppStore();
  const [tables, setTables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (currentProject) {
      loadTables();
    }
  }, [currentProject]);

  const loadTables = async () => {
    try {
      setIsLoading(true);
      const response = await McpService.listTables(currentProject.id);
      
      if (response.success && response.result.success) {
        setTables(response.result.data || []);
      }
    } catch (error) {
      console.error('Error loading tables:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-dark-900 dark:text-white">Database</h2>
        <button className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Create Table
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Tables</h3>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-dark-600 dark:text-dark-300">Loading tables...</p>
            </div>
          ) : tables.length === 0 ? (
            <div className="text-center py-8">
              <Database className="w-12 h-12 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
              <p className="text-dark-600 dark:text-dark-300">No tables created yet</p>
              <button className="btn-primary mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Table
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {tables.map((table, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Database className="w-5 h-5 text-primary-500" />
                    <div className="flex flex-col">
                      <span className="font-medium text-dark-900 dark:text-white">{table.table_name}</span>
                      <span className="text-xs text-dark-500 dark:text-dark-400">{table.table_type}</span>
                    </div>
                  </div>
                  <button className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-300">
                    <Code className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">SQL Editor</h3>
          <div className="bg-dark-900 rounded-lg p-4 font-mono text-sm">
            <div className="text-green-400">-- Write your SQL queries here</div>
            <div className="text-blue-400">SELECT * FROM users;</div>
          </div>
          <button className="btn-primary mt-4 w-full">
            <Code className="w-4 h-4 mr-2" />
            Execute Query
          </button>
        </div>
      </div>
    </div>
  );
};

// Storage Section Component
const StorageSection = () => {
  const { currentProject } = useAppStore();
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (currentProject) {
      loadFiles();
    }
  }, [currentProject]);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      const response = await McpService.listFiles(currentProject.id);
      
      if (response.success && response.result.success) {
        setFiles(response.result.data || []);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-dark-900 dark:text-white">Storage</h2>
        <button className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Upload File
        </button>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-dark-600 dark:text-dark-300">Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12">
            <Cloud className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">No Files Uploaded</h3>
            <p className="text-dark-600 dark:text-dark-300 mb-6">Upload your first file to get started</p>
            <button className="btn-primary">
              <Plus className="w-5 h-5 mr-2" />
              Upload File
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Files</h3>
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Cloud className="w-5 h-5 text-primary-500" />
                  <span className="font-medium text-dark-900 dark:text-white">{file.name}</span>
                  <span className="text-sm text-dark-500 dark:text-dark-400">({file.size} bytes)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-300">
                    <Code className="w-4 h-4" />
                  </button>
                  <button className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Settings Section Component
const SettingsSection = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-dark-900 dark:text-white">Settings</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Project Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Project Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                placeholder="Enter project name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Description
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                placeholder="Enter project description"
              />
            </div>
            <button className="btn-primary">
              Save Changes
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Danger Zone</h3>
          <div className="space-y-4">
            <button className="w-full btn-secondary text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20">
              Delete Project
            </button>
            <button className="w-full btn-secondary text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20">
              Reset Database
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
