import React, { useState } from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import { AppButton } from '../ComponentsIndex';

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  projectName: string;
}

const DeleteProjectModal = ({ isOpen, onClose, onConfirm, projectName }: DeleteProjectModalProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleConfirm = async () => {
    if (confirmText !== projectName) {
      return;
    }

    try {
      setIsDeleting(true);
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Delete Project</h3>
              <p className="text-sm text-dark-600 dark:text-dark-300">This action cannot be undone</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 disabled:opacity-50"
          >
            <X className="w-5 h-5 text-dark-600 dark:text-dark-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <p className="text-dark-600 dark:text-dark-300 mb-4">
              Are you sure you want to delete <strong className="text-dark-900 dark:text-white">{projectName}</strong>? 
              This will permanently delete:
            </p>
            <ul className="space-y-2 text-sm text-dark-600 dark:text-dark-300">
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                <span>All database tables and data</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                <span>All uploaded files and storage</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                <span>Project configuration and settings</span>
              </li>
            </ul>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Type <strong>{projectName}</strong> to confirm deletion:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={`Type "${projectName}" here`}
              className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-red-500 focus:border-transparent"
              disabled={isDeleting}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3">
            <AppButton
              variant="secondary"
              onClick={handleClose}
              disabled={isDeleting}
            >
              Cancel
            </AppButton>
            <AppButton
              variant="danger"
              onClick={handleConfirm}
              disabled={confirmText !== projectName || isDeleting}
              loading={isDeleting}
              icon={<Trash2 className="w-4 h-4" />}
            >
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteProjectModal;
