import React, { useState, useCallback } from 'react';
import { Upload, X, File, AlertCircle, CheckCircle } from 'lucide-react';
import { AppButton } from '@components/ComponentsIndex';
// import McpService from '../../services/McpService';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  data: string; // base64 encoded
}

const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projectId
}) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: 'pending' | 'uploading' | 'success' | 'error' }>({});

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = async (fileList: File[]) => {
    const newFiles: UploadedFile[] = [];

    for (const file of fileList) {
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        newFiles.push({
          name: file.name,
          size: file.size,
          type: file.type,
          data: base64
        });
      } catch (error) {
        console.error('Error processing file:', error);
        alert(`Error processing file "${file.name}"`);
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix to get just the base64 string
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const newProgress: { [key: string]: 'pending' | 'uploading' | 'success' | 'error' } = {};
    files.forEach(file => {
      newProgress[file.name] = 'pending';
    });
    setUploadProgress(newProgress);

    try {
      // for (const file of files) {
      //   setUploadProgress(prev => ({ ...prev, [file.name]: 'uploading' }));

      //   const result = await McpService.uploadFile(
      //     projectId,
      //     file.name,
      //     file.data,
      //     file.type
      //   );

      //   if (result.success) {
      //     setUploadProgress(prev => ({ ...prev, [file.name]: 'success' }));
      //   } else {
      //     setUploadProgress(prev => ({ ...prev, [file.name]: 'error' }));
      //     console.error('Failed to upload file:', file.name, result.error);
      //   }
      // }

      // Check if all uploads were successful
      const allSuccessful = files.every(file => uploadProgress[file.name] === 'success');

      if (allSuccessful) {
        onSuccess();
        setFiles([]);
        setUploadProgress({});
      } else {
        alert('Some files failed to upload. Please try again.');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Error uploading files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(extension || '')) {
      return <File className="w-4 h-4 text-blue-500" />;
    } else if (['pdf'].includes(extension || '')) {
      return <File className="w-4 h-4 text-red-500" />;
    } else if (['txt', 'md', 'json', 'csv'].includes(extension || '')) {
      return <File className="w-4 h-4 text-green-500" />;
    } else {
      return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  const getProgressIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'uploading':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>;
      default:
        return <div className="w-4 h-4"></div>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
            Upload Files
          </h3>
          <button
            onClick={onClose}
            className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-dark-300 dark:border-dark-600 hover:border-primary-400'
              }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 text-dark-400 dark:text-dark-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-dark-900 dark:text-white mb-2">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-dark-600 dark:text-dark-300 mb-4">
              Maximum file size: 10MB per file
            </p>
            <input
              type="file"
              multiple
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer transition-colors"
            >
              <Upload className="w-4 h-4 mr-2" />
              Choose Files
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-dark-900 dark:text-white mb-3">
                Files to Upload ({files.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-700 rounded-lg"
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      {getFileIcon(file.name)}
                      <div className="ml-3 flex-1 min-w-0">
                        <p className="text-sm font-medium text-dark-900 dark:text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-dark-500 dark:text-dark-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-3">
                      {getProgressIcon(uploadProgress[file.name] || 'pending')}
                      <button
                        onClick={() => removeFile(index)}
                        className="text-dark-400 hover:text-red-600 dark:hover:text-red-400"
                        disabled={uploading}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-dark-200 dark:border-dark-700">
          <AppButton
            variant="secondary"
            onClick={onClose}
            disabled={uploading}
          >
            Cancel
          </AppButton>
          <AppButton
            variant="primary"
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
          >
            {uploading ? 'Uploading...' : `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`}
          </AppButton>
        </div>
      </div>
    </div>
  );
};

export default FileUploadModal;