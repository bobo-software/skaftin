import React, { useState, useEffect } from 'react';
import { useDatabaseStore, useProjectStore } from '../../stores/StoresIndex';
import { 
  Play, 
  Save, 
  Download, 
  Upload, 
  History, 
  BookOpen,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  Trash2
} from 'lucide-react';
import { AppButton } from '../ComponentsIndex';

interface SqlEditorProps {
  projectId: string;
}

const SqlEditor = ({ projectId }: SqlEditorProps) => {
  const { 
    queryResults, 
    savedQueries, 
    loading, 
    error, 
    executeQuery, 
    saveQuery,
    deleteQuery,
    clearError 
  } = useDatabaseStore();
  
  const [query, setQuery] = useState('');
  const [queryName, setQueryName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  const handleExecute = async () => {
    if (!query.trim()) return;
    
    const startTime = Date.now();
    const result = await executeQuery(projectId, query);
    const endTime = Date.now();
    
    setExecutionTime(endTime - startTime);
  };

  const handleSaveQuery = () => {
    if (!query.trim() || !queryName.trim()) return;
    
    saveQuery({
      name: queryName,
      query: query,
      isFavorite: false
    });
    
    setQueryName('');
    setShowSaveModal(false);
  };

  const handleLoadQuery = (savedQuery: any) => {
    setQuery(savedQuery.query);
  };

  const handleCopyResult = () => {
    if (queryResults) {
      const csvData = [
        queryResults.columns.join(','),
        ...queryResults.rows.map(row => 
          queryResults.columns.map(col => row[col] || '').join(',')
        )
      ].join('\n');
      
      navigator.clipboard.writeText(csvData);
    }
  };

  const predefinedQueries = [
    { name: 'Show Tables', query: 'SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\';' },
    { name: 'Show Columns', query: 'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'your_table\';' },
    { name: 'Count Rows', query: 'SELECT COUNT(*) FROM your_table;' },
    { name: 'Show Indexes', query: 'SELECT indexname, tablename FROM pg_indexes WHERE schemaname = \'public\';' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white">SQL Editor</h3>
          <p className="text-sm text-dark-600 dark:text-dark-300">
            Write and execute SQL queries against your database
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <AppButton
            variant="secondary"
            size="sm"
            icon={<History className="w-4 h-4" />}
          >
            History
          </AppButton>
          <AppButton
            variant="secondary"
            size="sm"
            icon={<BookOpen className="w-4 h-4" />}
          >
            Docs
          </AppButton>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
            <button 
              onClick={clearError}
              className="text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query Editor */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-dark-900 dark:text-white">Query Editor</h4>
              <div className="flex items-center space-x-2">
                <AppButton
                  variant="secondary"
                  size="sm"
                  icon={<Upload className="w-4 h-4" />}
                >
                  Import
                </AppButton>
                <AppButton
                  variant="secondary"
                  size="sm"
                  icon={<Download className="w-4 h-4" />}
                >
                  Export
                </AppButton>
              </div>
            </div>
            
            <div className="space-y-4">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your SQL query here..."
                className="w-full h-64 px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                style={{ fontFamily: 'Monaco, Consolas, "Courier New", monospace' }}
              />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AppButton
                    variant="primary"
                    onClick={handleExecute}
                    loading={loading}
                    icon={<Play className="w-4 h-4" />}
                  >
                    Execute
                  </AppButton>
                  <AppButton
                    variant="secondary"
                    onClick={() => setShowSaveModal(true)}
                    icon={<Save className="w-4 h-4" />}
                  >
                    Save Query
                  </AppButton>
                </div>
                
                {executionTime && (
                  <div className="flex items-center space-x-1 text-sm text-dark-600 dark:text-dark-300">
                    <Clock className="w-4 h-4" />
                    <span>{executionTime}ms</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Query Results */}
          {queryResults && (
            <div className="card mt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <h4 className="font-semibold text-dark-900 dark:text-white">Query Results</h4>
                  <span className="text-sm text-dark-600 dark:text-dark-300">
                    {queryResults.rowCount} row{queryResults.rowCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <AppButton
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyResult}
                    icon={<Copy className="w-4 h-4" />}
                  >
                    Copy
                  </AppButton>
                  <AppButton
                    variant="secondary"
                    size="sm"
                    icon={<Download className="w-4 h-4" />}
                  >
                    Export
                  </AppButton>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-200 dark:border-dark-700">
                      {queryResults.columns.map((column, index) => (
                        <th key={index} className="text-left py-2 px-3 text-sm font-medium text-dark-700 dark:text-dark-300">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResults.rows.slice(0, 100).map((row, index) => (
                      <tr key={index} className="border-b border-dark-100 dark:border-dark-800">
                        {queryResults.columns.map((column, colIndex) => (
                          <td key={colIndex} className="py-2 px-3 text-sm text-dark-900 dark:text-white">
                            {row[column] !== null ? String(row[column]) : <span className="text-dark-400">NULL</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {queryResults.rows.length > 100 && (
                  <div className="text-center py-4 text-sm text-dark-600 dark:text-dark-300">
                    Showing first 100 rows of {queryResults.rowCount} total rows
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Queries */}
          <div className="card">
            <h4 className="font-semibold text-dark-900 dark:text-white mb-4">Quick Queries</h4>
            <div className="space-y-2">
              {predefinedQueries.map((predefined, index) => (
                <button
                  key={index}
                  onClick={() => setQuery(predefined.query)}
                  className="w-full text-left p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-primary-500" />
                    <span className="text-sm text-dark-900 dark:text-white">{predefined.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Saved Queries */}
          <div className="card">
            <h4 className="font-semibold text-dark-900 dark:text-white mb-4">Saved Queries</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {savedQueries.length === 0 ? (
                <p className="text-sm text-dark-600 dark:text-dark-300">No saved queries</p>
              ) : (
                savedQueries.map((savedQuery) => (
                  <div key={savedQuery.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700">
                    <button
                      onClick={() => handleLoadQuery(savedQuery)}
                      className="flex-1 text-left"
                    >
                      <p className="text-sm font-medium text-dark-900 dark:text-white">{savedQuery.name}</p>
                      <p className="text-xs text-dark-600 dark:text-dark-300 truncate">
                        {savedQuery.query.substring(0, 50)}...
                      </p>
                    </button>
                    <button
                      onClick={() => deleteQuery(savedQuery.id)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Query Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
                Save Query
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    Query Name
                  </label>
                  <input
                    type="text"
                    value={queryName}
                    onChange={(e) => setQueryName(e.target.value)}
                    placeholder="Enter query name"
                    className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center justify-end space-x-3">
                  <AppButton
                    variant="secondary"
                    onClick={() => setShowSaveModal(false)}
                  >
                    Cancel
                  </AppButton>
                  <AppButton
                    variant="primary"
                    onClick={handleSaveQuery}
                    disabled={!queryName.trim()}
                  >
                    Save
                  </AppButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SqlEditor;
