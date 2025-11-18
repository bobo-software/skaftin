import { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Connection,
  NodeTypes,
  ReactFlowInstance,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../../styles/WorkflowEditor.css';
import { Play, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Map, ListPlus, Loader2 } from 'lucide-react';
import {
	AddNodeModal,
	ResultPreview,
} from '@components/ComponentsIndex';
import ExecutionLogsPanel from './ExecutionLogsPanel';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';
import StartNode from './nodes/StartNode';
import HttpRequestNode from './nodes/HttpRequestNode';
import DbSelectNode from './nodes/DbSelectNode';
import DisplayNode from './nodes/DisplayNode';
import ConditionNode from './nodes/ConditionNode';
import ForLoopNode from './nodes/ForLoopNode';
import DbInsertNode from './nodes/DbInsertNode';
import DbDeleteNode from './nodes/DbDeleteNode';
import DbUpdateNode from './nodes/DbUpdateNode';
import { createNode } from '@utils/workflowUtils';
import useWorkflowStore from '@stores/workflows/useWorkflowStore';

interface WorkflowEditorProps {
  projectId: string;
}

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
  const setNodeResult = useWorkflowStore((s) => s.setNodeResult);
  const clearRun = useWorkflowStore((s) => s.clearRun);
  const clearLogs = useWorkflowStore((s) => s.clearLogs);
  const [selectedRunNodeId, setSelectedRunNodeId] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const nodeResults = useWorkflowStore((s) => s.nodeResults);
  const nodeResultsRef = useRef(nodeResults);
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [executionId, setExecutionId] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const saveWorkflow = useWorkflowStore((s) => s.saveWorkflow);

  
  useEffect(() => {
    nodeResultsRef.current = nodeResults;
  }, [nodeResults]);
  const [showAddNode, setShowAddNode] = useState(false);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const rf = useReactFlow();
  
  // Memoize node types to avoid React Flow warnings about recreating nodeTypes object
  const nodeTypesMemo = useMemo(
    () => ({
      start: StartNode,
      httpRequest: HttpRequestNode,
      dbSelect: DbSelectNode,
      display: DisplayNode,
      condition: ConditionNode,
      forLoop: ForLoopNode,
      dbInsert: DbInsertNode,
      dbDelete: DbDeleteNode,
      dbUpdate: DbUpdateNode,
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
    (type: 'start' | 'http' | 'db' | 'display' | 'condition' | 'forLoop' | 'dbInsert' | 'dbDelete' | 'dbUpdate') => {
      // For now, add at a random position; we can enhance with container center later
      if (type === 'start') {
        addStartNode();
      } else if (type === 'http') {
        addHttpRequestNode();
      } else if (type === 'db') {
        addDbSelectNode();
      } else if (type === 'display') {
        const idNum = nextNodeId();
        const newNode = createNode('display', idNum);
        setNodes((nds) => [...nds, newNode]);
      } else if (type === 'condition') {
        const idNum = nextNodeId();
        const newNode = createNode('condition', idNum);
        setNodes((nds) => [...nds, newNode]);
      } else if (type === 'forLoop') {
        const idNum = nextNodeId();
        const newNode = createNode('forLoop', idNum);
        setNodes((nds) => [...nds, newNode]);
      } else if (type === 'dbInsert') {
        const idNum = nextNodeId();
        const newNode = createNode('dbInsert', idNum, undefined, { projectId });
        setNodes((nds) => [...nds, newNode]);
      } else if (type === 'dbDelete') {
        const idNum = nextNodeId();
        const newNode = createNode('dbDelete', idNum, undefined, { projectId });
        setNodes((nds) => [...nds, newNode]);
      } else if (type === 'dbUpdate') {
        const idNum = nextNodeId();
        const newNode = createNode('dbUpdate', idNum, undefined, { projectId });
        setNodes((nds) => [...nds, newNode]);
      }
    },
    [addHttpRequestNode, addDbSelectNode, addStartNode, nextNodeId, projectId, setNodes]
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

  const handleRun = useCallback(async () => {
    if (isExecuting) return;

    setIsExecuting(true);
    clearRun();
    setExecutionId(null);
    clearLogs();

    try {
      // Save workflow first if it doesn't have an ID
      let currentWorkflowId = workflowId;
      if (!currentWorkflowId) {
        const saveResult = await saveWorkflow(projectId, `Workflow ${Date.now()}`, 'Auto-saved for execution');
        if (!saveResult.success || !saveResult.workflowId) {
          addLog({
            nodeId: 'workflow',
            type: 'error',
            data: { message: saveResult.error || 'Failed to save workflow before execution' },
          });
          setIsExecuting(false);
          return;
        }
        currentWorkflowId = saveResult.workflowId;
        setWorkflowId(currentWorkflowId);
      }

      // Execute workflow via backend API
      const token = localStorage.getItem('skaftin-token') || '';
      const url = ApiRoutes.WORKFLOWS.EXECUTE(projectId, currentWorkflowId);
      
      addLog({
        nodeId: 'workflow',
        type: 'info',
        data: { message: `Executing workflow ${currentWorkflowId}...` },
      });

      const response = await RequestUtils.post(url, token, { inputs: {}, triggeredBy: 'manual' });

      if (response && response.success !== false) {
        const result = (response as any).data || response;
        const execId = result.executionId || result.id;

        if (execId) {
          setExecutionId(execId);
          addLog({
            nodeId: 'workflow',
            type: 'info',
            data: { message: `Execution started (ID: ${execId})` },
          });

          // Poll for execution completion and fetch logs
          const pollInterval = setInterval(async () => {
            try {
              const logsUrl = ApiRoutes.WORKFLOWS.GET_EXECUTION_LOGS(projectId, currentWorkflowId!, execId);
              const logsResponse = await RequestUtils.get(logsUrl, token);

              if (logsResponse && logsResponse.success !== false) {
                const logsData = (logsResponse as any).data || logsResponse;
                const execution = logsData.execution;

                // Update node statuses based on logs
                if (logsData.nodeLogs) {
                  logsData.nodeLogs.forEach((nodeLog: any) => {
                    if (nodeLog.status === 'success') {
                      setNodeRunStatus(nodeLog.nodeId, 'success');
                      setNodeResult(nodeLog.nodeId, 'success', nodeLog.resultData);
                    } else if (nodeLog.status === 'fail') {
                      setNodeRunStatus(nodeLog.nodeId, 'fail');
                      setNodeResult(nodeLog.nodeId, 'fail', { error: nodeLog.errorMessage });
                    } else if (nodeLog.status === 'skipped') {
                      setNodeRunStatus(nodeLog.nodeId, 'idle');
                    }
                  });
                }

                // Stop polling if execution is complete
                if (execution.status === 'completed' || execution.status === 'failed') {
                  clearInterval(pollInterval);
                  setIsExecuting(false);
                  addLog({
                    nodeId: 'workflow',
                    type: execution.status === 'completed' ? 'success' : 'error',
                    data: {
                      message: `Execution ${execution.status}`,
                      executionId: execId,
                    },
                  });
                }
              }
            } catch (err) {
              console.error('Error polling execution logs:', err);
            }
          }, 500); // Poll every 500ms

          // Stop polling after 30 seconds max
          setTimeout(() => {
            clearInterval(pollInterval);
            setIsExecuting(false);
          }, 30000);
        }
      } else {
        addLog({
          nodeId: 'workflow',
          type: 'error',
          data: { message: (response as any)?.message || 'Failed to execute workflow' },
        });
        setIsExecuting(false);
      }
    } catch (error) {
      addLog({
        nodeId: 'workflow',
        type: 'error',
        data: { message: error instanceof Error ? error.message : 'Failed to execute workflow' },
      });
      setIsExecuting(false);
    }
  }, [isExecuting, workflowId, projectId, saveWorkflow, clearRun, clearLogs, addLog, setNodeRunStatus, setNodeResult]);

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
            disabled={isExecuting}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Run</span>
              </>
            )}
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
      )}

      {/* Execution Logs Panel */}
      {showConsole && (
        <ExecutionLogsPanel
          projectId={projectId}
          workflowId={workflowId}
          executionId={executionId}
        />
      )}
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

