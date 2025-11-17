import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Edge, Node, addEdge, Connection } from 'reactflow';

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
        showMinimap: true,
        showConsole: true,
      },
      logs: [],
      runStatuses: {},
      nodeResults: {},

      // Node/Edge operations
      setNodes: (updater) => set((state) => ({ nodes: updater(state.nodes) })),
      setEdges: (updater) => set((state) => ({ edges: updater(state.edges) })),
      onConnect: (conn) =>
        set((state) => ({ edges: addEdge(conn, state.edges) })),
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

      // Reset
      reset: () =>
        set({
          nodes: [],
          edges: [],
          nodeIdCounter: 1,
          ui: { showMinimap: true, showConsole: true },
          logs: [],
          runStatuses: {},
          nodeResults: {},
        }),
    }),
    { name: 'workflow-store' }
  )
);

export default useWorkflowStore;


