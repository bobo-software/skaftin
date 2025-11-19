import React, { useState } from 'react';
import { X, Download, FileText, FileJson, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { AppButton } from '../ComponentsIndex';

export type ExportFormat = 'csv' | 'json' | 'excel';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: ExportFormat) => void;
  selectedCount: number;
  totalCount: number;
  loading?: boolean;
}

const ExportModal = ({
  isOpen,
  onClose,
  onExport,
  selectedCount,
  totalCount,
  loading = false
}: ExportModalProps) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);

  const exportFormats: Array<{
    id: ExportFormat;
    name: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'csv',
      name: 'CSV',
      description: 'Comma-separated values file. Compatible with Excel and most spreadsheet applications.',
      icon: <FileText className="w-6 h-6" />
    },
    {
      id: 'json',
      name: 'JSON',
      description: 'JavaScript Object Notation. Perfect for data exchange and API integration.',
      icon: <FileJson className="w-6 h-6" />
    },
    {
      id: 'excel',
      name: 'Excel',
      description: 'Microsoft Excel format (.xlsx). Best for complex spreadsheets with formatting.',
      icon: <FileSpreadsheet className="w-6 h-6" />
    }
  ];

  const handleExport = () => {
    if (selectedFormat) {
      onExport(selectedFormat);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSelectedFormat(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  const isExportingAll = selectedCount === totalCount;
  const exportText = isExportingAll 
    ? `Export all ${totalCount} rows`
    : `Export ${selectedCount} selected ${selectedCount === 1 ? 'row' : 'rows'}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Export Data</h3>
              <p className="text-sm text-dark-600 dark:text-dark-300">{exportText}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 disabled:opacity-50 transition-colors"
          >
            <X className="w-5 h-5 text-dark-600 dark:text-dark-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <h4 className="text-sm font-medium text-dark-700 dark:text-dark-300 mb-4">
              Select Export Format
            </h4>
            
            <div className="space-y-3">
              {exportFormats.map((format) => {
                const isSelected = selectedFormat === format.id;
                return (
                  <button
                    key={format.id}
                    onClick={() => setSelectedFormat(format.id)}
                    disabled={loading}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-dark-200 dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-700 bg-white dark:bg-dark-700'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-start space-x-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                        isSelected
                          ? 'bg-primary-500 text-white'
                          : 'bg-dark-100 dark:bg-dark-600 text-dark-600 dark:text-dark-300'
                      }`}>
                        {format.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h5 className={`text-base font-semibold ${
                            isSelected
                              ? 'text-primary-700 dark:text-primary-300'
                              : 'text-dark-900 dark:text-white'
                          }`}>
                            {format.name}
                          </h5>
                          {isSelected && (
                            <CheckCircle className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 ml-2" />
                          )}
                        </div>
                        <p className="text-sm text-dark-600 dark:text-dark-400 mt-1">
                          {format.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {!isExportingAll && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> Only the {selectedCount} selected {selectedCount === 1 ? 'row' : 'rows'} will be exported.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-700">
          <AppButton
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </AppButton>
          <AppButton
            variant="primary"
            onClick={handleExport}
            disabled={!selectedFormat || loading}
            loading={loading}
            icon={<Download className="w-4 h-4" />}
          >
            Export
          </AppButton>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;

