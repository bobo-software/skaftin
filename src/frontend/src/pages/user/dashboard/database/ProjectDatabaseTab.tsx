import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../../../stores/StoresIndex';
import McpService from '../../../../services/McpService';
import { 
  Database, 
  Plus,
  Code
} from 'lucide-react';

const ProjectDatabaseTab = () => {
  const { currentProject } = useAppStore();
  const [tables, setTables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTables = useCallback(async () => {
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
  }, [currentProject]);

  useEffect(() => {
    if (currentProject) {
      loadTables();
    }
  }, [currentProject, loadTables]);

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

export default ProjectDatabaseTab;