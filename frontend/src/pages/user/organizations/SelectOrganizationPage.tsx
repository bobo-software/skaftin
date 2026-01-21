import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, Users, FolderKanban, Loader2, Plus } from 'lucide-react';
import { useOrganizationStore } from '../../../stores/StoresIndex';
import OrganizationService from '../../../services/OrganizationService';
import { Organization } from '../../../types/Types';

const SelectOrganizationPage = () => {
  const navigate = useNavigate();
  const { setCurrentOrganization } = useOrganizationStore();
  
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

  // Fetch organizations on mount
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const result = await OrganizationService.getUserOrganizations();
        if (result.success && result.organizations) {
          // If user has 0 orgs, redirect to create
          if (result.organizations.length === 0) {
            navigate('/organizations/create');
            return;
          }
          // If user has exactly 1 org, auto-select and redirect
          if (result.organizations.length === 1) {
            setCurrentOrganization(result.organizations[0]);
            navigate('/projects');
            return;
          }
          setOrganizations(result.organizations);
        } else {
          // Error fetching, redirect to create
          navigate('/organizations/create');
        }
      } catch (error) {
        console.error('Error fetching organizations:', error);
        navigate('/organizations/create');
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, [navigate, setCurrentOrganization]);

  const handleSelectOrganization = (org: Organization) => {
    setSelectedOrgId(org.id);
    setCurrentOrganization(org);
    navigate('/projects');
  };

  const handleCreateNew = () => {
    navigate('/organizations/create');
  };

  // Show loading while fetching
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
          <p className="text-dark-600 dark:text-dark-400">Loading your organizations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/20 mb-4">
              <Building2 className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h1 className="text-3xl font-bold text-dark-900 dark:text-white mb-2">
              Select an Organization
            </h1>
            <p className="text-dark-600 dark:text-dark-400">
              Choose which organization you'd like to work in
            </p>
          </div>

          {/* Organization Grid */}
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSelectOrganization(org)}
                className={`
                  relative p-6 rounded-xl border-2 text-left transition-all duration-200
                  hover:shadow-lg hover:scale-[1.02]
                  ${selectedOrgId === org.id 
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                    : 'border-dark-200 dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-700'
                  }
                `}
              >
                {/* Org Icon */}
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-dark-900 dark:text-white truncate">
                      {org.name}
                    </h3>
                    {org.description && (
                      <p className="text-sm text-dark-500 dark:text-dark-400 mt-1 line-clamp-2">
                        {org.description}
                      </p>
                    )}
                    {/* Stats */}
                    <div className="flex items-center space-x-4 mt-3 text-sm text-dark-500 dark:text-dark-400">
                      {org.projectCount !== undefined && (
                        <span className="flex items-center">
                          <FolderKanban className="w-4 h-4 mr-1" />
                          {org.projectCount} {org.projectCount === 1 ? 'project' : 'projects'}
                        </span>
                      )}
                      {org.memberCount !== undefined && (
                        <span className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {org.memberCount} {org.memberCount === 1 ? 'member' : 'members'}
                        </span>
                      )}
                    </div>
                    {/* Role Badge */}
                    {org.role && (
                      <span className={`
                        inline-block mt-3 px-2 py-1 text-xs font-medium rounded-full capitalize
                        ${org.isOwner 
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' 
                          : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400'
                        }
                      `}>
                        {org.isOwner ? 'Owner' : org.role}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Arrow indicator */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-200 dark:border-dark-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-dark-800 text-dark-500 dark:text-dark-400">
                or
              </span>
            </div>
          </div>

          {/* Create New Organization */}
          <button
            onClick={handleCreateNew}
            className="w-full p-4 rounded-xl border-2 border-dashed border-dark-300 dark:border-dark-600 
                     hover:border-primary-400 dark:hover:border-primary-600
                     hover:bg-primary-50 dark:hover:bg-primary-900/10
                     transition-all duration-200 group"
          >
            <div className="flex items-center justify-center space-x-3">
              <div className="w-10 h-10 rounded-lg border-2 border-primary-300 dark:border-primary-600 
                            flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 
                            transition-colors">
                <Plus className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <span className="text-primary-600 dark:text-primary-400 font-medium">
                Create New Organization
              </span>
            </div>
          </button>
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

export default SelectOrganizationPage;
