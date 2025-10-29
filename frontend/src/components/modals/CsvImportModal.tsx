import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { AppButton } from '../ComponentsIndex';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any[], columnMapping: any) => void;
  tableColumns: Array<{
    column_name: string;
    data_type: string;
    is_nullable: boolean;
  }>;
  loading?: boolean;
}

interface ParsedCsvData {
  headers: string[];
  rows: any[][];
  preview: any[];
}

const CsvImportModal = ({
  isOpen,
  onClose,
  onImport,
  tableColumns,
  loading = false
}: CsvImportModalProps) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<ParsedCsvData | null>(null);
  const [columnMapping, setColumnMapping] = useState<{[key: string]: string}>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [importError, setImportError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      setImportError('');
      parseCsvFile(file);
    } else {
      setImportError('Please select a valid CSV file.');
    }
  };

  const parseCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setImportError('CSV file must have at least a header row and one data row.');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows = lines.slice(1).map(line => 
          line.split(',').map(cell => cell.trim().replace(/"/g, ''))
        );

        // Create preview (first 5 rows)
        const preview = rows.slice(0, 5).map(row => {
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });

        setCsvData({
          headers,
          rows,
          preview
        });

        // Auto-map columns with similar names
        const autoMapping: {[key: string]: string} = {};
        headers.forEach(header => {
          const tableColumn = tableColumns.find(col => 
            col.column_name.toLowerCase() === header.toLowerCase() ||
            col.column_name.toLowerCase().includes(header.toLowerCase()) ||
            header.toLowerCase().includes(col.column_name.toLowerCase())
          );
          if (tableColumn) {
            autoMapping[header] = tableColumn.column_name;
          }
        });
        setColumnMapping(autoMapping);
        setStep('mapping');

      } catch (error) {
        setImportError('Error parsing CSV file. Please check the file format.');
        console.error('CSV parsing error:', error);
      }
    };
    reader.readAsText(file);
  };

  const handleColumnMapping = (csvColumn: string, tableColumn: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [csvColumn]: tableColumn
    }));
  };

  const validateMapping = () => {
    const errors: string[] = [];
    const mappedColumns = Object.values(columnMapping).filter(Boolean);
    
    // Check for duplicate mappings
    const duplicates = mappedColumns.filter((item, index) => mappedColumns.indexOf(item) !== index);
    if (duplicates.length > 0) {
      errors.push('Each table column can only be mapped once.');
    }

    // Check for required columns (non-nullable)
    const requiredColumns = tableColumns.filter(col => !col.is_nullable);
    const mappedRequiredColumns = requiredColumns.filter(col => 
      Object.values(columnMapping).includes(col.column_name)
    );
    
    if (mappedRequiredColumns.length !== requiredColumns.length) {
      const missing = requiredColumns
        .filter(col => !Object.values(columnMapping).includes(col.column_name))
        .map(col => col.column_name);
      errors.push(`Required columns must be mapped: ${missing.join(', ')}`);
    }

    setErrors(errors);
    return errors.length === 0;
  };

  const handleNext = () => {
    if (step === 'mapping') {
      if (validateMapping()) {
        setStep('preview');
      }
    }
  };

  const handleImport = () => {
    if (!csvData || !csvFile) return;

    // Transform data according to mapping
    const transformedData = csvData.rows.map(row => {
      const obj: any = {};
      csvData.headers.forEach((header, index) => {
        const tableColumn = columnMapping[header];
        if (tableColumn && row[index] !== undefined) {
          obj[tableColumn] = row[index] || null;
        }
      });
      return obj;
    });

    onImport(transformedData, columnMapping);
  };

  const handleClose = () => {
    setStep('upload');
    setCsvFile(null);
    setCsvData(null);
    setColumnMapping({});
    setErrors([]);
    setImportError('');
    onClose();
  };

  const getDataTypeIcon = (dataType: string) => {
    if (dataType.includes('INT') || dataType.includes('SERIAL')) return '🔢';
    if (dataType.includes('VARCHAR') || dataType.includes('TEXT')) return '📝';
    if (dataType.includes('BOOL')) return '✅';
    if (dataType.includes('DATE') || dataType.includes('TIME')) return '📅';
    return '📊';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-primary-500" />
            <h3 className="text-xl font-semibold text-dark-900 dark:text-white">
              Import CSV Data
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${step === 'upload' ? 'text-primary-600' : 'text-dark-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'upload' ? 'bg-primary-100 text-primary-600' : 'bg-dark-100 text-dark-400'
              }`}>
                1
              </div>
              <span className="text-sm font-medium">Upload CSV</span>
            </div>
            <div className={`w-8 h-0.5 ${step === 'mapping' || step === 'preview' ? 'bg-primary-200' : 'bg-dark-200'}`} />
            <div className={`flex items-center space-x-2 ${step === 'mapping' ? 'text-primary-600' : step === 'preview' ? 'text-primary-600' : 'text-dark-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'mapping' || step === 'preview' ? 'bg-primary-100 text-primary-600' : 'bg-dark-100 text-dark-400'
              }`}>
                2
              </div>
              <span className="text-sm font-medium">Map Columns</span>
            </div>
            <div className={`w-8 h-0.5 ${step === 'preview' ? 'bg-primary-200' : 'bg-dark-200'}`} />
            <div className={`flex items-center space-x-2 ${step === 'preview' ? 'text-primary-600' : 'text-dark-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'preview' ? 'bg-primary-100 text-primary-600' : 'bg-dark-100 text-dark-400'
              }`}>
                3
              </div>
              <span className="text-sm font-medium">Preview & Import</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="text-center">
                <Upload className="w-16 h-16 text-primary-500 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
                  Select CSV File
                </h4>
                <p className="text-dark-600 dark:text-dark-300 mb-6">
                  Choose a CSV file to import data into your table
                </p>
              </div>

              <div className="border-2 border-dashed border-primary-300 dark:border-primary-600 rounded-lg p-8 text-center hover:border-primary-400 dark:hover:border-primary-500 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                >
                  Click to browse files
                </button>
                <p className="text-sm text-dark-500 dark:text-dark-400 mt-2">
                  or drag and drop your CSV file here
                </p>
              </div>

              {csvFile && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-800 dark:text-green-200 font-medium">
                      File selected: {csvFile.name}
                    </span>
                  </div>
                </div>
              )}

              {importError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-800 dark:text-red-200">
                      {importError}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'mapping' && csvData && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
                  Map CSV Columns to Table Columns
                </h4>
                <p className="text-dark-600 dark:text-dark-300">
                  Match your CSV columns with the table columns
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h5 className="font-medium text-dark-900 dark:text-white mb-3">CSV Columns</h5>
                  <div className="space-y-2">
                    {csvData.headers.map((header, index) => (
                      <div key={index} className="flex items-center space-x-2 p-2 bg-dark-50 dark:bg-dark-700 rounded">
                        <span className="text-sm font-medium text-dark-700 dark:text-dark-300">
                          {header}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h5 className="font-medium text-dark-900 dark:text-white mb-3">Table Columns</h5>
                  <div className="space-y-2">
                    {csvData.headers.map((header, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <select
                          value={columnMapping[header] || ''}
                          onChange={(e) => handleColumnMapping(header, e.target.value)}
                          className="flex-1 px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value="">-- Skip this column --</option>
                          {tableColumns.map(col => (
                            <option key={col.column_name} value={col.column_name}>
                              {col.column_name} {getDataTypeIcon(col.data_type)} ({col.data_type})
                              {!col.is_nullable && ' *'}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h6 className="font-medium text-red-800 dark:text-red-200 mb-1">
                        Please fix the following errors:
                      </h6>
                      <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                        {errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && csvData && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
                  Preview Import Data
                </h4>
                <p className="text-dark-600 dark:text-dark-300">
                  Review the data that will be imported ({csvData.rows.length} rows)
                </p>
              </div>

              <div className="bg-dark-50 dark:bg-dark-700 rounded-lg p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-dark-200 dark:border-dark-600">
                        {Object.keys(csvData.preview[0] || {}).map((header, index) => (
                          <th key={index} className="text-left py-2 px-3 font-medium text-dark-700 dark:text-dark-300">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.preview.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-dark-200 dark:border-dark-600">
                          {Object.values(row).map((cell, cellIndex) => (
                            <td key={cellIndex} className="py-2 px-3 text-dark-600 dark:text-dark-300">
                              {String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvData.rows.length > 5 && (
                  <p className="text-sm text-dark-500 dark:text-dark-400 mt-2">
                    ... and {csvData.rows.length - 5} more rows
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-700">
          <div className="flex items-center space-x-2">
            {step === 'upload' && csvFile && (
              <AppButton
                variant="primary"
                onClick={() => setStep('mapping')}
                icon={<FileText className="w-4 h-4" />}
              >
                Next: Map Columns
              </AppButton>
            )}
            {step === 'mapping' && (
              <AppButton
                variant="primary"
                onClick={handleNext}
                disabled={errors.length > 0}
                icon={<CheckCircle className="w-4 h-4" />}
              >
                Next: Preview
              </AppButton>
            )}
            {step === 'preview' && (
              <AppButton
                variant="primary"
                onClick={handleImport}
                loading={loading}
                disabled={loading}
                icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              >
                {loading ? 'Importing...' : `Import ${csvData?.rows.length || 0} Rows`}
              </AppButton>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {step !== 'upload' && (
              <AppButton
                variant="secondary"
                onClick={() => setStep(step === 'preview' ? 'mapping' : 'upload')}
                disabled={loading}
              >
                Back
              </AppButton>
            )}
            <AppButton
              variant="secondary"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CsvImportModal;
