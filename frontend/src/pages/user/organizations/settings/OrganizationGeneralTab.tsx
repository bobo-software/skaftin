import { useState, useEffect } from 'react';
import { Building2, Save, Loader2 } from 'lucide-react';
import { useOrganizationStore } from '../../../../stores/StoresIndex';
import { Organization, OrganizationWithMembers } from '../../../../types/Types';
import ToastUtils from '../../../../utils/ToastUtils';

interface OrganizationGeneralTabProps {
  organization: Organization;
  organizationDetails: OrganizationWithMembers | null;
}

const OrganizationGeneralTab = ({ organization, organizationDetails }: OrganizationGeneralTabProps) => {
  const { updateOrganization, fetchOrganizations } = useOrganizationStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        description: organization.description || '',
      });
    }
  }, [organization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      ToastUtils.error('Organization name is required');
      return;
    }

    setLoading(true);
    try {
      await updateOrganization(organization.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });
      
      // Refresh organizations to get updated data
      await fetchOrganizations();
      
      ToastUtils.success('Organization updated successfully');
    } catch (error) {
      console.error('Error updating organization:', error);
      ToastUtils.error('Failed to update organization');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-dark-900 dark:text-white flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          General Settings
        </h2>
        <p className="text-dark-600 dark:text-dark-400 mt-1">
          Update your organization's basic information
        </p>
      </div>

      {/* Organization Info Card */}
      <div className="bg-dark-50 dark:bg-dark-900 rounded-lg p-4 border border-dark-200 dark:border-dark-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-dark-500 dark:text-dark-400">Organization ID</span>
            <p className="font-medium text-dark-900 dark:text-white">{organization.id}</p>
          </div>
          <div>
            <span className="text-dark-500 dark:text-dark-400">Your Role</span>
            <p className="font-medium text-dark-900 dark:text-white capitalize">
              {organization.isOwner ? 'Owner' : organization.role || 'Member'}
            </p>
          </div>
          <div>
            <span className="text-dark-500 dark:text-dark-400">Projects</span>
            <p className="font-medium text-dark-900 dark:text-white">{organization.projectCount ?? 0}</p>
          </div>
          <div>
            <span className="text-dark-500 dark:text-dark-400">Members</span>
            <p className="font-medium text-dark-900 dark:text-white">{organization.memberCount ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
            Organization Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter organization name"
            className="w-full px-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg 
                     bg-white dark:bg-dark-800 text-dark-900 dark:text-white 
                     placeholder-dark-400 dark:placeholder-dark-500
                     focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe your organization (optional)"
            rows={4}
            className="w-full px-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg 
                     bg-white dark:bg-dark-800 text-dark-900 dark:text-white 
                     placeholder-dark-400 dark:placeholder-dark-500
                     focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     transition-colors resize-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg 
                     hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OrganizationGeneralTab;
