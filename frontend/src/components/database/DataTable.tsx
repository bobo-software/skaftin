import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  Plus,
  RefreshCw,
  Search,
  Download
} from 'lucide-react';
import { AppButton, AppText, ExportModal } from '../ComponentsIndex';
import type { ExportFormat } from '../modals/ExportModal';

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
  pageSize: initialPageSize = 10,
  className = ''
}: DataTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [editingCell, setEditingCell] = useState<{rowIndex: number, column: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [jumpToPage, setJumpToPage] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Get columns from data if not provided
  const tableColumns = columns || (data.length > 0 ? Object.keys(data[0]) : []);
  
  // Reset to page 1 when page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);
  
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
    onBulkDelete?.(selectedIndices);
    setSelectedRows(new Set());
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
    setCurrentPage(1);
  }, [data]);
  
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };
  
  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpToPage);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setJumpToPage('');
    }
  };
  
  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first, last, and pages around current
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  const isAllSelected = paginatedData.length > 0 && 
    paginatedData.every((_, index) => selectedRows.has(startIndex + index));
  const isIndeterminate = selectedRows.size > 0 && !isAllSelected;

  // Get selected data
  const getSelectedData = () => {
    if (selectedRows.size === 0) return sortedData;
    const selectedIndices = Array.from(selectedRows);
    return selectedIndices.map(index => sortedData[index]).filter(Boolean);
  };

  // Export functions
  const exportToCsv = (dataToExport: any[]) => {
    if (dataToExport.length === 0) return;

    const headers = tableColumns;
    const csvRows = [
      headers.join(','),
      ...dataToExport.map(row =>
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          // Escape quotes and wrap in quotes if contains comma, newline, or quote
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `export_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJson = (dataToExport: any[]) => {
    if (dataToExport.length === 0) return;

    const jsonContent = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `export_${new Date().getTime()}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = (dataToExport: any[]) => {
    if (dataToExport.length === 0) return;

    // For Excel export, we'll create a CSV file with .xlsx extension
    // Note: For true Excel format, you'd need a library like xlsx or exceljs
    // This is a simple implementation that creates a CSV that Excel can open
    const headers = tableColumns;
    const csvRows = [
      headers.join(','),
      ...dataToExport.map(row =>
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ];

    const csvContent = csvRows.join('\n');
    // Create a CSV file but name it .xlsx - Excel will open it
    const blob = new Blob([csvContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `export_${new Date().getTime()}.xlsx`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async (format: ExportFormat) => {
    setExportLoading(true);
    try {
      const dataToExport = getSelectedData();
      
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 300));

      switch (format) {
        case 'csv':
          exportToCsv(dataToExport);
          break;
        case 'json':
          exportToJson(dataToExport);
          break;
        case 'excel':
          exportToExcel(dataToExport);
          break;
      }

      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting data:', error);
    } finally {
      setExportLoading(false);
    }
  };

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
    <div className={`space-y-4 ${className} p-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-row items-center space-x-2">
          <AppText
            children="Table Data"
            size="lg"
            weight="semibold"
            color="default"
          />
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
                variant="primary" 
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={() => setShowExportModal(true)}
              >
                Export
              </AppButton>
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
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={onAddRow}
            >
              Add Row
            </AppButton>
          )}
          
          {onCsvImport && (
            <AppButton 
              variant="secondary" 
              size="sm"
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
            className="w-full text-xs pl-10 pr-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Table */}
      {paginatedData.length > 0 ? (
        <div className="overflow-x-auto overflow-y-auto h-[57vh]">
          <table className="w-full border border-dark-200 dark:border-dark-700 rounded-lg overflow-y-auto">
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
                    className={`px-2 py-1 text-left text-[0.7rem] font-light text-dark-500 dark:text-dark-400 uppercase tracking-wider border-b border-dark-200 dark:border-dark-700 ${
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
            <tbody className="bg-white  overflow-y-auto dark:bg-dark-900 divide-y divide-dark-200 dark:divide-dark-700">
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
                      <td key={cellIndex} 
                        className={`px-2 text-[0.8rem]  text-dark-900 dark:text-white border-b border-dark-100 dark:border-dark-800 ${
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
      {pagination && sortedData.length > 0 && (
        <div className="mt-6 pt-4 border-t border-dark-200 dark:border-dark-700">
          {/* Pagination Controls */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Left: Results info and page size */}
            <div className="flex items-center space-x-4">
              <div className="text-sm text-dark-600 dark:text-dark-300">
                Showing <span className="font-medium text-dark-900 dark:text-white">{startIndex + 1}</span> to{' '}
                <span className="font-medium text-dark-900 dark:text-white">{Math.min(endIndex, sortedData.length)}</span> of{' '}
                <span className="font-medium text-dark-900 dark:text-white">{sortedData.length}</span> results
              </div>
              
              {/* Page size selector */}
              <div className="flex items-center space-x-2">
                <label className="text-sm text-dark-600 dark:text-dark-300">
                  Rows per page:
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="px-3 py-1.5 text-sm border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Right: Page navigation */}
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                {/* First page */}
                <AppButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  ««
                </AppButton>
                
                {/* Previous page */}
                <AppButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  ‹
                </AppButton>
                
                {/* Page numbers */}
                <div className="hidden sm:flex items-center space-x-1">
                  {getPageNumbers().map((page, index) => {
                    if (page === '...') {
                      return (
                        <span key={`ellipsis-${index}`} className="px-2 text-dark-400">
                          ...
                        </span>
                      );
                    }
                    
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(Number(page))}
                        className={`min-w-[2.5rem] px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-primary-500 text-white'
                            : 'bg-white dark:bg-dark-700 text-dark-700 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-600 border border-dark-200 dark:border-dark-600'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                
                {/* Current page indicator for mobile */}
                <span className="sm:hidden text-sm text-dark-600 dark:text-dark-300 px-2">
                  {currentPage} / {totalPages}
                </span>
                
                {/* Next page */}
                <AppButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  ›
                </AppButton>
                
                {/* Last page */}
                <AppButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  »»
                </AppButton>
                
                {/* Jump to page */}
                <form onSubmit={handleJumpToPage} className="hidden md:flex items-center space-x-2 ml-4">
                  <label className="text-sm text-dark-600 dark:text-dark-300 whitespace-nowrap">
                    Go to:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={jumpToPage}
                    onChange={(e) => setJumpToPage(e.target.value)}
                    placeholder={String(currentPage)}
                    className="w-16 px-2 py-1.5 text-sm text-center border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <AppButton
                    variant="secondary"
                    size="sm"
                    type="submit"
                  >
                    Go
                  </AppButton>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        selectedCount={selectedRows.size}
        totalCount={sortedData.length}
        loading={exportLoading}
      />
    </div>
  );
};

export default DataTable;
