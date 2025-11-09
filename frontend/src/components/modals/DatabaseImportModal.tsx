import React, { useState, useRef } from 'react';
import { X, Upload, Database, AlertCircle, CheckCircle, Loader2, FileText, AlertTriangle } from 'lucide-react';
import { AppButton } from '../ComponentsIndex';

interface DatabaseImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (sqlContent: string, dropExisting: boolean) => Promise<void>;
  loading?: boolean;
}

const DatabaseImportModal = ({
  isOpen,
  onClose,
  onImport,
  loading = false
}: DatabaseImportModalProps) => {
  const [sqlFile, setSqlFile] = useState<File | null>(null);
  const [sqlContent, setSqlContent] = useState<string>('');
  const [dropExisting, setDropExisting] = useState(false);
  const [error, setError] = useState<string>('');
  const [uploadMethod, setUploadMethod] = useState<'file' | 'paste'>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.sql') || file.type === 'text/plain' || file.type === 'application/sql') {
        setSqlFile(file);
        setError('');
        readSqlFile(file);
      } else {
        setError('Please select a valid SQL file (.sql)');
      }
    }
  };

  const readSqlFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (text.trim().length === 0) {
          setError('SQL file is empty');
          return;
        }
        setSqlContent(text);
        setError('');
      } catch (error) {
        setError('Error reading SQL file');
        console.error('File reading error:', error);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handlePastedSqlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    setSqlContent(content);
    setError('');
  };

  const handleImport = async () => {
    if (!sqlContent || sqlContent.trim().length === 0) {
      setError('Please provide SQL content to import');
      return;
    }

    try {
      await onImport(sqlContent, dropExisting);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to import database dump');
    }
  };

  const handleClose = () => {
    setSqlFile(null);
    setSqlContent('');
    setDropExisting(false);
    setError('');
    setUploadMethod('file');
    onClose();
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.sql') || file.type === 'text/plain' || file.type === 'application/sql') {
        setSqlFile(file);
        setError('');
        readSqlFile(file);
      } else {
        setError('Please select a valid SQL file (.sql)');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-3">
            <Database className="w-6 h-6 text-primary-500" />
            <h3 className="text-xl font-semibold text-dark-900 dark:text-white">
              Import PostgreSQL Database Dump
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

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="space-y-6">
            {/* Upload Method Selector */}
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
                Choose Import Method
              </label>
              <div className="flex space-x-4">
                <button
                  onClick={() => setUploadMethod('file')}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    uploadMethod === 'file'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-dark-200 dark:border-dark-700 hover:border-primary-300'
                  }`}
                  disabled={loading}
                >
                  <FileText className="w-6 h-6 mx-auto mb-2 text-primary-500" />
                  <p className="text-sm font-medium text-dark-900 dark:text-white">Upload SQL File</p>
                </button>
                <button
                  onClick={() => setUploadMethod('paste')}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    uploadMethod === 'paste'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-dark-200 dark:border-dark-700 hover:border-primary-300'
                  }`}
                  disabled={loading}
                >
                  <Upload className="w-6 h-6 mx-auto mb-2 text-primary-500" />
                  <p className="text-sm font-medium text-dark-900 dark:text-white">Paste SQL Content</p>
                </button>
              </div>
            </div>

            {/* File Upload */}
            {uploadMethod === 'file' && (
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-primary-300 dark:border-primary-600 rounded-lg p-8 text-center hover:border-primary-400 dark:hover:border-primary-500 transition-colors"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".sql,text/plain,application/sql"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Database className="w-12 h-12 text-primary-500 mx-auto mb-4" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                    disabled={loading}
                  >
                    Click to browse files
                  </button>
                  <p className="text-sm text-dark-500 dark:text-dark-400 mt-2">
                    or drag and drop your .sql file here
                  </p>
                  <p className="text-xs text-dark-400 dark:text-dark-500 mt-2">
                    Supported: .sql files (PostgreSQL dump format)
                  </p>
                </div>

                {sqlFile && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-800 dark:text-green-200 font-medium">
                        File selected: {sqlFile.name}
                      </span>
                      <span className="text-sm text-green-600 dark:text-green-300">
                        ({(sqlFile.size / 1024).toFixed(2)} KB)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Paste SQL Content */}
            {uploadMethod === 'paste' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300">
                  SQL Content
                </label>
                <textarea
                  value={sqlContent}
                  onChange={handlePastedSqlChange}
                  placeholder="Paste your PostgreSQL dump SQL here..."
                  className="w-full h-64 px-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  disabled={loading}
                />
                <p className="text-xs text-dark-500 dark:text-dark-400">
                  Paste SQL statements from your PostgreSQL dump
                </p>
              </div>
            )}

            {/* Drop Existing Tables Option */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dropExisting}
                      onChange={(e) => setDropExisting(e.target.checked)}
                      className="w-4 h-4 text-primary-600 border-dark-300 rounded focus:ring-primary-500"
                      disabled={loading}
                    />
                    <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
                      Drop existing tables before importing
                    </span>
                  </label>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 ml-6">
                    Warning: This will permanently delete all existing tables in this schema before importing the dump.
                  </p>
                </div>
              </div>
            </div>

            {/* Information Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Import Information:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>SQL statements will be executed within the project schema</li>
                    <li>The import runs in a transaction (all or nothing)</li>
                    <li>Large dumps may take several minutes to process</li>
                    <li>Ensure your SQL dump is compatible with PostgreSQL</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-800 dark:text-red-200">
                    {error}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-700">
          <div className="flex items-center space-x-2">
            <AppButton
              variant="primary"
              onClick={handleImport}
              loading={loading}
              disabled={loading || !sqlContent || sqlContent.trim().length === 0}
              icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            >
              {loading ? 'Importing...' : 'Import Database Dump'}
            </AppButton>
          </div>
          
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
  );
};

export default DatabaseImportModal;

