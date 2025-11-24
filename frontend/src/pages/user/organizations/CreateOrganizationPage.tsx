import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, Loader2 } from 'lucide-react';
import { useOrganizationStore } from '../../../stores/StoresIndex';
import OrganizationService from '../../../services/OrganizationService';

const CreateOrganizationPage = () => {
  const navigate = useNavigate();
  const { createOrganization, loading } = useOrganizationStore();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [error, setError] = useState('');
  const [hasOrganizations, setHasOrganizations] = useState<boolean | null>(null);
  const [checkingOrgs, setCheckingOrgs] = useState(true);

  // Check if user has organizations on mount
  useEffect(() => {
    const checkOrganizations = async () => {
      try {
        const result = await OrganizationService.getUserOrganizations();
        if (result.success && result.organizations) {
          const hasOrgs = result.organizations.length > 0;
          setHasOrganizations(hasOrgs);
          
          // If they have organizations, redirect to projects
          if (hasOrgs) {
            navigate('/projects');
          }
        } else {
          setHasOrganizations(false);
        }
      } catch (error) {
        console.error('Error checking organizations:', error);
        setHasOrganizations(false);
      } finally {
        setCheckingOrgs(false);
      }
    };

    checkOrganizations();
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Organization name is required');
      return;
    }

    const organization = await createOrganization({
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
    });

    if (organization) {
      // Redirect to projects page after successful organization creation
      navigate('/projects');
    } else {
      setError('Failed to create organization. Please try again.');
    }
  };

  // Show loading while checking organizations
  if (checkingOrgs) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
          <p className="text-dark-600 dark:text-dark-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/20 mb-4">
              <Building2 className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h1 className="text-3xl font-bold text-dark-900 dark:text-white mb-2">
              Create Your Organization
            </h1>
            <p className="text-dark-600 dark:text-dark-400">
              Organizations help you manage projects and collaborate with your team
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Organization Name */}
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
                className="w-full px-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg 
                         bg-white dark:bg-dark-700 text-dark-900 dark:text-white 
                         placeholder-dark-400 dark:placeholder-dark-500
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         transition-colors"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Tell us about your organization..."
                rows={4}
                className="w-full px-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg 
                         bg-white dark:bg-dark-700 text-dark-900 dark:text-white 
                         placeholder-dark-400 dark:placeholder-dark-500
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         transition-colors resize-none"
              />
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                What you'll get:
              </h3>
              <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Collaborative project management
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Team member invitations with role-based access
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Shared databases and storage
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Centralized team settings
                </li>
              </ul>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center space-x-2 py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating Organization...</span>
                </>
              ) : (
                <>
                  <span>Create Organization</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {/* Skip Link (only show if user already has organizations) */}
            {hasOrganizations && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate('/projects')}
                  className="text-sm text-dark-600 dark:text-dark-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  Skip for now (you can create one later)
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-dark-600 dark:text-dark-400">
            Need help? <a href="#" className="text-primary-600 dark:text-primary-400 hover:underline">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CreateOrganizationPage;

