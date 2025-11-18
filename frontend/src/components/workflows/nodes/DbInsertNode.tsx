import { Handle, Position } from 'reactflow';
import { Database, Plus } from 'lucide-react';
import { DbInsertNodeData } from '../../../types/workflow.types';
import { NodeWrapper, NodeActions } from '../../ComponentsIndex';
import { useNodeConnection } from '../../../hooks/useNodeConnection';
import { useNodeOperations } from '../../../hooks/useNodeOperations';
import { useState, useEffect, useMemo } from 'react';
import useDatabaseStore from '../../../stores/data/useDatabaseStore';

interface DbInsertNodeProps {
  id: string;
  data: DbInsertNodeData;
  selected?: boolean;
}

const DbInsertNode = ({ id, data, selected }: DbInsertNodeProps) => {
  const { isConnected } = useNodeConnection(id);
  const { handleDelete, handleUpdateData } = useNodeOperations(id);
  const { tables, fetchTables, loading, getTableSchema } = useDatabaseStore();
  const [showConfig, setShowConfig] = useState(false);
  const [table, setTable] = useState(data.table || '');
  const [fieldMappings, setFieldMappings] = useState(
    data.fieldMappings || [{ column: '', value: '' }]
  );
  const [schemaColumns, setSchemaColumns] = useState<any[]>([]);

  const availableTables = useMemo(
    () => tables.map((t) => t.table_name).sort(),
    [tables]
  );

  useEffect(() => {
    if (!data.projectId) return;
    if (tables.length === 0) {
      fetchTables(data.projectId).catch(() => {});
    }
  }, [data.projectId, tables.length, fetchTables]);

  useEffect(() => {
    if (table && data.projectId) {
      getTableSchema(data.projectId, table)
        .then((columns) => {
          setSchemaColumns(columns);
          handleUpdateData<DbInsertNodeData>({ schema: columns });
        })
        .catch(() => {});
    }
  }, [table, data.projectId, getTableSchema, handleUpdateData]);

  const handleAddField = () => {
    setFieldMappings([...fieldMappings, { column: '', value: '' }]);
  };

  const handleRemoveField = (index: number) => {
    setFieldMappings(fieldMappings.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, field: 'column' | 'value', value: string) => {
    const updated = [...fieldMappings];
    updated[index] = { ...updated[index], [field]: value };
    setFieldMappings(updated);
  };

  const handleSave = () => {
    handleUpdateData<DbInsertNodeData>({
      table: table || undefined,
      fieldMappings: fieldMappings.filter((f) => f.column && f.value),
    });
    setShowConfig(false);
  };

  return (
    <NodeWrapper
      id={id}
      selected={selected}
      isConnected={isConnected}
      minWidth="320px"
    >
      <NodeActions selected={selected || false} onDelete={handleDelete} />
      <div className="flex items-center space-x-2 mb-2">
        <Database className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        <div className="font-semibold text-sm text-dark-900 dark:text-white flex-1 truncate">
          {data.label || 'Insert Data'}
        </div>
      </div>

      <div className="px-4 py-3">
        <button
          onClick={() => setShowConfig(true)}
          className="w-full text-left bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-3 py-2 hover:border-primary-400 transition-colors"
        >
          <div className="text-[11px] uppercase tracking-wide text-dark-400 dark:text-dark-500 mb-1">
            Insert Configuration
          </div>
          <div className="text-sm text-dark-900 dark:text-dark-100">
            {table ? `Insert into ${table}` : 'Click to configure'}
          </div>
        </button>
      </div>

      {/* Config Modal */}
      {showConfig && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 rounded-lg" onClick={() => setShowConfig(false)} />
          <div className="relative z-30 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-lg p-4 w-[500px] max-h-[600px] overflow-y-auto">
            <div className="text-sm font-semibold text-dark-900 dark:text-white mb-3">Insert Data Configuration</div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-dark-500 dark:text-dark-400 mb-1">Table</div>
                <select
                  value={table}
                  onChange={(e) => {
                    setTable(e.target.value);
                    setFieldMappings([{ column: '', value: '' }]);
                  }}
                  className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
                  disabled={loading}
                >
                  <option value="">Select a table</option>
                  {availableTables.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {table && (
                <div>
                  <div className="text-xs text-dark-500 dark:text-dark-400 mb-2">Field Mappings</div>
                  <div className="space-y-2">
                    {fieldMappings.map((mapping, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <select
                          value={mapping.column}
                          onChange={(e) => handleFieldChange(index, 'column', e.target.value)}
                          className="flex-1 text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
                        >
                          <option value="">Select column</option>
                          {schemaColumns.map((col) => (
                            <option key={col.column_name} value={col.column_name}>
                              {col.column_name} ({col.data_type})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={mapping.value}
                          onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                          placeholder="Value or {{variable}}"
                          className="flex-1 text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
                        />
                        {fieldMappings.length > 1 && (
                          <button
                            onClick={() => handleRemoveField(index)}
                            className="px-2 py-1 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={handleAddField}
                      className="flex items-center space-x-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Field</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowConfig(false)}
                  className="px-3 py-1.5 text-sm rounded bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-900 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 text-sm rounded bg-primary-600 hover:bg-primary-700 text-white"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-primary-500 dark:bg-primary-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-primary-500 dark:bg-primary-400"
      />
    </NodeWrapper>
  );
};

export default DbInsertNode;

