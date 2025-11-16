import { Handle, Position } from 'reactflow';
import { Database, Eye, Trash2, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import useDatabaseStore from '../../../../../stores/data/useDatabaseStore';
import RequestUtils from '../../../../../utils/RequestUtils';
import ApiRoutes from '../../../../../constants/ApiRoutes';
import { DbSelectNodeData } from '../types/workflow.types';
import { useReactFlow } from 'reactflow';
import useWorkflowStore from '../../../../../stores/workflows/useWorkflowStore';
import JsonTree from '../../../../../components/workflows/JsonTree';

interface DbSelectNodeProps {
  id: string;
  data: DbSelectNodeData;
  selected?: boolean;
}

const DbSelectNode = ({ id, data, selected }: DbSelectNodeProps) => {
  const { tables, fetchTables, loading } = useDatabaseStore();
  const [table, setTable] = useState<string | undefined>(data.table);
  const [limit, setLimit] = useState<number>(data.limit ?? 10);
  const [showConfig, setShowConfig] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const rf = useReactFlow();
  const setNodeRunStatus = useWorkflowStore((s) => s.setNodeRunStatus);
  const setNodeResult = useWorkflowStore((s) => s.setNodeResult);
  const nodeResults = useWorkflowStore((s) => s.nodeResults);
  const [showResultModal, setShowResultModal] = useState(false);

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

  const handlePreview = async () => {
    if (!table || !data.projectId) return;
    const token = localStorage.getItem('skaftin-token') || '';
    const url = ApiRoutes.DATABASE.SELECT_DATA(data.projectId, table);
    try {
      setIsPreviewing(true);
      // Debug: log request details
      // eslint-disable-next-line no-console
      console.log('[DbSelectNode] preview request', { nodeId: id, url, limit, table });
      const result = await RequestUtils.post(url, token, { limit });
      // Debug: log raw result
      // eslint-disable-next-line no-console
      console.log('[DbSelectNode] preview response', { nodeId: id, result });
      const isSuccess = !!(result && result.success !== false);
      // Try to pull rows array from common shapes
      const rows =
        Array.isArray((result as any)?.data)
          ? (result as any).data
          : Array.isArray((result as any)?.result?.data)
          ? (result as any).result.data
          : Array.isArray((result as any)?.rows)
          ? (result as any).rows
          : [];
      const summary = { table, limit, rowsCount: rows.length };
      // eslint-disable-next-line no-console
      console.log('[DbSelectNode] preview rows', { nodeId: id, rowsCount: rows.length, sample: rows.slice(0, 3) });
      setNodeRunStatus(id, isSuccess ? 'success' : 'fail');
      setNodeResult(
        id,
        isSuccess ? 'success' : 'fail',
        isSuccess ? { ...summary, rows } : result
      );
      data.onLog?.({
        nodeId: id,
        type: 'dbSelectPreview',
        data: { ...summary, sample: rows.slice(0, 3) },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Debug: log error
      // eslint-disable-next-line no-console
      console.error('[DbSelectNode] preview error', { nodeId: id, error });
      setNodeRunStatus(id, 'fail');
      setNodeResult(id, 'fail', { error: error instanceof Error ? error.message : String(error) });
      data.onLog?.({
        nodeId: id,
        type: 'dbSelectPreview',
        data: { table, limit, error: true },
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleDelete = () => {
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
  };
  const addNodeAndConnect = (sourceHandle: 'success' | 'fail') => {
    const current = rf.getNode(id) as any;
    const baseX = current?.position?.x ?? 0;
    const baseY = current?.position?.y ?? 0;
    const newId = `http-${Date.now()}`;
    const newNode = {
      id: newId,
      type: 'httpRequest',
      position: { x: baseX + 260, y: baseY + (sourceHandle === 'success' ? -10 : 10) },
      data: {
        label: 'HTTP Request',
        method: 'GET',
        url: 'http://localhost:8001/api/health',
        headers: {},
        body: '',
      },
    };
    rf.setNodes((nds) => [...nds, newNode]);
    rf.setEdges((eds) => [...eds, { id: `${id}-${sourceHandle}-${newId}`, source: id, target: newId, sourceHandle }]);
  };

  return (
    <div
      className={`relative px-0 py-0 shadow-lg rounded-lg border-2 min-w-[320px] bg-white dark:bg-dark-800 ${
        selected
          ? 'border-primary-500 dark:border-primary-400'
          : 'border-dark-200 dark:border-dark-700'
      }`}
    >
      {selected && (
        <div className="absolute -top-3 -right-3 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded shadow p-1 z-10 flex items-center space-x-1">
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-2 rounded-t-lg bg-dark-50/60 dark:bg-dark-900/40 border-b border-dark-200 dark:border-dark-700">
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          <div className="font-semibold text-sm text-dark-900 dark:text-white flex-1 truncate">
            {data.label || 'Base Select'}
          </div>
        </div>
      </div>

      {/* Body clickable field */}
      <div className="px-4 py-3">
        <button
          onClick={() => setShowConfig(true)}
          className="w-full text-left bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-3 py-2 hover:border-primary-400 transition-colors"
          title="Select table and limit"
        >
          <div className="text-[11px] uppercase tracking-wide text-dark-400 dark:text-dark-500 mb-1">
            Select Table
          </div>
          <div className="text-sm text-dark-900 dark:text-dark-100 truncate">
            {table ? `${table} (limit ${limit})` : (loading ? 'Loading…' : 'Click to choose table')}
          </div>
        </button>

        <div className="flex items-center space-x-2 mt-2">
          <Eye className="w-3 h-3 text-dark-400 dark:text-dark-500" />
          <button
            onClick={handlePreview}
            disabled={!table || isPreviewing}
            className="text-xs text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-white disabled:opacity-60"
          >
            {isPreviewing ? 'Previewing…' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Config popover */}
      {showConfig && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 rounded-lg" onClick={() => setShowConfig(false)} />
          <div className="relative z-30 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-lg p-3 w-[280px]">
            <div className="text-sm font-semibold text-dark-900 dark:text-white mb-2">Select Table</div>
            <div className="space-y-2">
              <div className="text-xs text-dark-500 dark:text-dark-400">Table</div>
              <select
                value={table ?? ''}
                onChange={(e) => setTable(e.target.value || undefined)}
                className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
                disabled={loading}
              >
                <option value="">{loading ? 'Loading…' : 'Select a table'}</option>
                {availableTables.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <div className="text-xs text-dark-500 dark:text-dark-400">Limit</div>
              <input
                type="number"
                min={1}
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value || '1', 10))}
                className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
              />

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  onClick={() => setShowConfig(false)}
                  className="px-3 py-1.5 text-sm rounded bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-900 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowConfig(false)}
                  className="px-3 py-1.5 text-sm rounded bg-primary-600 hover:bg-primary-700 text-white"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-primary-500 dark:bg-primary-400"
      />

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
    </div>
  );
};

export default DbSelectNode;


