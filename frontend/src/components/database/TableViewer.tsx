import React, { useEffect, useState } from 'react';
import { useDatabaseStore, useRealtimeStore } from '../../stores/StoresIndex';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';
import { 
  Database, 
  Plus,
  RefreshCw,
  Search,
  Filter,
  Download,
  Table,
  List
} from 'lucide-react';
import { AppButton, AddRowModal, DataTable, DeleteConfirmModal, SchemaEditor, CsvImportModal, CreateTableModal } from '../ComponentsIndex';

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
    createTable,
    clearError 
  } = useDatabaseStore();
  
  const { joinProject, leaveProject, recentEvents } = useRealtimeStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('data');
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [tableData, setTableData] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'bulk';
    item?: any;
    indices?: number[];
    loading: boolean;
  }>({
    isOpen: false,
    type: 'single',
    loading: false
  });

  useEffect(() => {
    if (projectId) {
      fetchTables(projectId);
      joinProject(projectId);
    }
    
    return () => {
      if (projectId) {
        leaveProject(projectId);
      }
    };
  }, [projectId, fetchTables, joinProject, leaveProject]);

  // Listen for real-time database changes
  useEffect(() => {
    const handleDatabaseChange = (event: any) => {
      console.log('📡 Real-time database change:', event);
      
      // Refresh tables if a table was created/deleted
      if (event.type === 'create_table' || event.type === 'drop_table') {
        fetchTables(projectId);
      }
      
      // Refresh current table if data was modified
      if (event.type === 'insert' || event.type === 'update' || event.type === 'delete') {
        if (selectedTable && event.tableName === selectedTable) {
          fetchTableDetails(projectId, selectedTable);
          fetchTableData(selectedTable);
        }
      }
    };

    // This will be handled by the realtime store
    // The store will automatically call this when events are received
  }, [projectId, selectedTable, fetchTables, fetchTableDetails]);

  const fetchTableData = async (tableName: string) => {
    if (!tableName) return;
    
    setDataLoading(true);
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.post(
        ApiRoutes.DATABASE.SELECT_DATA(projectId, tableName),
        token,
        { limit: 100 }
      );
      console.log('fetchTableData result:', result);
      
      if (result.success && result.data) {
        const data = Array.isArray(result.data) ? result.data : [];
        setTableData(data);
        console.log('Table data set:', data);
      } else {
        console.error('Failed to fetch table data:', result.message);
        setTableData([]);
      }
    } catch (error) {
      console.error('Error fetching table data:', error);
      setTableData([]);
    } finally {
      setDataLoading(false);
    }
  };

  const handleTableSelect = async (tableName: string) => {
    setSelectedTable(tableName);
    setCurrentTable(tables.find(t => t.table_name === tableName) || null);
    await fetchTableDetails(projectId, tableName);
    await fetchTableData(tableName);
  };

  const filteredTables = tables.filter(table =>
    table.table_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveRow = async (data: Record<string, any>) => {
    if (!selectedTable) return false;
    
    try {
      const success = await insertData(projectId, selectedTable, data);
      if (success) {
        console.log('Row added successfully');
        // Refresh table data to show the new row
        await fetchTableData(selectedTable);
      }
      return success;
    } catch (error) {
      console.error('Error adding row:', error);
      return false;
    }
  };

  const handleCreateTable = async (tableName: string, columns: any[]) => {
    try {
      const success = await createTable(projectId, tableName, columns);
      if (success) {
        console.log('Table created successfully');
        // Refresh tables list
        await fetchTables(projectId);
        // Select the newly created table
        await handleTableSelect(tableName);
      }
      return success;
    } catch (error) {
      console.error('Error creating table:', error);
      return false;
    }
  };

  const handleCsvImport = async (dataArray: any[]) => {
    if (!selectedTable) return;
    
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.post(
        ApiRoutes.DATABASE.BULK_INSERT(projectId, selectedTable),
        token,
        { dataArray }
      );
      
      if (result.success) {
        console.log(`Successfully imported ${dataArray.length} rows`);
        setShowCsvImportModal(false);
        await fetchTableData(selectedTable);
        alert(`Successfully imported ${dataArray.length} rows from CSV!`);
      } else {
        console.error('Failed to import CSV:', result.message);
        alert('Failed to import CSV data. Please try again.');
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Error importing CSV data. Please try again.');
    }
  };

  const handleDeleteRow = (row: any, index: number) => {
    setDeleteModal({
      isOpen: true,
      type: 'single',
      item: row,
      indices: [index],
      loading: false
    });
  };

  const handleBulkDelete = (indices: number[]) => {
    setDeleteModal({
      isOpen: true,
      type: 'bulk',
      indices,
      loading: false
    });
  };

  const confirmDelete = async () => {
    if (!selectedTable || !deleteModal.indices) return;

    setDeleteModal(prev => ({ ...prev, loading: true }));

    try {
      const token = localStorage.getItem('skaftin-token') || '';
      
      if (deleteModal.type === 'single') {
        // Single row delete
        const row = deleteModal.item;
        const whereClause = { id: row.id };
        const result = await RequestUtils.delete(
          ApiRoutes.DATABASE.DELETE_DATA(projectId, selectedTable),
          token,
          { where: whereClause }
        );
        
        if (result.success) {
          console.log('Row deleted successfully');
          await fetchTableData(selectedTable);
          setDeleteModal({ isOpen: false, type: 'single', loading: false });
        } else {
          console.error('Failed to delete row:', result.message);
          alert('Failed to delete row. Please try again.');
        }
      } else {
        // Bulk delete
        let successCount = 0;
        let errorCount = 0;
        
        for (const index of deleteModal.indices!) {
          const row = tableData[index];
          const whereClause = { id: row.id };
          const result = await RequestUtils.delete(
            ApiRoutes.DATABASE.DELETE_DATA(projectId, selectedTable),
            token,
            { where: whereClause }
          );
          
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            console.error('Failed to delete row:', row.id, result.message);
          }
        }
        
        if (errorCount > 0) {
          alert(`Deleted ${successCount} rows successfully. ${errorCount} rows failed to delete.`);
        } else {
          console.log(`Successfully deleted ${successCount} rows`);
        }
        
        await fetchTableData(selectedTable);
        setDeleteModal({ isOpen: false, type: 'bulk', loading: false });
      }
    } catch (error) {
      console.error('Error deleting rows:', error);
      alert('Error deleting rows. Please try again.');
      setDeleteModal(prev => ({ ...prev, loading: false }));
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
    <div className="">
      {/* Header */}
      <div className="flex items-center justify-between">
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

      <div className="flex h-screen">
        {/* Tables Sidebar */}
        <div className="w-80 flex-shrink-0 border-r border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800">
          <div className="h-full flex flex-col">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-dark-200 dark:border-dark-700 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-dark-900 dark:text-white">Tables</h4>
                <span className="text-xs text-dark-500 dark:text-dark-400 bg-dark-100 dark:bg-dark-700 px-2 py-1 rounded">
                  {tables.length}
                </span>
              </div>
              
              <div className="flex items-center space-x-2 mb-3">
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
                  onClick={() => setShowCreateTableModal(true)}
                >
                  Create
                </AppButton>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400" />
                <input
                  type="text"
                  placeholder="Search tables..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Tables List - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredTables.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="w-12 h-12 text-dark-300 dark:text-dark-600 mx-auto mb-3" />
                  <p className="text-sm text-dark-600 dark:text-dark-300">
                    {searchTerm ? 'No tables found' : 'No tables yet'}
                  </p>
                  <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                    {searchTerm ? 'Try a different search term' : 'Create your first table'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredTables.map((table) => (
                    <div
                      key={table.table_name}
                      onClick={() => handleTableSelect(table.table_name)}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedTable === table.table_name
                          ? 'bg-primary-100 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 shadow-sm'
                          : 'bg-white dark:bg-dark-700 hover:bg-dark-50 dark:hover:bg-dark-600 border border-transparent hover:border-dark-200 dark:hover:border-dark-600'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Database className="w-4 h-4 text-primary-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-dark-900 dark:text-white truncate">
                            {table.table_name}
                          </p>
                          <p className="text-xs text-dark-500 dark:text-dark-400">
                            {table.table_type}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          {currentTable ? (
            <div className="h-full flex flex-col">
              {/* Content Header */}
              <div className="p-6 border-b border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xl font-semibold text-dark-900 dark:text-white">
                      {currentTable.table_name}
                    </h4>
                    <p className="text-sm text-dark-600 dark:text-dark-300 mt-1">
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
              </div>

              {/* Tab Navigation */}
              <div className="px-6 border-b border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900">
                <nav className="flex space-x-6">
                  {[
                    { id: 'data', name: 'Data', icon: List },
                    { id: 'schema', name: 'Schema', icon: Table },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
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
              <div className="flex-1 overflow-hidden">
                {activeTab === 'schema' && (
                  <div className="h-full overflow-y-auto p-6">
                    {currentTable.columns ? (
                      <SchemaEditor
                        projectId={projectId}
                        tableName={currentTable.table_name}
                        columns={currentTable.columns}
                        loading={loading}
                        onSchemaChange={() => {
                          fetchTableDetails(projectId, selectedTable!);
                        }}
                      />
                    ) : (
                      <div className="text-center py-8">
                        <Database className="w-12 h-12 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
                        <p className="text-dark-600 dark:text-dark-300">No column information available</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'data' && (
                  <div className="h-full overflow-hidden">
                    <DataTable
                      data={tableData}
                      loading={dataLoading}
                      onRefresh={() => selectedTable && fetchTableData(selectedTable)}
                      onAddRow={() => setShowAddRowModal(true)}
                      onCsvImport={() => setShowCsvImportModal(true)}
                      onEditRow={async (updatedRow, index) => {
                        if (!selectedTable) return;
                        
                        try {
                          const token = localStorage.getItem('skaftin-token') || '';
                          // Find the original row to get the ID for the where clause
                          const originalRow = tableData[index];
                          const whereClause = { id: originalRow.id };
                          
                          // Remove the id from the update data
                          const { id, ...updateData } = updatedRow;
                          
                          const result = await RequestUtils.put(
                            ApiRoutes.DATABASE.UPDATE_DATA(projectId, selectedTable),
                            token,
                            { data: updateData, where: whereClause }
                          );
                          
                          if (result.success) {
                            console.log('Row updated successfully');
                            await fetchTableData(selectedTable);
                          } else {
                            console.error('Failed to update row:', result.message);
                            alert('Failed to update row. Please try again.');
                          }
                        } catch (error) {
                          console.error('Error updating row:', error);
                          alert('Error updating row. Please try again.');
                        }
                      }}
                      onBulkDelete={handleBulkDelete}
                      searchable={true}
                      selectable={true}
                      sortable={true}
                      pagination={true}
                      pageSize={10}
                    />
                  </div>
                )}

              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-white dark:bg-dark-900">
              <div className="text-center py-12">
                <Database className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
                  Select a Table
                </h4>
                <p className="text-dark-600 dark:text-dark-300">
                  Choose a table from the sidebar to view its structure and data
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

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, type: 'single', loading: false })}
        onConfirm={confirmDelete}
        title={deleteModal.type === 'single' ? `Delete Row` : `Delete ${deleteModal.indices?.length || 0} Rows`}
        message={deleteModal.type === 'single' 
          ? 'Are you sure you want to delete this row? This action cannot be undone.'
          : `Are you sure you want to delete ${deleteModal.indices?.length || 0} rows? This action cannot be undone.`
        }
        itemName="row"
        itemCount={deleteModal.indices?.length || 1}
        loading={deleteModal.loading}
        variant={deleteModal.type}
      />

      {/* CSV Import Modal */}
      {currentTable && (
        <CsvImportModal
          isOpen={showCsvImportModal}
          onClose={() => setShowCsvImportModal(false)}
          onImport={handleCsvImport}
          tableColumns={currentTable.columns || []}
          loading={dataLoading}
        />
      )}

      {/* Create Table Modal */}
      <CreateTableModal
        isOpen={showCreateTableModal}
        onClose={() => setShowCreateTableModal(false)}
        onCreate={handleCreateTable}
      />
    </div>
  );
};

export default TableViewer;
