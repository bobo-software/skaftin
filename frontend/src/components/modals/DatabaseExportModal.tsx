import React, { useState, useEffect } from 'react';
import { X, Download, Database, AlertCircle, Loader2, CheckSquare, Square } from 'lucide-react';
import { AppButton } from '../ComponentsIndex';
import { Table } from '../../stores/data/useDatabaseStore';

interface DatabaseExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (tables: string[], includeSystemTables: boolean, schemaOnly: boolean) => Promise<void>;
  loading?: boolean;
  availableTables: Table[];
}

const DatabaseExportModal = ({
  isOpen,
  onClose,
  onExport,
  loading = false,
  availableTables
}: DatabaseExportModalProps) => {
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [includeSystemTables, setIncludeSystemTables] = useState(false);
  const [schemaOnly, setSchemaOnly] = useState(false);
  const [error, setError] = useState<string>('');
  const [allSelected, setAllSelected] = useState(true);

  // Initialize with all tables selected
  useEffect(() => {
    if (isOpen && availableTables.length > 0) {
      const userTables = availableTables.filter(t => !t.table_name.startsWith('skaftin_system_'));
      setSelectedTables(new Set(userTables.map(t => t.table_name)));
      setAllSelected(true);
    }
  }, [isOpen, availableTables]);

  const handleToggleTable = (tableName: string) => {
    const newSelected = new Set(selectedTables);
    if (newSelected.has(tableName)) {
      newSelected.delete(tableName);
    } else {
      newSelected.add(tableName);
    }
    setSelectedTables(newSelected);
    
    // Update allSelected state
    const userTables = availableTables.filter(t => !t.table_name.startsWith('skaftin_system_'));
    setAllSelected(newSelected.size === userTables.length);
  };

  const handleSelectAll = () => {
    const userTables = availableTables.filter(t => !t.table_name.startsWith('skaftin_system_'));
    setSelectedTables(new Set(userTables.map(t => t.table_name)));
    setAllSelected(true);
  };

  const handleDeselectAll = () => {
    setSelectedTables(new Set());
    setAllSelected(false);
  };

  const handleExport = async () => {
    if (selectedTables.size === 0 && !includeSystemTables) {
      setError('Please select at least one table to export');
      return;
    }

    try {
      await onExport(Array.from(selectedTables), includeSystemTables, schemaOnly);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to export database dump');
    }
  };

  const handleClose = () => {
    setSelectedTables(new Set());
    setIncludeSystemTables(false);
    setSchemaOnly(false);
    setError('');
    setAllSelected(true);
    onClose();
  };

  if (!isOpen) return null;

  const userTables = availableTables.filter(t => !t.table_name.startsWith('skaftin_system_'));
  const systemTables = availableTables.filter(t => t.table_name.startsWith('skaftin_system_'));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Export Database</h3>
              <p className="text-sm text-dark-500 dark:text-dark-400">Download your database as an SQL dump file</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-dark-600 dark:text-dark-300" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
                <button
                  onClick={() => setError('')}
                  className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-1">
                  Select Tables to Export
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Choose which tables you want to include in your SQL dump. All tables are selected by default.
                </p>
              </div>
            </div>
          </div>

          {/* Table Selection Controls */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-dark-900 dark:text-white">
              User Tables ({selectedTables.size}/{userTables.length})
            </h4>
            <div className="flex items-center space-x-2">
              <AppButton
                variant="secondary"
                size="sm"
                onClick={handleSelectAll}
                disabled={allSelected || loading}
              >
                Select All
              </AppButton>
              <AppButton
                variant="secondary"
                size="sm"
                onClick={handleDeselectAll}
                disabled={selectedTables.size === 0 || loading}
              >
                Deselect All
              </AppButton>
            </div>
          </div>

          {/* Table List */}
          {userTables.length === 0 ? (
            <div className="text-center py-8">
              <Database className="w-12 h-12 text-dark-300 dark:text-dark-600 mx-auto mb-3" />
              <p className="text-sm text-dark-600 dark:text-dark-300">No user tables found</p>
            </div>
          ) : (
            <div className="border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {userTables.map((table) => (
                <label
                  key={table.table_name}
                  className={`flex items-center space-x-3 p-3 hover:bg-dark-50 dark:hover:bg-dark-700 cursor-pointer border-b border-dark-200 dark:border-dark-700 last:border-b-0 transition-colors ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTables.has(table.table_name)}
                    onChange={() => handleToggleTable(table.table_name)}
                    disabled={loading}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 focus:ring-offset-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Database className="w-4 h-4 text-dark-400" />
                      <span className="text-sm font-medium text-dark-900 dark:text-white">
                        {table.table_name}
                      </span>
                    </div>
                    {table.row_count !== undefined && (
                      <span className="text-xs text-dark-500 dark:text-dark-400 ml-6">
                        {table.row_count} rows
                      </span>
                    )}
                  </div>
                  {selectedTables.has(table.table_name) ? (
                    <CheckSquare className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  ) : (
                    <Square className="w-5 h-5 text-dark-300 dark:text-dark-600" />
                  )}
                </label>
              ))}
            </div>
          )}

          {/* Export Options */}
          <div className="space-y-3 border-t border-dark-200 dark:border-dark-700 pt-4">
            {/* Schema Only Option */}
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={schemaOnly}
                onChange={(e) => setSchemaOnly(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 focus:ring-offset-0 mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium text-dark-900 dark:text-white">
                  Schema Only (No Data)
                </div>
                <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">
                  Export only table structures without any data
                </p>
              </div>
            </label>

            {/* System Tables Option */}
            {systemTables.length > 0 && (
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSystemTables}
                  onChange={(e) => setIncludeSystemTables(e.target.checked)}
                  disabled={loading}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 focus:ring-offset-0 mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-medium text-dark-900 dark:text-white">
                    Include User & Authentication Data
                  </div>
                  <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">
                    Export system tables including users, roles, permissions, and authentication settings
                  </p>
                  {includeSystemTables && (
                    <div className="mt-2 text-xs text-dark-600 dark:text-dark-300 bg-dark-50 dark:bg-dark-700 rounded p-2">
                      Will include: {systemTables.map(t => t.table_name).join(', ')}
                    </div>
                  )}
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-700 flex-shrink-0">
          <div className="text-sm text-dark-600 dark:text-dark-300">
            {selectedTables.size === 0 && !includeSystemTables ? (
              <span className="text-amber-600 dark:text-amber-400">No tables selected</span>
            ) : (
              <span>
                Exporting {selectedTables.size} table{selectedTables.size !== 1 ? 's' : ''}
                {includeSystemTables && ' + auth data'}
                {schemaOnly && ' (schema only)'}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <AppButton
              variant="secondary"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              onClick={handleExport}
              loading={loading}
              disabled={loading || (selectedTables.size === 0 && !includeSystemTables)}
              icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            >
              {loading ? 'Exporting...' : 'Export Database'}
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseExportModal;

