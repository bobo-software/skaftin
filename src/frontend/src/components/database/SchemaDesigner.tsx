import React, { useState } from 'react';
import { useDatabaseStore, useProjectStore } from '../../stores/StoresIndex';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  Eye,
  Key,
  Link,
  Settings,
  Database,
  Table,
  Columns
} from 'lucide-react';
import { AppButton } from '../ComponentsIndex';

interface SchemaDesignerProps {
  projectId: string;
}

interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string;
  length?: number;
}

const SchemaDesigner = ({ projectId }: SchemaDesignerProps) => {
  const { createTable, loading, error, clearError } = useDatabaseStore();
  
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { name: 'id', type: 'SERIAL', nullable: false, primaryKey: true }
  ]);
  const [showPreview, setShowPreview] = useState(true);

  const dataTypes = [
    'SERIAL', 'INTEGER', 'BIGINT', 'SMALLINT',
    'VARCHAR', 'TEXT', 'CHAR',
    'BOOLEAN', 'DATE', 'TIMESTAMP',
    'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION',
    'JSON', 'JSONB', 'UUID'
  ];

  const addColumn = () => {
    setColumns([...columns, {
      name: '',
      type: 'VARCHAR',
      nullable: true,
      primaryKey: false
    }]);
  };

  const updateColumn = (index: number, field: keyof ColumnDefinition, value: any) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    
    // If setting as primary key, unset others
    if (field === 'primaryKey' && value) {
      newColumns.forEach((col, i) => {
        if (i !== index) col.primaryKey = false;
      });
    }
    
    setColumns(newColumns);
  };

  const removeColumn = (index: number) => {
    if (columns.length > 1) {
      setColumns(columns.filter((_, i) => i !== index));
    }
  };

  const generateSQL = () => {
    const columnDefs = columns.map(col => {
      let def = `${col.name} ${col.type}`;
      if (col.length && (col.type.includes('VARCHAR') || col.type.includes('CHAR'))) {
        def += `(${col.length})`;
      }
      if (!col.nullable) def += ' NOT NULL';
      if (col.defaultValue) def += ` DEFAULT '${col.defaultValue}'`;
      return def;
    }).join(',\n  ');

    const primaryKeys = columns.filter(col => col.primaryKey).map(col => col.name);
    const pkConstraint = primaryKeys.length > 0 ? `,\n  PRIMARY KEY (${primaryKeys.join(', ')})` : '';

    return `CREATE TABLE ${tableName} (\n  ${columnDefs}${pkConstraint}\n);`;
  };

  const handleCreateTable = async () => {
    if (!tableName.trim() || columns.some(col => !col.name.trim())) {
      return;
    }

    const success = await createTable(projectId, tableName, columns);
    if (success) {
      setTableName('');
      setColumns([{ name: 'id', type: 'SERIAL', nullable: false, primaryKey: true }]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Schema Designer</h3>
          <p className="text-sm text-dark-600 dark:text-dark-300">
            Design and create database tables with a visual interface
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <AppButton
            variant="secondary"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            icon={<Eye className="w-4 h-4" />}
          >
            {showPreview ? 'Hide' : 'Show'} Preview
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table Designer */}
        <div className="space-y-6">
          {/* Table Name */}
          <div className="card">
            <h4 className="font-semibold text-dark-900 dark:text-white mb-4">Table Information</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Table Name
                </label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="Enter table name"
                  className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Columns */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-dark-900 dark:text-white">Columns</h4>
              <AppButton
                variant="secondary"
                size="sm"
                onClick={addColumn}
                icon={<Plus className="w-4 h-4" />}
              >
                Add Column
              </AppButton>
            </div>
            
            <div className="space-y-4">
              {columns.map((column, index) => (
                <div key={index} className="p-4 border border-dark-200 dark:border-dark-700 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-1">
                        Column Name
                      </label>
                      <input
                        type="text"
                        value={column.name}
                        onChange={(e) => updateColumn(index, 'name', e.target.value)}
                        placeholder="column_name"
                        className="w-full px-2 py-1 text-sm border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-1">
                        Data Type
                      </label>
                      <select
                        value={column.type}
                        onChange={(e) => updateColumn(index, 'type', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                      >
                        {dataTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-1">
                        Length
                      </label>
                      <input
                        type="number"
                        value={column.length || ''}
                        onChange={(e) => updateColumn(index, 'length', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="255"
                        className="w-full px-2 py-1 text-sm border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div className="flex items-end space-x-2">
                      <button
                        onClick={() => updateColumn(index, 'primaryKey', !column.primaryKey)}
                        className={`p-1 rounded ${
                          column.primaryKey 
                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' 
                            : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-300'
                        }`}
                        title="Primary Key"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateColumn(index, 'nullable', !column.nullable)}
                        className={`p-1 rounded ${
                          !column.nullable 
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                            : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-300'
                        }`}
                        title="Nullable"
                      >
                        <Columns className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeColumn(index)}
                        disabled={columns.length === 1}
                        className="p-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 disabled:opacity-50"
                        title="Remove Column"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {column.defaultValue !== undefined && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-dark-700 dark:text-dark-300 mb-1">
                        Default Value
                      </label>
                      <input
                        type="text"
                        value={column.defaultValue || ''}
                        onChange={(e) => updateColumn(index, 'defaultValue', e.target.value)}
                        placeholder="Default value"
                        className="w-full px-2 py-1 text-sm border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3">
            <AppButton
              variant="primary"
              onClick={handleCreateTable}
              loading={loading}
              disabled={!tableName.trim() || columns.some(col => !col.name.trim())}
              icon={<Save className="w-4 h-4" />}
            >
              Create Table
            </AppButton>
          </div>
        </div>

        {/* SQL Preview */}
        {showPreview && (
          <div className="card">
            <h4 className="font-semibold text-dark-900 dark:text-white mb-4">SQL Preview</h4>
            <div className="bg-dark-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre className="text-green-400 whitespace-pre-wrap">{generateSQL()}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchemaDesigner;
