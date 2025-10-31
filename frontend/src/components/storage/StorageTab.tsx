import { useState, useEffect } from 'react';
import { Cloud, Upload, Download, Trash2, RefreshCw, FileText, Image, File, Search } from 'lucide-react';
import { useAppStore } from '../../stores/state/StoresIndex';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';
import LoadingSpinner from '../elements/LoadingSpinner';
import ErrorMessage from '../elements/ErrorMessage';
import FileUploadModal from '../modals/FileUploadModal';

interface FileItem {
  key: string;
  size: number;
  lastModified?: string;
  etag?: string;
}

const StorageTab = () => {
  const { currentProject } = useAppStore();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    if (currentProject) {
      fetchFiles();
    }
  }, [currentProject]);

  const fetchFiles = async () => {
    if (!currentProject) return;

    setLoading(true);
    setError('');

    try {
      const result = await RequestUtils.get(ApiRoutes.FILES.LIST);

      if (result.success && result.data) {
        setFiles(Array.isArray(result.data) ? result.data : []);
      } else {
        setError(result.error || 'Failed to load files');
      }
    } catch (err) {
      setError('Failed to load files');
      console.error('Fetch files error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = async () => {
    if (!currentProject) return;
    await fetchFiles(); // Refresh file list
    setShowUploadModal(false);
  };

  const handleDownload = (fileName: string) => {
    if (!currentProject) return;

    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:4006'}${ApiRoutes.FILES.DOWNLOAD(fileName)}`;
    window.open(url, '_blank');
  };

  const handleDelete = async (fileName: string) => {
    if (!currentProject || !confirm(`Are you sure you want to delete ${fileName}?`)) return;

    setLoading(true);
    setError('');

    try {
      const result = await RequestUtils.delete(ApiRoutes.FILES.DELETE(fileName));

      if (result.success) {
        await fetchFiles(); // Refresh file list
      } else {
        setError(result.error || 'Failed to delete file');
      }
    } catch (err) {
      setError('Failed to delete file');
      console.error('Delete error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) {
      return <Image className="w-5 h-5" />;
    }
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) {
      return <FileText className="w-5 h-5" />;
    }
    return <File className="w-5 h-5" />;
  };

  const filteredFiles = files.filter((file) =>
    file.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-dark-200 dark:border-dark-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-dark-900 dark:text-white mb-1">Storage</h2>
            <p className="text-sm text-dark-600 dark:text-dark-400">
              Manage files and storage for {currentProject?.name}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchFiles}
              className="btn-secondary flex items-center space-x-2"
              disabled={loading}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <Upload className="w-5 h-5" />
              <span>Upload File</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
            <div className="text-sm text-primary-700 dark:text-primary-300 mb-1">Total Files</div>
            <div className="text-2xl font-bold text-primary-900 dark:text-primary-100">
              {files.length}
            </div>
          </div>
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
            <div className="text-sm text-primary-700 dark:text-primary-300 mb-1">Total Size</div>
            <div className="text-2xl font-bold text-primary-900 dark:text-primary-100">
              {formatFileSize(totalSize)}
            </div>
          </div>
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
            <div className="text-sm text-primary-700 dark:text-primary-300 mb-1">Bucket</div>
            <div className="text-sm font-semibold text-primary-900 dark:text-primary-100 truncate">
              {currentProject?.bucket_name || 'N/A'}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-10 pr-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && <ErrorMessage message={error} className="m-6" />}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading && files.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <LoadingSpinner />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700">
            <Cloud className="w-16 h-16 mx-auto mb-4 text-dark-400 dark:text-dark-500" />
            <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">
              {searchQuery ? 'No files found' : 'No files yet'}
            </h3>
            <p className="text-dark-600 dark:text-dark-400 mb-6 max-w-md mx-auto">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Upload your first file to get started with storage.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="btn-primary inline-flex items-center space-x-2"
              >
                <Upload className="w-5 h-5" />
                <span>Upload File</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-50 dark:bg-dark-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-dark-900 dark:text-white uppercase tracking-wider">
                      File
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-dark-900 dark:text-white uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-dark-900 dark:text-white uppercase tracking-wider">
                      Modified
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-dark-900 dark:text-white uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-200 dark:divide-dark-700">
                  {filteredFiles.map((file) => (
                    <tr
                      key={file.key}
                      className="hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="text-dark-600 dark:text-dark-400">
                            {getFileIcon(file.key)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-dark-900 dark:text-white">
                              {file.key}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-dark-600 dark:text-dark-400">
                        {formatFileSize(file.size || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-dark-600 dark:text-dark-400">
                        {file.lastModified
                          ? new Date(file.lastModified).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleDownload(file.key)}
                            className="text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(file.key)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && currentProject && (
        <FileUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={handleUploadSuccess}
          projectId={currentProject.id.toString()}
        />
      )}
    </div>
  );
};

export default StorageTab;

