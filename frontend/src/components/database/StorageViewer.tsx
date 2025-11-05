import React, { useState, useEffect, useCallback } from 'react';
import { 
  Download, 
  Trash2, 
  File, 
  Folder, 
  RefreshCw,
  Search,
  FolderPlus,
  Upload,
  ChevronRight,
  Home,
  Edit2,
  FolderMinus
} from 'lucide-react';
import { AppButton, AppInput, DeleteConfirmModal } from '../ComponentsIndex';
import StorageService from '../../services/StorageService';
import ToastUtils from '../../utils/ToastUtils';

interface StorageViewerProps {
  projectId: string;
  onStorageChange?: () => void;
}

interface FileItem {
  key: string;
  name: string;
  size?: number;
  lastModified?: string;
  isFolder?: boolean;
}

const StorageViewer: React.FC<StorageViewerProps> = ({ 
  projectId, 
  onStorageChange 
}) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [folderToRename, setFolderToRename] = useState<string | null>(null);
  const [newFolderNameForRename, setNewFolderNameForRename] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());

  // Load files for current path
  const loadFiles = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const result = await StorageService.listFiles(projectId, currentPath || undefined);
      
      if (result.success && result.data) {
        const filesData = result.data.files || result.data || [];
        
        // Process files to identify folders and files
        const processedFiles = processFilesForCurrentPath(filesData, currentPath);
        setFiles(processedFiles);
      } else {
        setFiles([]);
        if (result.error) {
          ToastUtils.error(result.message || 'Failed to load files');
        }
      }
    } catch (error) {
      console.error('Error loading files:', error);
      setFiles([]);
      ToastUtils.error('Error loading files');
    } finally {
      setLoading(false);
    }
  }, [projectId, currentPath]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Process files to show only items in current folder
  const processFilesForCurrentPath = (allFiles: any[], path: string): FileItem[] => {
    const prefix = path ? `${path}/` : '';
    const items: FileItem[] = [];
    const folders = new Set<string>();

    allFiles.forEach((file: any) => {
      const key = file.key || file.name || '';
      
      // Skip if not in current path
      if (path && !key.startsWith(prefix)) return;
      
      // Get the relative path from current location
      const relativePath = path ? key.substring(prefix.length) : key;
      
      // If it contains a slash, extract folder name
      if (relativePath.includes('/')) {
        const folderName = relativePath.substring(0, relativePath.indexOf('/'));
        const fullFolderPath = path ? `${path}/${folderName}` : folderName;
        
        if (!folders.has(fullFolderPath)) {
          folders.add(fullFolderPath);
          items.push({
            key: fullFolderPath,
            name: folderName,
            isFolder: true
          });
        }
        return; // Don't process the file/marker itself
      }
      
      // Skip folder markers at current level
      if (relativePath === '.folder') return;
      
      // It's a file in the current directory
      items.push({
        key: key,
        name: relativePath,
        size: file.size,
        lastModified: file.lastModified,
        isFolder: false
      });
    });

    // Sort: folders first, then files alphabetically
    return items.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  // Filter files based on search
  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Navigate to a folder
  const handleFolderClick = (folderPath: string) => {
    setCurrentPath(folderPath);
    setSelectedFiles(new Set());
  };

  // Navigate to parent folder
  const handleGoUp = () => {
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
    setSelectedFiles(new Set());
  };

  // Navigate to specific breadcrumb
  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentPath('');
    } else {
      const parts = currentPath.split('/');
      setCurrentPath(parts.slice(0, index + 1).join('/'));
    }
    setSelectedFiles(new Set());
  };

  // Get breadcrumb parts
  const breadcrumbs = currentPath ? currentPath.split('/') : [];

  const handleFileSelect = (filePath: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath);
    } else {
      newSelected.add(filePath);
    }
    setSelectedFiles(newSelected);
  };

  const handleDownload = async (filePath: string) => {
    try {
      ToastUtils.info('Generating download link...');
      const result = await StorageService.downloadFile(projectId, filePath);
      
      if (result.success && result.data?.url) {
        window.open(result.data.url, '_blank');
        ToastUtils.success('Download started');
      } else {
        ToastUtils.error(result.message || 'Failed to download file');
      }
    } catch {
      ToastUtils.error('Error downloading file');
    }
  };

  const handleDelete = async (filePath: string) => {
    try {
      const result = await StorageService.deleteFile(projectId, filePath);
      
      if (result.success) {
        ToastUtils.success('File deleted successfully');
        loadFiles();
        onStorageChange?.();
      } else {
        ToastUtils.error(result.message || 'Failed to delete file');
      }
    } catch {
      ToastUtils.error('Error deleting file');
    } finally {
      setShowDeleteModal(false);
      setFileToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return;
    
    try {
      const deletePromises = Array.from(selectedFiles).map(filePath =>
        StorageService.deleteFile(projectId, filePath)
      );
      
      await Promise.all(deletePromises);
      ToastUtils.success(`Deleted ${selectedFiles.size} file(s)`);
      setSelectedFiles(new Set());
      loadFiles();
      onStorageChange?.();
    } catch {
      ToastUtils.error('Error deleting files');
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;
    
    try {
      const result = await StorageService.deleteFolder(projectId, folderToDelete);
      
      if (result.success) {
        ToastUtils.success('Folder deleted successfully');
        loadFiles();
        onStorageChange?.();
      } else {
        ToastUtils.error(result.message || 'Failed to delete folder');
      }
    } catch {
      ToastUtils.error('Error deleting folder');
    } finally {
      setShowDeleteModal(false);
      setFolderToDelete(null);
    }
  };

  const handleRenameFolder = async () => {
    if (!folderToRename || !newFolderNameForRename.trim()) {
      ToastUtils.error('New folder name is required');
      return;
    }

    try {
      // Calculate new path
      const pathParts = folderToRename.split('/');
      pathParts[pathParts.length - 1] = newFolderNameForRename.trim();
      const newPath = pathParts.join('/');
      
      const result = await StorageService.renameFolder(projectId, folderToRename, newPath);
      
      if (result.success) {
        ToastUtils.success('Folder renamed successfully');
        setNewFolderNameForRename('');
        setFolderToRename(null);
        setShowRenameFolderModal(false);
        loadFiles();
        onStorageChange?.();
      } else {
        ToastUtils.error(result.message || 'Failed to rename folder');
      }
    } catch {
      ToastUtils.error('Error renaming folder');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      ToastUtils.error('Folder name is required');
      return;
    }

    try {
      const folderPath = currentPath 
        ? `${currentPath}/${newFolderName.trim()}`
        : newFolderName.trim();
      
      const result = await StorageService.createFolder(projectId, folderPath);
      
      if (result.success) {
        ToastUtils.success('Folder created successfully');
        setNewFolderName('');
        setShowCreateFolderModal(false);
        loadFiles();
        onStorageChange?.();
      } else {
        ToastUtils.error(result.message || 'Failed to create folder');
      }
    } catch {
      ToastUtils.error('Error creating folder');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newUploading = new Set(uploadingFiles);
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileName = file.name;
      const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
      
      newUploading.add(fileName);
      setUploadingFiles(new Set(newUploading));

      try {
        const result = await StorageService.uploadFile(projectId, filePath, file);
        
        if (result.success) {
          ToastUtils.success(`${fileName} uploaded successfully`);
        } else {
          ToastUtils.error(`Failed to upload ${fileName}`);
        }
      } catch {
        ToastUtils.error(`Error uploading ${fileName}`);
      } finally {
        newUploading.delete(fileName);
        setUploadingFiles(new Set(newUploading));
      }
    }

    loadFiles();
    onStorageChange?.();
    setShowUploadModal(false);
    event.target.value = '';
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Storage Browser
          </h2>
          <div className="flex items-center gap-2">
            <AppButton
              variant="secondary"
              size="sm"
              onClick={loadFiles}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </AppButton>
            <AppButton
              variant="primary"
              size="sm"
              onClick={() => setShowCreateFolderModal(true)}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </AppButton>
            <AppButton
              variant="primary"
              size="sm"
              onClick={() => setShowUploadModal(true)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </AppButton>
            {selectedFiles.size > 0 && (
              <AppButton
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedFiles.size})
              </AppButton>
            )}
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 mb-3 text-sm">
          <button
            onClick={() => handleBreadcrumbClick(-1)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <Home className="h-4 w-4" />
            <span>Root</span>
          </button>
          {breadcrumbs.map((part, index) => (
            <React.Fragment key={index}>
              <ChevronRight className="h-4 w-4 text-gray-400" />
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                {part}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <AppInput
            type="text"
            placeholder="Search files and folders..."
            value={searchTerm}
            onChange={(value) => setSearchTerm(String(value))}
            className="pl-10"
          />
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <Folder className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">No files or folders</p>
            <p className="text-sm">Upload files or create a folder to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
              <tr>
                <th className="w-12 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedFiles.size === filteredFiles.filter(f => !f.isFolder).length && filteredFiles.filter(f => !f.isFolder).length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFiles(new Set(filteredFiles.filter(f => !f.isFolder).map(f => f.key)));
                      } else {
                        setSelectedFiles(new Set());
                      }
                    }}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Modified
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {/* Parent folder link */}
              {currentPath && (
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                  <td className="px-4 py-3"></td>
                  <td 
                    className="px-4 py-3"
                    onClick={handleGoUp}
                  >
                    <div className="flex items-center gap-2">
                      <Folder className="h-5 w-5 text-blue-500" />
                      <span className="text-gray-900 dark:text-white font-medium">..</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">-</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">-</td>
                  <td className="px-4 py-3"></td>
                </tr>
              )}
              
              {/* Files and folders */}
              {filteredFiles.map((file) => (
                <tr 
                  key={file.key}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    {!file.isFolder && (
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.key)}
                        onChange={() => handleFileSelect(file.key)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    )}
                  </td>
                  <td 
                    className="px-4 py-3"
                    onClick={() => file.isFolder ? handleFolderClick(file.key) : null}
                  >
                    <div className="flex items-center gap-2">
                      {file.isFolder ? (
                        <Folder className="h-5 w-5 text-blue-500" />
                      ) : (
                        <File className="h-5 w-5 text-gray-400" />
                      )}
                      <span className="text-gray-900 dark:text-white">
                        {file.name}
                        {uploadingFiles.has(file.name) && (
                          <span className="ml-2 text-xs text-blue-500">(uploading...)</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {file.isFolder ? '-' : formatFileSize(file.size)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {file.isFolder ? '-' : formatDate(file.lastModified)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {file.isFolder ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolderToRename(file.key);
                              setNewFolderNameForRename(file.name);
                              setShowRenameFolderModal(true);
                            }}
                            className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/20"
                            title="Rename Folder"
                          >
                            <Edit2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolderToDelete(file.key);
                              setShowDeleteModal(true);
                            }}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20"
                            title="Delete Folder"
                          >
                            <FolderMinus className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file.key);
                            }}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                            title="Download"
                          >
                            <Download className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFileToDelete(file.key);
                              setShowDeleteModal(true);
                            }}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Create New Folder
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {currentPath ? `Location: ${currentPath}/` : 'Location: Root'}
            </p>
            <AppInput
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(value) => setNewFolderName(String(value))}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <AppButton
                variant="secondary"
                onClick={() => {
                  setShowCreateFolderModal(false);
                  setNewFolderName('');
                }}
              >
                Cancel
              </AppButton>
              <AppButton
                variant="primary"
                onClick={handleCreateFolder}
              >
                Create
              </AppButton>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Upload Files
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {currentPath ? `Uploading to: ${currentPath}/` : 'Uploading to: Root'}
            </p>
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                dark:file:bg-blue-900/20 dark:file:text-blue-400
                dark:hover:file:bg-blue-900/30
                mb-4"
            />
            <div className="flex justify-end gap-2">
              <AppButton
                variant="secondary"
                onClick={() => setShowUploadModal(false)}
              >
                Cancel
              </AppButton>
            </div>
          </div>
        </div>
      )}

      {/* Rename Folder Modal */}
      {showRenameFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Rename Folder
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Current name: {folderToRename?.split('/').pop()}
            </p>
            <AppInput
              type="text"
              placeholder="New folder name"
              value={newFolderNameForRename}
              onChange={(value) => setNewFolderNameForRename(String(value))}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <AppButton
                variant="secondary"
                onClick={() => {
                  setShowRenameFolderModal(false);
                  setFolderToRename(null);
                  setNewFolderNameForRename('');
                }}
              >
                Cancel
              </AppButton>
              <AppButton
                variant="primary"
                onClick={handleRenameFolder}
              >
                Rename
              </AppButton>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setFileToDelete(null);
            setFolderToDelete(null);
          }}
          onConfirm={() => {
            if (folderToDelete) {
              handleDeleteFolder();
            } else if (fileToDelete) {
              handleDelete(fileToDelete);
            } else if (selectedFiles.size > 0) {
              handleBulkDelete();
            }
          }}
          title={
            folderToDelete ? 'Delete Folder' : 
            fileToDelete ? 'Delete File' : 
            'Delete Files'
          }
          message={
            folderToDelete
              ? `Are you sure you want to delete the folder "${folderToDelete}" and all its contents?`
              : fileToDelete
              ? `Are you sure you want to delete "${fileToDelete}"?`
              : `Are you sure you want to delete ${selectedFiles.size} selected file(s)?`
          }
        />
      )}
    </div>
  );
};

export default StorageViewer;
