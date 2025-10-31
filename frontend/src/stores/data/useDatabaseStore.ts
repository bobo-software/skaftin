import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import McpService from '../../services/McpService';

// Types
export interface Table {
  table_name: string;
  table_type: string;
  table_schema: string;
  columns?: Column[];
  row_count?: number;
  size?: string;
}

export interface Column {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default?: string;
  character_maximum_length?: number;
  numeric_precision?: number;
  numeric_scale?: number;
}

export interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTime: number;
}

export interface DatabaseStats {
  totalTables: number;
  totalRows: number;
  databaseSize: string;
  lastBackup?: string;
}

export interface SqlQuery {
  id: string;
  name: string;
  query: string;
  createdAt: string;
  lastExecuted?: string;
  isFavorite: boolean;
}

// Store interface
interface DatabaseStoreType {
  // State
  tables: Table[];
  currentTable: Table | null;
  queryResults: QueryResult | null;
  savedQueries: SqlQuery[];
  databaseStats: DatabaseStats | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchTables: (projectId: string) => Promise<void>;
  fetchTableDetails: (projectId: string, tableName: string) => Promise<void>;
  executeQuery: (projectId: string, query: string) => Promise<QueryResult | null>;
  createTable: (projectId: string, tableName: string, columns: any[]) => Promise<boolean>;
  dropTable: (projectId: string, tableName: string) => Promise<boolean>;
  insertData: (projectId: string, tableName: string, data: any) => Promise<boolean>;
  updateData: (projectId: string, tableName: string, data: any, where: any) => Promise<boolean>;
  deleteData: (projectId: string, tableName: string, where: any) => Promise<boolean>;
  getTableSchema: (projectId: string, tableName: string) => Promise<Column[]>;
  saveQuery: (query: Omit<SqlQuery, 'id' | 'createdAt'>) => void;
  deleteQuery: (queryId: string) => void;
  fetchDatabaseStats: (projectId: string) => Promise<void>;
  setCurrentTable: (table: Table | null) => void;
  clearError: () => void;
  reset: () => void;
}

const useDatabaseStore = create<DatabaseStoreType>()(
  devtools(
    (set, get) => ({
      // Initial state
      tables: [],
      currentTable: null,
      queryResults: null,
      savedQueries: [],
      databaseStats: null,
      loading: false,
      error: null,

      // Actions
      fetchTables: async (projectId: string) => {
        set({ loading: true, error: null });
        try {
          const response = await McpService.listTables(projectId);
          if (response.status === 'success' && response.data) {
            const tables = Array.isArray(response.data) ? response.data : (response.data.tables || []);
            set({ tables });
          } else {
            set({ error: response.message || 'Failed to fetch tables' });
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to fetch tables' });
        } finally {
          set({ loading: false });
        }
      },

      fetchTableDetails: async (projectId: string, tableName: string) => {
        set({ loading: true, error: null });
        try {
          const response = await McpService.getTableSchema(projectId, tableName);
          if (response.status === 'success' && response.data) {
            const columns = Array.isArray(response.data) ? response.data : (response.data.columns || []);
            const currentTable = get().tables.find(t => t.table_name === tableName);
            if (currentTable) {
              set({ 
                currentTable: { ...currentTable, columns },
                loading: false 
              });
            }
          } else {
            set({ error: response.message || 'Failed to fetch table details' });
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to fetch table details' });
        } finally {
          set({ loading: false });
        }
      },

      executeQuery: async (projectId: string, query: string) => {
        set({ loading: true, error: null });
        try {
          const response = await McpService.executeQuery(projectId, query);
          if (response.status === 'success' && response.data) {
            const result: QueryResult = {
              columns: response.data.columns || [],
              rows: response.data.rows || [],
              rowCount: response.data.rowCount || 0,
              executionTime: response.data.executionTime || 0
            };
            set({ queryResults: result, loading: false });
            return result;
          } else {
            set({ error: response.message || 'Query execution failed' });
            return null;
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Query execution failed' });
          return null;
        } finally {
          set({ loading: false });
        }
      },

      createTable: async (projectId: string, tableName: string, columns: any[]) => {
        set({ loading: true, error: null });
        try {
          const response = await McpService.createTable(projectId, tableName, columns);
          if (response.status === 'success') {
            // Refresh tables list
            await get().fetchTables(projectId);
            return true;
          } else {
            set({ error: response.message || 'Failed to create table' });
            return false;
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to create table' });
          return false;
        } finally {
          set({ loading: false });
        }
      },

      dropTable: async (projectId: string, tableName: string) => {
        set({ loading: true, error: null });
        try {
          const response = await McpService.dropTable(projectId, tableName);
          if (response.success && response.result.success) {
            // Refresh tables list
            await get().fetchTables(projectId);
            return true;
          } else {
            set({ error: 'Failed to drop table' });
            return false;
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to drop table' });
          return false;
        } finally {
          set({ loading: false });
        }
      },

      insertData: async (projectId: string, tableName: string, data: any) => {
        set({ loading: true, error: null });
        try {
          const response = await McpService.insertData(projectId, tableName, data);
          if (response.status === 'success') {
            return true;
          } else {
            set({ error: response.message || 'Failed to insert data' });
            return false;
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to insert data' });
          return false;
        } finally {
          set({ loading: false });
        }
      },

      updateData: async (projectId: string, tableName: string, data: any, where: any) => {
        set({ loading: true, error: null });
        try {
          const response = await McpService.updateData(projectId, tableName, data, where);
          if (response.status === 'success') {
            return true;
          } else {
            set({ error: response.message || 'Failed to update data' });
            return false;
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to update data' });
          return false;
        } finally {
          set({ loading: false });
        }
      },

      deleteData: async (projectId: string, tableName: string, where: any) => {
        set({ loading: true, error: null });
        try {
          const response = await McpService.deleteData(projectId, tableName, where);
          if (response.status === 'success') {
            return true;
          } else {
            set({ error: response.message || 'Failed to delete data' });
            return false;
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to delete data' });
          return false;
        } finally {
          set({ loading: false });
        }
      },

      getTableSchema: async (projectId: string, tableName: string) => {
        try {
          const response = await McpService.getTableSchema(projectId, tableName);
          if (response.status === 'success' && response.data) {
            return Array.isArray(response.data) ? response.data : (response.data.columns || []);
          }
          return [];
        } catch (error) {
          console.error('Failed to get table schema:', error);
          return [];
        }
      },

      saveQuery: (query) => {
        const newQuery: SqlQuery = {
          ...query,
          id: Date.now().toString(),
          createdAt: new Date().toISOString()
        };
        set(state => ({
          savedQueries: [...state.savedQueries, newQuery]
        }));
      },

      deleteQuery: (queryId: string) => {
        set(state => ({
          savedQueries: state.savedQueries.filter(q => q.id !== queryId)
        }));
      },

      fetchDatabaseStats: async (projectId: string) => {
        set({ loading: true, error: null });
        try {
          // This would be a new MCP tool
          const response = await McpService.getDatabaseStats(projectId);
          if (response.success && response.result.success) {
            set({ databaseStats: response.result.data });
          }
        } catch (error) {
          console.error('Failed to fetch database stats:', error);
        } finally {
          set({ loading: false });
        }
      },

      setCurrentTable: (table: Table | null) => {
        set({ currentTable: table });
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set({
          tables: [],
          currentTable: null,
          queryResults: null,
          savedQueries: [],
          databaseStats: null,
          loading: false,
          error: null
        });
      }
    }),
    {
      name: 'database-store'
    }
  )
);

export default useDatabaseStore;
