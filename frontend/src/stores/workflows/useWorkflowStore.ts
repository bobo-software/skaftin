import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Edge, Node, addEdge, Connection } from 'reactflow';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';
import { WorkflowDefinition } from '../../types/workflow.types';

interface LogEntry {
  nodeId: string;
  type: string;
  data: any;
  timestamp: string;
}

interface WorkflowUiState {
  showMinimap: boolean;
  showConsole: boolean;
}

export type NodeRunStatus = 'idle' | 'running' | 'success' | 'fail';

interface NodeResult {
  status: 'success' | 'fail';
  payload: any;
  timestamp: string;
}

interface WorkflowStore {
  // State
  nodes: Node[];
  edges: Edge[];
  nodeIdCounter: number;
  ui: WorkflowUiState;
  logs: LogEntry[];
  runStatuses: Record<string, NodeRunStatus>;
  nodeResults: Record<string, NodeResult>;

  // Node/Edge operations
  setNodes: (updater: (nds: Node[]) => Node[]) => void;
  setEdges: (updater: (eds: Edge[]) => Edge[]) => void;
  onConnect: (conn: Connection) => void;
  addNode: (node: Node) => void;
  removeNodeById: (id: string) => void;
  deleteNode: (id: string) => void; // Deletes node and connected edges
  updateNodeData: <T = any>(nodeId: string, data: Partial<T>) => void;
  nextNodeId: () => number;

  // UI
  toggleMinimap: () => void;
  toggleConsole: () => void;

  // Logs
  addLog: (entry: Omit<LogEntry, 'timestamp'> & { timestamp?: string }) => void;
  clearLogs: () => void;

  // Run/execution
  clearRun: () => void;
  setNodeRunStatus: (nodeId: string, status: NodeRunStatus) => void;
  setNodeResult: (nodeId: string, status: 'success' | 'fail', payload: any) => void;

  // Selectors/Helpers
  getNodeConnections: (nodeId: string) => { incoming: Edge[]; outgoing: Edge[] };
  isNodeConnected: (nodeId: string) => boolean;
  getNodeResult: (nodeId: string) => NodeResult | undefined;
  getNodeRunStatus: (nodeId: string) => NodeRunStatus;

  // Persistence
  saveWorkflow: (projectId: string, name: string, description?: string, schedule?: string) => Promise<{ success: boolean; workflowId?: number; error?: string }>;
  updateWorkflow: (projectId: string, workflowId: number, name: string, description?: string, schedule?: string) => Promise<{ success: boolean; error?: string }>;
  loadWorkflow: (projectId: string, workflowId: number) => Promise<{ success: boolean; error?: string }>;
  listWorkflows: (projectId: string) => Promise<{ success: boolean; workflows?: any[]; error?: string }>;
  deleteWorkflow: (projectId: string, workflowId: number) => Promise<{ success: boolean; error?: string }>;

  reset: () => void;
}

