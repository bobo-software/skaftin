import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';

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
  importDatabaseDump: (projectId: string, sqlContent: string, dropExisting: boolean) => Promise<{success: boolean, result?: any}>;
  exportDatabaseDump: (projectId: string, tables: string[], includeSystemTables: boolean, schemaOnly: boolean) => Promise<{success: boolean}>;
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
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.get(ApiRoutes.DATABASE.LIST_TABLES(projectId), token);
          
          if (response.success) {
            const tables = Array.isArray(response.data) ? response.data : [];
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
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.get(
            ApiRoutes.DATABASE.GET_TABLE_SCHEMA(projectId, tableName),
            token
          );
          
          if (response.success) {
            const columns = Array.isArray(response.data) ? response.data : [];
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
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.post(
            ApiRoutes.DATABASE.EXECUTE_QUERY(projectId),
            token,
            { query }
          );
          
          if (response.success && response.data) {
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
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.post(
            ApiRoutes.DATABASE.CREATE_TABLE(projectId),
            token,
            { tableName, columns }
          );
          
          if (response.success) {
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
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.delete(
            ApiRoutes.DATABASE.DROP_TABLE(projectId, tableName),
            token,
            {}
          );
          
          if (response.success) {
            // Refresh tables list
            await get().fetchTables(projectId);
            set({ currentTable: null });
            return true;
          } else {
            set({ error: response.message || 'Failed to drop table' });
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
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.post(
            ApiRoutes.DATABASE.INSERT_DATA(projectId, tableName),
            token,
            { data }
          );
          
          if (response.success) {
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
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.put(
            ApiRoutes.DATABASE.UPDATE_DATA(projectId, tableName),
            token,
            { data, where }
          );
          
          if (response.success) {
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
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.delete(
            ApiRoutes.DATABASE.DELETE_DATA(projectId, tableName),
            token,
            { where }
          );
          
          if (response.success) {
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
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.get(
            ApiRoutes.DATABASE.GET_TABLE_SCHEMA(projectId, tableName),
            token
          );
          
          if (response.success && response.data) {
            return Array.isArray(response.data) ? response.data : [];
          }
          return [];
        } catch (error) {
          console.error('Failed to get table schema:', error);
          return [];
        }
      },

      importDatabaseDump: async (projectId: string, sqlContent: string, dropExisting: boolean) => {
        set({ loading: true, error: null });
        try {
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.post(
            ApiRoutes.DATABASE.IMPORT_DUMP(projectId),
            token,
            { sqlContent, dropExisting }
          );
          
          if (response.success) {
            // Refresh tables list after import
            await get().fetchTables(projectId);
            return { success: true, result: response.data };
          } else {
            set({ error: response.message || 'Failed to import database dump' });
            return { success: false };
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to import database dump';
          set({ error: errorMsg });
          return { success: false };
        } finally {
          set({ loading: false });
        }
      },

      exportDatabaseDump: async (projectId: string, tables: string[], includeSystemTables: boolean, schemaOnly: boolean) => {
        set({ loading: true, error: null });
        try {
          const token = localStorage.getItem('skaftin-token') || '';
          const API_BASE = import.meta.env.VITE_API_URL || '';
          
          // Make request with responseType blob
          const response = await fetch(`${API_BASE}${ApiRoutes.DATABASE.EXPORT_DUMP(projectId)}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            credentials: 'include',
            body: JSON.stringify({ tables, includeSystemTables, schemaOnly }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to export database dump');
          }

          // Get the blob
          const blob = await response.blob();
          
          // Extract filename from Content-Disposition header or use default
          let fileName = 'database-export.sql';
          const contentDisposition = response.headers.get('Content-Disposition');
          if (contentDisposition) {
            const matches = /filename="?(.+)"?/i.exec(contentDisposition);
            if (matches && matches[1]) {
              fileName = matches[1];
            }
          }

          // Create download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);

          set({ loading: false });
          return { success: true };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to export database dump';
          set({ error: errorMsg, loading: false });
          return { success: false };
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
          // This would be a new API endpoint
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.get(
            `/api/database/${projectId}/stats`,
            token
          );
          if (response.success) {
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
