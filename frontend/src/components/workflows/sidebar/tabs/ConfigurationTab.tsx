import { useState, useEffect, useMemo } from 'react';
import { Settings, Plus, X, FileText, ChevronUp, ChevronDown, Eye, Loader2 } from 'lucide-react';
import useWorkflowStore from '../../../../stores/workflows/useWorkflowStore';
import useDatabaseStore from '../../../../stores/data/useDatabaseStore';
import { useNodeSchema } from '../../../../hooks/useNodeSchema';
import type { Column } from '../../../../stores/data/useDatabaseStore';
import RequestUtils from '../../../../utils/RequestUtils';
import ApiRoutes from '../../../../constants/ApiRoutes';
import { JsonTree } from '../../../../components/ComponentsIndex';
import {
  DbSelectNodeData,
  DbUpdateNodeData,
  DbInsertNodeData,
  DbDeleteNodeData,
  DisplayNodeData,
  ForLoopNodeData,
  ConditionNodeData,
  EmailNodeData,
} from '../../../../types/workflow.types';
import CommunicationsService, { EmailTemplate, EmailProvider } from '../../../../services/CommunicationsService';

interface ConfigurationTabProps {
  nodeId: string;
}

const ConfigurationTab = ({ nodeId }: ConfigurationTabProps) => {
  const nodes = useWorkflowStore((s) => s.nodes);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const { tables, fetchTables, loading: tablesLoading, getTableSchema } = useDatabaseStore();

  const node = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId]);

  // Get schema for database nodes
  const { schema, sourceNode } = useNodeSchema({
    nodeId,
    autoDetectSource: true,
    updateNodeData: false,
  });

  const isConnectedToForLoop = sourceNode?.type === 'forLoop';

  // Get item schema from ForLoop source (similar to DbUpdateNode)
  const itemSchema = useMemo(() => {
    if (sourceNode?.type === 'forLoop') {
      const forLoopData = sourceNode.data as any;
      const loopSourceNodeId = forLoopData?.sourceNodeId;
      
      if (loopSourceNodeId) {
        const loopSourceNode = nodes.find((n) => n.id === loopSourceNodeId);
        if (loopSourceNode?.type === 'dbSelect') {
          const loopSourceData = loopSourceNode.data as any;
          return Array.isArray(loopSourceData?.schema) ? loopSourceData.schema : [];
        }
      }
    }
    return [];
  }, [sourceNode, nodes]);

  // Track if there are unsaved changes - MUST be before early return
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveHandler, setSaveHandler] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (node?.data?.projectId && tables.length === 0) {
      fetchTables((node.data as any).projectId).catch(() => {});
    }
  }, [node, tables.length, fetchTables]);

  if (!node) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-dark-500 dark:text-dark-400">
        Node not found
      </div>
    );
  }

  const nodeData = node.data as any;
  const projectId = nodeData?.projectId;

  // Render editable configuration based on node type
  const renderConfiguration = (setHasUnsavedChanges: (value: boolean) => void, setSaveHandler: (handler: () => void) => void) => {
    switch (node.type) {
      case 'dbSelect':
        return <DbSelectConfig nodeId={nodeId} nodeData={nodeData} projectId={projectId} setHasUnsavedChanges={setHasUnsavedChanges} setSaveHandler={setSaveHandler} />;
      case 'display':
        return <DisplayConfig nodeId={nodeId} nodeData={nodeData} setHasUnsavedChanges={setHasUnsavedChanges} setSaveHandler={setSaveHandler} />;
      case 'forLoop':
        return <ForLoopConfig nodeId={nodeId} nodeData={nodeData} setHasUnsavedChanges={setHasUnsavedChanges} setSaveHandler={setSaveHandler} />;
      case 'dbUpdate':
        return <DbUpdateConfig nodeId={nodeId} nodeData={nodeData} projectId={projectId} isConnectedToForLoop={isConnectedToForLoop} itemSchema={itemSchema} setHasUnsavedChanges={setHasUnsavedChanges} setSaveHandler={setSaveHandler} />;
      case 'dbInsert':
        return <DbInsertConfig nodeId={nodeId} nodeData={nodeData} projectId={projectId} isConnectedToForLoop={isConnectedToForLoop} itemSchema={itemSchema} setHasUnsavedChanges={setHasUnsavedChanges} setSaveHandler={setSaveHandler} />;
      case 'dbDelete':
        return <DbDeleteConfig nodeId={nodeId} nodeData={nodeData} projectId={projectId} isConnectedToForLoop={isConnectedToForLoop} itemSchema={itemSchema} setHasUnsavedChanges={setHasUnsavedChanges} setSaveHandler={setSaveHandler} />;
      case 'condition':
        return <ConditionConfig nodeId={nodeId} nodeData={nodeData} setHasUnsavedChanges={setHasUnsavedChanges} setSaveHandler={setSaveHandler} />;
      case 'email':
        return <EmailConfig nodeId={nodeId} nodeData={nodeData} projectId={projectId} setHasUnsavedChanges={setHasUnsavedChanges} setSaveHandler={setSaveHandler} />;
      default:
        return (
          <div className="text-xs text-dark-500 dark:text-dark-400">
            Configuration not available for this node type.
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto px-4 py-3">
        <div className="space-y-4">
          <div className="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded p-3">
            <div className="flex items-center space-x-2 mb-3">
              <Settings className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <div className="text-xs font-semibold text-dark-900 dark:text-white">Configuration</div>
            </div>
            {renderConfiguration(setHasUnsavedChanges, setSaveHandler)}
          </div>
        </div>
      </div>
      {hasUnsavedChanges && (
        <div className="px-4 py-3 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-900">
          <button
            onClick={() => {
              if (saveHandler) {
                saveHandler();
                setHasUnsavedChanges(false);
                setSaveHandler(null);
              }
            }}
            className="w-full px-4 py-2 text-sm rounded bg-primary-600 hover:bg-primary-700 text-white transition-colors"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};

// DbSelect Configuration
const DbSelectConfig = ({ 
  nodeId, 
  nodeData, 
  projectId,
  setHasUnsavedChanges,
  setSaveHandler,
}: { 
  nodeId: string; 
  nodeData: any; 
  projectId: string;
  setHasUnsavedChanges: (value: boolean) => void;
  setSaveHandler: (handler: () => void) => void;
}) => {
  const { tables, getTableSchema } = useDatabaseStore();
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const setNodeRunStatus = useWorkflowStore((s) => s.setNodeRunStatus);
  const setNodeResult = useWorkflowStore((s) => s.setNodeResult);
  const nodeResults = useWorkflowStore((s) => s.nodeResults);
  const [table, setTable] = useState(nodeData?.table || '');
  const [limit, setLimit] = useState(nodeData?.limit ?? 10);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [schemaColumns, setSchemaColumns] = useState<Column[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const availableTables = useMemo(() => tables.map((t) => t.table_name).sort(), [tables]);

  const handlePreview = async () => {
    if (!table || !projectId) return;
    setIsPreviewing(true);
    setShowPreviewModal(true);
    const token = localStorage.getItem('skaftin-token') || '';
    const url = ApiRoutes.DATABASE.SELECT_DATA(projectId, table);
    try {
      const result = await RequestUtils.post(url, token, { limit });
      const isSuccess = !!(result && result.success !== false);
      
      const rows =
        Array.isArray((result as any)?.data)
          ? (result as any).data
          : Array.isArray((result as any)?.result?.data)
          ? (result as any).result.data
          : Array.isArray((result as any)?.rows)
          ? (result as any).rows
          : [];
      
      setNodeRunStatus(nodeId, isSuccess ? 'success' : 'fail');
      setNodeResult(
        nodeId,
        isSuccess ? 'success' : 'fail',
        isSuccess ? { table, limit, rowsCount: rows.length, rows } : result
      );
    } catch (error) {
      console.error('[DbSelectConfig] preview error', error);
      setNodeRunStatus(nodeId, 'fail');
      setNodeResult(nodeId, 'fail', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleViewSchema = async () => {
    if (!table || !projectId) return;
    setShowSchemaModal(true);
    setSchemaLoading(true);
    try {
      const columns = await getTableSchema(projectId, table);
      setSchemaColumns(columns);
      updateNodeData<DbSelectNodeData>(nodeId, { schema: columns });
    } catch (error) {
      console.error('[DbSelectConfig] failed to fetch schema', error);
      setSchemaColumns([]);
    } finally {
      setSchemaLoading(false);
    }
  };

  const handleSave = () => {
    updateNodeData<DbSelectNodeData>(nodeId, {
      table: table || undefined,
      limit: limit || undefined,
    });
    // Fetch schema when table is saved
    if (table && projectId) {
      getTableSchema(projectId, table)
        .then((columns) => {
          updateNodeData<DbSelectNodeData>(nodeId, { schema: columns });
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    setSaveHandler(() => handleSave);
  }, [table, limit, nodeId, projectId, getTableSchema, updateNodeData, setSaveHandler]);

  useEffect(() => {
    const hasChanges = table !== (nodeData?.table || '') || limit !== (nodeData?.limit ?? 10);
    setHasUnsavedChanges(hasChanges);
  }, [table, limit, nodeData, setHasUnsavedChanges]);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">Table</label>
        <select
          value={table}
          onChange={(e) => setTable(e.target.value)}
          className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
        >
          <option value="">Select a table</option>
          {availableTables.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">Limit</label>
        <input
          type="number"
          value={limit}
          onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
          min="1"
          className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
        />
      </div>
      
      {/* Action Buttons */}
      {table && (
        <div className="flex items-center space-x-2 pt-2 border-t border-dark-200 dark:border-dark-700">
          <button
            onClick={handlePreview}
            disabled={!table || isPreviewing}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs rounded bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {isPreviewing ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Previewing…</span>
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" />
                <span>Preview</span>
              </>
            )}
          </button>
          <button
            onClick={handleViewSchema}
            disabled={schemaLoading}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs rounded bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed text-dark-900 dark:text-white transition-colors"
          >
            {schemaLoading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Loading…</span>
              </>
            ) : (
              <>
                <FileText className="w-3 h-3" />
                <span>View Schema</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Schema Modal */}
      {showSchemaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowSchemaModal(false)} />
          <div className="relative z-50 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-xl w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <div className="text-sm font-semibold text-dark-900 dark:text-white">
                  Schema: {table}
                </div>
              </div>
              <button
                onClick={() => setShowSchemaModal(false)}
                className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4 text-dark-600 dark:text-dark-400" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {schemaLoading ? (
                <div className="text-center py-8">
                  <div className="text-sm text-dark-500 dark:text-dark-400">Loading schema...</div>
                </div>
              ) : schemaColumns.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-sm text-dark-500 dark:text-dark-400">No schema information available</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-dark-50 dark:bg-dark-900">
                      <tr>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-dark-700 dark:text-dark-300 border-b border-dark-200 dark:border-dark-700">
                          Column Name
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-dark-700 dark:text-dark-300 border-b border-dark-200 dark:border-dark-700">
                          Data Type
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-dark-700 dark:text-dark-300 border-b border-dark-200 dark:border-dark-700">
                          Nullable
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-dark-700 dark:text-dark-300 border-b border-dark-200 dark:border-dark-700">
                          Default
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {schemaColumns.map((col, idx) => (
                        <tr
                          key={col.column_name}
                          className={idx % 2 === 0 ? 'bg-white dark:bg-dark-800' : 'bg-dark-50 dark:bg-dark-900'}
                        >
                          <td className="py-2 px-3 text-xs text-dark-900 dark:text-white font-mono">
                            {col.column_name}
                          </td>
                          <td className="py-2 px-3 text-xs text-dark-600 dark:text-dark-400">
                            {col.data_type}
                            {col.character_maximum_length && `(${col.character_maximum_length})`}
                          </td>
                          <td className="py-2 px-3 text-xs">
                            <span
                              className={`px-2 py-0.5 rounded ${
                                col.is_nullable
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}
                            >
                              {col.is_nullable ? 'YES' : 'NO'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-xs text-dark-600 dark:text-dark-400 font-mono">
                            {col.column_default || <span className="text-dark-400 dark:text-dark-500">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-dark-200 dark:border-dark-700 flex justify-end">
              <button
                onClick={() => setShowSchemaModal(false)}
                className="px-4 py-1.5 text-xs rounded bg-primary-600 hover:bg-primary-700 text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Result Modal */}
      {showPreviewModal && nodeResults[nodeId] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowPreviewModal(false)} />
          <div className="relative z-50 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded shadow-xl w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
              <div className="text-sm font-semibold text-dark-900 dark:text-white">
                Preview: {table} (limit {limit})
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4 text-dark-600 dark:text-dark-400" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-dark-50 dark:bg-dark-900">
              <div className="border border-dark-200 dark:border-dark-700 rounded p-3 text-xs">
                <JsonTree value={nodeResults[nodeId].payload} />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-dark-200 dark:border-dark-700 flex justify-end">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-1.5 text-xs rounded bg-primary-600 hover:bg-primary-700 text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Display Configuration
const DisplayConfig = ({ 
  nodeId, 
  nodeData,
  setHasUnsavedChanges,
  setSaveHandler,
}: { 
  nodeId: string; 
  nodeData: any;
  setHasUnsavedChanges: (value: boolean) => void;
  setSaveHandler: (handler: () => void) => void;
}) => {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const [keyPath, setKeyPath] = useState(nodeData?.keyPath || '');
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    arrayAccess: false,
    columns: false,
    loopOverArray: false,
  });

  // Use the schema hook to get schema from connected nodes
  const { schema: schemaColumns, loading: schemaLoading, sourceLabel } = useNodeSchema({
    nodeId,
    sourceNodeId: nodeData?.sourceNodeId,
    autoDetectSource: true,
    updateNodeData: false,
  });

  // Sync keyPath state when nodeData changes
  useEffect(() => {
    setKeyPath(nodeData?.keyPath || '');
  }, [nodeData?.keyPath]);

  const handleSave = () => {
    updateNodeData<DisplayNodeData>(nodeId, { keyPath: keyPath || undefined });
  };

  useEffect(() => {
    setSaveHandler(() => handleSave);
  }, [keyPath, nodeId, updateNodeData, setSaveHandler]);

  useEffect(() => {
    const hasChanges = keyPath !== (nodeData?.keyPath || '');
    setHasUnsavedChanges(hasChanges);
  }, [keyPath, nodeData, setHasUnsavedChanges]);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">Key Path</label>
        <input
          type="text"
          value={keyPath}
          onChange={(e) => setKeyPath(e.target.value)}
          placeholder="e.g. rows.0.name"
          className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1 font-mono"
        />
      </div>
      {schemaLoading && (
        <div className="text-xs text-dark-500 dark:text-dark-400">Loading schema...</div>
      )}
      {!schemaColumns.length && !schemaLoading && (
        <div className="text-xs text-amber-600 dark:text-amber-400">
          ⚠ Schema not available. Connect to a DbSelect node with a table selected.
        </div>
      )}
      {schemaColumns.length > 0 && (
        <div>
          <button
            onClick={() => setShowSchemaModal(true)}
            className="w-full px-3 py-2 text-sm rounded bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center space-x-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>Select from Schema</span>
          </button>
        </div>
      )}

      {/* Schema Selection Modal */}
      {showSchemaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowSchemaModal(false)} />
          <div className="relative z-50 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-xl w-[500px] max-w-[90vw] max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <div className="text-sm font-semibold text-dark-900 dark:text-white">
                  Select Column Path
                </div>
              </div>
              <button
                onClick={() => setShowSchemaModal(false)}
                className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4 text-dark-600 dark:text-dark-400" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {schemaColumns.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-sm text-dark-500 dark:text-dark-400">No schema available</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Array Access Options */}
                  <div className="border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() =>
                        setExpandedSections((prev) => ({
                          ...prev,
                          arrayAccess: !prev.arrayAccess,
                        }))
                      }
                      className="w-full flex items-center justify-between px-3 py-2 bg-dark-50 dark:bg-dark-900 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                    >
                      <div className="text-xs font-semibold text-dark-700 dark:text-dark-300">
                        Array Access
                      </div>
                      {expandedSections.arrayAccess ? (
                        <ChevronUp className="w-4 h-4 text-dark-500 dark:text-dark-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-dark-500 dark:text-dark-400" />
                      )}
                    </button>
                    {expandedSections.arrayAccess && (
                      <div className="p-2 space-y-1">
                        <button
                          onClick={() => {
                            setKeyPath('rows');
                            setShowSchemaModal(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm rounded bg-white dark:bg-dark-800 hover:bg-dark-50 dark:hover:bg-dark-700 border border-dark-200 dark:border-dark-700 transition-colors"
                        >
                          <div className="font-mono text-primary-600 dark:text-primary-400">rows</div>
                          <div className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">All rows array</div>
                        </button>
                        <button
                          onClick={() => {
                            setKeyPath('rows.0');
                            setShowSchemaModal(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm rounded bg-white dark:bg-dark-800 hover:bg-dark-50 dark:hover:bg-dark-700 border border-dark-200 dark:border-dark-700 transition-colors"
                        >
                          <div className="font-mono text-primary-600 dark:text-primary-400">rows.0</div>
                          <div className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">First row object</div>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Column Options */}
                  <div className="border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() =>
                        setExpandedSections((prev) => ({
                          ...prev,
                          columns: !prev.columns,
                        }))
                      }
                      className="w-full flex items-center justify-between px-3 py-2 bg-dark-50 dark:bg-dark-900 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                    >
                      <div className="text-xs font-semibold text-dark-700 dark:text-dark-300">
                        Columns (First Row) <span className="text-dark-500 dark:text-dark-400 font-normal">({schemaColumns.length})</span>
                      </div>
                      {expandedSections.columns ? (
                        <ChevronUp className="w-4 h-4 text-dark-500 dark:text-dark-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-dark-500 dark:text-dark-400" />
                      )}
                    </button>
                    {expandedSections.columns && (
                      <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                        {schemaColumns.map((col) => (
                          <button
                            key={col.column_name}
                            onClick={() => {
                              const path = `rows.0.${col.column_name}`;
                              setKeyPath(path);
                              setShowSchemaModal(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm rounded bg-white dark:bg-dark-800 hover:bg-dark-50 dark:hover:bg-dark-700 border border-dark-200 dark:border-dark-700 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-mono text-primary-600 dark:text-primary-400">
                                rows.0.{col.column_name}
                              </div>
                              <div className="text-xs text-dark-500 dark:text-dark-400">
                                {col.data_type}
                                {col.character_maximum_length && `(${col.character_maximum_length})`}
                              </div>
                            </div>
                            <div className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">
                              {col.column_name} • {col.is_nullable ? 'Nullable' : 'Not Null'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Loop Over Array Options */}
                  <div className="border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() =>
                        setExpandedSections((prev) => ({
                          ...prev,
                          loopOverArray: !prev.loopOverArray,
                        }))
                      }
                      className="w-full flex items-center justify-between px-3 py-2 bg-dark-50 dark:bg-dark-900 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                    >
                      <div className="text-xs font-semibold text-dark-700 dark:text-dark-300">
                        Loop Over Array <span className="text-dark-500 dark:text-dark-400 font-normal">({schemaColumns.length})</span>
                      </div>
                      {expandedSections.loopOverArray ? (
                        <ChevronUp className="w-4 h-4 text-dark-500 dark:text-dark-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-dark-500 dark:text-dark-400" />
                      )}
                    </button>
                    {expandedSections.loopOverArray && (
                      <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                        {schemaColumns.map((col) => (
                          <button
                            key={col.column_name}
                            onClick={() => {
                              const path = `rows.*.${col.column_name}`;
                              setKeyPath(path);
                              setShowSchemaModal(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm rounded bg-white dark:bg-dark-800 hover:bg-dark-50 dark:hover:bg-dark-700 border border-dark-200 dark:border-dark-700 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-mono text-primary-600 dark:text-primary-400">
                                rows.*.{col.column_name}
                              </div>
                              <div className="text-xs text-dark-500 dark:text-dark-400">
                                {col.data_type}
                                {col.character_maximum_length && `(${col.character_maximum_length})`}
                              </div>
                            </div>
                            <div className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">
                              All {col.column_name} values from array • {col.is_nullable ? 'Nullable' : 'Not Null'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ForLoop Configuration
const ForLoopConfig = ({ 
  nodeId, 
  nodeData,
  setHasUnsavedChanges,
  setSaveHandler,
}: { 
  nodeId: string; 
  nodeData: any;
  setHasUnsavedChanges: (value: boolean) => void;
  setSaveHandler: (handler: () => void) => void;
}) => {
  const nodes = useWorkflowStore((s) => s.nodes);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const [sourceNodeId, setSourceNodeId] = useState(nodeData?.sourceNodeId || '');
  const [arrayPath, setArrayPath] = useState(nodeData?.arrayPath || 'rows');
  const [itemVariableName, setItemVariableName] = useState(nodeData?.itemVariableName || 'item');
  const [expandedSections, setExpandedSections] = useState({
    columns: false,
  });

  const availableNodes = useMemo(() => nodes.filter((n) => n.id !== nodeId && n.type !== 'start'), [nodes, nodeId]);

  // Get schema from the source node
  const { schema: schemaColumns, loading: schemaLoading, sourceLabel } = useNodeSchema({
    nodeId,
    sourceNodeId: sourceNodeId || nodeData?.sourceNodeId,
    autoDetectSource: false,
    updateNodeData: false,
  });

  const handleSave = () => {
    updateNodeData<ForLoopNodeData>(nodeId, {
      sourceNodeId: sourceNodeId || undefined,
      arrayPath: arrayPath || undefined,
      itemVariableName: itemVariableName || undefined,
    });
  };

  useEffect(() => {
    setSaveHandler(() => handleSave);
  }, [sourceNodeId, arrayPath, itemVariableName, nodeId, updateNodeData, setSaveHandler]);

  useEffect(() => {
    const hasChanges = 
      sourceNodeId !== (nodeData?.sourceNodeId || '') ||
      arrayPath !== (nodeData?.arrayPath || 'rows') ||
      itemVariableName !== (nodeData?.itemVariableName || 'item');
    setHasUnsavedChanges(hasChanges);
  }, [sourceNodeId, arrayPath, itemVariableName, nodeData, setHasUnsavedChanges]);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">Source Node</label>
        <select
          value={sourceNodeId}
          onChange={(e) => setSourceNodeId(e.target.value)}
          className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
        >
          <option value="">Select source node</option>
          {availableNodes.map((n) => (
            <option key={n.id} value={n.id}>
              {(n.data as any)?.label || n.id} ({n.type})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">Array Path</label>
        <input
          type="text"
          value={arrayPath}
          onChange={(e) => setArrayPath(e.target.value)}
          placeholder="rows"
          className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1 font-mono"
        />
        {schemaColumns.length > 0 && (
          <div className="mt-2 border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden">
            <button
              onClick={() =>
                setExpandedSections((prev) => ({
                  ...prev,
                  columns: !prev.columns,
                }))
              }
              className="w-full flex items-center justify-between px-3 py-2 bg-dark-50 dark:bg-dark-900 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
            >
              <div className="text-xs font-semibold text-dark-700 dark:text-dark-300">
                Select from Schema <span className="text-dark-500 dark:text-dark-400 font-normal">({schemaColumns.length} columns)</span>
              </div>
              {expandedSections.columns ? (
                <ChevronUp className="w-4 h-4 text-dark-500 dark:text-dark-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-dark-500 dark:text-dark-400" />
              )}
            </button>
            {expandedSections.columns && (
              <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                {/* Array path options */}
                <button
                  onClick={() => {
                    setArrayPath('rows');
                    setExpandedSections((prev) => ({ ...prev, columns: false }));
                  }}
                  className="w-full text-left px-3 py-2 text-sm rounded bg-white dark:bg-dark-800 hover:bg-dark-50 dark:hover:bg-dark-700 border border-dark-200 dark:border-dark-700 transition-colors"
                >
                  <div className="font-mono text-primary-600 dark:text-primary-400">rows</div>
                  <div className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">All rows array (most common)</div>
                </button>
                {/* Column options */}
                {schemaColumns.map((col) => (
                  <button
                    key={col.column_name}
                    onClick={() => {
                      setArrayPath(`rows.0.${col.column_name}`);
                      setExpandedSections((prev) => ({ ...prev, columns: false }));
                    }}
                    className="w-full text-left px-3 py-2 text-sm rounded bg-white dark:bg-dark-800 hover:bg-dark-50 dark:hover:bg-dark-700 border border-dark-200 dark:border-dark-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-primary-600 dark:text-primary-400">
                        rows.0.{col.column_name}
                      </div>
                      <div className="text-xs text-dark-500 dark:text-dark-400">
                        {col.data_type}
                        {col.character_maximum_length && `(${col.character_maximum_length})`}
                      </div>
                    </div>
                    <div className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">
                      {col.column_name} • {col.is_nullable ? 'Nullable' : 'Not Null'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div>
        <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">Item Variable Name</label>
        <input
          type="text"
          value={itemVariableName}
          onChange={(e) => setItemVariableName(e.target.value)}
          placeholder="item"
          className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1 font-mono"
        />
      </div>
    </div>
  );
};

// DbUpdate Configuration
const DbUpdateConfig = ({
  nodeId,
  nodeData,
  projectId,
  isConnectedToForLoop,
  itemSchema,
  setHasUnsavedChanges,
  setSaveHandler,
}: {
  nodeId: string;
  nodeData: any;
  projectId: string;
  isConnectedToForLoop: boolean;
  itemSchema: Column[];
  setHasUnsavedChanges: (value: boolean) => void;
  setSaveHandler: (handler: () => void) => void;
}) => {
  const { tables, getTableSchema } = useDatabaseStore();
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const [table, setTable] = useState(nodeData?.table || '');
  const [updates, setUpdates] = useState(nodeData?.updates || [{ field: '', value: '' }]);
  const [whereConditions, setWhereConditions] = useState(nodeData?.where || [{ field: '', operator: '=', value: '' }]);
  const [schemaColumns, setSchemaColumns] = useState<Column[]>([]);

  const availableTables = useMemo(() => tables.map((t) => t.table_name).sort(), [tables]);
  const operators = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'NOT IN'];

  const handleSave = () => {
    updateNodeData<DbUpdateNodeData>(nodeId, {
      table: table || undefined,
      updates: updates.filter((u) => u.field && u.value),
      where: whereConditions.filter((c) => c.field && c.value),
    });
    // Fetch schema when table is saved
    if (table && projectId) {
      getTableSchema(projectId, table)
        .then((columns) => {
          updateNodeData<DbUpdateNodeData>(nodeId, { schema: columns });
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    setSaveHandler(() => handleSave);
  }, [table, updates, whereConditions, nodeId, projectId, getTableSchema, updateNodeData, setSaveHandler]);

  useEffect(() => {
    const hasChanges = 
      table !== (nodeData?.table || '') ||
      JSON.stringify(updates) !== JSON.stringify(nodeData?.updates || [{ field: '', value: '' }]) ||
      JSON.stringify(whereConditions) !== JSON.stringify(nodeData?.where || [{ field: '', operator: '=', value: '' }]);
    setHasUnsavedChanges(hasChanges);
  }, [table, updates, whereConditions, nodeData, setHasUnsavedChanges]);

  // Load schema when table changes (for display only, not saved until save button)
  useEffect(() => {
    if (table && projectId) {
      getTableSchema(projectId, table)
        .then((columns) => {
          setSchemaColumns(columns);
        })
        .catch(() => {});
    } else {
      setSchemaColumns([]);
    }
  }, [table, projectId, getTableSchema]);

  const handleAddUpdate = () => {
    setUpdates([...updates, { field: '', value: '' }]);
  };

  const handleRemoveUpdate = (index: number) => {
    setUpdates(updates.filter((_, i) => i !== index));
  };

  const handleUpdateChange = (index: number, field: 'field' | 'value', value: string) => {
    const updated = [...updates];
    updated[index] = { ...updated[index], [field]: value };
    setUpdates(updated);
  };

  const handleAddCondition = () => {
    setWhereConditions([...whereConditions, { field: '', operator: '=', value: '' }]);
  };

  const handleRemoveCondition = (index: number) => {
    setWhereConditions(whereConditions.filter((_, i) => i !== index));
  };

  const handleConditionChange = (index: number, field: 'field' | 'operator' | 'value', value: string) => {
    const updated = [...whereConditions];
    updated[index] = { ...updated[index], [field]: value };
    setWhereConditions(updated);
  };

  return (
    <div className="space-y-3">
      {isConnectedToForLoop && itemSchema.length > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded p-2 mb-3">
          <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">🔄 Connected to ForLoop</div>
          <div className="text-xs text-purple-600 dark:text-purple-400">
            Use <span className="font-mono">{"{{item.fieldName}}"}</span> in values to reference loop items.
          </div>
        </div>
      )}
      <div>
        <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">Table</label>
        <select
          value={table}
          onChange={(e) => setTable(e.target.value)}
          className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
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
        <>
          <div>
            <label className="text-xs text-dark-500 dark:text-dark-400 mb-2 block">Update Fields</label>
            <div className="space-y-2">
              {updates.map((update: any, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <select
                    value={update.field}
                    onChange={(e) => handleUpdateChange(index, 'field', e.target.value)}
                    className="flex-1 text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
                  >
                    <option value="">Select column</option>
                    {schemaColumns.map((col) => (
                      <option key={col.column_name} value={col.column_name}>
                        {col.column_name} ({col.data_type})
                      </option>
                    ))}
                  </select>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={update.value}
                      onChange={(e) => handleUpdateChange(index, 'value', e.target.value)}
                      placeholder={isConnectedToForLoop ? "Value or {{item.fieldName}}" : "Value"}
                      className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1 pr-28"
                    />
                    {isConnectedToForLoop && itemSchema.length > 0 && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleUpdateChange(index, 'value', `{{item.${e.target.value}}}`);
                            e.target.value = '';
                          }
                        }}
                        className="absolute right-1 top-1 text-xs font-medium bg-purple-500 dark:bg-purple-600 hover:bg-purple-600 dark:hover:bg-purple-500 text-white border border-purple-600 dark:border-purple-500 rounded px-2 py-1 shadow-sm cursor-pointer transition-colors"
                        title="Insert item field"
                      >
                        <option value="" className="bg-white dark:bg-dark-800 text-dark-900 dark:text-white">+ Item field</option>
                        {itemSchema.map((col) => (
                          <option key={col.column_name} value={col.column_name} className="bg-white dark:bg-dark-800 text-dark-900 dark:text-white">
                            {col.column_name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {updates.length > 1 && (
                    <button
                      onClick={() => handleRemoveUpdate(index)}
                      className="px-2 py-1 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={handleAddUpdate}
                className="flex items-center space-x-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              >
                <Plus className="w-3 h-3" />
                <span>Add Field</span>
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-dark-500 dark:text-dark-400 mb-2 block">WHERE Conditions</label>
            <div className="space-y-3">
              {whereConditions.map((condition: any, index: number) => (
                <div key={index} className="space-y-2 border border-dark-200 dark:border-dark-700 rounded p-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-dark-700 dark:text-dark-300">Condition {index + 1}</div>
                    {whereConditions.length > 1 && (
                      <button
                        onClick={() => handleRemoveCondition(index)}
                        className="px-2 py-1 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <select
                    value={condition.field}
                    onChange={(e) => handleConditionChange(index, 'field', e.target.value)}
                    className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
                  >
                    <option value="">Select column</option>
                    {schemaColumns.map((col) => (
                      <option key={col.column_name} value={col.column_name}>
                        {col.column_name} ({col.data_type})
                      </option>
                    ))}
                  </select>
                  <select
                    value={condition.operator}
                    onChange={(e) => handleConditionChange(index, 'operator', e.target.value)}
                    className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
                  >
                    {operators.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  <div className="relative">
                    <input
                      type="text"
                      value={condition.value}
                      onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
                      placeholder={isConnectedToForLoop ? "Value or {{item.fieldName}}" : "Value"}
                      className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1 pr-28"
                    />
                    {isConnectedToForLoop && itemSchema.length > 0 && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleConditionChange(index, 'value', `{{item.${e.target.value}}}`);
                            e.target.value = '';
                          }
                        }}
                        className="absolute right-1 top-1 text-xs font-medium bg-purple-500 dark:bg-purple-600 hover:bg-purple-600 dark:hover:bg-purple-500 text-white border border-purple-600 dark:border-purple-500 rounded px-2 py-1 shadow-sm cursor-pointer transition-colors"
                        title="Insert item field"
                      >
                        <option value="" className="bg-white dark:bg-dark-800 text-dark-900 dark:text-white">+ Item field</option>
                        {itemSchema.map((col) => (
                          <option key={col.column_name} value={col.column_name} className="bg-white dark:bg-dark-800 text-dark-900 dark:text-white">
                            {col.column_name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={handleAddCondition}
                className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              >
                + Add Condition
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// DbInsert Configuration
const DbInsertConfig = ({ 
  nodeId, 
  nodeData, 
  projectId,
  isConnectedToForLoop,
  itemSchema,
  setHasUnsavedChanges,
  setSaveHandler,
}: { 
  nodeId: string; 
  nodeData: any; 
  projectId: string;
  isConnectedToForLoop: boolean;
  itemSchema: Column[];
  setHasUnsavedChanges: (value: boolean) => void;
  setSaveHandler: (handler: () => void) => void;
}) => {
  const { tables, getTableSchema } = useDatabaseStore();
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const [table, setTable] = useState(nodeData?.table || '');
  const [fieldMappings, setFieldMappings] = useState(nodeData?.fieldMappings || [{ column: '', value: '' }]);
  const [schemaColumns, setSchemaColumns] = useState<Column[]>([]);

  const availableTables = useMemo(() => tables.map((t) => t.table_name).sort(), [tables]);

  const handleSave = () => {
    updateNodeData<DbInsertNodeData>(nodeId, {
      table: table || undefined,
      fieldMappings: fieldMappings.filter((f) => f.column && f.value),
    });
    // Fetch schema when table is saved
    if (table && projectId) {
      getTableSchema(projectId, table)
        .then((columns) => {
          updateNodeData<DbInsertNodeData>(nodeId, { schema: columns });
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    setSaveHandler(() => handleSave);
  }, [table, fieldMappings, nodeId, projectId, getTableSchema, updateNodeData, setSaveHandler]);

  useEffect(() => {
    const hasChanges = 
      table !== (nodeData?.table || '') ||
      JSON.stringify(fieldMappings) !== JSON.stringify(nodeData?.fieldMappings || [{ column: '', value: '' }]);
    setHasUnsavedChanges(hasChanges);
  }, [table, fieldMappings, nodeData, setHasUnsavedChanges]);

  // Load schema when table changes (for display only, not saved until save button)
  useEffect(() => {
    if (table && projectId) {
      getTableSchema(projectId, table)
        .then((columns) => {
          setSchemaColumns(columns);
        })
        .catch(() => {});
    } else {
      setSchemaColumns([]);
    }
  }, [table, projectId, getTableSchema]);

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

  return (
    <div className="space-y-3">
      {isConnectedToForLoop && itemSchema.length > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded p-2 mb-3">
          <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">🔄 Connected to ForLoop</div>
          <div className="text-xs text-purple-600 dark:text-purple-400">
            Use <span className="font-mono">{"{{item.fieldName}}"}</span> in values to reference loop items.
          </div>
        </div>
      )}
      <div>
        <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">Table</label>
        <select
          value={table}
          onChange={(e) => setTable(e.target.value)}
          className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
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
          <label className="text-xs text-dark-500 dark:text-dark-400 mb-2 block">Field Mappings</label>
          <div className="border border-dark-200 dark:border-dark-700 rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed ">
                <colgroup>
                  <col className="w-[40%]" />
                  <col className="w-[50%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead className="bg-dark-50 dark:bg-dark-900 ">
                  <tr>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-dark-700 dark:text-dark-300 border-b border-dark-200 dark:border-dark-700">
                      Column
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-dark-700 dark:text-dark-300 border-b border-dark-200 dark:border-dark-700">
                      Value
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-dark-700 dark:text-dark-300 border-b border-dark-200 dark:border-dark-700">
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fieldMappings.map((mapping: any, index: number) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-dark-800' : 'bg-dark-50 dark:bg-dark-900'}>
                      <td className="py-2 px-3 align-top">
                        <select
                          value={mapping.column}
                          onChange={(e) => handleFieldChange(index, 'column', e.target.value)}
                          className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1 min-w-0"
                        >
                          <option value="">Select column</option>
                          {schemaColumns.map((col) => (
                            <option key={col.column_name} value={col.column_name}>
                              {col.column_name} ({col.data_type})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3 align-top ">
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            value={mapping.value}
                            onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                            placeholder={isConnectedToForLoop ? "Value or {{item.fieldName}}" : "Value"}
                            className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1 min-w-0"
                          />
                          {isConnectedToForLoop && itemSchema.length > 0 && (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleFieldChange(index, 'value', `{{item.${e.target.value}}}`);
                                  e.target.value = '';
                                }
                              }}
                              className="w-fit text-xs font-medium bg-purple-500 dark:bg-purple-600 hover:bg-purple-600 dark:hover:bg-purple-500 text-white border border-purple-600 dark:border-purple-500 rounded px-2 py-1 shadow-sm cursor-pointer transition-colors"
                              title="Insert item field"
                            >
                              <option value="" className="bg-white dark:bg-dark-800 text-dark-900 dark:text-white">+ Item field</option>
                              {itemSchema.map((col) => (
                                <option key={col.column_name} value={col.column_name} className="bg-white dark:bg-dark-800 text-dark-900 dark:text-white">
                                  {col.column_name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 align-top">
                        {fieldMappings.length > 1 && (
                          <button
                            onClick={() => handleRemoveField(index)}
                            className="px-2 py-1 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button
            onClick={handleAddField}
            className="mt-2 flex items-center space-x-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            <Plus className="w-3 h-3" />
            <span>Add Field</span>
          </button>
        </div>
      )}
    </div>
  );
};

// DbDelete Configuration
const DbDeleteConfig = ({ 
  nodeId, 
  nodeData, 
  projectId,
  isConnectedToForLoop,
  itemSchema,
  setHasUnsavedChanges,
  setSaveHandler,
}: { 
  nodeId: string; 
  nodeData: any; 
  projectId: string;
  isConnectedToForLoop: boolean;
  itemSchema: Column[];
  setHasUnsavedChanges: (value: boolean) => void;
  setSaveHandler: (handler: () => void) => void;
}) => {
  const { tables, getTableSchema } = useDatabaseStore();
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const [table, setTable] = useState(nodeData?.table || '');
  const [whereConditions, setWhereConditions] = useState(nodeData?.where || [{ field: '', operator: '=', value: '' }]);
  const [schemaColumns, setSchemaColumns] = useState<Column[]>([]);

  const availableTables = useMemo(() => tables.map((t) => t.table_name).sort(), [tables]);
  const operators = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'NOT IN'];

  const handleSave = () => {
    updateNodeData<DbDeleteNodeData>(nodeId, {
      table: table || undefined,
      where: whereConditions.filter((c) => c.field && c.value),
    });
  };

  useEffect(() => {
    setSaveHandler(() => handleSave);
  }, [table, whereConditions, nodeId, updateNodeData, setSaveHandler]);

  useEffect(() => {
    const hasChanges = 
      table !== (nodeData?.table || '') ||
      JSON.stringify(whereConditions) !== JSON.stringify(nodeData?.where || [{ field: '', operator: '=', value: '' }]);
    setHasUnsavedChanges(hasChanges);
  }, [table, whereConditions, nodeData, setHasUnsavedChanges]);

  // Load schema when table changes (for display only, not saved until save button)
  useEffect(() => {
    if (table && projectId) {
      getTableSchema(projectId, table)
        .then((columns) => {
          setSchemaColumns(columns);
        })
        .catch(() => {});
    } else {
      setSchemaColumns([]);
    }
  }, [table, projectId, getTableSchema]);

  const handleAddCondition = () => {
    setWhereConditions([...whereConditions, { field: '', operator: '=', value: '' }]);
  };

  const handleRemoveCondition = (index: number) => {
    setWhereConditions(whereConditions.filter((_, i) => i !== index));
  };

  const handleConditionChange = (index: number, field: 'field' | 'operator' | 'value', value: string) => {
    const updated = [...whereConditions];
    updated[index] = { ...updated[index], [field]: value };
    setWhereConditions(updated);
  };

  return (
    <div className="space-y-3">
      {isConnectedToForLoop && itemSchema.length > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded p-2 mb-3">
          <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">🔄 Connected to ForLoop</div>
          <div className="text-xs text-purple-600 dark:text-purple-400">
            Use <span className="font-mono">{"{{item.fieldName}}"}</span> in values to reference loop items.
          </div>
        </div>
      )}
      <div>
        <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">Table</label>
        <select
          value={table}
          onChange={(e) => setTable(e.target.value)}
          className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
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
          <label className="text-xs text-dark-500 dark:text-dark-400 mb-2 block">WHERE Conditions</label>
          <div className="space-y-3">
            {whereConditions.map((condition: any, index: number) => (
              <div key={index} className="space-y-2 border border-dark-200 dark:border-dark-700 rounded p-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-dark-700 dark:text-dark-300">Condition {index + 1}</div>
                  {whereConditions.length > 1 && (
                    <button
                      onClick={() => handleRemoveCondition(index)}
                      className="px-2 py-1 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <select
                  value={condition.field}
                  onChange={(e) => handleConditionChange(index, 'field', e.target.value)}
                  className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
                >
                  <option value="">Select column</option>
                  {schemaColumns.map((col) => (
                    <option key={col.column_name} value={col.column_name}>
                      {col.column_name} ({col.data_type})
                    </option>
                  ))}
                </select>
                <select
                  value={condition.operator}
                  onChange={(e) => handleConditionChange(index, 'operator', e.target.value)}
                  className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
                >
                  {operators.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <input
                    type="text"
                    value={condition.value}
                    onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
                    placeholder={isConnectedToForLoop ? "Value or {{item.fieldName}}" : "Value"}
                    className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1 pr-28"
                  />
                  {isConnectedToForLoop && itemSchema.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleConditionChange(index, 'value', `{{item.${e.target.value}}}`);
                          e.target.value = '';
                        }
                      }}
                      className="absolute right-1 top-1 text-xs font-medium bg-purple-500 dark:bg-purple-600 hover:bg-purple-600 dark:hover:bg-purple-500 text-white border border-purple-600 dark:border-purple-500 rounded px-2 py-1 shadow-sm cursor-pointer transition-colors"
                      title="Insert item field"
                    >
                      <option value="" className="bg-white dark:bg-dark-800 text-dark-900 dark:text-white">+ Item field</option>
                      {itemSchema.map((col) => (
                        <option key={col.column_name} value={col.column_name} className="bg-white dark:bg-dark-800 text-dark-900 dark:text-white">
                          {col.column_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={handleAddCondition}
              className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              + Add Condition
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Condition Configuration
const ConditionConfig = ({ 
  nodeId, 
  nodeData,
  setHasUnsavedChanges,
  setSaveHandler,
}: { 
  nodeId: string; 
  nodeData: any;
  setHasUnsavedChanges: (value: boolean) => void;
  setSaveHandler: (handler: () => void) => void;
}) => {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const [condition, setCondition] = useState(nodeData?.condition || '');
  const [trueBranchLabel, setTrueBranchLabel] = useState(nodeData?.trueBranchLabel || '');
  const [falseBranchLabel, setFalseBranchLabel] = useState(nodeData?.falseBranchLabel || '');

  const handleSave = () => {
    updateNodeData<ConditionNodeData>(nodeId, {
      condition: condition || undefined,
      trueBranchLabel: trueBranchLabel || undefined,
      falseBranchLabel: falseBranchLabel || undefined,
    });
  };

  useEffect(() => {
    setSaveHandler(() => handleSave);
  }, [condition, trueBranchLabel, falseBranchLabel, nodeId, updateNodeData, setSaveHandler]);

  useEffect(() => {
    const hasChanges = 
      condition !== (nodeData?.condition || '') ||
      trueBranchLabel !== (nodeData?.trueBranchLabel || '') ||
      falseBranchLabel !== (nodeData?.falseBranchLabel || '');
    setHasUnsavedChanges(hasChanges);
  }, [condition, trueBranchLabel, falseBranchLabel, nodeData, setHasUnsavedChanges]);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">Condition</label>
        <input
          type="text"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder="e.g. {{nodeId.field}} > 10"
          className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1 font-mono"
        />
      </div>
      <div>
        <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">True Branch Label</label>
        <input
          type="text"
          value={trueBranchLabel}
          onChange={(e) => setTrueBranchLabel(e.target.value)}
          placeholder="True"
          className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
        />
      </div>
      <div>
        <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">False Branch Label</label>
        <input
          type="text"
          value={falseBranchLabel}
          onChange={(e) => setFalseBranchLabel(e.target.value)}
          placeholder="False"
          className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
        />
      </div>
    </div>
  );
};

// Email Configuration
const EmailConfig = ({ 
  nodeId, 
  nodeData, 
  projectId,
  setHasUnsavedChanges,
  setSaveHandler,
}: { 
  nodeId: string; 
  nodeData: any; 
  projectId: string;
  setHasUnsavedChanges: (value: boolean) => void;
  setSaveHandler: (handler: () => void) => void;
}) => {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const [templateId, setTemplateId] = useState<number | undefined>(nodeData?.templateId);
  const [templateName, setTemplateName] = useState<string | undefined>(nodeData?.templateName);
  const [recipientEmail, setRecipientEmail] = useState<string>(nodeData?.recipientEmail || '');
  const [providerId, setProviderId] = useState<number | undefined>(nodeData?.providerId);
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>(nodeData?.variableMappings || {});
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [providers, setProviders] = useState<EmailProvider[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);

  // Load templates and providers
  useEffect(() => {
    if (projectId) {
      console.log('[EmailConfig] Loading templates and providers for project:', projectId);
      setLoadingTemplates(true);
      CommunicationsService.listEmailTemplates(projectId)
        .then((data) => {
          console.log('[EmailConfig] Loaded templates:', data);
          data.forEach((template) => {
            console.log(`[EmailConfig] Template "${template.name}" (ID: ${template.id}):`, {
              variables: template.variables,
              variablesType: typeof template.variables,
              variablesIsArray: Array.isArray(template.variables),
            });
          });
          setTemplates(data);
          setLoadingTemplates(false);
        })
        .catch((error) => {
          console.error('[EmailConfig] Error loading templates:', error);
          setLoadingTemplates(false);
        });

      setLoadingProviders(true);
      CommunicationsService.listEmailProviders(projectId)
        .then((data) => {
          console.log('[EmailConfig] Loaded providers:', data);
          setProviders(data.filter((p) => p.is_active));
          setLoadingProviders(false);
        })
        .catch((error) => {
          console.error('[EmailConfig] Error loading providers:', error);
          setLoadingProviders(false);
        });
    }
  }, [projectId]);

  // Sync state when nodeData changes
  useEffect(() => {
    setTemplateId(nodeData?.templateId);
    setTemplateName(nodeData?.templateName);
    setRecipientEmail(nodeData?.recipientEmail || '');
    setProviderId(nodeData?.providerId);
    setVariableMappings(nodeData?.variableMappings || {});
  }, [nodeData]);

  // Initialize variable mappings when templates are loaded and a template is selected
  useEffect(() => {
    if (templateId && templates.length > 0) {
      const selectedTemplate = templates.find((t) => t.id === templateId);
      if (selectedTemplate) {
        let templateVariables: string[] = [];
        if (selectedTemplate.variables) {
          if (Array.isArray(selectedTemplate.variables)) {
            templateVariables = selectedTemplate.variables;
          } else if (typeof selectedTemplate.variables === 'string') {
            try {
              const parsed = JSON.parse(selectedTemplate.variables);
              templateVariables = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
              templateVariables = [];
            }
          }
        }
        
        // Initialize mappings for variables that don't have values yet
        const currentMappings = variableMappings || {};
        const newMappings: Record<string, string> = { ...currentMappings };
        let hasNewMappings = false;
        
        templateVariables.forEach((varName) => {
          if (!(varName in newMappings)) {
            newMappings[varName] = '';
            hasNewMappings = true;
          }
        });
        
        // Remove mappings for variables that are no longer in the template
        Object.keys(newMappings).forEach((key) => {
          if (!templateVariables.includes(key)) {
            delete newMappings[key];
            hasNewMappings = true;
          }
        });
        
        if (hasNewMappings) {
          console.log('[EmailConfig] Initializing variable mappings:', newMappings);
          setVariableMappings(newMappings);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, templateId]);

  const handleSave = () => {
    updateNodeData<EmailNodeData>(nodeId, {
      templateId,
      templateName,
      recipientEmail: recipientEmail || undefined,
      providerId,
      variableMappings: Object.keys(variableMappings).length > 0 ? variableMappings : undefined,
    });
  };

  useEffect(() => {
    setSaveHandler(() => handleSave);
  }, [templateId, templateName, recipientEmail, providerId, variableMappings, nodeId, updateNodeData, setSaveHandler]);

  useEffect(() => {
    const hasChanges =
      templateId !== (nodeData?.templateId || undefined) ||
      templateName !== (nodeData?.templateName || undefined) ||
      recipientEmail !== (nodeData?.recipientEmail || '') ||
      providerId !== (nodeData?.providerId || undefined) ||
      JSON.stringify(variableMappings) !== JSON.stringify(nodeData?.variableMappings || {});
    setHasUnsavedChanges(hasChanges);
  }, [templateId, templateName, recipientEmail, providerId, variableMappings, nodeData, setHasUnsavedChanges]);

  // Get schema from connected source node for variable suggestions
  const { schema: schemaColumns, sourceLabel } = useNodeSchema({
    nodeId,
    autoDetectSource: true,
    updateNodeData: false,
  });

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">
          Email Provider <span className="text-red-500">*</span>
        </label>
        {loadingProviders ? (
          <div className="text-xs text-dark-500 dark:text-dark-400">Loading providers...</div>
        ) : (
          <select
            value={providerId || ''}
            onChange={(e) => {
              const selectedId = e.target.value ? parseInt(e.target.value) : undefined;
              setProviderId(selectedId);
            }}
            className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
          >
            <option value="">Select provider...</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        )}
        {!loadingProviders && providers.length === 0 && (
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            ⚠ No active email providers found. Create one in Communications settings.
          </div>
        )}
      </div>

      <div>
        <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">
          Email Template <span className="text-red-500">*</span>
        </label>
        {loadingTemplates ? (
          <div className="text-xs text-dark-500 dark:text-dark-400">Loading templates...</div>
        ) : (
          <select
            value={templateId || ''}
            onChange={(e) => {
              const selectedId = e.target.value ? parseInt(e.target.value) : undefined;
              const selectedTemplate = templates.find((t) => t.id === selectedId);
              setTemplateId(selectedId);
              setTemplateName(selectedTemplate?.name);
              
              // Initialize variable mappings for new template
              if (selectedTemplate) {
                let templateVariables: string[] = [];
                if (selectedTemplate.variables) {
                  if (Array.isArray(selectedTemplate.variables)) {
                    templateVariables = selectedTemplate.variables;
                  } else if (typeof selectedTemplate.variables === 'string') {
                    try {
                      const parsed = JSON.parse(selectedTemplate.variables);
                      templateVariables = Array.isArray(parsed) ? parsed : [];
                    } catch (e) {
                      templateVariables = [];
                    }
                  }
                }
                
                // Initialize empty mappings for new variables, keep existing ones
                const newMappings: Record<string, string> = { ...variableMappings };
                templateVariables.forEach((varName) => {
                  if (!(varName in newMappings)) {
                    newMappings[varName] = '';
                  }
                });
                // Remove mappings for variables that are no longer in the template
                Object.keys(newMappings).forEach((key) => {
                  if (!templateVariables.includes(key)) {
                    delete newMappings[key];
                  }
                });
                setVariableMappings(newMappings);
              } else {
                setVariableMappings({});
              }
            }}
            className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
          >
            <option value="">Select template...</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        )}
        {!loadingTemplates && templates.length === 0 && (
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            ⚠ No email templates found. Create one in Communications settings.
          </div>
        )}
        {templateId && (() => {
          const selectedTemplate = templates.find((t) => t.id === templateId);
          console.log('[EmailConfig] Selected template:', {
            templateId,
            selectedTemplate,
            templateName: selectedTemplate?.name,
            rawVariables: selectedTemplate?.variables,
            variablesType: typeof selectedTemplate?.variables,
          });
          
          // Handle variables - could be array or JSON string
          let templateVariables: string[] = [];
          if (selectedTemplate?.variables) {
            if (Array.isArray(selectedTemplate.variables)) {
              templateVariables = selectedTemplate.variables;
            } else if (typeof selectedTemplate.variables === 'string') {
              try {
                const parsed = JSON.parse(selectedTemplate.variables);
                templateVariables = Array.isArray(parsed) ? parsed : [];
              } catch (e) {
                console.warn('[EmailConfig] Failed to parse variables as JSON:', e);
                templateVariables = [];
              }
            }
          }
          
          console.log('[EmailConfig] Processed variables:', templateVariables);
          
          if (templateVariables.length > 0) {
            return (
              <div className="mt-2 space-y-2">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-2 py-2">
                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">
                    Required Variables:
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {templateVariables.map((variable) => (
                      <span
                        key={variable}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                      >
                        {'{{'}{variable}{'}}'}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-300">
                    Map these variables to values or workflow variables below.
                  </div>
                </div>
                
                {/* Variable Input Fields */}
                <div className="space-y-2">
                  {templateVariables.map((variable) => (
                    <div key={variable}>
                      <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">
                        <span className="font-mono">{'{{'}{variable}{'}}'}</span>
                      </label>
                      <input
                        type="text"
                        value={variableMappings[variable] || ''}
                        onChange={(e) => {
                          setVariableMappings({
                            ...variableMappings,
                            [variable]: e.target.value,
                          });
                        }}
                        placeholder={`Value or {{nodeId.field}} for ${variable}`}
                        className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1 font-mono"
                      />
                      {schemaColumns.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {schemaColumns.slice(0, 3).map((col) => (
                            <button
                              key={col.column_name}
                              type="button"
                              onClick={() => {
                                const variableValue = `{{${sourceLabel}.rows.0.${col.column_name}}}`;
                                setVariableMappings({
                                  ...variableMappings,
                                  [variable]: variableValue,
                                });
                              }}
                              className="text-xs px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                            >
                              {col.column_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          } else {
            console.log('[EmailConfig] No variables found for template');
          }
          return null;
        })()}
      </div>

      <div>
        <label className="text-xs text-dark-500 dark:text-dark-400 mb-1 block">
          Recipient Email <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="user@example.com or {{nodeId.field}}"
          className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1 font-mono"
        />
        <div className="text-xs text-dark-500 dark:text-dark-400 mt-1">
          Enter email address or use variable like <code className="bg-dark-100 dark:bg-dark-800 px-1 rounded">{'{{nodeId.field}}'}</code>
        </div>
        {schemaColumns.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-dark-500 dark:text-dark-400 mb-1">
              Available from {sourceLabel}:
            </div>
            <div className="flex flex-wrap gap-1">
              {schemaColumns.slice(0, 5).map((col) => (
                <button
                  key={col.column_name}
                  onClick={() => {
                    const variable = `{{${sourceLabel}.rows.0.${col.column_name}}}`;
                    setRecipientEmail(variable);
                  }}
                  className="text-xs px-2 py-1 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                >
                  {col.column_name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigurationTab;
