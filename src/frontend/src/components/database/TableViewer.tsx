import React, { useEffect, useState } from 'react';
import { useDatabaseStore } from '../../stores/StoresIndex';
import { 
  Database, 
  Eye, 
  Edit3, 
  Trash2, 
  Plus,
  RefreshCw,
  Search,
  Filter,
  Download,
  Table,
  List,
  Settings
} from 'lucide-react';
import { AppButton, AddRowModal } from '../ComponentsIndex';

interface TableViewerProps {
  projectId: string;
}

const TableViewer = ({ projectId }: TableViewerProps) => {
  const { 
    tables, 
    currentTable, 
    loading, 
    error, 
    fetchTables, 
    fetchTableDetails, 
    setCurrentTable,
    insertData,
    clearError 
  } = useDatabaseStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('structure');
  const [showAddRowModal, setShowAddRowModal] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchTables(projectId);
    }
  }, [projectId, fetchTables]);

  const handleTableSelect = async (tableName: string) => {
    setSelectedTable(tableName);
    setCurrentTable(tables.find(t => t.table_name === tableName) || null);
    await fetchTableDetails(projectId, tableName);
  };

  const filteredTables = tables.filter(table =>
    table.table_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveRow = async (data: Record<string, any>) => {
    if (!selectedTable) return false;
    
    try {
      const success = await insertData(projectId, selectedTable, data);
      if (success) {
        // Optionally refresh table data or show success message
        console.log('Row added successfully');
      }
      return success;
    } catch (error) {
      console.error('Error adding row:', error);
      return false;
    }
  };

  if (loading && tables.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-dark-600 dark:text-dark-300">Loading tables...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Table Viewer</h3>
          <p className="text-sm text-dark-600 dark:text-dark-300">
            Browse and manage your database tables
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <AppButton
            variant="secondary"
            size="sm"
            onClick={() => fetchTables(projectId)}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </AppButton>
          <AppButton
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
          >
            Create Table
          </AppButton>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button 
              onClick={clearError}
              className="text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tables List - Compact */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-dark-900 dark:text-white text-sm">Tables</h4>
              <span className="text-xs text-dark-500 dark:text-dark-400">
                {tables.length}
              </span>
            </div>
            
            <div className="relative mb-3">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-dark-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-1 max-h-80 overflow-y-auto">
              {filteredTables.length === 0 ? (
                <div className="text-center py-6">
                  <Database className="w-8 h-8 text-dark-300 dark:text-dark-600 mx-auto mb-2" />
                  <p className="text-xs text-dark-600 dark:text-dark-300">
                    {searchTerm ? 'No matches' : 'No tables'}
                  </p>
                </div>
              ) : (
                filteredTables.map((table) => (
                  <div
                    key={table.table_name}
                    onClick={() => handleTableSelect(table.table_name)}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      selectedTable === table.table_name
                        ? 'bg-primary-100 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800'
                        : 'bg-dark-50 dark:bg-dark-700 hover:bg-dark-100 dark:hover:bg-dark-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Database className="w-3 h-3 text-primary-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-dark-900 dark:text-white truncate">
                            {table.table_name}
                          </p>
                          <p className="text-xs text-dark-500 dark:text-dark-400">
                            {table.table_type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button 
                          className="p-1 rounded hover:bg-dark-200 dark:hover:bg-dark-600"
                          title="View"
                        >
                          <Eye className="w-3 h-3 text-dark-400" />
                        </button>
                        <button 
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Table Details with Tabs */}
        <div className="lg:col-span-3">
          {currentTable ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-dark-900 dark:text-white">
                    {currentTable.table_name}
                  </h4>
                  <p className="text-sm text-dark-600 dark:text-dark-300">
                    {currentTable.table_type} • {currentTable.columns?.length || 0} columns
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <AppButton variant="secondary" size="sm" icon={<Filter className="w-4 h-4" />}>
                    Filter
                  </AppButton>
                  <AppButton variant="secondary" size="sm" icon={<Download className="w-4 h-4" />}>
                    Export
                  </AppButton>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="border-b border-dark-200 dark:border-dark-700 mb-4">
                <nav className="flex space-x-6">
                  {[
                    { id: 'structure', name: 'Structure', icon: Table },
                    { id: 'data', name: 'Data', icon: List },
                    { id: 'settings', name: 'Settings', icon: Settings }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                          activeTab === tab.id
                            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300 hover:border-dark-300 dark:hover:border-dark-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.name}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="mt-4">
                {activeTab === 'structure' && (
                  <div>
                    {loading ? (
                      <div className="text-center py-8">
                        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-dark-600 dark:text-dark-300">Loading table structure...</p>
                      </div>
                    ) : currentTable.columns ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-dark-200 dark:border-dark-700">
                              <th className="text-left py-2 px-3 text-sm font-medium text-dark-700 dark:text-dark-300">
                                Column
                              </th>
                              <th className="text-left py-2 px-3 text-sm font-medium text-dark-700 dark:text-dark-300">
                                Type
                              </th>
                              <th className="text-left py-2 px-3 text-sm font-medium text-dark-700 dark:text-dark-300">
                                Nullable
                              </th>
                              <th className="text-left py-2 px-3 text-sm font-medium text-dark-700 dark:text-dark-300">
                                Default
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentTable.columns.map((column, index) => (
                              <tr key={index} className="border-b border-dark-100 dark:border-dark-800">
                                <td className="py-2 px-3 text-sm text-dark-900 dark:text-white">
                                  {column.column_name}
                                </td>
                                <td className="py-2 px-3 text-sm text-dark-600 dark:text-dark-300">
                                  {column.data_type}
                                  {column.character_maximum_length && (
                                    <span className="text-xs text-dark-500 dark:text-dark-400">
                                      ({column.character_maximum_length})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-sm">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    column.is_nullable 
                                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                                      : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                  }`}>
                                    {column.is_nullable ? 'Yes' : 'No'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-sm text-dark-600 dark:text-dark-300">
                                  {column.column_default || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Database className="w-12 h-12 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
                        <p className="text-dark-600 dark:text-dark-300">No column information available</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'data' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-dark-900 dark:text-white">
                          Table Data
                        </h4>
                        <p className="text-sm text-dark-600 dark:text-dark-300">
                          Browse and manage table data
                        </p>
                      </div>
                      <AppButton 
                        variant="primary" 
                        icon={<Plus className="w-4 h-4" />}
                        onClick={() => setShowAddRowModal(true)}
                      >
                        Add Row
                      </AppButton>
                    </div>
                    
                    <div className="text-center py-8">
                      <List className="w-12 h-12 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
                        No Data Displayed
                      </h4>
                      <p className="text-dark-600 dark:text-dark-300 mb-4">
                        Data browsing functionality will be implemented here
                      </p>
                      <p className="text-sm text-dark-500 dark:text-dark-400">
                        Use the "Add Row" button to insert new data
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div>
                    <div className="text-center py-8">
                      <Settings className="w-12 h-12 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
                        Table Settings
                      </h4>
                      <p className="text-dark-600 dark:text-dark-300 mb-4">
                        Manage table properties and constraints
                      </p>
                      <div className="flex items-center justify-center space-x-3">
                        <AppButton variant="secondary" icon={<Edit3 className="w-4 h-4" />}>
                          Edit Table
                        </AppButton>
                        <AppButton variant="danger" icon={<Trash2 className="w-4 h-4" />}>
                          Delete Table
                        </AppButton>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="text-center py-12">
                <Database className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
                  Select a Table
                </h4>
                <p className="text-dark-600 dark:text-dark-300">
                  Choose a table from the list to view its structure and data
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Row Modal */}
      {currentTable && (
        <AddRowModal
          isOpen={showAddRowModal}
          onClose={() => setShowAddRowModal(false)}
          onSave={handleSaveRow}
          columns={currentTable.columns || []}
          tableName={currentTable.table_name}
        />
      )}
    </div>
  );
};

export default TableViewer;
