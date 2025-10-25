import React, { useState } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2 
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

  const dataTypes = [
    'SERIAL', 'INTEGER', 'BIGINT', 'SMALLINT',
    'VARCHAR', 'TEXT', 'CHAR',
    'BOOLEAN', 'DATE', 'TIMESTAMP',
    'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION',
    'JSON', 'JSONB', 'UUID'
  ];

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
    </div>
  );
};

export default SchemaEditor;
