import React from 'react';
import { Trash2, X } from 'lucide-react';

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

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName = 'item',
  itemCount = 1,
  loading = false,
  variant = 'single',
}) => {
  if (!isOpen) return null;

  const isBulk = variant === 'bulk' || itemCount > 1;
  const defaultTitle = isBulk ? `Delete ${itemCount} ${itemName}s` : `Delete ${itemName}`;
  const defaultMessage = isBulk
    ? `Are you sure you want to delete ${itemCount} ${itemName}s? This action cannot be undone.`
    : `Are you sure you want to delete this ${itemName}? This action cannot be undone.`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-dark-900 dark:text-white">
              {title || defaultTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-dark-600 dark:text-dark-300 leading-relaxed">
            {message || defaultMessage}
          </p>

          {isBulk && (
            <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-xs text-red-700 dark:text-red-300">
                <span className="font-semibold">Warning:</span> {itemCount} {itemName}s will be permanently removed.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-900/40 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3.5 py-1.5 text-sm text-dark-600 dark:text-dark-300 hover:bg-dark-200 dark:hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-3.5 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                {isBulk ? `Delete ${itemCount}` : 'Delete'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
