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
import { Play, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Map, ListPlus, Loader2, Save } from 'lucide-react';
import {
	AddNodeModal,
	AppButton,
	ResultPreview,
} from '@components/ComponentsIndex';
import ExecutionLogsPanel from './ExecutionLogsPanel';
import WorkflowSidebar from './sidebar/WorkflowSidebar';
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
import EmailNode from './nodes/EmailNode';
import { createNode } from '@utils/workflowUtils';
import useWorkflowStore from '@stores/workflows/useWorkflowStore';

interface WorkflowEditorProps {
  projectId: string;
  workflowId?: number | null;
  onWorkflowCreated?: (workflowId: number) => void;
}

// Inner component that must be rendered inside ReactFlowProvider
const WorkflowEditorInner = ({ projectId, workflowId: propWorkflowId, onWorkflowCreated }: WorkflowEditorProps) => {
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
  const setNodeRunStatus = useWorkflowStore((s) => s.setNodeRunStatus);
  const setNodeResult = useWorkflowStore((s) => s.setNodeResult);
  const clearRun = useWorkflowStore((s) => s.clearRun);
  const clearLogs = useWorkflowStore((s) => s.clearLogs);
  const nodeResults = useWorkflowStore((s) => s.nodeResults);
  const nodeResultsRef = useRef(nodeResults);
  const [workflowId, setWorkflowId] = useState<number | null>(propWorkflowId || null);
  const [executionId, setExecutionId] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const saveWorkflow = useWorkflowStore((s) => s.saveWorkflow);
  const updateWorkflow = useWorkflowStore((s) => s.updateWorkflow);
  const [isSaving, setIsSaving] = useState(false);

  
  useEffect(() => {
    nodeResultsRef.current = nodeResults;
  }, [nodeResults]);

  // Sync workflowId from prop
  useEffect(() => {
    if (propWorkflowId !== undefined) {
      setWorkflowId(propWorkflowId);
    }
  }, [propWorkflowId]);
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
      email: EmailNode,
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
      // Log edge changes for debugging
      changes.forEach((change) => {
        if (change.type === 'remove') {
          const edge = change.id ? edges.find((e) => e.id === change.id) : null;
          if (edge) {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);
            console.log('[Connection] Edge removed:', {
              edgeId: edge.id,
              source: edge.source,
              sourceType: sourceNode?.type,
              sourceHandle: edge.sourceHandle,
              target: edge.target,
              targetType: targetNode?.type,
              targetHandle: edge.targetHandle,
            });
            addLog({
              nodeId: edge.source || 'system',
              type: 'nodeConnection',
              data: {
                action: 'disconnected',
                source: edge.source,
                sourceType: sourceNode?.type,
                sourceHandle: edge.sourceHandle,
                target: edge.target,
                targetType: targetNode?.type,
                targetHandle: edge.targetHandle,
                edgeId: edge.id,
              },
              timestamp: new Date().toISOString(),
            });
          }
        }
      });
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges, edges, nodes, addLog]
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
    (type: 'start' | 'http' | 'db' | 'display' | 'condition' | 'forLoop' | 'dbInsert' | 'dbDelete' | 'dbUpdate' | 'email') => {
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
      } else if (type === 'email') {
        const idNum = nextNodeId();
        const newNode = createNode('email', idNum, undefined, { projectId });
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
        onWorkflowCreated?.(currentWorkflowId);
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
  }, [isExecuting, workflowId, projectId, saveWorkflow, clearRun, clearLogs, addLog, setNodeRunStatus, setNodeResult, onWorkflowCreated]);

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

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      if (workflowId) {
        // Update existing workflow
        const result = await updateWorkflow(
          projectId,
          workflowId,
          `Workflow ${workflowId}`, // TODO: Get actual name from workflow metadata
          undefined,
          undefined
        );
        if (result.success) {
          addLog({
            nodeId: 'workflow',
            type: 'success',
            data: { message: 'Workflow saved successfully' },
          });
        } else {
          addLog({
            nodeId: 'workflow',
            type: 'error',
            data: { message: result.error || 'Failed to save workflow' },
          });
        }
      } else {
        // Create new workflow
        const result = await saveWorkflow(
          projectId,
          `Workflow ${Date.now()}`,
          'Auto-saved workflow'
        );
        if (result.success && result.workflowId) {
          setWorkflowId(result.workflowId);
          onWorkflowCreated?.(result.workflowId);
          addLog({
            nodeId: 'workflow',
            type: 'success',
            data: { message: 'Workflow created successfully' },
          });
        } else {
          addLog({
            nodeId: 'workflow',
            type: 'error',
            data: { message: result.error || 'Failed to create workflow' },
          });
        }
      }
    } catch (error) {
      addLog({
        nodeId: 'workflow',
        type: 'error',
        data: { message: error instanceof Error ? error.message : 'Failed to save workflow' },
      });
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, workflowId, projectId, updateWorkflow, saveWorkflow, addLog, onWorkflowCreated]);

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

          <AppButton
            variant="secondary"
            size="sm"
            onClick={() => { setShowAddNode(true); }}
            icon={<ListPlus className="w-4 h-4" />}
          >
            Add Node
          </AppButton>
          <AppButton
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            icon={<Save className="w-4 h-4" />}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </AppButton>
          <AppButton
            variant="secondary"
            size="sm"
            onClick={handleRun}
            disabled={isExecuting}
            icon={<Play className="w-4 h-4" />}
          >
            {isExecuting ? 'Running...' : 'Run Workflow'}
          </AppButton>
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
            onClick={() => {
              if (!showSidebar) {
                setShowSidebar(true);
              } else {
                toggleConsole();
              }
            }}
            className={`p-2 rounded transition-colors ${
              showSidebar || showConsole
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-600 dark:text-dark-400'
            }`}
            title="Toggle Sidebar"
          >
            <span className="text-xs">Sidebar</span>
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

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex">
        {/* React Flow Canvas */}
        <div className="flex-1 min-h-0 relative" style={{ width: '100%', height: '100%' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={onInit}
            onPaneClick={(event) => {
              handlePaneClick(event);
              setSelectedNodeId(null);
            }}
            onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
            onNodeMouseLeave={() => setHoveredNodeId(null)}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
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

        {/* Right Sidebar */}
        {showSidebar && (
          <WorkflowSidebar
            projectId={projectId}
            workflowId={workflowId}
            executionId={executionId}
            hoveredNodeId={hoveredNodeId}
            selectedNodeId={selectedNodeId}
            onClose={() => setShowSidebar(false)}
          />
        )}
      </div>



      {/* Execution Logs Panel (Legacy - hidden when sidebar is shown) */}
      {showConsole && !showSidebar && (
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
const WorkflowEditor = ({ projectId, workflowId, onWorkflowCreated }: WorkflowEditorProps) => {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner projectId={projectId} workflowId={workflowId} onWorkflowCreated={onWorkflowCreated} />
    </ReactFlowProvider>
  );
};

export default WorkflowEditor;