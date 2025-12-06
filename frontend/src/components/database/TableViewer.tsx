import React, { useEffect, useState } from 'react';
import { useDatabaseStore, useRealtimeStore } from '../../stores/StoresIndex';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';
import ToastUtils from '../../utils/ToastUtils';
import { Database, Plus, Search, Table, List, Settings, Upload, Download, Trash2 } from 'lucide-react';
import { AppButton, AddRowModal, DataTable, DeleteConfirmModal, SchemaEditor, CsvImportModal, CreateTableModal, TableItem, TableSettingsTab, DatabaseImportModal, DatabaseExportModal, AppText } from '../ComponentsIndex';

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
    importDatabaseDump,
    exportDatabaseDump,
    clearError 
  } = useDatabaseStore();
  
  const { joinProject, leaveProject, recentEvents, initialize: initializeRealtime } = useRealtimeStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedTablesForDelete, setSelectedTablesForDelete] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('data');
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [tableData, setTableData] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'bulk' | 'table';
    item?: any;
    indices?: number[];
    tableName?: string;
    loading: boolean;
  }>({
    isOpen: false,
    type: 'single',
    loading: false
  });

  // Initialize realtime store on mount
  useEffect(() => {
    initializeRealtime();
  }, [initializeRealtime]);

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

  const fetchTableData = async (tableName: string) => {
    if (!tableName || !projectId) return;
    
    setDataLoading(true);
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.post(
        ApiRoutes.DATABASE.SELECT_DATA(projectId, tableName),
        token,
        { limit: 100, orderBy: 'id', orderDirection: 'ASC' }
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

  // Listen for real-time database changes and refresh UI automatically
  useEffect(() => {
    // Get the most recent event
    if (recentEvents.length === 0) return;
    
    const latestEvent = recentEvents[0];
    
    // Only process database events for this project
    if ('tableName' in latestEvent && latestEvent.projectId === projectId) {
      const dbEvent = latestEvent as any; // DatabaseEvent
      
      // If this event affects the currently selected table, refresh the data
      if (selectedTable && dbEvent.tableName === selectedTable) {
        console.log('🔄 Real-time update detected, refreshing table data...', dbEvent);
        
        // Refresh table data based on event type
        if (dbEvent.type === 'insert' || dbEvent.type === 'update' || dbEvent.type === 'delete') {
          // Refetch the table data to get latest changes
          fetchTableData(selectedTable);
        }
      }
      
      // If a table was created, renamed, or dropped, refresh the table list
      if (dbEvent.type === 'create_table' || dbEvent.type === 'drop_table' || dbEvent.type === 'rename_table') {
        console.log('🔄 Table structure changed, refreshing table list...', dbEvent);
        fetchTables(projectId);
        
        // If the current table was dropped, clear the selection
        if (dbEvent.type === 'drop_table' && selectedTable === dbEvent.tableName) {
          setSelectedTable(null);
          setTableData([]);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentEvents, projectId, selectedTable, fetchTables]);

  const handleTableSelect = async (tableName: string) => {
    setSelectedTable(tableName);
    setCurrentTable(tables.find(t => t.table_name === tableName) || null);
    await fetchTableDetails(projectId, tableName);
    await fetchTableData(tableName);
  };

  // Auth system tables that should be hidden from the table viewer
  const authSystemTables = ['app_users', 'app_roles', 'app_user_roles', 'app_user_custom_fields'];

  // First filter out auth tables, then apply search filter
  const userTables = tables.filter(table => !authSystemTables.includes(table.table_name));
  
  const filteredTables = userTables.filter(table =>
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
        ToastUtils.success(`Successfully imported ${dataArray.length} rows from CSV!`);
      } else {
        console.error('Failed to import CSV:', result.message);
        ToastUtils.error('Failed to import CSV data. Please try again.');
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      ToastUtils.error('Error importing CSV data. Please try again.');
    }
  };

  const handleBulkDelete = (indices: number[]) => {
    setDeleteModal({
      isOpen: true,
      type: 'bulk',
      indices,
      loading: false
    });
  };

  const handleDeleteTableClick = (tableName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent table selection
    setDeleteModal({
      isOpen: true,
      type: 'table',
      tableName,
      loading: false
    });
  };

  const confirmDelete = async () => {
    setDeleteModal(prev => ({ ...prev, loading: true }));

    try {
      const token = localStorage.getItem('skaftin-token') || '';
      
      if (deleteModal.type === 'table') {
        // Delete entire table(s) - handle both single and bulk
        const tableNamesToDelete = deleteModal.tableName?.includes(', ') 
          ? deleteModal.tableName.split(', ') 
          : [deleteModal.tableName!];
        
        if (!tableNamesToDelete.length || !tableNamesToDelete[0]) return;

        let successCount = 0;
        let errorCount = 0;

        for (const tableNameToDelete of tableNamesToDelete) {
          const result = await RequestUtils.delete(
            ApiRoutes.DATABASE.DROP_TABLE(projectId, tableNameToDelete),
            token,
            {}
          );
          
          if (result.success) {
            successCount++;
            // Clear selection if the deleted table was selected
            if (selectedTable === tableNameToDelete) {
              setSelectedTable(null);
              setCurrentTable(null);
              setTableData([]);
            }
          } else {
            errorCount++;
            console.error(`Failed to delete table ${tableNameToDelete}:`, result.message);
          }
        }
        
        // Clear all selected tables after deletion completes
        setSelectedTablesForDelete(new Set());
        
        if (errorCount > 0) {
          ToastUtils.warning(`Deleted ${successCount} table(s) successfully. ${errorCount} table(s) failed to delete.`);
        } else {
          ToastUtils.success(`Successfully deleted ${successCount} table(s)`);
        }
        
        await fetchTables(projectId);
        setDeleteModal({ isOpen: false, type: 'table', loading: false });
      } else if (deleteModal.type === 'single') {
        // Single row delete
        if (!selectedTable || !deleteModal.indices) return;
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
          ToastUtils.error('Failed to delete row. Please try again.');
        }
      } else {
        // Bulk delete
        if (!selectedTable || !deleteModal.indices) return;
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
          ToastUtils.warning(`Deleted ${successCount} rows successfully. ${errorCount} rows failed to delete.`);
        } else {
          console.log(`Successfully deleted ${successCount} rows`);
          ToastUtils.success(`Successfully deleted ${successCount} rows`);
        }
        
        await fetchTableData(selectedTable);
        setDeleteModal({ isOpen: false, type: 'bulk', loading: false });
      }
    } catch (error) {
      console.error('Error deleting:', error);
      ToastUtils.error('Error deleting. Please try again.');
      // Clear selected tables if it was a table deletion
      if (deleteModal.type === 'table') {
        setSelectedTablesForDelete(new Set());
      }
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleTableRenamed = async (newTableName: string) => {
    setSelectedTable(newTableName);
    await handleTableSelect(newTableName);
  };

  const handleDeleteTableFromSettings = () => {
    if (!selectedTable) return;
    setDeleteModal({
      isOpen: true,
      type: 'table',
      tableName: selectedTable,
      loading: false
    });
  };

  const handleDatabaseImport = async (sqlContent: string, dropExisting: boolean) => {
    setImportLoading(true);
    try {
      const result = await importDatabaseDump(projectId, sqlContent, dropExisting);
      
      if (result.success && result.result) {
        const { successCount, errorCount, droppedTablesCount, errors } = result.result;
        
        if (errorCount === 0) {
          let message = `Successfully imported ${successCount} SQL statements!`;
          if (dropExisting && droppedTablesCount > 0) {
            message += ` Dropped ${droppedTablesCount} existing tables.`;
          }
          ToastUtils.success(message);
        } else {
          let message = `Imported ${successCount} statements with ${errorCount} errors.`;
          if (dropExisting && droppedTablesCount > 0) {
            message += ` Dropped ${droppedTablesCount} existing tables.`;
          }
          ToastUtils.warning(message);
          
          // Log errors to console for debugging
          if (errors && errors.length > 0) {
            console.error('Import errors:', errors);
          }
        }
        
        setShowImportModal(false);
        
        // Refresh tables list
        await fetchTables(projectId);
        
        // Clear selected table
        setSelectedTable(null);
        setCurrentTable(null);
        setTableData([]);
      } else {
        ToastUtils.error('Failed to import database dump. Please check the SQL content and console for errors.');
      }
    } catch (error) {
      console.error('Error importing database dump:', error);
      ToastUtils.error('Error importing database dump. Please try again.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleDatabaseExport = async (tablesToExport: string[], includeSystemTables: boolean, schemaOnly: boolean) => {
    setExportLoading(true);
    try {
      const result = await exportDatabaseDump(projectId, tablesToExport, includeSystemTables, schemaOnly);
      
      if (result.success) {
        let message = `Successfully exported ${tablesToExport.length} table${tablesToExport.length !== 1 ? 's' : ''}!`;
        if (schemaOnly) {
          message += ' (Schema only)';
        }
        if (includeSystemTables) {
          message += ' Including user & authentication data.';
        }
        ToastUtils.success(message);
        setShowExportModal(false);
      } else {
        ToastUtils.error('Failed to export database dump. Please try again.');
      }
    } catch (error: any) {
      console.error('Error exporting database:', error);
      ToastUtils.error(error.message || 'Failed to export database dump.');
    } finally {
      setExportLoading(false);
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
    <div className="h-full">

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

      <div className="flex h-[88vh]">
        {/* Tables Sidebar */}
        <div className="w-30 flex-shrink-0 border-r border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800">
          <div className="h-full flex flex-col">
            {/* Sidebar Header */}
            <div className="border-b border-dark-200 dark:border-dark-700 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-dark-900 dark:text-white">Tables</h4>
                <span className="text-xs text-dark-500 dark:text-dark-400 bg-dark-100 dark:bg-dark-700 px-2 py-1 rounded">
                  {userTables.length}
                </span>
              </div>
              
              <div className="flex items-center space-x-2 mb-3">
                {selectedTablesForDelete.size > 0 ? (
                  <>
                    <AppButton
                      variant="primary"
                      size="sm"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={() => setShowCreateTableModal(true)}
                    >
                      Create
                    </AppButton>
                    <AppButton
                      variant="danger"
                      size="sm"
                      icon={<Trash2 className="w-4 h-4" />}
                      onClick={() => {
                        setDeleteModal({
                          isOpen: true,
                          type: 'table',
                          tableName: Array.from(selectedTablesForDelete).join(', '),
                          loading: false
                        });
                      }}
                    >
                      Delete ({selectedTablesForDelete.size})
                    </AppButton>
                  </>
                ) : (
                  <>
                    <AppButton
                      variant="primary"
                      size="sm"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={() => setShowCreateTableModal(true)}
                    >
                      Create
                    </AppButton>
                    <AppButton
                      variant="secondary"
                      size="sm"
                      icon={<Upload className="w-4 h-4" />}
                      onClick={() => setShowImportModal(true)}
                    >
                      Import
                    </AppButton>
                    <AppButton
                      variant="secondary"
                      size="sm"
                      icon={<Download className="w-4 h-4" />}
                      onClick={() => setShowExportModal(true)}
                    >
                      Export
                    </AppButton>
                  </>
                )}
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
            <div className="flex-1 overflow-y-auto p-2">
              {filteredTables.length === 0 ? (
                <div className="text-center">
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
                    <TableItem
                      key={table.table_name}
                      tableName={table.table_name}
                      tableType={table.table_type}
                      isSelected={selectedTable === table.table_name}
                      isChecked={selectedTablesForDelete.has(table.table_name)}
                      onSelect={() => handleTableSelect(table.table_name)}
                      onCheckboxChange={(checked) => {
                        const newSet = new Set(selectedTablesForDelete);
                        if (checked) {
                          newSet.add(table.table_name);
                        } else {
                          newSet.delete(table.table_name);
                        }
                        setSelectedTablesForDelete(newSet);
                      }}
                    />
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
              <div className="p-2 border-b border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900">
                <div className="flex items-center justify-between">
                  <div className="flex flex-row items-center space-x-2">
                    <AppText
                      children={currentTable.table_name}
                      size="xl"
                      weight="semibold"
                      color="default"
                    />
                    <AppText
                      children={`-> ${currentTable.table_type} • ${currentTable.columns?.length || 0} columns`}
                      size="xs"
                      color="muted"
                    />
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="px-6 border-b border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900">
                <nav className="flex space-x-6">
                  {[
                    { id: 'data', name: 'Data', icon: List },
                    { id: 'schema', name: 'Schema', icon: Table },
                    { id: 'settings', name: 'Settings', icon: Settings },
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
                      projectId={projectId}
                      tableName={selectedTable || undefined}
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
                          const { id, ...updateData } = updatedRow; // eslint-disable-line @typescript-eslint/no-unused-vars
                          
                          const result = await RequestUtils.put(
                            ApiRoutes.DATABASE.UPDATE_DATA(projectId, selectedTable),
                            token,
                            { data: updateData, where: whereClause }
                          );
                          
                          if (result.success) {
                            console.log('Row updated successfully');
                            await fetchTableData(selectedTable);
                            ToastUtils.success('Row updated successfully!');
                          } else {
                            console.error('Failed to update row:', result.message);
                            ToastUtils.error('Failed to update row. Please try again.');
                          }
                        } catch (error) {
                          console.error('Error updating row:', error);
                          ToastUtils.error('Error updating row. Please try again.');
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

                {activeTab === 'settings' && (
                  <TableSettingsTab
                    projectId={projectId}
                    currentTable={currentTable}
                    tableData={tableData}
                    onTableRenamed={handleTableRenamed}
                    onDeleteTable={handleDeleteTableFromSettings}
                    onRefreshTables={() => fetchTables(projectId)}
                  />
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
        onClose={() => {
          setDeleteModal({ isOpen: false, type: 'single', loading: false });
          setSelectedTablesForDelete(new Set());
        }}
        onConfirm={confirmDelete}
        title={
          deleteModal.type === 'table' 
            ? deleteModal.tableName?.includes(', ')
              ? `Delete ${deleteModal.tableName.split(', ').length} Tables`
              : `Delete Table "${deleteModal.tableName}"`
            : deleteModal.type === 'single' 
              ? `Delete Row` 
              : `Delete ${deleteModal.indices?.length || 0} Rows`
        }
        message={
          deleteModal.type === 'table'
            ? deleteModal.tableName?.includes(', ')
              ? `Are you sure you want to delete ${deleteModal.tableName.split(', ').length} tables? All data in these tables will be permanently deleted. This action cannot be undone.`
              : `Are you sure you want to delete the table "${deleteModal.tableName}"? All data in this table will be permanently deleted. This action cannot be undone.`
            : deleteModal.type === 'single' 
              ? 'Are you sure you want to delete this row? This action cannot be undone.'
              : `Are you sure you want to delete ${deleteModal.indices?.length || 0} rows? This action cannot be undone.`
        }
        itemName={deleteModal.type === 'table' ? 'table' : 'row'}
        itemCount={deleteModal.type === 'table' 
          ? (deleteModal.tableName?.includes(', ') ? deleteModal.tableName.split(', ').length : 1)
          : (deleteModal.indices?.length || 1)}
        loading={deleteModal.loading}
        variant={deleteModal.type === 'table' ? 'single' : deleteModal.type}
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

      {/* Database Import Modal */}
      <DatabaseImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleDatabaseImport}
        loading={importLoading}
      />

      {/* Database Export Modal */}
      <DatabaseExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleDatabaseExport}
        loading={exportLoading}
        availableTables={tables}
      />
    </div>
  );
};

export default TableViewer;
