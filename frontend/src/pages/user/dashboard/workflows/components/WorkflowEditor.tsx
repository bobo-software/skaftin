import { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  NodeTypes,
  ReactFlowInstance,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './WorkflowEditor.css';
import { Play, Plus, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Map, ListPlus } from 'lucide-react';
import AddNodeModal from '../../../../../components/workflows/AddNodeModal';
import ResultPreview from '../../../../../components/workflows/ResultPreview';
import { createNode } from '../utils/workflowUtils';
import StartNode from './StartNode';
import HttpRequestNode from './HttpRequestNode';
import DbSelectNode from './DbSelectNode';
import DisplayNode from './DisplayNode';
import useWorkflowStore from '../../../../../stores/workflows/useWorkflowStore';

interface WorkflowEditorProps {
  projectId: string;
}

const nodeTypes: NodeTypes = {
  start: StartNode,
  httpRequest: HttpRequestNode,
  dbSelect: DbSelectNode,
  display: DisplayNode,
};

// Inner component that must be rendered inside ReactFlowProvider
const WorkflowEditorInner = ({ projectId }: WorkflowEditorProps) => {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const setNodes = useWorkflowStore((s) => s.setNodes);
  const setEdges = useWorkflowStore((s) => s.setEdges);
  const onConnectStore = useWorkflowStore((s) => s.onConnect);
  const nextNodeId = useWorkflowStore((s) => s.nextNodeId);
  const showMinimap = useWorkflowStore((s) => s.ui.showMinimap);
  const showConsole = useWorkflowStore((s) => s.ui.showConsole);
  const toggleMinimap = useWorkflowStore((s) => s.toggleMinimap);
  const toggleConsole = useWorkflowStore((s) => s.toggleConsole);
  const addLog = useWorkflowStore((s) => s.addLog);
  const logs = useWorkflowStore((s) => s.logs);
  const runStatuses = useWorkflowStore((s) => s.runStatuses);
  const setNodeRunStatus = useWorkflowStore((s) => s.setNodeRunStatus);
  const clearRun = useWorkflowStore((s) => s.clearRun);
  const [selectedRunNodeId, setSelectedRunNodeId] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const nodeResults = useWorkflowStore((s) => s.nodeResults);
  const nodeResultsRef = useRef(nodeResults);
  useEffect(() => {
    nodeResultsRef.current = nodeResults;
  }, [nodeResults]);
  // Debug: log when selection changes (avoid render spam)
  useEffect(() => {
    if (selectedRunNodeId) {
      // eslint-disable-next-line no-console
      console.log('[WorkflowEditor] selected run node', selectedRunNodeId);
    }
  }, [selectedRunNodeId]);
  const [showAddNode, setShowAddNode] = useState(false);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const rf = useReactFlow();
  const nodeTypesMemo = useMemo(
    () => ({
      start: StartNode,
      httpRequest: HttpRequestNode,
      dbSelect: DbSelectNode,
      display: DisplayNode,
    }),
    []
  );

  const onConnect = useCallback((params: Connection) => onConnectStore(params), [onConnectStore]);
  const onNodesChange = useCallback(
    (changes: Parameters<typeof applyNodeChanges>[0]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes: Parameters<typeof applyEdgeChanges>[0]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges]
  );

  const addStartNode = useCallback((position?: { x: number; y: number }) => {
    const idNum = nextNodeId();
    const newNode = createNode('start', idNum, position);
    setNodes((nds) => [...nds, newNode]);
  }, [nextNodeId, setNodes]);

  const addHttpRequestNode = useCallback((position?: { x: number; y: number }) => {
    const idNum = nextNodeId();
    const newNode = createNode('httpRequest', idNum, position);
    setNodes((nds) => [...nds, newNode]);
  }, [nextNodeId, setNodes]);

  const addDbSelectNode = useCallback((position?: { x: number; y: number }) => {
    const idNum = nextNodeId();
    const newNode = createNode('dbSelect', idNum, position, {
      projectId,
      onLog: (entry: { nodeId: string; type: string; data: any; timestamp?: string }) => {
        addLog(entry);
        if (!showConsole) toggleConsole();
      },
    });
    setNodes((nds) => [...nds, newNode]);
  }, [nextNodeId, projectId, setNodes, addLog, toggleConsole]);

  const addNodeAtViewportCenter = useCallback(
    (type: 'start' | 'http' | 'db' | 'display') => {
      // For now, add at a random position; we can enhance with container center later
      if (type === 'start') {
        addStartNode();
      } else if (type === 'http') {
        addHttpRequestNode();
      } else if (type === 'db') {
        addDbSelectNode();
      } else {
        const idNum = nextNodeId();
        const newNode = createNode('display', idNum);
        setNodes((nds) => [...nds, newNode]);
      }
    },
    [addHttpRequestNode, addDbSelectNode, addStartNode, nextNodeId, rf, setNodes]
  );

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      // Treat double-clicks as add-node gesture
      if (!reactFlowInstance.current || event.detail !== 2) return;
      const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const position = rf.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      addHttpRequestNode(position);
    },
    [addHttpRequestNode, rf]
  );

  const handleRun = useCallback(() => {
    // Debug: starting run
    // eslint-disable-next-line no-console
    console.log('[WorkflowEditor] handleRun invoked', { nodes, edges, projectId });
    // Build a simple list of nodes directly connected from any start node
    const startNodeIds = nodes.filter((n) => n.type === 'start').map((n) => n.id);
    const firstLayerTargets = edges
      .filter((e) => startNodeIds.includes(e.source))
      .map((e) => e.target);
    // Deduplicate
    const uniqueTargets = Array.from(new Set(firstLayerTargets));
    // Debug: targets to run
    // eslint-disable-next-line no-console
    console.log('[WorkflowEditor] run targets', uniqueTargets);
    // Reset statuses and set to running, then mark success (placeholder)
    clearRun();
    if (uniqueTargets.length > 0) {
      setSelectedRunNodeId(uniqueTargets[0]);
    } else {
      setSelectedRunNodeId(null);
    }
    uniqueTargets.forEach((nodeId, idx) => {
      setTimeout(() => {
        // eslint-disable-next-line no-console
        console.log('[WorkflowEditor] node running', nodeId);
        setNodeRunStatus(nodeId, 'running');
        // Simulate quick success; this is where actual execution would branch
        setTimeout(() => {
          setNodeRunStatus(nodeId, 'success');
          // eslint-disable-next-line no-console
          console.log('[WorkflowEditor] node success', nodeId);
          // Log node result payload if available
          const resultEntry = nodeResultsRef.current[nodeId];
          if (resultEntry) {
            // eslint-disable-next-line no-console
            console.log('[WorkflowEditor] node result payload', { nodeId, status: resultEntry.status, payload: resultEntry.payload });
            addLog({
              nodeId,
              type: 'nodeResult',
              data: {
                status: resultEntry.status,
                summary:
                  Array.isArray((resultEntry as any).payload?.rows)
                    ? { rowsCount: (resultEntry as any).payload.rows.length }
                    : undefined,
              },
            });
          }
          addLog({
            nodeId,
            type: 'runStatus',
            data: { status: 'success' },
          });
        }, 200);
      }, idx * 150);
    });
    // After run, print an aggregate summary of all available node results
    setTimeout(() => {
      const summary = uniqueTargets.map((id) => {
        const r = nodeResultsRef.current[id];
        const rowsCount =
          Array.isArray((r as any)?.payload?.rows) ? (r as any).payload.rows.length : undefined;
        return { nodeId: id, status: r?.status ?? runStatuses[id], rowsCount };
      });
      // eslint-disable-next-line no-console
      console.log('[WorkflowEditor] run summary', summary);
      addLog({
        nodeId: 'workflow',
        type: 'runSummary',
        data: summary,
      });
    }, uniqueTargets.length * 150 + 400);
  }, [addLog, clearRun, edges, nodes, setNodeRunStatus]);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  const handleZoomIn = useCallback(() => {
    reactFlowInstance.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance.current?.zoomOut();
  }, []);

  const handleFitView = useCallback(() => {
    reactFlowInstance.current?.fitView();
  }, []);

  return (
    <div className="h-full flex flex-col bg-dark-50 dark:bg-dark-900 ring">
      {/* Toolbar */}
      <div className="bg-white dark:bg-dark-800 border-b border-dark-200 dark:border-dark-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {}}
            className="p-2 hover:bg-dark-100 dark:hover:bg-dark-700 rounded transition-colors"
            title="Undo"
          >
            <Undo2 className="w-4 h-4 text-dark-600 dark:text-dark-400" />
          </button>
          <button
            onClick={() => {}}
            className="p-2 hover:bg-dark-100 dark:hover:bg-dark-700 rounded transition-colors"
            title="Redo"
          >
            <Redo2 className="w-4 h-4 text-dark-600 dark:text-dark-400" />
          </button>
          <div className="w-px h-6 bg-dark-200 dark:bg-dark-700 mx-2" />
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-dark-100 dark:hover:bg-dark-700 rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4 text-dark-600 dark:text-dark-400" />
          </button>
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-dark-100 dark:hover:bg-dark-700 rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4 text-dark-600 dark:text-dark-400" />
          </button>
          <button
            onClick={handleFitView}
            className="p-2 hover:bg-dark-100 dark:hover:bg-dark-700 rounded transition-colors"
            title="Fit to Screen"
          >
            <Maximize2 className="w-4 h-4 text-dark-600 dark:text-dark-400" />
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={handleRun}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
          >
            <Play className="w-4 h-4" />
            <span>Run</span>
          </button>
        
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={toggleMinimap}
            className={`p-2 rounded transition-colors ${
              showMinimap
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-600 dark:text-dark-400'
            }`}
            title="Toggle Minimap"
          >
            <Map className="w-4 h-4" />
          </button>
          <button
            onClick={toggleConsole}
            className={`p-2 rounded transition-colors ${
              showConsole
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-600 dark:text-dark-400'
            }`}
            title="Toggle Console"
          >
            <span className="text-xs">Console</span>
          </button>
        </div>
      </div>

      {/* Add Node Picker */}
      {showAddNode && (
        <AddNodeModal
          onClose={() => setShowAddNode(false)}
          onAdd={(type) => {
            addNodeAtViewportCenter(type);
            setShowAddNode(false);
          }}
        />
      )}

      {/* React Flow Canvas */}
      <div className="flex-1 min-h-0 relative" style={{ width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={onInit}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypesMemo}
          fitView
          className="bg-dark-50 dark:bg-dark-900"
          style={{ width: '100%', height: '100%' }}
        >
          <Background 
            color="#e5e7eb" 
            gap={16}
            className="dark:opacity-20"
          />
          <Controls
            className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700"
            showInteractive={false}
          />
          {showMinimap && (
            <MiniMap
              className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700"
              nodeColor={(node) => {
                if (node.type === 'start') return '#3b82f6';
                if (node.type === 'httpRequest') return '#10b981';
                if (node.type === 'dbSelect') return '#6366f1';
                if (node.type === 'display') return '#f59e0b';
                return '#6b7280';
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
          )}
        </ReactFlow>
      </div>

      {/* Bottom Bar */}
      <div className="bg-white dark:bg-dark-800 border-t border-dark-200 dark:border-dark-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
        <button
            onClick={() => setShowAddNode(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-900 dark:text-white rounded transition-colors text-sm font-medium"
            title="Add Node">
            <ListPlus className="w-4 h-4" />
            <span>Add Node</span>
          </button>
        </div>
        <div className="text-xs text-dark-500 dark:text-dark-400">
          Variables: <span className="font-semibold">0</span>
        </div>
      </div>

      {/* Run Pane: Checklist (left) + Status Details (right) */}
      {Object.keys(runStatuses).length > 0 && (
        <div className="bg-white dark:bg-dark-800 border-t border-dark-200 dark:border-dark-700">
          <div className="flex" style={{ minHeight: '180px' }}>
            {/* Left: Checklist */}
            <div className="w-72 border-r border-dark-200 dark:border-dark-700">
              <div className="px-4 py-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-dark-900 dark:text-white">All blocks</div>
                <button
                  onClick={clearRun}
                  className="text-xs px-2 py-1 rounded bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-900 dark:text-white"
                >
                  Clear
                </button>
              </div>
              <div className="px-2 pb-2 overflow-auto" style={{ maxHeight: '240px' }}>
                {Object.entries(runStatuses).map(([nodeId, status]) => {
                  const node = nodes.find((n) => n.id === nodeId);
                  const label =
                    (node?.data as any)?.label ?? `${node?.type ?? 'node'} (${nodeId})`;
                  const color =
                    status === 'success'
                      ? 'text-green-600 dark:text-green-400'
                      : status === 'running'
                      ? 'text-amber-600 dark:text-amber-400'
                      : status === 'fail'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-dark-500 dark:text-dark-400';
                  const symbol =
                    status === 'success' ? '✔' : status === 'running' ? '…' : status === 'fail' ? '✖' : '•';
                  const isSelected = selectedRunNodeId === nodeId;
                  return (
                    <button
                      key={nodeId}
                      onClick={() => setSelectedRunNodeId(nodeId)}
                      className={`w-full text-left flex items-center justify-between text-xs rounded px-3 py-2 mb-1 ${
                        isSelected
                          ? 'bg-primary-50 dark:bg-primary-900/20'
                          : 'bg-dark-50 dark:bg-dark-900'
                      } border border-dark-200 dark:border-dark-700`}
                    >
                      <div className="truncate pr-2 flex items-center">
                        <span
                          className={`inline-block w-2 h-2 rounded-full mr-2 ${
                            status === 'success'
                              ? 'bg-green-500'
                              : status === 'running'
                              ? 'bg-amber-500'
                              : status === 'fail'
                              ? 'bg-red-500'
                              : 'bg-gray-400'
                          }`}
                        />
                        <span className="font-medium">{label}</span>
                        <span className="ml-2 opacity-70">[{nodeId}]</span>
                      </div>
                      <div className={`ml-2 font-semibold ${color}`}>{symbol}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Right: Run Statuses */}
            <div className="flex-1 px-6 py-4">
              {/* Result details for selected node */}
              {selectedRunNodeId && nodeResults[selectedRunNodeId] && (
                <div className="mb-3">
                  <div className="text-xs text-dark-500 dark:text-dark-400 mb-2">
                    Node: <span className="font-medium">{selectedRunNodeId}</span>
                    <span className="ml-2 text-[10px] opacity-70">[{nodeResults[selectedRunNodeId].timestamp}]</span>
                  </div>
                  <div className="relative inline-block group">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        nodeResults[selectedRunNodeId].status === 'success'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                    >
                      {nodeResults[selectedRunNodeId].status === 'success' ? 'Success' : 'Fail'}
                    </span>
                    <button
                      onClick={() => setShowResultModal(true)}
                      className="ml-2 px-2 py-0.5 text-xs rounded bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-900 dark:text-white"
                      title="View data"
                    >
                      View
                    </button>
                    <div className="absolute z-20 left-0 mt-2 w-[520px] hidden group-hover:block">
                      <div className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded shadow-lg p-2">
                        <div className="text-[10px] opacity-70 mb-1">Details</div>
                        <pre className="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded p-2 whitespace-pre-wrap break-all text-[11px] max-h-64 overflow-auto">
{JSON.stringify(nodeResults[selectedRunNodeId].payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="text-xs text-dark-500 dark:text-dark-400 mb-3">
              {showConsole && (
        <div className="bg-white dark:bg-dark-800 border-t border-dark-200 dark:border-dark-700 px-4 py-2 h-40 overflow-auto">
          {logs.length === 0 ? (
            <div className="text-xs text-dark-500 dark:text-dark-400">No output yet</div>
          ) : (
            <div className="space-y-2">
              {logs.slice(-50).map((log, idx) => (
                <div key={`${log.timestamp}-${idx}`} className="text-xs">
                  <div className="text-dark-600 dark:text-dark-400">
                    <span className="font-semibold">{log.type}</span>
                    <span className="ml-2 text-[10px] opacity-70">[{log.timestamp}]</span>
                    <span className="ml-2 opacity-80">node: {log.nodeId}</span>
                  </div>
                  <pre className="mt-1 bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded p-2 whitespace-pre-wrap break-all">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
              {/* Result Modal */}
              {showResultModal && selectedRunNodeId && nodeResults[selectedRunNodeId] && (
                <ResultPreview
                  title={`${selectedRunNodeId}`}
                  status={nodeResults[selectedRunNodeId].status}
                  payload={nodeResults[selectedRunNodeId].payload}
                  onClose={() => setShowResultModal(false)}
                />
              )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Console Panel */}
     
    </div>
  );
};

// Wrapper that provides the required store context
const WorkflowEditor = ({ projectId }: WorkflowEditorProps) => {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner projectId={projectId} />
    </ReactFlowProvider>
  );
};

export default WorkflowEditor;

