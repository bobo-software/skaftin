import React, { useState, useEffect, useRef } from 'react';
import { AppButton } from '../ComponentsIndex';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';

interface TableSettingsTabProps {
  projectId: string;
  currentTable: {
    table_name: string;
    table_type: string;
    columns?: any[];
  } | null;
  tableData: any[];
  onTableRenamed: (tableName: string) => void;
  onDeleteTable: () => void;
  onRefreshTables: () => void;
}

interface ValidationError {
  type: 'error' | 'warning' | 'success';
  message: string;
}

const TableSettingsTab = ({ 
  projectId, 
  currentTable, 
  tableData, 
  onTableRenamed,
  onDeleteTable,
  onRefreshTables
}: TableSettingsTabProps) => {
  const [isEditingTableName, setIsEditingTableName] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [renamingTable, setRenamingTable] = useState(false);
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Validate table name with debounce
  const validateTableName = async (name: string) => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Reset validation if empty
    if (!name.trim()) {
      setValidationError({ type: 'error', message: 'Table name cannot be empty' });
      setIsValidating(false);
      return;
    }

    // Check if name is same as current
    if (name === currentTable?.table_name) {
      setValidationError({ type: 'warning', message: 'Name is the same as current table name' });
      setIsValidating(false);
      return;
    }

    // Client-side validation
    const tableNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!tableNameRegex.test(name)) {
      setValidationError({ 
        type: 'error', 
        message: 'Table name must start with a letter or underscore and contain only letters, numbers, and underscores' 
      });
      setIsValidating(false);
      return;
    }

    // Set validating state
    setIsValidating(true);
    setValidationError(null);

    // Debounce the server-side check
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('skaftin-token') || '';
        const result = await RequestUtils.get(
          ApiRoutes.DATABASE.LIST_TABLES(projectId),
          token
        );

        if (result.success && result.data) {
          const tableExists = result.data.some((table: any) => table.table_name === name);
          if (tableExists) {
            setValidationError({ type: 'error', message: `Table "${name}" already exists` });
          } else {
            setValidationError({ type: 'success', message: 'Table name is available' });
          }
        }
      } catch (error) {
        console.error('Error checking table name:', error);
        setValidationError({ type: 'warning', message: 'Unable to verify table name availability' });
      } finally {
        setIsValidating(false);
      }
    }, 1000); // 1 second debounce
  };

  // Handle table name input change
  const handleTableNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewTableName(value);
    validateTableName(value);
  };

  const handleRenameTable = async () => {
    if (!currentTable?.table_name || !newTableName.trim()) return;
    
    // Don't proceed if there are validation errors
    if (validationError?.type === 'error') {
      alert(validationError.message);
      return;
    }
    
    setRenamingTable(true);
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.post(
        ApiRoutes.DATABASE.RENAME_TABLE(projectId, currentTable.table_name),
        token,
        { newTableName: newTableName.trim() }
      );
      
      if (result.success) {
        console.log('Table renamed successfully');
        const oldTableName = currentTable.table_name;
        setIsEditingTableName(false);
        setNewTableName('');
        setValidationError(null);
        await onRefreshTables();
        await onTableRenamed(newTableName.trim());
        alert(`Table "${oldTableName}" has been renamed to "${newTableName.trim()}"`);
      } else {
        console.error('Failed to rename table:', result.message);
        setValidationError({ type: 'error', message: result.message || 'Failed to rename table' });
      }
    } catch (error: any) {
      console.error('Error renaming table:', error);
      setValidationError({ type: 'error', message: error.message || 'Error renaming table' });
    } finally {
      setRenamingTable(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingTableName(false);
    setNewTableName('');
    setValidationError(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  if (!currentTable) {
    return null;
  }

  return (
    <div className="h-full overflow-y-auto p-2">
        {/* Table Information */}
          <h5 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
            Table Information
          </h5>
          
          <div className="space-y-4">
            {/* Table Name */}
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Table Name
              </label>
            {isEditingTableName ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newTableName}
                      onChange={handleTableNameChange}
                      placeholder={currentTable.table_name}
                      className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:border-transparent ${
                        validationError?.type === 'error'
                          ? 'border-red-500 focus:ring-red-500'
                          : validationError?.type === 'success'
                          ? 'border-green-500 focus:ring-green-500'
                          : validationError?.type === 'warning'
                          ? 'border-yellow-500 focus:ring-yellow-500'
                          : 'border-dark-200 dark:border-dark-700 focus:ring-primary-500'
                      }`}
                      disabled={renamingTable}
                    />
                    {isValidating && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  <AppButton
                    variant="primary"
                    size="sm"
                    onClick={handleRenameTable}
                    loading={renamingTable}
                    disabled={
                      !newTableName.trim() || 
                      renamingTable || 
                      isValidating || 
                      validationError?.type === 'error' ||
                      validationError?.type === 'warning' && validationError.message.includes('same as current')
                    }
                  >
                    Save
                  </AppButton>
                  <AppButton
                    variant="secondary"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={renamingTable}
                  >
                    Cancel
                  </AppButton>
                </div>
                
                {/* Validation Message */}
                {validationError && (
                  <p className={`text-sm ${
                    validationError.type === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : validationError.type === 'success'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-yellow-600 dark:text-yellow-400'
                  }`}>
                    {validationError.message}
                  </p>
                )}
              </div>
            ) : (
                <div className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-700 rounded-lg">
                  <span className="font-mono text-dark-900 dark:text-white">
                    {currentTable.table_name}
                  </span>
                  <AppButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsEditingTableName(true);
                      setNewTableName(currentTable.table_name);
                    }}
                  >
                    Edit
                  </AppButton>
                </div>
              )}
            </div>

            {/* Table Type */}
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Table Type
              </label>
              <div className="p-3 bg-dark-50 dark:bg-dark-700 rounded-lg">
                <span className="text-dark-900 dark:text-white">
                  {currentTable.table_type}
                </span>
              </div>
            </div>
          </div>

        {/* Danger Zone */}
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-6">
          <h5 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
            Danger Zone
          </h5>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">
            Irreversible and destructive actions
          </p>
          
          <div className="space-y-4">
            {/* Delete Table */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex-1">
                <h6 className="font-medium text-red-900 dark:text-red-100 mb-1">
                  Delete this table
                </h6>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Once you delete a table, there is no going back. All data will be permanently deleted.
                </p>
              </div>
              <AppButton
                variant="danger"
                size="sm"
                onClick={onDeleteTable}
                className="ml-4"
              >
                Delete Table
              </AppButton>
            </div>
          </div>
        </div>
    </div>
  );
};

export default TableSettingsTab;