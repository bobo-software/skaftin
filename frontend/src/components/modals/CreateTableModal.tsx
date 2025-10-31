import React, { useState } from 'react';
import { X, Plus, Trash2, Database } from 'lucide-react';
import { AppButton, AppInput } from '@components/ComponentsIndex';

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string;
}

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (tableName: string, columns: ColumnDefinition[]) => Promise<boolean>;
}

const CreateTableModal = ({ isOpen, onClose, onCreate }: CreateTableModalProps) => {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { name: 'id', type: 'SERIAL', nullable: false, primaryKey: true }
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dataTypes = [
    { value: 'SERIAL', label: 'SERIAL (Auto-increment Integer)' },
    { value: 'BIGSERIAL', label: 'BIGSERIAL (Auto-increment Big Integer)' },
    { value: 'INTEGER', label: 'INTEGER' },
    { value: 'BIGINT', label: 'BIGINT' },
    { value: 'SMALLINT', label: 'SMALLINT' },
    { value: 'DECIMAL', label: 'DECIMAL' },
    { value: 'NUMERIC', label: 'NUMERIC' },
    { value: 'REAL', label: 'REAL' },
    { value: 'DOUBLE PRECISION', label: 'DOUBLE PRECISION' },
    { value: 'VARCHAR', label: 'VARCHAR' },
    { value: 'TEXT', label: 'TEXT' },
    { value: 'CHAR', label: 'CHAR' },
    { value: 'BOOLEAN', label: 'BOOLEAN' },
    { value: 'DATE', label: 'DATE' },
    { value: 'TIME', label: 'TIME' },
    { value: 'TIMESTAMP', label: 'TIMESTAMP' },
    { value: 'TIMESTAMPTZ', label: 'TIMESTAMP WITH TIME ZONE' },
    { value: 'JSON', label: 'JSON' },
    { value: 'JSONB', label: 'JSONB' },
    { value: 'UUID', label: 'UUID' },
  ];

  const resetForm = () => {
    setTableName('');
    setColumns([{ name: 'id', type: 'SERIAL', nullable: false, primaryKey: true }]);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAddColumn = () => {
    setColumns([...columns, { name: '', type: 'TEXT', nullable: true, primaryKey: false }]);
  };

  const handleRemoveColumn = (index: number) => {
    if (columns.length > 1) {
      setColumns(columns.filter((_, i) => i !== index));
    }
  };

  const handleColumnChange = (index: number, field: keyof ColumnDefinition, value: any) => {
    const updated = [...columns];
    
    // If setting primaryKey to true, unset all other primary keys
    if (field === 'primaryKey' && value === true) {
      updated.forEach((col, i) => {
        if (i !== index) {
          col.primaryKey = false;
        }
      });
    }
    
    // If setting type to SERIAL or BIGSERIAL, automatically set as primary key and not nullable
    if (field === 'type' && (value === 'SERIAL' || value === 'BIGSERIAL')) {
      updated[index] = {
        ...updated[index],
        [field]: value,
        primaryKey: true,
        nullable: false
      };
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value
      };
    }
    
    setColumns(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Form submitted:', { tableName, columns });
    
    // Validation
    if (!tableName.trim()) {
      setError('Table name is required');
      return;
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName.trim())) {
      setError('Table name must start with a letter or underscore and contain only alphanumeric characters and underscores');
      return;
    }

    const emptyColumns = columns.filter(col => !col.name.trim());
    if (emptyColumns.length > 0) {
      setError('All columns must have a name');
      return;
    }

    const duplicateNames = columns.filter((col, index) => 
      columns.findIndex(c => c.name.toLowerCase() === col.name.toLowerCase()) !== index
    );
    if (duplicateNames.length > 0) {
      setError('Column names must be unique');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      console.log('Calling onCreate with:', { tableName: tableName.trim(), columns });
      const success = await onCreate(tableName.trim(), columns);
      console.log('onCreate returned:', success);
      if (success) {
        handleClose();
      } else {
        setError('Failed to create table. Please try again.');
      }
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      setError(err instanceof Error ? err.message : 'Failed to create table');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-dark-900 dark:text-white">
              Create New Table
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5 text-dark-600 dark:text-dark-300" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Table Name */}
          <div>
            <AppInput
              label="Table Name"
              placeholder="users, products, orders, etc."
              value={tableName}
              onChange={(value: string) => setTableName(value)}
              required
              icon={<Database className="w-4 h-4" />}
            />
            <p className="mt-1 text-xs text-dark-500 dark:text-dark-400">
              Use lowercase letters, numbers, and underscores only. Must start with a letter or underscore.
            </p>
          </div>

          {/* Columns */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300">
                Columns
              </label>
              <AppButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddColumn}
                icon={<Plus className="w-4 h-4" />}
              >
                Add Column
              </AppButton>
            </div>

            <div className="space-y-3">
              {columns.map((column, index) => (
                <div
                  key={index}
                  className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg bg-dark-50 dark:bg-dark-700/50"
                >
                  <div className="grid grid-cols-12 gap-3 items-start">
                    {/* Column Name */}
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={column.name}
                        onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                        placeholder="column_name"
                        className="w-full px-3 py-2 text-sm border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>

                    {/* Data Type */}
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-1">
                        Type
                      </label>
                      <select
                        value={column.type}
                        onChange={(e) => handleColumnChange(index, 'type', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        {dataTypes.map((dt) => (
                          <option key={dt.value} value={dt.value}>
                            {dt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Default Value */}
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-1">
                        Default (Optional)
                      </label>
                      <input
                        type="text"
                        value={column.defaultValue || ''}
                        onChange={(e) => handleColumnChange(index, 'defaultValue', e.target.value)}
                        placeholder="default value"
                        disabled={column.type.includes('SERIAL')}
                        className="w-full px-3 py-2 text-sm border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Options */}
                    <div className="col-span-2 flex items-end space-x-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={column.nullable}
                          onChange={(e) => handleColumnChange(index, 'nullable', e.target.checked)}
                          disabled={column.type.includes('SERIAL') || column.primaryKey}
                          className="rounded border-dark-300 dark:border-dark-600 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                        />
                        <span className="text-xs text-dark-700 dark:text-dark-300">Nullable</span>
                      </label>
                    </div>

                    {/* Primary Key */}
                    <div className="col-span-1 flex items-end">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={column.primaryKey}
                          onChange={(e) => handleColumnChange(index, 'primaryKey', e.target.checked)}
                          disabled={column.type.includes('SERIAL')}
                          className="rounded border-dark-300 dark:border-dark-600 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                        />
                        <span className="text-xs text-dark-700 dark:text-dark-300">PK</span>
                      </label>
                    </div>

                    {/* Remove Button */}
                    <div className="col-span-1 flex items-end justify-end">
                      {columns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveColumn(index)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-dark-200 dark:border-dark-700 flex-shrink-0">
            <AppButton
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              loading={isCreating}
              disabled={!tableName.trim() || isCreating}
            >
              Create Table
            </AppButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTableModal;

