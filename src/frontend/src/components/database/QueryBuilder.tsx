import React, { useState, useEffect } from 'react';
import { useDatabaseStore, useProjectStore } from '../../stores/StoresIndex';
import { 
  Plus, 
  Trash2, 
  Play, 
  Save,
  Download,
  Filter,
  SortAsc,
  SortDesc,
  Search,
  Eye,
  Settings
} from 'lucide-react';
import { AppButton } from '../ComponentsIndex';

interface QueryBuilderProps {
  projectId: string;
}

interface QueryCondition {
  column: string;
  operator: string;
  value: string;
  logicalOperator: 'AND' | 'OR';
}

interface QueryBuilderState {
  selectedTable: string;
  selectedColumns: string[];
  conditions: QueryCondition[];
  orderBy: { column: string; direction: 'ASC' | 'DESC' }[];
  limit: number;
  offset: number;
}

const QueryBuilder = ({ projectId }: QueryBuilderProps) => {
  const { 
    tables, 
    queryResults, 
    loading, 
    error, 
    fetchTables, 
    executeQuery,
    clearError 
  } = useDatabaseStore();
  
  const [queryState, setQueryState] = useState<QueryBuilderState>({
    selectedTable: '',
    selectedColumns: [],
    conditions: [],
    orderBy: [],
    limit: 100,
    offset: 0
  });
  
  const [showPreview, setShowPreview] = useState(false);
  const [generatedQuery, setGeneratedQuery] = useState('');

  const operators = [
    { value: '=', label: 'Equals' },
    { value: '!=', label: 'Not Equals' },
    { value: '>', label: 'Greater Than' },
    { value: '<', label: 'Less Than' },
    { value: '>=', label: 'Greater or Equal' },
    { value: '<=', label: 'Less or Equal' },
    { value: 'LIKE', label: 'Like' },
    { value: 'IN', label: 'In' },
    { value: 'NOT IN', label: 'Not In' },
    { value: 'IS NULL', label: 'Is Null' },
    { value: 'IS NOT NULL', label: 'Is Not Null' }
  ];

  useEffect(() => {
    if (projectId) {
      fetchTables(projectId);
    }
  }, [projectId, fetchTables]);

  useEffect(() => {
    setGeneratedQuery(generateQuery());
  }, [queryState]);

  const generateQuery = () => {
    if (!queryState.selectedTable) return '';

    let query = 'SELECT ';
    
    // Columns
    if (queryState.selectedColumns.length === 0) {
      query += '*';
    } else {
      query += queryState.selectedColumns.join(', ');
    }
    
    // FROM
    query += ` FROM ${queryState.selectedTable}`;
    
    // WHERE conditions
    if (queryState.conditions.length > 0) {
      query += ' WHERE ';
      query += queryState.conditions.map((condition, index) => {
        let conditionStr = '';
        if (index > 0) {
          conditionStr += ` ${condition.logicalOperator} `;
        }
        conditionStr += `${condition.column} ${condition.operator}`;
        
        if (!['IS NULL', 'IS NOT NULL'].includes(condition.operator)) {
          if (['IN', 'NOT IN'].includes(condition.operator)) {
            conditionStr += ` (${condition.value})`;
          } else {
            conditionStr += ` '${condition.value}'`;
          }
        }
        
        return conditionStr;
      }).join('');
    }
    
    // ORDER BY
    if (queryState.orderBy.length > 0) {
      query += ' ORDER BY ';
      query += queryState.orderBy.map(order => 
        `${order.column} ${order.direction}`
      ).join(', ');
    }
    
    // LIMIT and OFFSET
    if (queryState.limit > 0) {
      query += ` LIMIT ${queryState.limit}`;
    }
    if (queryState.offset > 0) {
      query += ` OFFSET ${queryState.offset}`;
    }
    
    return query;
  };

  const handleExecute = async () => {
    if (!generatedQuery) return;
    await executeQuery(projectId, generatedQuery);
  };

  const addCondition = () => {
    setQueryState(prev => ({
      ...prev,
      conditions: [...prev.conditions, {
        column: '',
        operator: '=',
        value: '',
        logicalOperator: 'AND'
      }]
    }));
  };

  const updateCondition = (index: number, field: keyof QueryCondition, value: any) => {
    setQueryState(prev => ({
      ...prev,
      conditions: prev.conditions.map((condition, i) => 
        i === index ? { ...condition, [field]: value } : condition
      )
    }));
  };

  const removeCondition = (index: number) => {
    setQueryState(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }));
  };

  const addOrderBy = () => {
    setQueryState(prev => ({
      ...prev,
      orderBy: [...prev.orderBy, { column: '', direction: 'ASC' }]
    }));
  };

  const updateOrderBy = (index: number, field: string, value: any) => {
    setQueryState(prev => ({
      ...prev,
      orderBy: prev.orderBy.map((order, i) => 
        i === index ? { ...order, [field]: value } : order
      )
    }));
  };

  const removeOrderBy = (index: number) => {
    setQueryState(prev => ({
      ...prev,
      orderBy: prev.orderBy.filter((_, i) => i !== index)
    }));
  };

  const toggleColumn = (column: string) => {
    setQueryState(prev => ({
      ...prev,
      selectedColumns: prev.selectedColumns.includes(column)
        ? prev.selectedColumns.filter(c => c !== column)
        : [...prev.selectedColumns, column]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Query Builder</h3>
          <p className="text-sm text-dark-600 dark:text-dark-300">
            Build SQL queries using a visual interface
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <AppButton
            variant="secondary"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            icon={<Eye className="w-4 h-4" />}
          >
            {showPreview ? 'Hide' : 'Show'} SQL
          </AppButton>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button 
              onClick={clearError}
              className="text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Query Builder */}
        <div className="space-y-6">
          {/* Table Selection */}
          <div className="card">
            <h4 className="font-semibold text-dark-900 dark:text-white mb-4">Table Selection</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Select Table
                </label>
                <select
                  value={queryState.selectedTable}
                  onChange={(e) => setQueryState(prev => ({ ...prev, selectedTable: e.target.value }))}
                  className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Choose a table...</option>
                  {tables.map(table => (
                    <option key={table.table_name} value={table.table_name}>
                      {table.table_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Column Selection */}
          {queryState.selectedTable && (
            <div className="card">
              <h4 className="font-semibold text-dark-900 dark:text-white mb-4">Column Selection</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="select-all"
                    checked={queryState.selectedColumns.length === 0}
                    onChange={() => setQueryState(prev => ({ ...prev, selectedColumns: [] }))}
                    className="rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="select-all" className="text-sm text-dark-700 dark:text-dark-300">
                    Select All (*)
                  </label>
                </div>
                {/* Note: In a real implementation, you'd fetch columns for the selected table */}
                <p className="text-sm text-dark-600 dark:text-dark-300">
                  Column selection will be available after implementing table schema fetching
                </p>
              </div>
            </div>
          )}

          {/* Conditions */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-dark-900 dark:text-white">Conditions (WHERE)</h4>
              <AppButton
                variant="secondary"
                size="sm"
                onClick={addCondition}
                icon={<Plus className="w-4 h-4" />}
              >
                Add Condition
              </AppButton>
            </div>
            
            <div className="space-y-3">
              {queryState.conditions.map((condition, index) => (
                <div key={index} className="p-3 border border-dark-200 dark:border-dark-700 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {index > 0 && (
                      <div className="md:col-span-1">
                        <select
                          value={condition.logicalOperator}
                          onChange={(e) => updateCondition(index, 'logicalOperator', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>
                      </div>
                    )}
                    
                    <div className={index === 0 ? 'md:col-span-1' : 'md:col-span-1'}>
                      <input
                        type="text"
                        value={condition.column}
                        onChange={(e) => updateCondition(index, 'column', e.target.value)}
                        placeholder="Column name"
                        className="w-full px-2 py-1 text-sm border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400"
                      />
                    </div>
                    
                    <div className="md:col-span-1">
                      <select
                        value={condition.operator}
                        onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                      >
                        {operators.map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="md:col-span-1 flex items-center space-x-2">
                      {!['IS NULL', 'IS NOT NULL'].includes(condition.operator) && (
                        <input
                          type="text"
                          value={condition.value}
                          onChange={(e) => updateCondition(index, 'value', e.target.value)}
                          placeholder="Value"
                          className="flex-1 px-2 py-1 text-sm border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400"
                        />
                      )}
                      <button
                        onClick={() => removeCondition(index)}
                        className="p-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order By */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-dark-900 dark:text-white">Sorting (ORDER BY)</h4>
              <AppButton
                variant="secondary"
                size="sm"
                onClick={addOrderBy}
                icon={<Plus className="w-4 h-4" />}
              >
                Add Sort
              </AppButton>
            </div>
            
            <div className="space-y-3">
              {queryState.orderBy.map((order, index) => (
                <div key={index} className="p-3 border border-dark-200 dark:border-dark-700 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <input
                        type="text"
                        value={order.column}
                        onChange={(e) => updateOrderBy(index, 'column', e.target.value)}
                        placeholder="Column name"
                        className="w-full px-2 py-1 text-sm border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400"
                      />
                    </div>
                    
                    <div>
                      <select
                        value={order.direction}
                        onChange={(e) => updateOrderBy(index, 'direction', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                      >
                        <option value="ASC">Ascending</option>
                        <option value="DESC">Descending</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => removeOrderBy(index)}
                        className="p-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Limit and Offset */}
          <div className="card">
            <h4 className="font-semibold text-dark-900 dark:text-white mb-4">Pagination</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Limit
                </label>
                <input
                  type="number"
                  value={queryState.limit}
                  onChange={(e) => setQueryState(prev => ({ ...prev, limit: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Offset
                </label>
                <input
                  type="number"
                  value={queryState.offset}
                  onChange={(e) => setQueryState(prev => ({ ...prev, offset: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Execute Button */}
          <div className="flex items-center justify-end space-x-3">
            <AppButton
              variant="primary"
              onClick={handleExecute}
              loading={loading}
              disabled={!queryState.selectedTable}
              icon={<Play className="w-4 h-4" />}
            >
              Execute Query
            </AppButton>
          </div>
        </div>

        {/* SQL Preview and Results */}
        <div className="space-y-6">
          {showPreview && (
            <div className="card">
              <h4 className="font-semibold text-dark-900 dark:text-white mb-4">Generated SQL</h4>
              <div className="bg-dark-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre className="text-green-400 whitespace-pre-wrap">{generatedQuery}</pre>
              </div>
            </div>
          )}

          {/* Query Results */}
          {queryResults && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-dark-900 dark:text-white">Query Results</h4>
                <span className="text-sm text-dark-600 dark:text-dark-300">
                  {queryResults.rowCount} row{queryResults.rowCount !== 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-200 dark:border-dark-700">
                      {queryResults.columns.map((column, index) => (
                        <th key={index} className="text-left py-2 px-3 text-sm font-medium text-dark-700 dark:text-dark-300">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResults.rows.slice(0, 50).map((row, index) => (
                      <tr key={index} className="border-b border-dark-100 dark:border-dark-800">
                        {queryResults.columns.map((column, colIndex) => (
                          <td key={colIndex} className="py-2 px-3 text-sm text-dark-900 dark:text-white">
                            {row[column] !== null ? String(row[column]) : <span className="text-dark-400">NULL</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {queryResults.rows.length > 50 && (
                  <div className="text-center py-4 text-sm text-dark-600 dark:text-dark-300">
                    Showing first 50 rows of {queryResults.rowCount} total rows
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QueryBuilder;
