import React, { useState, useEffect, useCallback } from 'react';
import { 
  Download, 
  Trash2, 
  File, 
  Folder, 
  RefreshCw,
  Plus,
  Search
} from 'lucide-react';
import { AppButton, AppInput, DeleteConfirmModal, FileUploadModal } from '../ComponentsIndex';
import McpService from '../../services/McpService';
import ToastUtils from '../../utils/ToastUtils';

interface StorageViewerProps {
  projectId: string;
  onStorageChange?: () => void;
}

const StorageViewer: React.FC<StorageViewerProps> = ({ 
  projectId, 
  onStorageChange 
}) => {
  console.log('StorageViewer mounted with projectId:', projectId);
  
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);

  // Load files when component mounts or project changes
  const loadFiles = useCallback(async () => {
    if (!projectId) {
      console.log('No projectId provided');
      return;
    }
    
    console.log('Loading files for projectId:', projectId);
    setLoading(true);
    
    try {
      const result = await McpService.listFiles(projectId);
      console.log('Full MCP response:', JSON.stringify(result, null, 2));
      
      if (result.success) {
        // Try multiple paths to find the files array
        let files = [];
        
        if (result.result?.data) {
          files = result.result.data;
          console.log('Found files in result.result.data:', files);
        } else if (result.data) {
          files = result.data;
          console.log('Found files in result.data:', files);
        } else if (result.result) {
          files = result.result;
          console.log('Found files in result.result:', files);
        }
        
        console.log('Final extracted files:', files);
        setFiles(Array.isArray(files) ? files : []);
      } else {
        console.error('MCP request failed:', result.error);
        setFiles([]);
      }
    } catch (error) {
      console.error('Error calling MCP service:', error);
      setFiles([]);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadFiles();
    
    // Fallback timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('Loading timeout reached, forcing loading to false');
        setLoading(false);
      }
    }, 10000); // 10 second timeout
    
    return () => clearTimeout(timeout);
  }, [loadFiles, loading]);

  // Filter files based on search and type
  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Determine file type from extension since contentType might not be available
    const extension = file.name.split('.').pop()?.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension || '');
    const isDocument = ['pdf', 'doc', 'docx', 'txt', 'md', 'json', 'csv'].includes(extension || '');
    
    const matchesType = filterType === 'all' || 
      (filterType === 'images' && isImage) ||
      (filterType === 'documents' && isDocument) ||
      (filterType === 'other' && !isImage && !isDocument);
    
    return matchesSearch && matchesType;
  });

  const handleFileSelect = (fileName: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileName)) {
      newSelected.delete(fileName);
    } else {
      newSelected.add(fileName);
    }
    setSelectedFiles(newSelected);
  };


  const handleDownload = async (fileName: string) => {
    try {
      const result = await McpService.downloadFile(projectId, fileName);
      if (result.success) {
        // Create a blob and download
        const blob = new Blob([result.data], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        ToastUtils.error('Failed to download file');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      ToastUtils.error('Error downloading file');
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    try {
      const result = await McpService.deleteFile(projectId, fileName);
      if (result.success) {
        console.log('File deleted successfully');
        await loadFiles();
        onStorageChange?.();
        ToastUtils.success('File deleted successfully!');
      } else {
        ToastUtils.error('Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      ToastUtils.error('Error deleting file');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const deletePromises = Array.from(selectedFiles).map(fileName => 
        McpService.deleteFile(projectId, fileName)
      );
      
      await Promise.all(deletePromises);
      console.log('Files deleted successfully');
      setSelectedFiles(new Set());
      await loadFiles();
      onStorageChange?.();
      ToastUtils.success(`${selectedFiles.size} file(s) deleted successfully!`);
    } catch (error) {
      console.error('Error deleting files:', error);
      ToastUtils.error('Error deleting files');
    }
  };

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    loadFiles();
    onStorageChange?.();
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension || '')) {
      return <File className="w-4 h-4 text-blue-500" />;
    } else if (['pdf'].includes(extension || '')) {
      return <File className="w-4 h-4 text-red-500" />;
    } else if (['txt', 'md', 'json', 'csv', 'js', 'ts', 'html', 'css'].includes(extension || '')) {
      return <File className="w-4 h-4 text-green-500" />;
    } else {
      return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-dark-800">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-dark-200 dark:border-dark-700">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-dark-900 dark:text-white">
                Storage
              </h2>
              <p className="text-sm text-dark-600 dark:text-dark-300 mt-1">
                Manage files and documents for this project
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <AppButton
                variant="secondary"
                size="sm"
                onClick={loadFiles}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </AppButton>
              <AppButton
                variant="primary"
                size="sm"
                onClick={() => setShowUploadModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Upload Files
              </AppButton>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 max-w-md">
              <AppInput
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(value) => setSearchTerm(value as string)}
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
            >
              <option value="all">All Files</option>
              <option value="images">Images</option>
              <option value="documents">Documents</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedFiles.size > 0 && (
        <div className="flex-shrink-0 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-800 dark:text-blue-300">
                {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center space-x-2">
                <AppButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedFiles(new Set())}
                >
                  Clear Selection
                </AppButton>
                <AppButton
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setBulkDelete(true);
                    setShowDeleteModal(true);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Files List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="w-12 h-12 text-dark-300 dark:text-dark-600 mx-auto mb-3" />
            <p className="text-dark-600 dark:text-dark-300">No files found</p>
            <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">
              Upload files to get started
            </p>
          </div>
        ) : (
          <div className="p-4">
            <div className="space-y-2">
              {filteredFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center p-3 bg-dark-50 dark:bg-dark-700 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-600 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(file.name)}
                    onChange={() => handleFileSelect(file.name)}
                    className="mr-3 rounded border-dark-300 dark:border-dark-600"
                  />
                  
                  <div className="flex items-center flex-1 min-w-0">
                    {getFileIcon(file.name)}
                    <div className="ml-3 flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark-900 dark:text-white truncate">
                        {file.name}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-dark-500 dark:text-dark-400">
                        <span>{formatFileSize(file.size || 0)}</span>
                        <span>{file.name.split('.').pop()?.toUpperCase() || 'FILE'}</span>
                        <span>{formatDate(file.lastModified || new Date().toISOString())}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 ml-4">
                    <button
                      onClick={() => handleDownload(file.name)}
                      className="p-1 text-dark-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setFileToDelete(file.name);
                        setBulkDelete(false);
                        setShowDeleteModal(true);
                      }}
                      className="p-1 text-dark-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <FileUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={handleUploadSuccess}
        projectId={projectId}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setFileToDelete(null);
          setBulkDelete(false);
        }}
        onConfirm={async () => {
          if (bulkDelete) {
            await handleBulkDelete();
          } else if (fileToDelete) {
            await handleDeleteFile(fileToDelete);
          }
          setShowDeleteModal(false);
          setFileToDelete(null);
          setBulkDelete(false);
        }}
        title={bulkDelete ? "Delete Selected Files" : "Delete File"}
        message={
          bulkDelete 
            ? `Are you sure you want to delete ${selectedFiles.size} selected files? This action cannot be undone.`
            : `Are you sure you want to delete "${fileToDelete}"? This action cannot be undone.`
        }
        variant="bulk"
      />
    </div>
  );
};

export default StorageViewer;