const useWorkflowStore = create<WorkflowStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      nodes: [],
      edges: [],
      nodeIdCounter: 1,
      ui: {
        showMinimap: false,
        showConsole: true,
      },
      logs: [],
      runStatuses: {},
      nodeResults: {},

      // Node/Edge operations
      setNodes: (updater) => set((state) => ({ nodes: updater(state.nodes) })),
      setEdges: (updater) => set((state) => ({ edges: updater(state.edges) })),
      onConnect: (conn) => {
        const state = get();
        const newEdges = addEdge(conn, state.edges);
        // Log connection for debugging
        const sourceNode = state.nodes.find((n) => n.id === conn.source);
        const targetNode = state.nodes.find((n) => n.id === conn.target);
        const edgeId = conn.id || `${conn.source}-${conn.sourceHandle}-${conn.target}`;
        
        console.log('[Connection] Node connected:', {
          source: conn.source,
          sourceType: sourceNode?.type,
          sourceHandle: conn.sourceHandle,
          target: conn.target,
          targetType: targetNode?.type,
          targetHandle: conn.targetHandle,
          edgeId,
        });
        
        // Add to workflow logs
        set((prevState) => ({
          edges: newEdges,
          logs: [
            ...prevState.logs,
            {
              nodeId: conn.source || 'system',
              type: 'nodeConnection',
              data: {
                action: 'connected',
                source: conn.source,
                sourceType: sourceNode?.type,
                sourceHandle: conn.sourceHandle,
                target: conn.target,
                targetType: targetNode?.type,
                targetHandle: conn.targetHandle,
                edgeId,
              },
              timestamp: new Date().toISOString(),
            },
          ],
        }));
      },
      addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
      removeNodeById: (id) =>
        set((state) => ({ nodes: state.nodes.filter((n) => n.id !== id) })),
      deleteNode: (id) =>
        set((state) => ({
          nodes: state.nodes.filter((n) => n.id !== id),
          edges: state.edges.filter((e) => e.source !== id && e.target !== id),
        })),
      updateNodeData: (nodeId, data) =>
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
          ),
        })),
      nextNodeId: () => {
        const id = get().nodeIdCounter;
        set({ nodeIdCounter: id + 1 });
        return id;
      },

      // UI operations
      toggleMinimap: () =>
        set((state) => ({
          ui: { ...state.ui, showMinimap: !state.ui.showMinimap },
        })),
      toggleConsole: () =>
        set((state) => ({
          ui: { ...state.ui, showConsole: !state.ui.showConsole },
        })),

      // Log operations
      addLog: (entry) =>
        set((state) => ({
          logs: [
            ...state.logs,
            {
              nodeId: entry.nodeId,
              type: entry.type,
              data: entry.data,
              timestamp: entry.timestamp ?? new Date().toISOString(),
            },
          ],
        })),
      clearLogs: () => set({ logs: [] }),

      // Run/execution operations
      clearRun: () => set({ runStatuses: {} }),
      setNodeRunStatus: (nodeId, status) =>
        set((state) => ({
          runStatuses: { ...state.runStatuses, [nodeId]: status },
        })),
      setNodeResult: (nodeId, status, payload) =>
        set((state) => ({
          nodeResults: {
            ...state.nodeResults,
            [nodeId]: { status, payload, timestamp: new Date().toISOString() },
          },
        })),

      // Selectors/Helpers
      getNodeConnections: (nodeId) => {
        const state = get();
        return {
          incoming: state.edges.filter((e) => e.target === nodeId),
          outgoing: state.edges.filter((e) => e.source === nodeId),
        };
      },
      isNodeConnected: (nodeId) => {
        const state = get();
        return state.edges.some((e) => e.source === nodeId || e.target === nodeId);
      },
      getNodeResult: (nodeId) => {
        return get().nodeResults[nodeId];
      },
      getNodeRunStatus: (nodeId) => {
        return get().runStatuses[nodeId] || 'idle';
      },

      // Persistence
      saveWorkflow: async (projectId: string, name: string, description?: string, schedule?: string) => {
        const state = get();
        const token = localStorage.getItem('skaftin-token') || '';
        
        try {
          const workflowData: WorkflowDefinition = {
            name,
            description,
            projectId,
            enabled: true,
            schedule,
            nodes: state.nodes.map((n) => ({
              id: n.id,
              type: n.type as any,
              position: n.position,
              data: n.data,
            })),
            edges: state.edges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle,
              targetHandle: e.targetHandle,
            })),
          };

          const url = ApiRoutes.WORKFLOWS.CREATE(projectId);
          const response = await RequestUtils.post(url, token, workflowData);

          if (response && response.success !== false) {
            return {
              success: true,
              workflowId: (response as any).data?.id || (response as any).id,
            };
          }

          return {
            success: false,
            error: (response as any)?.message || 'Failed to save workflow',
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to save workflow',
          };
        }
      },

      loadWorkflow: async (projectId: string, workflowId: number) => {
        const token = localStorage.getItem('skaftin-token') || '';
        
        try {
          const url = ApiRoutes.WORKFLOWS.GET(projectId, workflowId);
          const response = await RequestUtils.get(url, token);

          if (response && response.success !== false) {
            const workflow = (response as any).data || response;
            
            // Convert workflow nodes and edges to React Flow format
            const nodes: Node[] = workflow.nodes.map((n: any) => ({
              id: n.id,
              type: n.type,
              position: n.position,
              data: n.data,
            }));

            const edges: Edge[] = workflow.edges.map((e: any) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle,
              targetHandle: e.targetHandle,
            }));

            // Find max node ID to set counter
            const maxId = Math.max(
              ...nodes.map((n) => {
                const match = n.id.match(/-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
              }),
              0
            );

            set({
              nodes,
              edges,
              nodeIdCounter: maxId + 1,
            });

            return { success: true };
          }

          return {
            success: false,
            error: (response as any)?.message || 'Failed to load workflow',
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to load workflow',
          };
        }
      },

      updateWorkflow: async (projectId: string, workflowId: number, name: string, description?: string, schedule?: string) => {
        const state = get();
        const token = localStorage.getItem('skaftin-token') || '';
        
        try {
          const workflowData: WorkflowDefinition = {
            name,
            description,
            projectId,
            enabled: true,
            schedule,
            nodes: state.nodes.map((n) => ({
              id: n.id,
              type: n.type as any,
              position: n.position,
              data: n.data,
            })),
            edges: state.edges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              sourceHandle: e.sourceHandle,
              targetHandle: e.targetHandle,
            })),
          };

          const url = ApiRoutes.WORKFLOWS.UPDATE(projectId, workflowId);
          const response = await RequestUtils.put(url, token, workflowData);

          if (response && response.success !== false) {
            return {
              success: true,
            };
          }

          return {
            success: false,
            error: (response as any)?.message || 'Failed to update workflow',
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update workflow',
          };
        }
      },

      listWorkflows: async (projectId: string) => {
        const token = localStorage.getItem('skaftin-token') || '';
        
        try {
          const url = ApiRoutes.WORKFLOWS.LIST(projectId);
          const response = await RequestUtils.get(url, token);

          if (response && response.success !== false) {
            return {
              success: true,
              workflows: (response as any).data || response,
            };
          }

          return {
            success: false,
            error: (response as any)?.message || 'Failed to list workflows',
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list workflows',
          };
        }
      },

      deleteWorkflow: async (projectId: string, workflowId: number) => {
        const token = localStorage.getItem('skaftin-token') || '';
        
        try {
          const url = ApiRoutes.WORKFLOWS.DELETE(projectId, workflowId);
          const response = await RequestUtils.delete(url, token, {});

          if (response && response.success !== false) {
            return {
              success: true,
            };
          }

          return {
            success: false,
            error: (response as any)?.message || 'Failed to delete workflow',
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete workflow',
          };
        }
      },

      // Reset
      reset: () =>
        set({
          nodes: [],
          edges: [],
          nodeIdCounter: 1,
          ui: { showMinimap: false, showConsole: true },
          logs: [],
          runStatuses: {},
          nodeResults: {},
        }),
    }),
    { name: 'workflow-store' }
  )
);

export default useWorkflowStore;


