import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { AppButton } from '../ComponentsIndex';

interface ConfirmModalProps {
  isOpen: boolean;
  heading: string;
  text: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

/**
 * ConfirmModal - Reusable confirmation dialog
 * 
 * A simple, consistent confirmation modal for use across the application.
 * 
 * @example
 * ```tsx
 * <ConfirmModal
 *   isOpen={showConfirm}
 *   heading="Delete Item"
 *   text="Are you sure you want to delete this item? This action cannot be undone."
 *   onCancel={() => setShowConfirm(false)}
 *   onConfirm={handleDelete}
 *   variant="danger"
 * />
 * ```
 */
const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  heading,
  text,
  onCancel,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  loading = false,
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-800 dark:text-red-200',
      button: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      icon: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-200 dark:border-orange-800',
      text: 'text-orange-800 dark:text-orange-200',
      button: 'bg-orange-600 hover:bg-orange-700',
    },
    info: {
      icon: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-800 dark:text-blue-200',
      button: 'bg-primary-600 hover:bg-primary-700',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-3">
            <AlertTriangle className={`w-6 h-6 ${styles.icon}`} />
            <h3 className="text-xl font-semibold text-dark-900 dark:text-white">
              {heading}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className={`${styles.bg} border ${styles.border} rounded-lg p-4`}>
            <p className={`text-sm ${styles.text}`}>
              {text}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-700">
          <AppButton
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </AppButton>
          <AppButton
            variant="primary"
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
            className={styles.button}
          >
            {confirmText}
          </AppButton>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;

