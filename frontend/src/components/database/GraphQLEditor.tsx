import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/StoresIndex';
import { 
  Play, 
  Save, 
  Download, 
  BookOpen,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  Code2,
  FileJson,
  Sparkles,
  Table,
  Database,
  Plus,
  Search
} from 'lucide-react';
import { AppButton } from '../ComponentsIndex';

interface GraphQLEditorProps {
  projectId: string;
}

interface QueryResult {
  data?: any;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
  }>;
  executionTime?: number;
}

const GraphQLEditor = ({ projectId }: GraphQLEditorProps) => {
  const { currentProject } = useProjectStore();
  const [query, setQuery] = useState('');
  const [variables, setVariables] = useState('{}');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [activeTab, setActiveTab] = useState<'query' | 'variables'>('query');

  // Example queries
  const exampleQueries = [
    {
      name: 'List All Tables',
      description: 'Get all tables in the project',
      query: `query GetTables {
  tables(projectId: ${projectId}) {
    table_name
    table_schema
    table_type
  }
}`,
      variables: '{}'
    },
    {
      name: 'Get Table Schema',
      description: 'View columns of a specific table',
      query: `query GetTableSchema {
  tableSchema(projectId: ${projectId}, tableName: "users") {
    column_name
    data_type
    is_nullable
    is_primary_key
    column_default
  }
}`,
      variables: '{}'
    },
    {
      name: 'Query Table Data',
      description: 'Fetch data with filters and pagination',
      query: `query QueryTable {
  queryTable(
    projectId: ${projectId}
    tableName: "users"
    limit: 10
    offset: 0
  ) {
    rows {
      data
    }
    rowCount
    executionTime
  }
}`,
      variables: '{}'
    },
    {
      name: 'Insert Data',
      description: 'Add a new row to a table',
      query: `mutation InsertData($data: JSON!) {
  insertData(
    projectId: ${projectId}
    tableName: "users"
    data: $data
  ) {
    success
    message
    data
  }
}`,
      variables: JSON.stringify({
        data: {
          name: "John Doe",
          email: "john@example.com"
        }
      }, null, 2)
    },
    {
      name: 'Update Data',
      description: 'Update existing rows',
      query: `mutation UpdateData($data: JSON!, $where: JSON!) {
  updateData(
    projectId: ${projectId}
    tableName: "users"
    data: $data
    where: $where
  ) {
    success
    message
    rowCount
  }
}`,
      variables: JSON.stringify({
        data: { status: "active" },
        where: { id: 1 }
      }, null, 2)
    },
    {
      name: 'Create Table',
      description: 'Create a new table with columns',
      query: `mutation CreateTable($input: CreateTableInput!) {
  createTable(
    projectId: ${projectId}
    input: $input
  ) {
    success
    message
    data
  }
}`,
      variables: JSON.stringify({
        input: {
          tableName: "products",
          columns: [
            { name: "id", type: "SERIAL", primaryKey: true },
            { name: "name", type: "VARCHAR(255)", nullable: false },
            { name: "price", type: "DECIMAL(10,2)" }
          ]
        }
      }, null, 2)
    },
    {
      name: 'Query with Filter',
      description: 'Query data with WHERE clause',
      query: `query QueryWithFilter($where: JSON!) {
  queryTable(
    projectId: ${projectId}
    tableName: "users"
    where: $where
    orderBy: [{ field: "created_at", direction: "DESC" }]
    limit: 20
  ) {
    rows {
      data
    }
    rowCount
  }
}`,
      variables: JSON.stringify({
        where: { status: "active" }
      }, null, 2)
    },
    {
      name: 'Bulk Insert',
      description: 'Insert multiple rows at once',
      query: `mutation BulkInsert($dataArray: [JSON!]!) {
  bulkInsertData(
    projectId: ${projectId}
    tableName: "products"
    dataArray: $dataArray
  ) {
    success
    message
    rowCount
  }
}`,
      variables: JSON.stringify({
        dataArray: [
          { name: "Product A", price: 19.99 },
          { name: "Product B", price: 29.99 },
          { name: "Product C", price: 39.99 }
        ]
      }, null, 2)
    }
  ];

  const executeGraphQL = async () => {
    if (!query.trim()) {
      setError('Please enter a GraphQL query');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Parse variables
      let parsedVariables = {};
      if (variables.trim()) {
        try {
          parsedVariables = JSON.parse(variables);
        } catch (e) {
          throw new Error('Invalid JSON in variables');
        }
      }

      const startTime = Date.now();
      
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          query: query,
          variables: parsedVariables
        })
      });

      const endTime = Date.now();
      const executionMs = endTime - startTime;
      setExecutionTime(executionMs);

      const data = await response.json();
      
      setResult({
        ...data,
        executionTime: executionMs
      });

      if (data.errors) {
        setError(data.errors[0].message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute GraphQL query');
    } finally {
      setLoading(false);
    }
  };

  const loadExample = (example: typeof exampleQueries[0]) => {
    setQuery(example.query);
    setVariables(example.variables);
    setShowExamples(false);
  };

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    }
  };

  const downloadResult = () => {
    if (result) {
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `graphql-result-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const prettifyQuery = () => {
    try {
      // Basic prettification (could be enhanced with a proper GraphQL formatter)
      const formatted = query
        .replace(/\{/g, '{\n  ')
        .replace(/\}/g, '\n}')
        .replace(/,/g, ',\n  ');
      setQuery(formatted);
    } catch (e) {
      // Ignore formatting errors
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-primary-500" />
            GraphQL Explorer
          </h3>
          <p className="text-sm text-dark-600 dark:text-dark-300">
            Query and mutate your database using GraphQL
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <AppButton
            variant="secondary"
            size="sm"
            onClick={() => setShowExamples(!showExamples)}
            icon={<BookOpen className="w-4 h-4" />}
          >
            Examples
          </AppButton>
          <AppButton
            variant="primary"
            size="sm"
            onClick={executeGraphQL}
            icon={<Play className="w-4 h-4" />}
            loading={loading}
          >
            Execute
          </AppButton>
        </div>
      </div>

      {/* Examples Panel */}
      {showExamples && (
        <div className="bg-dark-50 dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-4">
          <h4 className="text-sm font-semibold text-dark-900 dark:text-white mb-3">
            Example Queries
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {exampleQueries.map((example, index) => (
              <button
                key={index}
                onClick={() => loadExample(example)}
                className="text-left p-3 bg-white dark:bg-dark-900 rounded-lg border border-dark-200 dark:border-dark-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors"
              >
                <div className="font-medium text-dark-900 dark:text-white text-sm mb-1">
                  {example.name}
                </div>
                <div className="text-xs text-dark-600 dark:text-dark-400">
                  {example.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Query Editor */}
        <div className="space-y-4">
          {/* Tab Selector */}
          <div className="flex space-x-2 border-b border-dark-200 dark:border-dark-700">
            <button
              onClick={() => setActiveTab('query')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'query'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white'
              }`}
            >
              <Code2 className="w-4 h-4 inline mr-2" />
              Query
            </button>
            <button
              onClick={() => setActiveTab('variables')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'variables'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white'
              }`}
            >
              <FileJson className="w-4 h-4 inline mr-2" />
              Variables
            </button>
          </div>

          {/* Query Input */}
          {activeTab === 'query' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-dark-700 dark:text-dark-300">
                  GraphQL Query / Mutation
                </label>
                <button
                  onClick={prettifyQuery}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                >
                  Prettify
                </button>
              </div>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your GraphQL query or mutation here..."
                className="w-full h-96 px-4 py-3 bg-white dark:bg-dark-900 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm font-mono text-dark-900 dark:text-white resize-none"
                style={{ fontFamily: 'Monaco, Menlo, Consolas, monospace' }}
              />
            </div>
          )}

          {/* Variables Input */}
          {activeTab === 'variables' && (
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Query Variables (JSON)
              </label>
              <textarea
                value={variables}
                onChange={(e) => setVariables(e.target.value)}
                placeholder='{\n  "key": "value"\n}'
                className="w-full h-96 px-4 py-3 bg-white dark:bg-dark-900 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm font-mono text-dark-900 dark:text-white resize-none"
                style={{ fontFamily: 'Monaco, Menlo, Consolas, monospace' }}
              />
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex items-center justify-between text-xs text-dark-600 dark:text-dark-400">
            <div className="flex items-center space-x-4">
              <span>
                <kbd className="px-2 py-1 bg-dark-100 dark:bg-dark-800 rounded border border-dark-300 dark:border-dark-600">
                  Ctrl
                </kbd>
                {' + '}
                <kbd className="px-2 py-1 bg-dark-100 dark:bg-dark-800 rounded border border-dark-300 dark:border-dark-600">
                  Enter
                </kbd>
                {' to execute'}
              </span>
            </div>
            {executionTime !== null && (
              <div className="flex items-center text-primary-600 dark:text-primary-400">
                <Clock className="w-3 h-3 mr-1" />
                {executionTime}ms
              </div>
            )}
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-dark-700 dark:text-dark-300">
              Response
            </label>
            {result && (
              <div className="flex space-x-2">
                <button
                  onClick={copyResult}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </button>
                <button
                  onClick={downloadResult}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </button>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-red-900 dark:text-red-200 text-sm">
                    Error
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {error}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success Result */}
          {result && !result.errors && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg mb-4">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                <span className="font-medium text-green-900 dark:text-green-200 text-sm">
                  Query executed successfully
                </span>
                {result.executionTime && (
                  <span className="ml-auto text-xs text-green-700 dark:text-green-300">
                    {result.executionTime}ms
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Result Display */}
          <div className="bg-white dark:bg-dark-900 border border-dark-300 dark:border-dark-600 rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-auto">
              {result ? (
                <pre className="p-4 text-xs font-mono text-dark-900 dark:text-white">
                  {JSON.stringify(result.errors ? result.errors : result.data, null, 2)}
                </pre>
              ) : (
                <div className="p-8 text-center text-dark-400 dark:text-dark-500">
                  <Code2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Execute a query to see results here</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Info */}
          {result && result.data && (
            <div className="bg-dark-50 dark:bg-dark-800 rounded-lg p-4">
              <div className="text-xs text-dark-600 dark:text-dark-400 space-y-1">
                <div>Response size: {JSON.stringify(result.data).length} bytes</div>
                {result.data.queryTable && (
                  <div>Rows returned: {result.data.queryTable.rowCount}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Panel */}
      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
        <div className="flex items-start">
          <Zap className="w-5 h-5 text-primary-600 dark:text-primary-400 mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-primary-900 dark:text-primary-200 mb-1">
              GraphQL Tips
            </div>
            <ul className="text-primary-700 dark:text-primary-300 space-y-1 text-xs">
              <li>• Use <code className="px-1 bg-primary-100 dark:bg-primary-900/40 rounded">query</code> for fetching data</li>
              <li>• Use <code className="px-1 bg-primary-100 dark:bg-primary-900/40 rounded">mutation</code> for modifying data</li>
              <li>• Variables make queries reusable and prevent injection</li>
              <li>• Request only the fields you need for optimal performance</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphQLEditor;

