import { useState, useEffect } from 'react';
import { Database, Plus, Table as TableIcon, Code, RefreshCw, Play, Trash2, Edit, Search } from 'lucide-react';
import { useAppStore } from '../../stores/state/StoresIndex';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';
import LoadingSpinner from '../elements/LoadingSpinner';
import ErrorMessage from '../elements/ErrorMessage';

interface Table {
  table_name: string;
  table_schema: string;
  columns?: Array<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>;
}

interface QueryResult {
  rows: any[];
  rowCount: number;
  fields?: Array<{
    name: string;
    dataTypeID: number;
  }>;
}

const DatabaseTab = () => {
  const { currentProject } = useAppStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [executingQuery, setExecutingQuery] = useState(false);
  const [activeTab, setActiveTab] = useState<'tables' | 'sql'>('tables');

  useEffect(() => {
    if (currentProject) {
      fetchTables();
    }
  }, [currentProject]);

  useEffect(() => {
    if (selectedTable && currentProject) {
      fetchTableData(selectedTable);
    }
  }, [selectedTable, currentProject]);

  const fetchTables = async () => {
    if (!currentProject) return;

    setLoading(true);
    setError('');

    try {
      const result = await RequestUtils.post(ApiRoutes.MCP.CALL, {
        name: 'list_tables',
        arguments: {
          projectId: currentProject.id.toString(),
          includeMetadata: true,
        },
      });

      if (result.success && result.data) {
        const content = result.data.content?.[0]?.text;
        if (content) {
          const tablesData = JSON.parse(content);
          setTables(Array.isArray(tablesData) ? tablesData : []);
        }
      } else {
        setError(result.error || 'Failed to load tables');
      }
    } catch (err) {
      setError('Failed to load tables');
      console.error('Fetch tables error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async (tableName: string) => {
    if (!currentProject) return;

    setLoading(true);
    setError('');

    try {
      const result = await RequestUtils.post(ApiRoutes.MCP.CALL, {
        name: 'execute_sql',
        arguments: {
          projectId: currentProject.id.toString(),
          query: `SELECT * FROM ${tableName} LIMIT 100`,
          readonly: true,
        },
      });

      if (result.success && result.data) {
        const content = result.data.content?.[0]?.text;
        if (content) {
          const queryData = JSON.parse(content);
          setTableData(queryData.rows || []);
        }
      } else {
        setError(result.error || 'Failed to load table data');
      }
    } catch (err) {
      setError('Failed to load table data');
      console.error('Fetch table data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const executeSql = async () => {
    if (!currentProject || !sqlQuery.trim()) return;

    setExecutingQuery(true);
    setError('');

    try {
      const result = await RequestUtils.post(ApiRoutes.MCP.CALL, {
        name: 'execute_sql',
        arguments: {
          projectId: currentProject.id.toString(),
          query: sqlQuery,
          readonly: true, // Start with readonly for safety
        },
      });

      if (result.success && result.data) {
        const content = result.data.content?.[0]?.text;
        if (content) {
          const queryData = JSON.parse(content);
          setQueryResult({
            rows: queryData.rows || [],
            rowCount: queryData.rowCount || 0,
            fields: queryData.fields || [],
          });
        }
      } else {
        setError(result.error || 'Query execution failed');
        setQueryResult(null);
      }
    } catch (err) {
      setError('Failed to execute query');
      console.error('Execute SQL error:', err);
      setQueryResult(null);
    } finally {
      setExecutingQuery(false);
    }
  };

  const getTableColumns = (table: Table): string[] => {
    if (table.columns && table.columns.length > 0) {
      return table.columns.map((col) => col.column_name);
    }
    // If no metadata, try to infer from first row of data
    if (tableData.length > 0) {
      return Object.keys(tableData[0]);
    }
    return [];
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-dark-200 dark:border-dark-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-dark-900 dark:text-white mb-1">Database</h2>
            <p className="text-sm text-dark-600 dark:text-dark-400">
              Manage tables and execute SQL queries for {currentProject?.name}
            </p>
          </div>
          <button
            onClick={fetchTables}
            className="btn-secondary flex items-center space-x-2"
            disabled={loading}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 border-b border-dark-200 dark:border-dark-700">
          <button
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'tables'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <TableIcon className="w-4 h-4" />
              <span>Tables</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'sql'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Code className="w-4 h-4" />
              <span>SQL Editor</span>
            </div>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && <ErrorMessage message={error} className="m-6" />}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'tables' && (
          <div className="space-y-6">
            {loading && tables.length === 0 ? (
              <div className="flex justify-center items-center py-20">
                <LoadingSpinner />
              </div>
            ) : tables.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700">
                <Database className="w-16 h-16 mx-auto mb-4 text-dark-400 dark:text-dark-500" />
                <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">
                  No tables yet
                </h3>
                <p className="text-dark-600 dark:text-dark-400 mb-6 max-w-md mx-auto">
                  This project doesn't have any tables yet. Create one using the SQL editor or use a migration.
                </p>
                <button
                  onClick={() => setActiveTab('sql')}
                  className="btn-primary inline-flex items-center space-x-2"
                >
                  <Code className="w-5 h-5" />
                  <span>Open SQL Editor</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tables List */}
                <div className="lg:col-span-1">
                  <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 p-4">
                    <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
                      Tables ({tables.length})
                    </h3>
                    <div className="space-y-2">
                      {tables.map((table) => (
                        <button
                          key={table.table_name}
                          onClick={() => setSelectedTable(table.table_name)}
                          className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                            selectedTable === table.table_name
                              ? 'bg-primary-600 text-white'
                              : 'bg-dark-50 dark:bg-dark-700 text-dark-900 dark:text-white hover:bg-dark-100 dark:hover:bg-dark-600'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <TableIcon className="w-4 h-4" />
                            <span className="font-medium">{table.table_name}</span>
                          </div>
                          {table.columns && (
                            <div className="text-xs mt-1 opacity-75">
                              {table.columns.length} columns
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Table Data */}
                <div className="lg:col-span-2">
                  {selectedTable ? (
                    <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700">
                      <div className="p-4 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
                          {selectedTable}
                        </h3>
                        <button
                          onClick={() => fetchTableData(selectedTable)}
                          className="btn-secondary text-sm"
                          disabled={loading}
                        >
                          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        {loading ? (
                          <div className="flex justify-center items-center py-20">
                            <LoadingSpinner />
                          </div>
                        ) : tableData.length === 0 ? (
                          <div className="text-center py-20 text-dark-600 dark:text-dark-400">
                            No data found
                          </div>
                        ) : (
                          <table className="w-full">
                            <thead className="bg-dark-50 dark:bg-dark-700">
                              <tr>
                                {getTableColumns(
                                  tables.find((t) => t.table_name === selectedTable)!
                                ).map((col) => (
                                  <th
                                    key={col}
                                    className="px-4 py-3 text-left text-sm font-semibold text-dark-900 dark:text-white"
                                  >
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tableData.map((row, idx) => (
                                <tr
                                  key={idx}
                                  className="border-t border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-700"
                                >
                                  {getTableColumns(
                                    tables.find((t) => t.table_name === selectedTable)!
                                  ).map((col) => (
                                    <td
                                      key={col}
                                      className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400"
                                    >
                                      {row[col] !== null && row[col] !== undefined
                                        ? String(row[col])
                                        : 'NULL'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 p-20 text-center">
                      <TableIcon className="w-16 h-16 mx-auto mb-4 text-dark-400 dark:text-dark-500" />
                      <p className="text-dark-600 dark:text-dark-400">
                        Select a table to view its data
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sql' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700">
              <div className="p-4 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white">SQL Editor</h3>
                <button
                  onClick={executeSql}
                  className="btn-primary flex items-center space-x-2"
                  disabled={executingQuery || !sqlQuery.trim()}
                >
                  <Play className="w-4 h-4" />
                  <span>{executingQuery ? 'Executing...' : 'Execute'}</span>
                </button>
              </div>
              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                placeholder="Enter your SQL query here...&#10;&#10;Example: SELECT * FROM users LIMIT 10;"
                className="w-full h-64 p-4 font-mono text-sm bg-dark-50 dark:bg-dark-900 border-none focus:outline-none text-dark-900 dark:text-white resize-none"
              />
            </div>

            {queryResult && (
              <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700">
                <div className="p-4 border-b border-dark-200 dark:border-dark-700">
                  <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
                    Results ({queryResult.rowCount} rows)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  {queryResult.rows.length === 0 ? (
                    <div className="text-center py-20 text-dark-600 dark:text-dark-400">
                      No results
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-dark-50 dark:bg-dark-700">
                        <tr>
                          {queryResult.fields?.map((field) => (
                            <th
                              key={field.name}
                              className="px-4 py-3 text-left text-sm font-semibold text-dark-900 dark:text-white"
                            >
                              {field.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.rows.map((row, idx) => (
                          <tr
                            key={idx}
                            className="border-t border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-700"
                          >
                            {queryResult.fields?.map((field) => (
                              <td
                                key={field.name}
                                className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400"
                              >
                                {row[field.name] !== null && row[field.name] !== undefined
                                  ? String(row[field.name])
                                  : 'NULL'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseTab;

