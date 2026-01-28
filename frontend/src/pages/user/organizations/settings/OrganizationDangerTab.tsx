import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { useOrganizationStore } from '../../../../stores/StoresIndex';
import { Organization } from '../../../../types/Types';
import ToastUtils from '../../../../utils/ToastUtils';

interface OrganizationDangerTabProps {
  organization: Organization;
}

const OrganizationDangerTab = ({ organization }: OrganizationDangerTabProps) => {
  const navigate = useNavigate();
  const { deleteOrganization, fetchOrganizations, setCurrentOrganization } = useOrganizationStore();
  const [confirmName, setConfirmName] = useState('');
  const [loading, setLoading] = useState(false);

  const isOwner = organization.isOwner || organization.role === 'admin';
  const canDelete = confirmName === organization.name;

  const handleDelete = async () => {
    if (!canDelete) {
      ToastUtils.error('Please type the organization name to confirm');
      return;
    }

    setLoading(true);
    try {
      await deleteOrganization(organization.id);
      
      // Clear current organization
      setCurrentOrganization(null);
      
      // Refresh organizations list
      await fetchOrganizations();
      
      ToastUtils.success('Organization deleted successfully');
      
      // Redirect to organization selection or projects
      navigate('/organizations/select');
    } catch (error) {
      console.error('Error deleting organization:', error);
      ToastUtils.error('Failed to delete organization');
    } finally {
      setLoading(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </h2>
          <p className="text-dark-600 dark:text-dark-400 mt-1">
            Irreversible and destructive actions
          </p>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">
              Access Restricted
            </h3>
          </div>
          <p className="text-red-600 dark:text-red-400">
            Only the organization owner can delete this organization.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </h2>
        <p className="text-dark-600 dark:text-dark-400 mt-1">
          Irreversible and destructive actions
        </p>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-800 dark:text-amber-200">Warning</h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              The actions in this section are irreversible. Please proceed with caution.
            </p>
          </div>
        </div>
      </div>

      {/* Delete Organization */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">
            Delete Organization
          </h3>
        </div>
        
        <p className="text-red-600 dark:text-red-400 mb-4">
          Once you delete an organization, there is no going back. This will:
        </p>
        
        <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 mb-6 space-y-1">
          <li>Permanently delete the organization</li>
          <li>Remove all members from this organization</li>
          <li>Delete all projects within this organization</li>
          <li>Delete all databases and data associated with those projects</li>
          <li>Delete all files and storage associated with those projects</li>
        </ul>

        {/* Confirmation */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-2">
              To confirm, type <span className="font-bold">"{organization.name}"</span> below:
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={organization.name}
              className="w-full px-4 py-2 border border-red-300 dark:border-red-700 rounded-lg 
                       bg-white dark:bg-dark-800 text-dark-900 dark:text-white
                       focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleDelete}
            disabled={!canDelete || loading}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg 
                     hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Delete Organization</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrganizationDangerTab;
