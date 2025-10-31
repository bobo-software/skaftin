import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  Plus,
  RefreshCw,
  Search,
  Download
} from 'lucide-react';
import { AppButton } from '../ComponentsIndex';

interface DataTableProps {
  data: any[];
  loading?: boolean;
  onRefresh?: () => void;
  onAddRow?: () => void;
  onCsvImport?: () => void;
  onEditRow?: (row: any, index: number) => void;
  onBulkDelete?: (selectedIndices: number[]) => void;
  columns?: string[];
  searchable?: boolean;
  selectable?: boolean;
  sortable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  className?: string;
}

const DataTable = ({
  data,
  loading = false,
  onRefresh,
  onAddRow,
  onCsvImport,
  onEditRow,
  onBulkDelete,
  columns,
  searchable = true,
  selectable = true,
  sortable = true,
  pagination = true,
  pageSize = 10,
  className = ''
}: DataTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingCell, setEditingCell] = useState<{rowIndex: number, column: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Get columns from data if not provided
  const tableColumns = columns || (data.length > 0 ? Object.keys(data[0]) : []);
  
  // Filter data based on search term
  const filteredData = data.filter(row => {
    if (!searchTerm) return true;
    return Object.values(row).some(value => 
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn) return 0;
    
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];
    
    if (aValue === bValue) return 0;
    
    const comparison = aValue < bValue ? -1 : 1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Paginate data
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = pagination ? sortedData.slice(startIndex, endIndex) : sortedData;
  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIndices = new Set(paginatedData.map((_, index) => startIndex + index));
      setSelectedRows(allIndices);
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (index: number, checked: boolean) => {
    const actualIndex = startIndex + index;
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(actualIndex);
    } else {
      newSelected.delete(actualIndex);
    }
    setSelectedRows(newSelected);
  };

  const handleSort = (column: string) => {
    if (!sortable) return;
    
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleBulkDelete = () => {
    if (selectedRows.size === 0) return;
    
    const selectedIndices = Array.from(selectedRows);
    if (window.confirm(`Delete ${selectedIndices.length} selected row${selectedIndices.length !== 1 ? 's' : ''}?`)) {
      onBulkDelete?.(selectedIndices);
      setSelectedRows(new Set());
    }
  };

  const handleCellClick = (rowIndex: number, column: string, value: any) => {
    // Don't allow editing of certain columns (like id)
    if (column.toLowerCase() === 'id' || column.toLowerCase() === 'created_at' || column.toLowerCase() === 'updated_at') {
      return;
    }
    
    setEditingCell({ rowIndex, column });
    setEditValue(String(value || ''));
  };

  const handleCellEdit = (newValue: string) => {
    setEditValue(newValue);
  };

  const handleCellSave = async () => {
    if (!editingCell) return;
    
    const actualRowIndex = startIndex + editingCell.rowIndex;
    const row = paginatedData[editingCell.rowIndex];
    const updatedRow = { ...row, [editingCell.column]: editValue };
    
    try {
      // Call the edit handler if provided
      if (onEditRow) {
        await onEditRow(updatedRow, actualRowIndex);
      }
      setEditingCell(null);
      setEditValue('');
    } catch (error) {
      console.error('Error saving cell:', error);
      // Keep editing on error
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      handleCellCancel();
    }
  };

  // Reset selection when data changes
  useEffect(() => {
    setSelectedRows(new Set());
  }, [data]);

  const isAllSelected = paginatedData.length > 0 && 
    paginatedData.every((_, index) => selectedRows.has(startIndex + index));
  const isIndeterminate = selectedRows.size > 0 && !isAllSelected;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-dark-600 dark:text-dark-300">Loading table data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold text-dark-900 dark:text-white">
            Table Data
          </h4>
          <p className="text-sm text-dark-600 dark:text-dark-300">
            {sortedData.length} rows
            {selectedRows.size > 0 && (
              <span className="ml-2 text-primary-600 dark:text-primary-400 font-medium">
                • {selectedRows.size} selected
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {selectedRows.size > 0 && (
            <div className="flex items-center space-x-2 mr-4">
              <AppButton 
                variant="danger" 
                size="sm"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={handleBulkDelete}
              >
                Delete Selected
              </AppButton>
              <AppButton 
                variant="secondary" 
                size="sm"
                onClick={() => setSelectedRows(new Set())}
              >
                Clear Selection
              </AppButton>
            </div>
          )}
          
          {onRefresh && (
            <AppButton 
              variant="secondary" 
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={onRefresh}
            >
              Refresh
            </AppButton>
          )}
          
          {onAddRow && (
            <AppButton 
              variant="primary" 
              icon={<Plus className="w-4 h-4" />}
              onClick={onAddRow}
            >
              Add Row
            </AppButton>
          )}
          
          {onCsvImport && (
            <AppButton 
              variant="secondary" 
              icon={<Download className="w-4 h-4" />}
              onClick={onCsvImport}
            >
              Import CSV
            </AppButton>
          )}
        </div>
      </div>

      {/* Search */}
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            type="text"
            placeholder="Search table data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Table */}
      {paginatedData.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border border-dark-200 dark:border-dark-700 rounded-lg">
            <thead className="bg-dark-50 dark:bg-dark-800">
              <tr>
                {selectable && (
                  <th className="px-2 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase border-b border-dark-200 dark:border-dark-700">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = isIndeterminate;
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                )}
                {tableColumns.map((column) => (
                  <th 
                    key={column} 
                    className={`px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider border-b border-dark-200 dark:border-dark-700 ${
                      sortable ? 'cursor-pointer hover:bg-dark-100 dark:hover:bg-dark-700' : ''
                    }`}
                    onClick={() => handleSort(column)}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{column}</span>
                      {sortable && sortColumn === column && (
                        <span className="text-primary-600 dark:text-primary-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-dark-900 divide-y divide-dark-200 dark:divide-dark-700">
              {paginatedData.map((row, index) => (
                <tr key={index} className="hover:bg-dark-50 dark:hover:bg-dark-800">
                  {selectable && (
                    <td className="px-2 py-3 text-sm text-dark-900 dark:text-white border-b border-dark-100 dark:border-dark-800">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(startIndex + index)}
                        onChange={(e) => handleSelectRow(index, e.target.checked)}
                        className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                  )}
                  {tableColumns.map((column, cellIndex) => {
                    const isEditing = editingCell?.rowIndex === index && editingCell?.column === column;
                    const isEditable = !['id', 'created_at', 'updated_at'].includes(column.toLowerCase());
                    
                    return (
                      <td 
                        key={cellIndex} 
                        className={`px-4 py-3 text-sm text-dark-900 dark:text-white border-b border-dark-100 dark:border-dark-800 ${
                          isEditable ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20' : ''
                        }`}
                        onClick={() => isEditable && handleCellClick(index, column, row[column])}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => handleCellEdit(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleCellSave}
                            className="w-full px-2 py-1 border border-primary-500 rounded focus:outline-none focus:ring-2 focus:ring-primary-500/20 bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                            autoFocus
                          />
                        ) : (
                          <div className="max-w-xs truncate" title={String(row[column])}>
                            {row[column] === null ? (
                              <span className="text-dark-400 dark:text-dark-500 italic">null</span>
                            ) : typeof row[column] === 'boolean' ? (
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                row[column] ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                              }`}>
                                {row[column] ? 'true' : 'false'}
                              </span>
                            ) : (
                              <span className={isEditable ? 'hover:text-primary-600 dark:hover:text-primary-400' : ''}>
                                {String(row[column])}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4">
            <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
            No Data Found
          </h4>
          <p className="text-dark-600 dark:text-dark-300 mb-4">
            {searchTerm ? 'No data matches your search criteria' : 'This table doesn\'t have any data yet'}
          </p>
          {onAddRow && (
            <AppButton 
              variant="primary" 
              icon={<Plus className="w-4 h-4" />}
              onClick={onAddRow}
            >
              Add First Row
            </AppButton>
          )}
        </div>
      )}

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-dark-600 dark:text-dark-300">
            Showing {startIndex + 1} to {Math.min(endIndex, sortedData.length)} of {sortedData.length} results
          </div>
          <div className="flex items-center space-x-2">
            <AppButton
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </AppButton>
            <span className="text-sm text-dark-600 dark:text-dark-300">
              Page {currentPage} of {totalPages}
            </span>
            <AppButton
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </AppButton>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
