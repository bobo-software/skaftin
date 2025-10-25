import { useEffect, useState, useCallback, useRef } from 'react';
import { useProjectStore } from '../../../../stores/StoresIndex';
import McpService from '../../../../services/McpService';
import { 
  Cloud, 
  Plus,
  Trash2,
  Folder,
  FolderPlus,
  Upload,
  Download,
  File,
  MoreHorizontal,
  Edit,
  Copy,
  Move
} from 'lucide-react';

const ProjectStorageTab = () => {
  
  const { currentProject, setCurrentProject } = useProjectStore();
  
  // Temporary: Set a project if none is selected
  useEffect(() => {
    if (!currentProject) {
      const testProject = {
        id: 'b76224c8-2f0b-488c-ae7e-ed194585dce0',
        name: 'vMelodic',
        description: 'Test Project',
        schema_name: 'project_vmelodic',
        bucket_name: 'project-vmelodic',
        created_at: '2025-10-25T09:01:53.091Z',
        updated_at: '2025-10-25T09:01:53.091Z',
        user_id: '550e8400-e29b-41d4-a716-446655440000'
      };
      setCurrentProject(testProject);
    }
  }, [currentProject, setCurrentProject]);
  
  const projectToUse = currentProject;
  
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isLoadingRef = useRef(false);
  
  // File explorer state
  const [currentPath, setCurrentPath] = useState('Root');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showFileMenu, setShowFileMenu] = useState<string | null>(null);
  const [pathHistory, setPathHistory] = useState<string[]>(['Root']);

  const loadFiles = useCallback(async () => {
    
    // Prevent multiple simultaneous requests
    if (isLoadingRef.current) {
      return;
    }
    
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      const prefix = currentPath === 'Root' ? '' : currentPath + '/';
      console.log('🔍 Loading files for path:', currentPath, 'with prefix:', prefix);
      const response = await McpService.listFiles(projectToUse.id, prefix);
      
      if (response.success && response.result.success) {
        const files = response.result.data || [];
        // Filter out .folder marker files only when we're inside a folder
        const filteredFiles = currentPath === 'Root' 
          ? files 
          : files.filter(file => !file.name.endsWith('/.folder'));
        console.log('📁 Files loaded for', currentPath + ':', filteredFiles.map(f => f.name));
        setFiles(filteredFiles);
      } else {
        console.log('❌ Failed to load files:', response);
        setFiles([]);
      }
    } catch {
      setFiles([]);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [projectToUse.id, currentPath]); // Depend on both project ID and current path

  // File operations
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      // Create a folder by uploading an empty file with folder path
      const folderPath = currentPath === 'Root' 
        ? `${newFolderName}/.folder` 
        : `${currentPath}/${newFolderName}/.folder`;
      
      console.log('ProjectStorageTab: Creating folder:', folderPath, 'in path:', currentPath);
      const response = await McpService.uploadFile(
        projectToUse.id,
        folderPath,
        '', // Empty content for folder marker
        'application/x-directory'
      );
      
      if (response.success) {
        console.log('Folder created successfully');
        setNewFolderName('');
        setShowCreateFolder(false);
        loadFiles(); // Refresh the file list
      } else {
        console.error('Failed to create folder:', response.error);
        alert('Failed to create folder');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Error creating folder');
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const base64 = await fileToBase64(file);
      // Use current path as prefix for the file name
      const filePath = currentPath === 'Root' ? file.name : `${currentPath}/${file.name}`;
      
      console.log('ProjectStorageTab: Uploading file:', filePath, 'to path:', currentPath);
      const response = await McpService.uploadFile(
        projectToUse.id,
        filePath,
        base64,
        file.type
      );
      
      if (response.success) {
        loadFiles(); // Refresh the file list
      } else {
        console.error('Failed to upload file:', response.error);
        alert('Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file');
    }
  };

  const handleFileDownload = async (fileName: string) => {
    try {
      const response = await McpService.downloadFile(projectToUse.id, fileName);
      if (response.success) {
        // Create blob and download
        const blob = new Blob([response.data], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.split('/').pop() || fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to download file');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error downloading file');
    }
  };

  const handleFileDelete = async (fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;
    
    try {
      const response = await McpService.deleteFile(projectToUse.id, fileName);
      if (response.success) {
        console.log('File deleted successfully');
        loadFiles(); // Refresh the file list
      } else {
        alert('Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Error deleting file');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('/')) {
      return <Folder className="w-5 h-5 text-blue-500" />;
    }
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension || '')) {
      return <File className="w-5 h-5 text-green-500" />;
    } else if (['pdf'].includes(extension || '')) {
      return <File className="w-5 h-5 text-red-500" />;
    } else if (['txt', 'md', 'json', 'csv', 'js', 'ts', 'html', 'css'].includes(extension || '')) {
      return <File className="w-5 h-5 text-yellow-500" />;
    } else {
      return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Folder navigation functions
  const navigateToFolder = (folderName: string) => {
    const newPath = currentPath === 'Root' ? folderName : `${currentPath}/${folderName}`;
    console.log('📂 Navigating to folder:', folderName, 'from', currentPath, '→', newPath);
    setCurrentPath(newPath);
    setPathHistory(prev => [...prev, currentPath]);
    setSelectedFiles(new Set()); // Clear selection when navigating
    // loadFiles will be called automatically due to currentPath dependency
  };

  const navigateBack = () => {
    if (pathHistory.length > 0) {
      const newHistory = [...pathHistory];
      const previousPath = newHistory.pop(); // Get and remove the last path
      setPathHistory(newHistory);
      setCurrentPath(previousPath || 'Root');
      setSelectedFiles(new Set()); // Clear selection when navigating
      // loadFiles will be called automatically due to currentPath dependency
    }
  };

  const navigateToPath = (path: string) => {
    setCurrentPath(path);
    setPathHistory(prev => [...prev, path]);
    setSelectedFiles(new Set());
    // loadFiles will be called automatically due to currentPath dependency
  };

  const getBreadcrumbPaths = () => {
    if (currentPath === 'Root') {
      return [{ name: 'Root', path: 'Root' }];
    }
    
    const paths = currentPath.split('/');
    const breadcrumbs = [{ name: 'Root', path: 'Root' }];
    
    let currentBreadcrumbPath = '';
    paths.forEach((segment, index) => {
      if (index === 0) {
        currentBreadcrumbPath = segment;
      } else {
        currentBreadcrumbPath += '/' + segment;
      }
      breadcrumbs.push({
        name: segment,
        path: currentBreadcrumbPath
      });
    });
    
    return breadcrumbs;
  };


  // Group files by folder for better display
  const groupFilesByFolder = (files: any[]) => {
    const folders: { [key: string]: any[] } = {};
    const rootFiles: any[] = [];

    console.log('🗂️ Grouping files for path:', currentPath, 'with', files.length, 'files');

    files.forEach(file => {
      if (file.name.includes('/')) {
        if (currentPath === 'Root') {
          // In root: group by first-level folders
          const folderName = file.name.split('/')[0];
          if (!folders[folderName]) {
            folders[folderName] = [];
          }
          folders[folderName].push(file);
          console.log('📁 Added folder:', folderName);
        } else {
          // Inside a folder: check if this is a subfolder or direct file
          const pathPrefix = currentPath + '/';
          if (file.name.startsWith(pathPrefix)) {
            const remainingPath = file.name.substring(pathPrefix.length);
            const pathParts = remainingPath.split('/');
            
            if (pathParts.length > 1) {
              // This is a subfolder
              const subfolderName = pathParts[0];
              if (!folders[subfolderName]) {
                folders[subfolderName] = [];
              }
              folders[subfolderName].push(file);
              console.log('📁 Added subfolder:', subfolderName);
            } else {
              // This is a direct file in current folder
              rootFiles.push(file);
              console.log('📄 Added direct file:', file.name);
            }
          } else {
            // File doesn't match current path
            rootFiles.push(file);
            console.log('📄 Added unmatched file:', file.name);
          }
        }
      } else {
        rootFiles.push(file);
        console.log('📄 Added root file:', file.name);
      }
    });

    const folderNames = Object.keys(folders);
    console.log('🎯 Final result - Folders:', folderNames, 'Files:', rootFiles.length);
    if (folderNames.length > 0) {
      console.log('📂 Folders being rendered:', folderNames);
    }
    
    return { folders, rootFiles };
  };

  // Get display name for files (strip folder prefix when inside a folder)
  const getDisplayName = (fileName: string) => {
    if (currentPath === 'Root') {
      return fileName;
    }
    
    // If we're inside a folder, strip the folder prefix
    const pathParts = currentPath.split('/');
    const currentFolder = pathParts[pathParts.length - 1];
    
    if (fileName.startsWith(currentFolder + '/')) {
      const displayName = fileName.substring(currentFolder.length + 1);
      return displayName;
    }
    
    return fileName;
  };

  useEffect(() => {
    if (projectToUse?.id) {
      loadFiles();
    } else {
      console.log('ProjectStorageTab: No project available, setting loading to false');
      setIsLoading(false);
    }
  }, [projectToUse?.id, loadFiles]); // Only depend on project ID and loadFiles

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb and actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-900 dark:text-white">Storage</h2>
          <div className="flex items-center space-x-2 text-sm text-dark-600 dark:text-dark-300 mt-1">
            <span>Path:</span>
            <div className="flex items-center space-x-1">
              {getBreadcrumbPaths().map((breadcrumb, index) => (
                <div key={index} className="flex items-center">
                  {index > 0 && <span className="mx-1">/</span>}
                  <button
                    onClick={() => navigateToPath(breadcrumb.path)}
                    className={`px-2 py-1 rounded transition-colors ${
                      breadcrumb.path === currentPath
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                        : 'hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-700 dark:text-dark-300'
                    }`}
                  >
                    {breadcrumb.name}
                  </button>
                </div>
              ))}
            </div>
            {pathHistory.length > 1 && (
              <button
                onClick={navigateBack}
                className="ml-2 px-2 py-1 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 rounded transition-colors"
                title="Go back"
              >
                ← Back
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        {!projectToUse ? (
          <div className="text-center py-12">
            <Cloud className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">No Project Selected</h3>
            <p className="text-dark-600 dark:text-dark-300">Please select a project to view its storage</p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-dark-600 dark:text-dark-300">Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12">
            <Cloud className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">No Files Uploaded</h3>
            <p className="text-dark-600 dark:text-dark-300 mb-6">Upload your first file to get started</p>
            <button className="btn-primary">
              <Plus className="w-5 h-5 mr-2" />
              Upload File
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center justify-between space-x-3">
                <h3 className="text-sm font-semibold text-dark-900 dark:text-white">
                  Files ({files.length})
                </h3>
              </div>
                <div className="flex items-center justify-end space-x-2">
                  <button 
                    onClick={() => setShowCreateFolder(true)}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-dark-100 dark:bg-dark-700 text-dark-700 dark:text-dark-300 rounded hover:bg-dark-200 dark:hover:bg-dark-600 transition-colors"
                  >
                    <FolderPlus className="w-3 h-3" />
                    <span>New Folder</span>
                  </button>
                  <button 
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload</span>
                  </button>

                </div>
              {selectedFiles.size > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-dark-600 dark:text-dark-300">
                    {selectedFiles.size} selected
                  </span>
                  <button 
                    onClick={() => setSelectedFiles(new Set())}
                    className="text-sm text-dark-500 hover:text-dark-700 dark:hover:text-dark-300"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            
            {(() => {
              const { folders, rootFiles } = groupFilesByFolder(files);
              const allItems: any[] = [];
              
              // Add folders first
              Object.keys(folders).forEach(folderName => {
                allItems.push({
                  type: 'folder',
                  name: folderName,
                  files: folders[folderName],
                  totalSize: folders[folderName].reduce((sum, file) => sum + (file.size || 0), 0),
                  lastModified: Math.max(...folders[folderName].map(f => new Date(f.lastModified || 0).getTime()))
                });
              });
              
              // Add root files
              rootFiles.forEach(file => {
                allItems.push({
                  type: 'file',
                  name: file.name,
                  ...file
                });
              });
              
              return (
                <>
                  {allItems.map((item, index) => {
                const isFileFolder = item.type === 'folder';
                const displayName = isFileFolder ? item.name : getDisplayName(item.name);
                
                return (
                  <div 
                    key={index} 
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      selectedFiles.has(item.name) 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' 
                        : 'bg-dark-50 dark:bg-dark-700 hover:bg-dark-100 dark:hover:bg-dark-600'
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(item.name)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedFiles);
                          if (e.target.checked) {
                            newSelected.add(item.name);
                          } else {
                            newSelected.delete(item.name);
                          }
                          setSelectedFiles(newSelected);
                        }}
                        className="rounded border-dark-300 dark:border-dark-600"
                      />
                      
                      {isFileFolder ? (
                        <Folder className="w-5 h-5 text-blue-500" />
                      ) : (
                        getFileIcon(item.name)
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          {isFileFolder ? (
                            <button
                              onClick={() => navigateToFolder(displayName)}
                              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 truncate text-left"
                            >
                              {displayName}
                            </button>
                          ) : (
                            <span className="font-medium text-dark-900 dark:text-white truncate">
                              {displayName}
                            </span>
                          )}
                          {isFileFolder && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                              Folder ({item.files.length} files)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-dark-500 dark:text-dark-400">
                          <span>{formatFileSize(item.totalSize || item.size || 0)}</span>
                          <span>{new Date(item.lastModified || item.lastModified || new Date()).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                
                <div className="flex items-center space-x-1 ml-4">
                  {!isFileFolder && (
                    <button
                      onClick={() => handleFileDownload(item.name)}
                      className="p-1 text-dark-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  
                  <div className="relative">
                    <button
                      onClick={() => setShowFileMenu(showFileMenu === item.name ? null : item.name)}
                      className="p-1 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
                      title="More actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    
                    {showFileMenu === item.name && (
                      <div className="absolute right-0 top-8 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-lg z-10 min-w-32">
                        {isFileFolder ? (
                          <>
                            <button
                              onClick={() => {
                                setShowFileMenu(null);
                                navigateToFolder(displayName);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center space-x-2"
                            >
                              <Folder className="w-4 h-4" />
                              <span>Open Folder</span>
                            </button>
                            <hr className="border-dark-200 dark:border-dark-700" />
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setShowFileMenu(null);
                                handleFileDownload(item.name);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700 flex items-center space-x-2"
                            >
                              <Download className="w-4 h-4" />
                              <span>Download</span>
                            </button>
                            <hr className="border-dark-200 dark:border-dark-700" />
                          </>
                        )}
                        <button
                          onClick={() => {
                            setShowFileMenu(null);
                            // TODO: Implement rename
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700 flex items-center space-x-2"
                        >
                          <Edit className="w-4 h-4" />
                          <span>Rename</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowFileMenu(null);
                            // TODO: Implement copy
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700 flex items-center space-x-2"
                        >
                          <Copy className="w-4 h-4" />
                          <span>Copy</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowFileMenu(null);
                            // TODO: Implement move
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700 flex items-center space-x-2"
                        >
                          <Move className="w-4 h-4" />
                          <span>Move</span>
                        </button>
                        <hr className="border-dark-200 dark:border-dark-700" />
                        <button
                          onClick={() => {
                            setShowFileMenu(null);
                            handleFileDelete(item.name);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
                );
              })}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
                Create New Folder
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Enter folder name"
                    className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateFolder();
                      } else if (e.key === 'Escape') {
                        setShowCreateFolder(false);
                        setNewFolderName('');
                      }
                    }}
                  />
                </div>
                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowCreateFolder(false);
                      setNewFolderName('');
                    }}
                    className="px-4 py-2 text-dark-600 dark:text-dark-300 hover:text-dark-800 dark:hover:text-dark-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Folder
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
                Upload Files
              </h3>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-dark-300 dark:border-dark-600 rounded-lg p-8 text-center">
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
                    onChange={(e) => {
                      if (e.target.files) {
                        Array.from(e.target.files).forEach(handleFileUpload);
                        setShowUploadModal(false);
                      }
                    }}
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
                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 text-dark-600 dark:text-dark-300 hover:text-dark-800 dark:hover:text-dark-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectStorageTab;