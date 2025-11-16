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

interface WorkflowStore {
  nodes: Node[];
  edges: Edge[];
  nodeIdCounter: number;
  ui: WorkflowUiState;
  logs: LogEntry[];
  runStatuses: Record<string, 'idle' | 'running' | 'success' | 'fail'>;
  nodeResults: Record<string, { status: 'success' | 'fail'; payload: any; timestamp: string }>;

  // Node/Edge operations
  setNodes: (updater: (nds: Node[]) => Node[]) => void;
  setEdges: (updater: (eds: Edge[]) => Edge[]) => void;
  onConnect: (conn: Connection) => void;
  addNode: (node: Node) => void;
  removeNodeById: (id: string) => void;
  nextNodeId: () => number;

  // UI
  toggleMinimap: () => void;
  toggleConsole: () => void;

  // Logs
  addLog: (entry: Omit<LogEntry, 'timestamp'> & { timestamp?: string }) => void;
  clearLogs: () => void;

  // Run/checklist
  clearRun: () => void;
  setNodeRunStatus: (nodeId: string, status: 'idle' | 'running' | 'success' | 'fail') => void;
  setNodeResult: (nodeId: string, status: 'success' | 'fail', payload: any) => void;

  reset: () => void;
}

const useWorkflowStore = create<WorkflowStore>()(
  devtools(
    (set, get) => ({
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

      setNodes: (updater) => set((state) => ({ nodes: updater(state.nodes) })),
      setEdges: (updater) => set((state) => ({ edges: updater(state.edges) })),
      onConnect: (conn) =>
        set((state) => ({ edges: addEdge(conn, state.edges) })),
      addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
      removeNodeById: (id) =>
        set((state) => ({ nodes: state.nodes.filter((n) => n.id !== id) })),
      nextNodeId: () => {
        const id = get().nodeIdCounter;
        set({ nodeIdCounter: id + 1 });
        return id;
      },

      toggleMinimap: () =>
        set((state) => ({
          ui: { ...state.ui, showMinimap: !state.ui.showMinimap },
        })),
      toggleConsole: () =>
        set((state) => ({
          ui: { ...state.ui, showConsole: !state.ui.showConsole },
        })),

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


