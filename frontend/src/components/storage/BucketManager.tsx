import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Folder, X } from 'lucide-react';
import { AppButton, AppInput, ConfirmModal } from '../ComponentsIndex';
import BucketService from '../../services/BucketService';
import ToastUtils from '../../utils/ToastUtils';
import { ProjectBucket } from '../../types/Types';

interface BucketManagerProps {
  projectId: string;
  onBucketChange?: () => void;
}

const BucketManager: React.FC<BucketManagerProps> = ({ projectId, onBucketChange }) => {
  const [buckets, setBuckets] = useState<ProjectBucket[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<ProjectBucket | null>(null);
  const [bucketName, setBucketName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load buckets
  const loadBuckets = async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const result = await BucketService.listBuckets(projectId, true);
      
      if (result.success && result.data) {
        setBuckets(result.data);
      } else {
        setBuckets([]);
        if (result.error) {
          ToastUtils.error(result.message || 'Failed to load buckets');
        }
      }
    } catch (error) {
      console.error('Error loading buckets:', error);
      setBuckets([]);
      ToastUtils.error('Error loading buckets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuckets();
  }, [projectId]);

  // Create bucket
  const handleCreate = async () => {
    if (!bucketName.trim()) {
      ToastUtils.error('Bucket name is required');
      return;
    }

    // Validate bucket name format (S3 bucket naming rules)
    const bucketNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    if (!bucketNameRegex.test(bucketName.trim()) || bucketName.trim().length < 3 || bucketName.trim().length > 63) {
      ToastUtils.error('Bucket name must be 3-63 characters, lowercase alphanumeric with hyphens');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await BucketService.createBucket(projectId, bucketName.trim(), description.trim() || undefined);
      
      if (result.success) {
        ToastUtils.success('Bucket created successfully');
        setBucketName('');
        setDescription('');
        setShowCreateModal(false);
        loadBuckets();
        onBucketChange?.();
      } else {
        ToastUtils.error(result.message || 'Failed to create bucket');
      }
    } catch (error) {
      console.error('Error creating bucket:', error);
      ToastUtils.error('Error creating bucket');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit bucket
  const handleEdit = async () => {
    if (!selectedBucket) return;
    
    if (bucketName.trim() && bucketName.trim() !== selectedBucket.bucket_name) {
      // Validate bucket name format if changed
      const bucketNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
      if (!bucketNameRegex.test(bucketName.trim()) || bucketName.trim().length < 3 || bucketName.trim().length > 63) {
        ToastUtils.error('Bucket name must be 3-63 characters, lowercase alphanumeric with hyphens');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const result = await BucketService.updateBucket(
        projectId,
        selectedBucket.id,
        bucketName.trim() !== selectedBucket.bucket_name ? bucketName.trim() : undefined,
        description.trim() !== (selectedBucket.description || '') ? description.trim() || undefined : undefined
      );
      
      if (result.success) {
        ToastUtils.success('Bucket updated successfully');
        setBucketName('');
        setDescription('');
        setSelectedBucket(null);
        setShowEditModal(false);
        loadBuckets();
        onBucketChange?.();
      } else {
        ToastUtils.error(result.message || 'Failed to update bucket');
      }
    } catch (error) {
      console.error('Error updating bucket:', error);
      ToastUtils.error('Error updating bucket');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete bucket
  const handleDelete = async () => {
    if (!selectedBucket) return;

    setIsSubmitting(true);
    try {
      const result = await BucketService.deleteBucket(projectId, selectedBucket.id, false);
      
      if (result.success) {
        ToastUtils.success('Bucket deleted successfully');
        setSelectedBucket(null);
        setShowDeleteModal(false);
        loadBuckets();
        onBucketChange?.();
      } else {
        ToastUtils.error(result.message || 'Failed to delete bucket');
      }
    } catch (error) {
      console.error('Error deleting bucket:', error);
      ToastUtils.error('Error deleting bucket');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open create modal
  const openCreateModal = () => {
    setBucketName('');
    setDescription('');
    setShowCreateModal(true);
  };

  // Open edit modal
  const openEditModal = (bucket: ProjectBucket) => {
    setSelectedBucket(bucket);
    setBucketName(bucket.bucket_name);
    setDescription(bucket.description || '');
    setShowEditModal(true);
  };

  // Open delete modal
  const openDeleteModal = (bucket: ProjectBucket) => {
    setSelectedBucket(bucket);
    setShowDeleteModal(true);
  };

  if (loading && buckets.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading buckets...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Storage Buckets</h3>
        <AppButton
          onClick={openCreateModal}
          variant="primary"
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Bucket
        </AppButton>
      </div>

      {/* Empty state */}
      {buckets.length === 0 && !loading && (
        <div className="text-center py-12 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Folder className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            No buckets found. Create your first bucket to start storing files.
          </p>
          <AppButton onClick={openCreateModal} variant="primary" size="sm">
            Create Bucket
          </AppButton>
        </div>
      )}

      {/* Buckets list */}
      {buckets.length > 0 && (
        <div className="space-y-2">
          {buckets.map((bucket) => (
            <div
              key={bucket.id}
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Folder className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {bucket.bucket_name}
                    </div>
                    {bucket.description && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {bucket.description}
                      </div>
                    )}
                    {(bucket as any).fileCount !== undefined && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {(bucket as any).fileCount} files
                        {(bucket as any).totalSize !== undefined && (bucket as any).totalSize > 0 && (
                          <> • {formatBytes((bucket as any).totalSize)}</>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AppButton
                  onClick={() => openEditModal(bucket)}
                  variant="ghost"
                  size="sm"
                  className="p-2"
                >
                  <Edit2 className="w-4 h-4" />
                </AppButton>
                <AppButton
                  onClick={() => openDeleteModal(bucket)}
                  variant="ghost"
                  size="sm"
                  className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </AppButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create Bucket</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bucket Name *
                </label>
                <AppInput
                  type="text"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value.toLowerCase())}
                  placeholder="my-bucket-name"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  3-63 characters, lowercase alphanumeric with hyphens
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <AppInput
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Bucket description"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <AppButton
                onClick={() => setShowCreateModal(false)}
                variant="ghost"
                disabled={isSubmitting}
              >
                Cancel
              </AppButton>
              <AppButton
                onClick={handleCreate}
                variant="primary"
                disabled={isSubmitting || !bucketName.trim()}
              >
                {isSubmitting ? 'Creating...' : 'Create'}
              </AppButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedBucket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Bucket</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bucket Name *
                </label>
                <AppInput
                  type="text"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value.toLowerCase())}
                  placeholder="my-bucket-name"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  3-63 characters, lowercase alphanumeric with hyphens
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <AppInput
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Bucket description"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <AppButton
                onClick={() => setShowEditModal(false)}
                variant="ghost"
                disabled={isSubmitting}
              >
                Cancel
              </AppButton>
              <AppButton
                onClick={handleEdit}
                variant="primary"
                disabled={isSubmitting || !bucketName.trim()}
              >
                {isSubmitting ? 'Updating...' : 'Update'}
              </AppButton>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        heading="Delete Bucket"
        text={
          selectedBucket
            ? `Are you sure you want to delete "${selectedBucket.bucket_name}"? This action cannot be undone. If the bucket contains files, you'll need to delete them first or use force delete.`
            : ''
        }
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedBucket(null);
        }}
        onConfirm={handleDelete}
        variant="danger"
        confirmText="Delete"
        loading={isSubmitting}
      />
    </div>
  );
};

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export default BucketManager;

