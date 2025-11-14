import React, { useState } from 'react';
import { X, AlertTriangle, Database, HardDrive, Loader2, CheckCircle } from 'lucide-react';
import { AppButton } from '../ComponentsIndex';

interface ResetProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  projectName: string;
  loading?: boolean;
}

const ResetProjectModal: React.FC<ResetProjectModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  loading = false
}) => {
  const [step, setStep] = useState<'warning' | 'confirm' | 'typing'>(loading ? 'warning' : 'warning');
  const [confirmText, setConfirmText] = useState('');
  const expectedText = `reset ${projectName}`;

  const handleClose = () => {
    if (!loading) {
      setStep('warning');
      setConfirmText('');
      onClose();
    }
  };

  const handleNext = () => {
    if (step === 'warning') {
      setStep('confirm');
    } else if (step === 'confirm') {
      setStep('typing');
    }
  };

  const handleBack = () => {
    if (step === 'typing') {
      setStep('confirm');
    } else if (step === 'confirm') {
      setStep('warning');
    }
  };

  const handleConfirm = async () => {
    if (confirmText.toLowerCase() === expectedText.toLowerCase()) {
      await onConfirm();
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <h3 className="text-xl font-semibold text-dark-900 dark:text-white">
              Reset Project
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'warning' && (
            <div className="space-y-6">
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                      Warning: This action cannot be undone!
                    </h4>
                    <p className="text-sm text-orange-800 dark:text-orange-200">
                      Resetting <span className="font-semibold">{projectName}</span> will permanently delete:
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-4 bg-dark-50 dark:bg-dark-700 rounded-lg">
                  <Database className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-medium text-dark-900 dark:text-white mb-1">
                      All Database Tables
                    </h5>
                    <p className="text-sm text-dark-600 dark:text-dark-300">
                      All tables in the project schema will be dropped. This includes all data, relationships, and constraints.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 bg-dark-50 dark:bg-dark-700 rounded-lg">
                  <HardDrive className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-medium text-dark-900 dark:text-white mb-1">
                      All Stored Files
                    </h5>
                    <p className="text-sm text-dark-600 dark:text-dark-300">
                      All files in the project's storage bucket will be permanently deleted.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">What will be kept:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Project settings and metadata</li>
                      <li>Team members and permissions</li>
                      <li>API credentials</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-dark-900 dark:text-white mb-3">
                  Are you absolutely sure?
                </h4>
                <p className="text-dark-600 dark:text-dark-300 mb-4">
                  This reset operation will:
                </p>
                <ul className="space-y-2 mb-4">
                  <li className="flex items-start space-x-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span className="text-dark-700 dark:text-dark-200">
                      Drop <strong>all tables</strong> in the database schema
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span className="text-dark-700 dark:text-dark-200">
                      Delete <strong>all files</strong> from storage
                    </span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span className="text-dark-700 dark:text-dark-200">
                      Remove <strong>all data</strong> permanently
                    </span>
                  </li>
                </ul>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium text-center">
                  ⚠️ There is no way to recover your data after this operation
                </p>
              </div>
            </div>
          )}

          {step === 'typing' && (
            <div className="space-y-6">
              <div>
                <p className="text-dark-700 dark:text-dark-200 mb-4">
                  To confirm, please type <span className="font-mono font-semibold bg-dark-100 dark:bg-dark-700 px-2 py-1 rounded">
                    {expectedText}
                  </span> below:
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={expectedText}
                  className="w-full px-4 py-3 border-2 border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  disabled={loading}
                  autoFocus
                />
                <p className="text-sm text-dark-500 dark:text-dark-400 mt-2">
                  This confirmation is case-insensitive
                </p>
              </div>

              {confirmText && confirmText.toLowerCase() !== expectedText.toLowerCase() && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Text doesn't match. Please type exactly: <span className="font-mono">{expectedText}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-700">
          <div className="flex items-center space-x-2">
            {step !== 'warning' && (
              <AppButton
                variant="secondary"
                onClick={handleBack}
                disabled={loading}
              >
                Back
              </AppButton>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <AppButton
              variant="secondary"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </AppButton>

            {step === 'warning' && (
              <AppButton
                variant="primary"
                onClick={handleNext}
                className="bg-orange-600 hover:bg-orange-700"
              >
                I Understand, Continue
              </AppButton>
            )}

            {step === 'confirm' && (
              <AppButton
                variant="primary"
                onClick={handleNext}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Continue to Confirmation
              </AppButton>
            )}

            {step === 'typing' && (
              <AppButton
                variant="primary"
                onClick={handleConfirm}
                disabled={loading || confirmText.toLowerCase() !== expectedText.toLowerCase()}
                loading={loading}
                className="bg-red-600 hover:bg-red-700 disabled:bg-red-400"
                icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
              >
                {loading ? 'Resetting Project...' : 'Reset Project'}
              </AppButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetProjectModal;

