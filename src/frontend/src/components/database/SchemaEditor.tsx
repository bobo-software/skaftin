import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2,
  Key,
  Link,
  Shield,
  RefreshCw
} from 'lucide-react';
import { AppButton, DeleteConfirmModal } from '../ComponentsIndex';
import McpService from '../../services/McpService';

interface SchemaEditorProps {
  projectId: string;
  tableName: string;
  columns: Array<{
    column_name: string;
    data_type: string;
    is_nullable: boolean;
    column_default?: string;
    character_maximum_length?: number;
  }>;
  loading?: boolean;
  onSchemaChange?: () => void;
}

const SchemaEditor = ({ 
  projectId, 
  tableName, 
  columns, 
  loading = false,
  onSchemaChange 
}: SchemaEditorProps) => {
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [showAddColumnForm, setShowAddColumnForm] = useState(false);
  const [newColumn, setNewColumn] = useState({
    name: '',
    type: 'VARCHAR',
    nullable: true,
    defaultValue: '',
    length: ''
  });
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editColumnData, setEditColumnData] = useState({
    name: '',
    type: '',
    nullable: true,
    defaultValue: ''
  });
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'column' | 'table';
    columnName?: string;
    loading: boolean;
  }>({
    isOpen: false,
    type: 'column',
    loading: false
  });
  const [showConstraintsSection, setShowConstraintsSection] = useState(false);
  const [showForeignKeyModal, setShowForeignKeyModal] = useState(false);
  const [foreignKeys, setForeignKeys] = useState<any[]>([]);
  const [newForeignKey, setNewForeignKey] = useState({
    columnName: '',
    referencedTable: '',
    referencedColumn: '',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT'
  });
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [selectedConstraintTable, setSelectedConstraintTable] = useState<string>('');
  const [selectedConstraintColumns, setSelectedConstraintColumns] = useState<any[]>([]);
  const [constraintForm, setConstraintForm] = useState({
    sourceColumn: '',
    referencedTable: '',
    referencedColumn: '',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT'
  });
  const [constraintWarnings, setConstraintWarnings] = useState<string[]>([]);
  const [allConstraints, setAllConstraints] = useState<any[]>([]);
  const [constraintsLoading, setConstraintsLoading] = useState(false);

  const dataTypes = [
    'SERIAL', 'INTEGER', 'BIGINT', 'SMALLINT',
    'VARCHAR', 'TEXT', 'CHAR',
    'BOOLEAN', 'DATE', 'TIMESTAMP',
    'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION',
    'JSON', 'JSONB', 'UUID'
  ];


  const foreignKeyActions = [
    { value: 'RESTRICT', label: 'RESTRICT' },
    { value: 'CASCADE', label: 'CASCADE' },
    { value: 'SET NULL', label: 'SET NULL' },
    { value: 'SET DEFAULT', label: 'SET DEFAULT' },
    { value: 'NO ACTION', label: 'NO ACTION' }
  ];

  const loadForeignKeys = async () => {
    try {
      const result = await McpService.listForeignKeys(projectId, tableName);
      if (result.success) {
        setForeignKeys(result.data || []);
      }
    } catch (error) {
      console.error('Error loading foreign keys:', error);
    }
  };

  const loadAllConstraints = useCallback(async () => {
    setConstraintsLoading(true);
    try {
      const result = await McpService.listAllConstraints(projectId, tableName);
      console.log('Full MCP response:', result);
      
      if (result.success) {
        // Debug the response structure
        console.log('result.data:', result.data);
        console.log('result.data.data:', result.data?.data);
        console.log('result.result:', result.result);
        console.log('result.result.data:', result.result?.data);
        
        // Try different paths to find the actual constraints array
        let constraints = [];
        
        // Based on your earlier message, the structure is: result.data.data
        if (result.data?.data && Array.isArray(result.data.data)) {
          constraints = result.data.data;
        } 
        // Fallback paths
        else if (result.data && Array.isArray(result.data)) {
          constraints = result.data;
        } else if (result.result?.data?.data && Array.isArray(result.result.data.data)) {
          constraints = result.result.data.data;
        } else if (result.result?.data && Array.isArray(result.result.data)) {
          constraints = result.result.data;
        } else if (result.result && Array.isArray(result.result)) {
          constraints = result.result;
        }
        
        // If we still don't have an array, let's look deeper
        if (!Array.isArray(constraints)) {
          console.log('No array found, checking deeper...');
          console.log('result keys:', Object.keys(result));
          if (result.data) {
            console.log('result.data keys:', Object.keys(result.data));
            if (result.data.data) {
              console.log('result.data.data type:', typeof result.data.data);
              console.log('result.data.data is array:', Array.isArray(result.data.data));
            }
          }
        }
        
        console.log('Extracted constraints:', constraints);
        setAllConstraints(Array.isArray(constraints) ? constraints : []);
      } else {
        console.error('Failed to load constraints:', result.error);
        setAllConstraints([]);
      }
    } catch (error) {
      console.error('Error loading constraints:', error);
      setAllConstraints([]);
    } finally {
      setConstraintsLoading(false);
    }
  }, [projectId, tableName]);

  // Load constraints when component mounts
  useEffect(() => {
    if (projectId && tableName) {
      loadAllConstraints();
    }
  }, [projectId, tableName, loadAllConstraints]);

  const loadAvailableTables = async () => {
    try {
      const result = await McpService.listTables(projectId);
      if (result.success) {
        // Filter out current table
        const otherTables = result.data.filter((table: any) => table.table_name !== tableName);
        setAvailableTables(otherTables);
      }
    } catch (error) {
      console.error('Error loading tables:', error);
    }
  };

  const handleConstraintTableSelect = async (tableName: string) => {
    setSelectedConstraintTable(tableName);
    setConstraintForm(prev => ({ ...prev, referencedTable: tableName, referencedColumn: '' }));
    
    try {
      const result = await McpService.getTableSchema(projectId, tableName);
      if (result.success) {
        setSelectedConstraintColumns(result.data || []);
        validateConstraintTypes();
      }
    } catch (error) {
      console.error('Error loading table schema:', error);
      setSelectedConstraintColumns([]);
    }
  };

  const validateConstraintTypes = () => {
    const warnings: string[] = [];
    
    if (constraintForm.sourceColumn && constraintForm.referencedColumn) {
      const sourceColumn = columns.find(col => col.column_name === constraintForm.sourceColumn);
      const referencedColumn = selectedConstraintColumns.find(col => col.column_name === constraintForm.referencedColumn);
      
      if (sourceColumn && referencedColumn) {
        // Check for type compatibility
        const sourceType = sourceColumn.data_type.toUpperCase();
        const referencedType = referencedColumn.data_type.toUpperCase();
        
        if (sourceType !== referencedType) {
          warnings.push(`⚠️ Data type mismatch: ${sourceColumn.column_name} (${sourceType}) vs ${referencedColumn.column_name} (${referencedType})`);
        }
        
        // Check for length differences in VARCHAR
        if (sourceType.includes('VARCHAR') && referencedType.includes('VARCHAR')) {
          const sourceLength = sourceColumn.character_maximum_length || 0;
          const referencedLength = referencedColumn.character_maximum_length || 0;
          if (sourceLength !== referencedLength) {
            warnings.push(`⚠️ VARCHAR length mismatch: ${sourceColumn.column_name} (${sourceLength}) vs ${referencedColumn.column_name} (${referencedLength})`);
          }
        }
        
        // Check for nullable constraints
        if (!sourceColumn.is_nullable && referencedColumn.is_nullable) {
          warnings.push(`⚠️ Source column ${sourceColumn.column_name} is NOT NULL but referenced column ${referencedColumn.column_name} is nullable`);
        }
      }
    }
    
    setConstraintWarnings(warnings);
  };

  const handleConstraintFormChange = (field: string, value: string) => {
    setConstraintForm(prev => ({ ...prev, [field]: value }));
    
    // Re-validate when columns change
    if (field === 'sourceColumn' || field === 'referencedColumn') {
      setTimeout(validateConstraintTypes, 100);
    }
  };

  const handleCreateConstraint = async () => {
    if (!constraintForm.sourceColumn || !constraintForm.referencedTable || !constraintForm.referencedColumn) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const result = await McpService.createForeignKey(
        projectId,
        tableName,
        constraintForm.sourceColumn,
        constraintForm.referencedTable,
        constraintForm.referencedColumn
      );
      
      if (result.success) {
        console.log('Foreign key constraint created successfully');
        onSchemaChange?.();
        setShowConstraintsSection(false);
        setConstraintForm({
          sourceColumn: '',
          referencedTable: '',
          referencedColumn: '',
          onDelete: 'RESTRICT',
          onUpdate: 'RESTRICT'
        });
        setSelectedConstraintTable('');
        setSelectedConstraintColumns([]);
        setConstraintWarnings([]);
        await loadForeignKeys();
      } else {
        console.error('Failed to create constraint:', result.error);
        alert('Failed to create constraint. Please try again.');
      }
    } catch (error) {
      console.error('Error creating constraint:', error);
      alert('Error creating constraint. Please try again.');
    }
  };

  const handleCreateForeignKey = async () => {
    if (!newForeignKey.columnName || !newForeignKey.referencedTable || !newForeignKey.referencedColumn) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const result = await McpService.createForeignKey(
        projectId,
        tableName,
        newForeignKey.columnName,
        newForeignKey.referencedTable,
        newForeignKey.referencedColumn
      );
      
      if (result.success) {
        console.log('Foreign key created successfully');
        onSchemaChange?.();
        setShowForeignKeyModal(false);
        setNewForeignKey({
          columnName: '',
          referencedTable: '',
          referencedColumn: '',
          onDelete: 'RESTRICT',
          onUpdate: 'RESTRICT'
        });
        await loadForeignKeys();
      } else {
        console.error('Failed to create foreign key:', result.error);
        alert('Failed to create foreign key. Please try again.');
      }
    } catch (error) {
      console.error('Error creating foreign key:', error);
      alert('Error creating foreign key. Please try again.');
    }
  };

  const handleAddColumn = async (columnName: string, columnType: string, nullable: boolean = true, defaultValue?: string, length?: string) => {
    if (!tableName) return;
    
    setIsAddingColumn(true);
    try {
      // Build the full column type with length if specified
      let fullColumnType = columnType;
      if (length && (columnType.includes('VARCHAR') || columnType.includes('CHAR'))) {
        fullColumnType = `${columnType}(${length})`;
      }
      
      const result = await McpService.addColumn(projectId, tableName, columnName, fullColumnType, nullable);
      if (result.success) {
        console.log('Column added successfully');
        onSchemaChange?.();
        // Reset form and hide it
        setNewColumn({ name: '', type: 'VARCHAR', nullable: true, defaultValue: '', length: '' });
        setShowAddColumnForm(false);
      } else {
        console.error('Failed to add column:', result.error);
        alert('Failed to add column. Please try again.');
      }
    } catch (error) {
      console.error('Error adding column:', error);
      alert('Error adding column. Please try again.');
    } finally {
      setIsAddingColumn(false);
    }
  };

  const handleAddColumnClick = () => {
    setShowAddColumnForm(true);
  };

  const handleSaveNewColumn = () => {
    if (!newColumn.name.trim()) {
      alert('Please enter a column name');
      return;
    }
    
    handleAddColumn(
      newColumn.name, 
      newColumn.type, 
      newColumn.nullable, 
      newColumn.defaultValue || undefined,
      newColumn.length || undefined
    );
  };

  const handleCancelAddColumn = () => {
    setShowAddColumnForm(false);
    setNewColumn({ name: '', type: 'VARCHAR', nullable: true, defaultValue: '', length: '' });
  };

  const handleStartEdit = (column: any) => {
    setEditingColumn(column.column_name);
    setEditColumnData({
      name: column.column_name,
      type: column.data_type,
      nullable: column.is_nullable,
      defaultValue: column.column_default || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingColumn(null);
    setEditColumnData({ name: '', type: '', nullable: true, defaultValue: '' });
  };

  const handleSaveEdit = async () => {
    if (!editingColumn || !editColumnData.name.trim()) return;

    try {
      const changes: any = {};
      
      // Check what has changed
      const originalColumn = columns.find(col => col.column_name === editingColumn);
      if (!originalColumn) return;

      if (editColumnData.name !== originalColumn.column_name) {
        changes.newName = editColumnData.name;
      }
      
      if (editColumnData.type !== originalColumn.data_type) {
        changes.newType = editColumnData.type;
      }
      
      if (editColumnData.nullable !== originalColumn.is_nullable) {
        changes.nullable = editColumnData.nullable;
      }
      
      const originalDefault = originalColumn.column_default || '';
      if (editColumnData.defaultValue !== originalDefault) {
        changes.defaultValue = editColumnData.defaultValue || null;
      }

      // Only proceed if there are actual changes
      if (Object.keys(changes).length === 0) {
        alert('No changes detected.');
        handleCancelEdit();
        return;
      }

      const result = await McpService.alterColumn(projectId, tableName, editingColumn, changes);
      
      if (result.success) {
        console.log('Column altered successfully');
        onSchemaChange?.();
        handleCancelEdit();
      } else {
        console.error('Failed to alter column:', result.error);
        alert('Failed to alter column. Please try again.');
      }
    } catch (error) {
      console.error('Error editing column:', error);
      alert('Error editing column. Please try again.');
    }
  };

  const renderDefaultValueInput = () => {
    const isNumeric = ['INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION'].includes(newColumn.type);
    const isBoolean = newColumn.type === 'BOOLEAN';
    const isDate = ['DATE', 'TIMESTAMP'].includes(newColumn.type);
    const isText = ['VARCHAR', 'TEXT', 'CHAR'].includes(newColumn.type);

    if (isBoolean) {
      return (
        <select
          value={newColumn.defaultValue}
          onChange={(e) => setNewColumn({ ...newColumn, defaultValue: e.target.value })}
          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">No default</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    if (isNumeric) {
      return (
        <input
          type="number"
          value={newColumn.defaultValue}
          onChange={(e) => setNewColumn({ ...newColumn, defaultValue: e.target.value })}
          placeholder="Enter number"
          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      );
    }

    if (isDate) {
      return (
        <input
          type={newColumn.type === 'DATE' ? 'date' : 'datetime-local'}
          value={newColumn.defaultValue}
          onChange={(e) => setNewColumn({ ...newColumn, defaultValue: e.target.value })}
          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      );
    }

    if (isText) {
      return (
        <input
          type="text"
          value={newColumn.defaultValue}
          onChange={(e) => setNewColumn({ ...newColumn, defaultValue: e.target.value })}
          placeholder="Enter text"
          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      );
    }

    // Default fallback for other types (JSON, JSONB, UUID, etc.)
    return (
      <input
        type="text"
        value={newColumn.defaultValue}
        onChange={(e) => setNewColumn({ ...newColumn, defaultValue: e.target.value })}
        placeholder="Enter default value"
        className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
    );
  };

  const renderEditForm = (column: any) => {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h6 className="font-semibold text-blue-900 dark:text-blue-100">
            Edit Column: {column.column_name}
          </h6>
          <button
            onClick={handleCancelEdit}
            className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
          >
            ×
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Column Name
            </label>
            <input
              type="text"
              value={editColumnData.name}
              onChange={(e) => setEditColumnData({ ...editColumnData, name: e.target.value })}
              className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Data Type
            </label>
            <select
              value={editColumnData.type}
              onChange={(e) => setEditColumnData({ ...editColumnData, type: e.target.value, defaultValue: '' })}
              className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {dataTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Default Value
            </label>
            {renderEditDefaultValueInput()}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Nullable
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={editColumnData.nullable}
                onChange={(e) => setEditColumnData({ ...editColumnData, nullable: e.target.checked })}
                className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-dark-700 dark:text-dark-300">
                {editColumnData.nullable ? 'Nullable' : 'Required'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end space-x-2 mt-4">
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
            onClick={handleSaveEdit}
            disabled={!editColumnData.name.trim()}
            icon={<Edit3 className="w-4 h-4" />}
          >
            Save Changes
          </AppButton>
        </div>
      </div>
    );
  };

  const renderEditDefaultValueInput = () => {
    const isNumeric = ['INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION'].includes(editColumnData.type);
    const isBoolean = editColumnData.type === 'BOOLEAN';
    const isDate = ['DATE', 'TIMESTAMP'].includes(editColumnData.type);
    const isText = ['VARCHAR', 'TEXT', 'CHAR'].includes(editColumnData.type);

    if (isBoolean) {
      return (
        <select
          value={editColumnData.defaultValue}
          onChange={(e) => setEditColumnData({ ...editColumnData, defaultValue: e.target.value })}
          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">No default</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    if (isNumeric) {
      return (
        <input
          type="number"
          value={editColumnData.defaultValue}
          onChange={(e) => setEditColumnData({ ...editColumnData, defaultValue: e.target.value })}
          placeholder="Enter number"
          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      );
    }

    if (isDate) {
      return (
        <input
          type={editColumnData.type === 'DATE' ? 'date' : 'datetime-local'}
          value={editColumnData.defaultValue}
          onChange={(e) => setEditColumnData({ ...editColumnData, defaultValue: e.target.value })}
          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      );
    }

    if (isText) {
      return (
        <input
          type="text"
          value={editColumnData.defaultValue}
          onChange={(e) => setEditColumnData({ ...editColumnData, defaultValue: e.target.value })}
          placeholder="Enter text"
          className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      );
    }

    // Default fallback for other types
    return (
      <input
        type="text"
        value={editColumnData.defaultValue}
        onChange={(e) => setEditColumnData({ ...editColumnData, defaultValue: e.target.value })}
        placeholder="Enter default value"
        className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
    );
  };

  const handleDropColumn = (columnName: string) => {
    setDeleteModal({
      isOpen: true,
      type: 'column',
      columnName,
      loading: false
    });
  };

  const handleDropTable = () => {
    setDeleteModal({
      isOpen: true,
      type: 'table',
      loading: false
    });
  };

  const confirmDelete = async () => {
    setDeleteModal(prev => ({ ...prev, loading: true }));

    try {
      if (deleteModal.type === 'column' && deleteModal.columnName) {
        const result = await McpService.dropColumn(projectId, tableName, deleteModal.columnName);
        if (result.success) {
          console.log('Column dropped successfully');
          onSchemaChange?.();
          setDeleteModal({ isOpen: false, type: 'column', loading: false });
        } else {
          console.error('Failed to drop column:', result.error);
          alert('Failed to drop column. Please try again.');
        }
      } else if (deleteModal.type === 'table') {
        const result = await McpService.dropTable(projectId, tableName);
        if (result.success) {
          console.log('Table dropped successfully');
          // This will be handled by the parent component
          window.location.reload(); // Simple refresh for now
        } else {
          console.error('Failed to drop table:', result.error);
          alert('Failed to drop table. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Error deleting. Please try again.');
    } finally {
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };


  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-dark-600 dark:text-dark-300">Loading table schema...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Schema Actions */}
      <div className="flex items-center justify-between">
        <h5 className="text-lg font-semibold text-dark-900 dark:text-white">
          Table Schema
        </h5>
        <div className="flex items-center space-x-2">
          <AppButton 
            variant="secondary" 
            size="sm" 
            icon={<Plus className="w-4 h-4" />}
            onClick={handleAddColumnClick}
            disabled={isAddingColumn}
          >
            Add Column
          </AppButton>
          <AppButton 
            variant="secondary" 
            size="sm" 
            icon={<Key className="w-4 h-4" />}
            onClick={() => {
              setShowConstraintsSection(!showConstraintsSection);
              if (!showConstraintsSection) {
                loadAvailableTables();
              }
            }}
          >
            {showConstraintsSection ? 'Hide Constraints' : 'Constraints'}
          </AppButton>
          <AppButton 
            variant="secondary" 
            size="sm" 
            icon={<Link className="w-4 h-4" />}
            onClick={() => {
              setShowForeignKeyModal(true);
              loadAvailableTables();
            }}
          >
            Foreign Keys
          </AppButton>
          <AppButton 
            variant="danger" 
            size="sm" 
            icon={<Trash2 className="w-4 h-4" />}
            onClick={handleDropTable}
          >
            Delete Table
          </AppButton>
        </div>
      </div>

      {/* Schema Table */}
      <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-50 dark:bg-dark-700">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-700 dark:text-dark-300">
                  Column Name
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-700 dark:text-dark-300">
                  Data Type
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-700 dark:text-dark-300">
                  Nullable
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-700 dark:text-dark-300">
                  Default Value
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-dark-700 dark:text-dark-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-200 dark:divide-dark-700">
              {columns.map((column, index) => (
                <React.Fragment key={index}>
                  <tr className="hover:bg-dark-50 dark:hover:bg-dark-700">
                    <td className="py-3 px-4 text-sm text-dark-900 dark:text-white font-medium">
                      {column.column_name}
                    </td>
                    <td className="py-3 px-4 text-sm text-dark-600 dark:text-dark-300">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs bg-dark-100 dark:bg-dark-600 px-2 py-1 rounded">
                          {column.data_type}
                        </span>
                        {column.character_maximum_length && (
                          <span className="text-xs text-dark-500 dark:text-dark-400">
                            ({column.character_maximum_length})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        column.is_nullable 
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      }`}>
                        {column.is_nullable ? 'Nullable' : 'Required'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-dark-600 dark:text-dark-300">
                      {column.column_default ? (
                        <span className="font-mono text-xs bg-dark-100 dark:bg-dark-600 px-2 py-1 rounded">
                          {column.column_default}
                        </span>
                      ) : (
                        <span className="text-dark-400 dark:text-dark-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <div className="flex items-center space-x-1">
                        <button 
                          className="p-1 text-dark-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                          onClick={() => handleStartEdit(column)}
                          title="Edit column"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-1 text-dark-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          onClick={() => handleDropColumn(column.column_name)}
                          title="Delete column"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingColumn === column.column_name && (
                    <tr>
                      <td colSpan={5} className="p-0">
                        {renderEditForm(column)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Existing Constraints Display */}
      <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 overflow-hidden">
        <div className="p-4 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="w-5 h-5 text-primary-500" />
              <h5 className="text-lg font-semibold text-dark-900 dark:text-white">
                Table Constraints
              </h5>
            </div>
            <AppButton
              variant="secondary"
              size="sm"
              onClick={loadAllConstraints}
              loading={constraintsLoading}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </AppButton>
          </div>
        </div>

        <div className="p-4">
          {constraintsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-3"></div>
              <p className="text-dark-600 dark:text-dark-300">Loading constraints...</p>
            </div>
          ) : allConstraints.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-dark-300 dark:text-dark-600 mx-auto mb-3" />
              <p className="text-dark-600 dark:text-dark-300">No constraints found</p>
              <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">
                Click "Refresh" to load constraints or create new ones
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {allConstraints.map((constraint, index) => (
                <div key={index} className="bg-dark-50 dark:bg-dark-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          constraint.constraint_type === 'FOREIGN KEY' 
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                            : constraint.constraint_type === 'PRIMARY KEY'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : constraint.constraint_type === 'CHECK'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                            : 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
                        }`}>
                          {constraint.constraint_type}
                        </span>
                        <span className="font-mono text-sm text-dark-600 dark:text-dark-300">
                          {constraint.constraint_name}
                        </span>
                      </div>
                      
                      {constraint.constraint_type === 'FOREIGN KEY' && (
                        <div className="space-y-1">
                          <p className="text-sm text-dark-700 dark:text-dark-300">
                            <span className="font-medium">{constraint.column_name}</span> → 
                            <span className="font-medium">{constraint.referenced_table_name}.{constraint.referenced_column_name}</span>
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-dark-500 dark:text-dark-400">
                            <span>ON DELETE: <span className="font-medium">{constraint.delete_rule}</span></span>
                            <span>ON UPDATE: <span className="font-medium">{constraint.update_rule}</span></span>
                          </div>
                        </div>
                      )}
                      
                      {constraint.constraint_type === 'PRIMARY KEY' && (
                        <p className="text-sm text-dark-700 dark:text-dark-300">
                          Column: <span className="font-medium">{constraint.column_name}</span>
                        </p>
                      )}
                      
                      {constraint.constraint_type === 'CHECK' && constraint.check_clause && (
                        <div className="space-y-1">
                          <p className="text-sm text-dark-700 dark:text-dark-300">
                            Check: <span className="font-mono text-xs bg-dark-100 dark:bg-dark-600 px-2 py-1 rounded">
                              {constraint.check_clause}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-1 ml-4">
                      <button 
                        className="p-1 text-dark-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete constraint"
                        onClick={async () => {
                          if (confirm(`Are you sure you want to delete the constraint "${constraint.constraint_name}"?`)) {
                            try {
                              const result = await McpService.dropConstraint(projectId, tableName, constraint.constraint_name);
                              if (result.success) {
                                console.log('Constraint deleted successfully');
                                await loadAllConstraints(); // Refresh the list
                                onSchemaChange?.(); // Notify parent of schema change
                              } else {
                                console.error('Failed to delete constraint:', result.error);
                                alert('Failed to delete constraint. Please try again.');
                              }
                            } catch (error) {
                              console.error('Error deleting constraint:', error);
                              alert('Error deleting constraint. Please try again.');
                            }
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Constraints Section */}
      {showConstraintsSection && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Key className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h5 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                Create Foreign Key Constraint
              </h5>
            </div>
            <button
              onClick={() => setShowConstraintsSection(false)}
              className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            {/* Step 1: Select Referenced Table */}
            <div>
              <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
                1. Select Referenced Table
              </label>
              <select
                value={selectedConstraintTable}
                onChange={(e) => handleConstraintTableSelect(e.target.value)}
                className="w-full px-4 py-3 border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose a table to reference...</option>
                {availableTables.map(table => (
                  <option key={table.table_name} value={table.table_name}>
                    {table.table_name} ({table.table_type})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Column Mapping */}
            {selectedConstraintTable && (
              <div>
                <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
                  2. Map Columns
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Source Column (from {tableName})
                    </label>
                    <select
                      value={constraintForm.sourceColumn}
                      onChange={(e) => handleConstraintFormChange('sourceColumn', e.target.value)}
                      className="w-full px-3 py-2 border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select source column</option>
                      {columns.map(col => (
                        <option key={col.column_name} value={col.column_name}>
                          {col.column_name} ({col.data_type})
                          {!col.is_nullable && ' *'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Referenced Column (from {selectedConstraintTable})
                    </label>
                    <select
                      value={constraintForm.referencedColumn}
                      onChange={(e) => handleConstraintFormChange('referencedColumn', e.target.value)}
                      className="w-full px-3 py-2 border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select referenced column</option>
                      {selectedConstraintColumns.map(col => (
                        <option key={col.column_name} value={col.column_name}>
                          {col.column_name} ({col.data_type})
                          {!col.is_nullable && ' *'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Action Configuration */}
            {constraintForm.sourceColumn && constraintForm.referencedColumn && (
              <div>
                <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
                  3. Configure Actions
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      On Delete
                    </label>
                    <select
                      value={constraintForm.onDelete}
                      onChange={(e) => handleConstraintFormChange('onDelete', e.target.value)}
                      className="w-full px-3 py-2 border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {foreignKeyActions.map(action => (
                        <option key={action.value} value={action.value}>
                          {action.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      On Update
                    </label>
                    <select
                      value={constraintForm.onUpdate}
                      onChange={(e) => handleConstraintFormChange('onUpdate', e.target.value)}
                      className="w-full px-3 py-2 border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {foreignKeyActions.map(action => (
                        <option key={action.value} value={action.value}>
                          {action.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Warnings */}
            {constraintWarnings.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <h6 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                      Compatibility Warnings
                    </h6>
                    <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                      {constraintWarnings.map((warning, index) => (
                        <li key={index}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3">
              <AppButton
                variant="secondary"
                onClick={() => setShowConstraintsSection(false)}
              >
                Cancel
              </AppButton>
              <AppButton
                variant="primary"
                onClick={handleCreateConstraint}
                disabled={!constraintForm.sourceColumn || !constraintForm.referencedTable || !constraintForm.referencedColumn}
                icon={<Key className="w-4 h-4" />}
              >
                Create Constraint
              </AppButton>
            </div>
          </div>
        </div>
      )}

      {/* Add Column Form */}
      {showAddColumnForm && (
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h6 className="font-semibold text-primary-900 dark:text-primary-100">
              Add New Column
            </h6>
            <button
              onClick={handleCancelAddColumn}
              className="text-primary-400 hover:text-primary-600 dark:hover:text-primary-300"
            >
              ×
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Column Name
              </label>
              <input
                type="text"
                value={newColumn.name}
                onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                placeholder="Enter column name"
                className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Data Type
              </label>
              <select
                value={newColumn.type}
                onChange={(e) => {
                  const newType = e.target.value;
                  // Clear default value when type changes to avoid invalid values
                  setNewColumn({ ...newColumn, type: newType, defaultValue: '' });
                }}
                className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {dataTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Length
              </label>
              <input
                type="number"
                value={newColumn.length}
                onChange={(e) => setNewColumn({ ...newColumn, length: e.target.value })}
                placeholder="255"
                className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Default Value
              </label>
              {renderDefaultValueInput()}
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newColumn.nullable}
                  onChange={(e) => setNewColumn({ ...newColumn, nullable: e.target.checked })}
                  className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-dark-700 dark:text-dark-300">Nullable</span>
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <AppButton
                variant="secondary"
                size="sm"
                onClick={handleCancelAddColumn}
                disabled={isAddingColumn}
              >
                Cancel
              </AppButton>
              <AppButton
                variant="primary"
                size="sm"
                onClick={handleSaveNewColumn}
                loading={isAddingColumn}
                disabled={isAddingColumn || !newColumn.name.trim()}
                icon={<Plus className="w-4 h-4" />}
              >
                Add Column
              </AppButton>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, type: 'column', loading: false })}
        onConfirm={confirmDelete}
        title={deleteModal.type === 'column' ? `Delete Column "${deleteModal.columnName}"` : `Delete Table "${tableName}"`}
        message={deleteModal.type === 'column' 
          ? `Are you sure you want to delete the column "${deleteModal.columnName}"? This action cannot be undone.`
          : `Are you sure you want to delete the table "${tableName}"? This action cannot be undone and will remove all data in the table.`
        }
        itemName={deleteModal.type === 'column' ? 'column' : 'table'}
        itemCount={1}
        loading={deleteModal.loading}
        variant="single"
      />


      {/* Foreign Keys Modal */}
      {showForeignKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
              <div className="flex items-center space-x-3">
                <Link className="w-6 h-6 text-primary-500" />
                <h3 className="text-xl font-semibold text-dark-900 dark:text-white">
                  Foreign Keys
                </h3>
              </div>
              <button
                onClick={() => setShowForeignKeyModal(false)}
                className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-6">
                {/* Add Foreign Key Form */}
                <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
                  <h4 className="font-semibold text-primary-900 dark:text-primary-100 mb-4">
                    Add New Foreign Key
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                        Column Name
                      </label>
                      <select
                        value={newForeignKey.columnName}
                        onChange={(e) => setNewForeignKey({ ...newForeignKey, columnName: e.target.value })}
                        className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Select column</option>
                        {columns.map(col => (
                          <option key={col.column_name} value={col.column_name}>
                            {col.column_name} ({col.data_type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                        Referenced Table
                      </label>
                      <select
                        value={newForeignKey.referencedTable}
                        onChange={(e) => setNewForeignKey({ ...newForeignKey, referencedTable: e.target.value, referencedColumn: '' })}
                        className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Select table</option>
                        {availableTables.map(table => (
                          <option key={table.table_name} value={table.table_name}>
                            {table.table_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                        Referenced Column
                      </label>
                      <input
                        type="text"
                        value={newForeignKey.referencedColumn}
                        onChange={(e) => setNewForeignKey({ ...newForeignKey, referencedColumn: e.target.value })}
                        placeholder="Enter column name"
                        className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                        On Delete
                      </label>
                      <select
                        value={newForeignKey.onDelete}
                        onChange={(e) => setNewForeignKey({ ...newForeignKey, onDelete: e.target.value })}
                        className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        {foreignKeyActions.map(action => (
                          <option key={action.value} value={action.value}>
                            {action.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                        On Update
                      </label>
                      <select
                        value={newForeignKey.onUpdate}
                        onChange={(e) => setNewForeignKey({ ...newForeignKey, onUpdate: e.target.value })}
                        className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        {foreignKeyActions.map(action => (
                          <option key={action.value} value={action.value}>
                            {action.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 mt-4">
                    <AppButton
                      variant="secondary"
                      onClick={() => setShowForeignKeyModal(false)}
                    >
                      Cancel
                    </AppButton>
                    <AppButton
                      variant="primary"
                      onClick={handleCreateForeignKey}
                      disabled={!newForeignKey.columnName || !newForeignKey.referencedTable || !newForeignKey.referencedColumn}
                      icon={<Link className="w-4 h-4" />}
                    >
                      Create Foreign Key
                    </AppButton>
                  </div>
                </div>

                {/* Existing Foreign Keys */}
                {foreignKeys.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-dark-900 dark:text-white">Existing Foreign Keys</h5>
                    {foreignKeys.map((fk, index) => (
                      <div key={index} className="bg-dark-50 dark:bg-dark-700 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-dark-900 dark:text-white">
                              {fk.column_name} → {fk.referenced_table_name}.{fk.referenced_column_name}
                            </p>
                            <p className="text-sm text-dark-600 dark:text-dark-300">
                              ON DELETE {fk.delete_rule} • ON UPDATE {fk.update_rule}
                            </p>
                            <p className="text-xs text-dark-500 dark:text-dark-400">
                              Constraint: {fk.constraint_name}
                            </p>
                          </div>
                          <button className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchemaEditor;
