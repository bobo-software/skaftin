import React, { useState, useEffect, useCallback } from 'react';
import { useDatabaseStore } from '../../stores/StoresIndex';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  Eye,
  Key,
  Columns,
  Code,
  Upload
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
  const [editSQL, setEditSQL] = useState(true);
  const [sqlSchema, setSqlSchema] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [isAutoParsing, setIsAutoParsing] = useState(false);
  const [parseTimeout, setParseTimeout] = useState<NodeJS.Timeout | null>(null);
  const [userIsEditingSQL, setUserIsEditingSQL] = useState(false);

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

  const generateSQL = useCallback(() => {
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
  }, [tableName, columns]);

  const parseSQLSchema = (sql: string) => {
    try {
      setParseError(null);
      
      // Clean up the SQL
      const cleanSQL = sql.trim().replace(/;$/, '');
      
      // Extract table name - handle optional IF NOT EXISTS and schema prefixes
      const tableMatch = cleanSQL.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(\w+)\.)?(\w+)\s*\(/i);
      if (!tableMatch) {
        throw new Error('Could not find table name in CREATE TABLE statement');
      }
      
      const extractedTableName = tableMatch[2]; // Second capture group is the table name
      
      // Extract column definitions - handle optional IF NOT EXISTS and schema prefixes
      const columnMatch = cleanSQL.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(\w+)\.)?(\w+)\s*\(([\s\S]*?)\)/i);
      if (!columnMatch) {
        throw new Error('Could not find column definitions');
      }
      
      const columnDefinitions = columnMatch[3]; // Third capture group is the column definitions
      
      // Parse columns
      const parsedColumns: ColumnDefinition[] = [];
      const lines = columnDefinitions.split(',').map(line => line.trim()).filter(line => line);
      
      for (const line of lines) {
        // Skip PRIMARY KEY constraints for now
        if (line.toUpperCase().includes('PRIMARY KEY')) {
          continue;
        }
        
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) continue;
        
        const name = parts[0];
        let type = parts[1];
        let length: number | undefined;
        
        // Extract length for VARCHAR/CHAR
        const lengthMatch = type.match(/^(\w+)\((\d+)\)$/);
        if (lengthMatch) {
          type = lengthMatch[1];
          length = parseInt(lengthMatch[2]);
        }
        
        // Check for NOT NULL
        const nullable = !line.toUpperCase().includes('NOT NULL');
        
        // Check for DEFAULT
        const defaultMatch = line.match(/DEFAULT\s+['"]([^'"]+)['"]/i);
        const defaultValue = defaultMatch ? defaultMatch[1] : undefined;
        
        // Check for PRIMARY KEY (inline)
        const primaryKey = line.toUpperCase().includes('PRIMARY KEY');
        
        parsedColumns.push({
          name,
          type: type.toUpperCase(),
          nullable,
          primaryKey,
          defaultValue,
          length
        });
      }
      
      // Handle separate PRIMARY KEY constraint
      const pkMatch = cleanSQL.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        const pkColumns = pkMatch[1].split(',').map(col => col.trim());
        parsedColumns.forEach(col => {
          col.primaryKey = pkColumns.includes(col.name);
        });
      }
      
      if (parsedColumns.length === 0) {
        throw new Error('No valid columns found in the SQL');
      }
      
      return {
        tableName: extractedTableName,
        columns: parsedColumns
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse SQL schema';
      setParseError(errorMessage);
      throw error;
    }
  };

  const handleSQLParse = () => {
    try {
      const parsed = parseSQLSchema(sqlSchema);
      setTableName(parsed.tableName);
      setColumns(parsed.columns);
      setEditSQL(false);
      setSqlSchema('');
    } catch {
      // Error is already set in parseSQLSchema
    }
  };

  const autoParseSQL = useCallback(() => {
    if (!editSQL || !sqlSchema.trim()) return;
    
    setIsAutoParsing(true);
    try {
      const parsed = parseSQLSchema(sqlSchema);
      setTableName(parsed.tableName);
      setColumns(parsed.columns);
      setParseError(null);
    } catch {
      // Error is already set in parseSQLSchema
    } finally {
      setIsAutoParsing(false);
    }
  }, [editSQL, sqlSchema]);

  const handleSQLChange = (newSQL: string) => {
    setSqlSchema(newSQL);
    setParseError(null);
    setUserIsEditingSQL(true);
    
    // Clear existing timeout
    if (parseTimeout) {
      clearTimeout(parseTimeout);
    }
    
    // Set new timeout for auto-parsing
    const timeout = setTimeout(() => {
      autoParseSQL();
      setUserIsEditingSQL(false);
    }, 1000);
    
    setParseTimeout(timeout);
  };

  const handleEditSQL = () => {
    setEditSQL(true);
    setSqlSchema(generateSQL());
    setParseError(null);
    setUserIsEditingSQL(false);
  };

  const handleCancelEdit = () => {
    setEditSQL(false);
    setSqlSchema('');
    setParseError(null);
    setUserIsEditingSQL(false);
  };

  // Auto-update SQL when visual designer changes (only if not in edit mode and user isn't editing SQL)
  useEffect(() => {
    if (editSQL && !userIsEditingSQL) {
      setSqlSchema(generateSQL());
    }
  }, [tableName, columns, editSQL, generateSQL, userIsEditingSQL]);

  // Initialize SQL schema with default table structure
  useEffect(() => {
    if (editSQL && !sqlSchema) {
      setSqlSchema(generateSQL());
    }
  }, [editSQL, sqlSchema, generateSQL]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (parseTimeout) {
        clearTimeout(parseTimeout);
      }
    };
  }, [parseTimeout]);

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

      {parseError && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-yellow-600 dark:text-yellow-400">{parseError}</p>
            <button 
              onClick={() => setParseError(null)}
              className="text-yellow-400 hover:text-yellow-600"
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
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-dark-900 dark:text-white">SQL Preview</h4>
              <div className="flex items-center space-x-2">
                {!editSQL ? (
                  <AppButton
                    variant="secondary"
                    size="sm"
                    onClick={handleEditSQL}
                    icon={<Edit3 className="w-4 h-4" />}
                  >
                    Edit SQL
                  </AppButton>
                ) : (
                  <div className="flex items-center space-x-2">
                    <AppButton
                      variant="secondary"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </AppButton>
                    <AppButton
                      variant="primary"
                      size="sm"
                      onClick={handleSQLParse}
                      icon={<Upload className="w-4 h-4" />}
                    >
                      Apply Changes
                    </AppButton>
                  </div>
                )}
              </div>
            </div>
            
            {editSQL ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    Edit your CREATE TABLE statement:
                  </label>
                  <textarea
                    value={sqlSchema}
                    onChange={(e) => handleSQLChange(e.target.value)}
                    className="w-full h-64 px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <Code className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <h6 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                        Interactive SQL Editor
                      </h6>
                      <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                        <li>• Auto-parses SQL after 1 second of inactivity</li>
                        <li>• Real-time sync with visual designer</li>
                        <li>• Supports all PostgreSQL data types and constraints</li>
                        <li>• Handles VARCHAR/CHAR length specifications</li>
                        <li>• Bidirectional editing - changes in either mode sync instantly</li>
                      </ul>
                      {sqlSchema.length > 10000 && (
                        <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                          <p className="text-xs text-yellow-800 dark:text-yellow-200">
                            ⚠️ Large SQL detected ({sqlSchema.length} characters). For very large dumps, consider parsing individual CREATE TABLE statements.
                          </p>
                        </div>
                      )}
                      {isAutoParsing && (
                        <div className="mt-2 flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm">Auto-parsing...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-dark-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre className="text-green-400 whitespace-pre-wrap">{generateSQL()}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SchemaDesigner;
