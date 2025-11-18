import { Handle, Position } from 'reactflow';
import { Database, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import useDatabaseStore from '../../../stores/data/useDatabaseStore';
import RequestUtils from '../../../utils/RequestUtils';
import ApiRoutes from '../../../constants/ApiRoutes';
import { DbSelectNodeData } from '../../../types/workflow.types';
import useWorkflowStore from '../../../stores/workflows/useWorkflowStore';
import { JsonTree, NodeWrapper, NodeActions } from '../../ComponentsIndex';
import { useNodeConnection } from '../../../hooks/useNodeConnection';
import { useNodeOperations } from '../../../hooks/useNodeOperations';

interface DbSelectNodeProps {
  id: string;
  data: DbSelectNodeData;
  selected?: boolean;
}

const DbSelectNode = ({ id, data, selected }: DbSelectNodeProps) => {
  const { tables, fetchTables, loading } = useDatabaseStore();
  const [table] = useState<string | undefined>(data.table);
  const [limit] = useState<number>(data.limit ?? 10);
  const getTableSchema = useDatabaseStore((s) => s.getTableSchema);
  const setNodeRunStatus = useWorkflowStore((s) => s.setNodeRunStatus);
  const setNodeResult = useWorkflowStore((s) => s.setNodeResult);
  const nodeResults = useWorkflowStore((s) => s.nodeResults);
  const runStatuses = useWorkflowStore((s) => s.runStatuses);
  const [showResultModal, setShowResultModal] = useState(false);
  const lastExecutedStatusRef = useRef<string | undefined>(undefined);
  const { isConnected } = useNodeConnection(id);
  const { handleDelete, handleUpdateData } = useNodeOperations(id);

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

  // Execute the database query - for workflow run only
  const executeQuery = useCallback(async () => {
    if (!table || !data.projectId) return;
    const token = localStorage.getItem('skaftin-token') || '';
    const url = ApiRoutes.DATABASE.SELECT_DATA(data.projectId, table);
    try {
      const result = await RequestUtils.post(url, token, { limit });
      const isSuccess = !!(result && result.success !== false);
      
      // Extract rows array from various response shapes
      const rows =
        Array.isArray((result as any)?.data)
          ? (result as any).data
          : Array.isArray((result as any)?.result?.data)
          ? (result as any).result.data
          : Array.isArray((result as any)?.rows)
          ? (result as any).rows
          : [];
      
      const summary = { table, limit, rowsCount: rows.length };
      setNodeRunStatus(id, isSuccess ? 'success' : 'fail');
      setNodeResult(
        id,
        isSuccess ? 'success' : 'fail',
        isSuccess ? { ...summary, rows } : result
      );
      data.onLog?.({
        nodeId: id,
        type: 'dbSelectRun',
        data: { ...summary, sample: rows.slice(0, 3) },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[DbSelectNode] query error', error);
      setNodeRunStatus(id, 'fail');
      setNodeResult(id, 'fail', { error: error instanceof Error ? error.message : String(error) });
      data.onLog?.({
        nodeId: id,
        type: 'dbSelectRun',
        data: { table, limit, error: true },
        timestamp: new Date().toISOString(),
      });
    }
  }, [id, table, data.projectId, limit, setNodeRunStatus, setNodeResult, data.onLog]);

  // Watch for run status changes and execute when status becomes 'running'
  useEffect(() => {
    const currentStatus = runStatuses[id];
    // Only execute if status changed to 'running' and we haven't executed for this status change yet
    if (currentStatus === 'running' && lastExecutedStatusRef.current !== 'running') {
      lastExecutedStatusRef.current = 'running';
      // Execute the query when workflow run starts
      executeQuery();
    } else if (currentStatus !== 'running') {
      // Reset the ref when status is no longer 'running' so we can execute again on next run
      lastExecutedStatusRef.current = currentStatus;
    }
  }, [runStatuses[id], executeQuery]);

  // Auto-fetch and store schema when table is selected
  useEffect(() => {
    if (!table || !data.projectId) {
      return;
    }
    
    // Only fetch if schema is not already stored
    if (!data.schema || data.schema.length === 0) {
      getTableSchema(data.projectId, table)
        .then((columns) => {
          // Store schema in node data
          handleUpdateData<DbSelectNodeData>({ schema: columns });
        })
        .catch((error) => {
          console.error('[DbSelectNode] failed to auto-fetch schema', error);
        });
    }
  }, [table, data.projectId, data.schema, getTableSchema, handleUpdateData]);

  const addNodeAndConnect = (sourceHandle: 'success' | 'fail') => {
    // This functionality can be added later if needed
    // For now, we'll keep it simple
  };

  return (
    <NodeWrapper
      id={id}
      selected={selected}
      isConnected={isConnected}
      minWidth="320px"
      className="px-0 py-0"
    >
      <NodeActions selected={selected || false} onDelete={handleDelete} />

      {/* Header */}
      <div className="px-4 py-2 rounded-t-lg bg-dark-50/60 dark:bg-dark-900/40 border-b border-dark-200 dark:border-dark-700">
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          <div className="font-semibold text-sm text-dark-900 dark:text-white flex-1 truncate">
            {data.label || 'Base Select'}
          </div>
        </div>
      </div>

      {/* Body - display only */}
      <div className="px-4 py-3">
        <div className="w-full text-left bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-dark-400 dark:text-dark-500 mb-1">
            Table
          </div>
          <div className="text-sm text-dark-900 dark:text-dark-100 truncate">
            {table ? `${table} (limit ${limit})` : (loading ? 'Loading…' : 'Not configured')}
          </div>
        </div>
      </div>


      <div className="mt-3 pt-2 border-t border-dark-200 dark:border-dark-700">
        <div className="flex items-center space-x-2 mb-1">
          <Handle
            type="source"
            position={Position.Right}
            className="w-3 h-3 bg-green-500 dark:bg-green-400"
            id="success"
            style={{ top: 'auto', bottom: '40%' }}
          />
          <div className="text-xs text-green-600 dark:text-green-400 flex items-center space-x-1">
            <span>Success ()</span>
            {nodeResults[id] && nodeResults[id].status === 'success' && (
              <button
                onClick={() => setShowResultModal(true)}
                className="ml-1 px-1.5 py-0.5 rounded bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-900 dark:text-white"
                title="View data"
              >
                View
              </button>
            )}
            <button
              onClick={() => addNodeAndConnect('success')}
              className="ml-1 p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700"
              title="Add and connect node"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Handle
            type="source"
            position={Position.Right}
            className="w-3 h-3 bg-red-500 dark:bg-red-400"
            id="fail"
            style={{ top: 'auto', bottom: '20%' }}
          />
          <div className="text-xs text-red-600 dark:text-red-400 flex items-center space-x-1">
            <span>Fail ()</span>
            {nodeResults[id] && nodeResults[id].status === 'fail' && (
              <button
                onClick={() => setShowResultModal(true)}
                className="ml-1 px-1.5 py-0.5 rounded bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-900 dark:text-white"
                title="View error"
              >
                View
              </button>
            )}
            <button
              onClick={() => addNodeAndConnect('fail')}
              className="ml-1 p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700"
              title="Add and connect node"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      {showResultModal && nodeResults[id] && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 rounded-lg" onClick={() => setShowResultModal(false)} />
          <div className="relative z-50 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded shadow-xl w-[420px] max-w-[90vw]">
            <div className="px-3 py-2 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
              <div className="text-xs font-semibold text-dark-900 dark:text-white">
                {nodeResults[id].status === 'success' ? 'Success data' : 'Fail data'}
              </div>
              <button
                onClick={() => setShowResultModal(false)}
                className="text-xs px-2 py-1 rounded bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-900 dark:text-white"
              >
                Close
              </button>
            </div>
            <div className="p-2 max-h-[50vh] overflow-auto bg-dark-50 dark:bg-dark-900">
              <div className="border border-dark-200 dark:border-dark-700 rounded p-2 text-[11px]">
                <JsonTree value={nodeResults[id].payload} />
              </div>
            </div>
          </div>
        </div>
      )}
    </NodeWrapper>
  );
};

export default DbSelectNode;


