import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { AppButton } from '../ComponentsIndex';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  itemName?: string;
  itemCount?: number;
  loading?: boolean;
  variant?: 'single' | 'bulk';
}

const DeleteConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName = 'item',
  itemCount = 1,
  loading = false,
  variant = 'single'
}: DeleteConfirmModalProps) => {
  if (!isOpen) return null;

  const isBulk = variant === 'bulk' || itemCount > 1;
  const defaultTitle = isBulk ? `Delete ${itemCount} ${itemName}s` : `Delete ${itemName}`;
  const defaultMessage = isBulk 
    ? `Are you sure you want to delete ${itemCount} ${itemName}s? This action cannot be undone.`
    : `Are you sure you want to delete this ${itemName}? This action cannot be undone.`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
                {title || defaultTitle}
              </h3>
              <p className="text-sm text-dark-600 dark:text-dark-300">
                {isBulk ? 'Multiple items selected' : 'Permanent action'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-dark-700 dark:text-dark-300 leading-relaxed">
                {message || defaultMessage}
              </p>
              
              {isBulk && (
                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    <strong>Warning:</strong> This will delete {itemCount} {itemName}s permanently. 
                    Make sure you have backed up any important data.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-700">
          <AppButton
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </AppButton>
          <AppButton
            variant="danger"
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
            icon={loading ? undefined : <Trash2 className="w-4 h-4" />}
          >
            {loading ? 'Deleting...' : isBulk ? `Delete ${itemCount} ${itemName}s` : `Delete ${itemName}`}
          </AppButton>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
