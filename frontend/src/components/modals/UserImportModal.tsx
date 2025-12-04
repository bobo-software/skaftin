import React, { useState, useRef } from 'react';
import { X, Upload, Users, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { AppButton } from '../ComponentsIndex';

interface UserImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (sqlContent: string, clearExisting: boolean) => Promise<void>;
  loading?: boolean;
}

const UserImportModal = ({
  isOpen,
  onClose,
  onImport,
  loading = false
}: UserImportModalProps) => {
  const [sqlFile, setSqlFile] = useState<File | null>(null);
  const [sqlContent, setSqlContent] = useState<string>('');
  const [clearExisting, setClearExisting] = useState(false);
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
      await onImport(sqlContent, clearExisting);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to import users');
    }
  };

  const handleClose = () => {
    setSqlFile(null);
    setSqlContent('');
    setClearExisting(false);
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
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Import Users</h3>
              <p className="text-sm text-dark-500 dark:text-dark-400">Import users from an SQL dump file</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-dark-600 dark:text-dark-300" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
                <button
                  onClick={() => setError('')}
                  className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Upload Method Selector */}
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => setUploadMethod('file')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                uploadMethod === 'file'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700'
              }`}
            >
              Upload File
            </button>
            <button
              onClick={() => setUploadMethod('paste')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                uploadMethod === 'paste'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700'
              }`}
            >
              Paste SQL
            </button>
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
                <Users className="w-12 h-12 text-primary-500 mx-auto mb-4" />
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
                <div className="bg-dark-50 dark:bg-dark-900 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark-900 dark:text-white truncate">
                        {sqlFile.name}
                      </p>
                      <p className="text-xs text-dark-500 dark:text-dark-400">
                        {(sqlFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Paste SQL */}
          {uploadMethod === 'paste' && (
            <div>
              <textarea
                value={sqlContent}
                onChange={handlePastedSqlChange}
                placeholder="Paste your SQL dump here..."
                className="w-full h-64 px-4 py-3 border border-dark-300 dark:border-dark-600 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-dark-700 dark:text-white resize-none"
                disabled={loading}
              />
            </div>
          )}

          {/* Clear Existing Option */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <label className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearExisting}
                    onChange={(e) => setClearExisting(e.target.checked)}
                    disabled={loading}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 focus:ring-offset-0 mt-0.5"
                  />
                  <div>
                    <span className="font-medium text-amber-900 dark:text-amber-200">
                      Clear existing user data before import
                    </span>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      This will delete all existing users, roles, and authentication data before importing. Use with caution!
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-700 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <AppButton
              variant="primary"
              onClick={handleImport}
              loading={loading}
              disabled={loading || !sqlContent || sqlContent.trim().length === 0}
              icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            >
              {loading ? 'Importing...' : 'Import Users'}
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

export default UserImportModal;

