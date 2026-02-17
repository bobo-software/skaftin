import React, { useState } from 'react';
import { Building2, X, Loader2 } from 'lucide-react';
import { useOrganizationStore } from '../../stores/StoresIndex';

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateOrganizationModal = ({ isOpen, onClose, onSuccess }: CreateOrganizationModalProps) => {
  const { createOrganization, loading } = useOrganizationStore();

  const [formData, setFormData] = useState({ name: '', description: '' });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Organization name is required');
      return;
    }

    const organization = await createOrganization({
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
    });

    if (organization) {
      setFormData({ name: '', description: '' });
      onSuccess?.();
      onClose();
    } else {
      setError('Failed to create organization. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-dark-900 dark:text-white">
              Create Organization
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5 text-dark-600 dark:text-dark-300" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Organization Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Acme Corporation"
              className="w-full px-4 py-2.5 border border-dark-200 dark:border-dark-700 rounded-lg 
                       bg-white dark:bg-dark-700 text-dark-900 dark:text-white 
                       placeholder-dark-400 dark:placeholder-dark-500
                       focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       transition-colors"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Tell us about your organization..."
              rows={3}
              className="w-full px-4 py-2.5 border border-dark-200 dark:border-dark-700 rounded-lg 
                       bg-white dark:bg-dark-700 text-dark-900 dark:text-white 
                       placeholder-dark-400 dark:placeholder-dark-500
                       focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       transition-colors resize-none"
            />
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-dark-200 dark:border-dark-700 text-dark-700 dark:text-dark-300 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Organization</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrganizationModal;
