import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  ArrowLeft, 
  Settings, 
  Users, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useOrganizationStore } from '../../../stores/StoresIndex';
import OrganizationGeneralTab from './settings/OrganizationGeneralTab';
import OrganizationMembersTab from './settings/OrganizationMembersTab';
import OrganizationDangerTab from './settings/OrganizationDangerTab';

type TabType = 'general' | 'members' | 'danger';

const OrganizationSettingsPage = () => {
  const navigate = useNavigate();
  const { currentOrganization, fetchOrganizations, getOrganizationById } = useOrganizationStore();
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [loading, setLoading] = useState(true);
  const [organizationDetails, setOrganizationDetails] = useState<any>(null);

  useEffect(() => {
    const loadOrganization = async () => {
      setLoading(true);
      try {
        // Make sure organizations are loaded
        await fetchOrganizations();
        
        // If we have a current organization, fetch its full details
        if (currentOrganization) {
          const details = await getOrganizationById(currentOrganization.id);
          setOrganizationDetails(details);
        }
      } catch (error) {
        console.error('Error loading organization:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOrganization();
  }, [currentOrganization?.id, fetchOrganizations, getOrganizationById]);

  const tabs = [
    { id: 'general' as TabType, label: 'General', icon: Settings },
    { id: 'members' as TabType, label: 'Members', icon: Users },
    { id: 'danger' as TabType, label: 'Danger Zone', icon: AlertTriangle },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
          <p className="text-dark-600 dark:text-dark-400">Loading organization settings...</p>
        </div>
      </div>
    );
  }

  if (!currentOrganization) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">
            No Organization Selected
          </h2>
          <p className="text-dark-600 dark:text-dark-400 mb-6">
            Please select an organization first to manage its settings.
          </p>
          <button
            onClick={() => navigate('/organizations/select')}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Select Organization
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-50 dark:bg-dark-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-2 text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Projects</span>
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-dark-900 dark:text-white">
                Organization Settings
              </h1>
              <p className="text-dark-600 dark:text-dark-400 mt-1">
                Manage settings for <span className="font-medium text-dark-900 dark:text-white">{currentOrganization.name}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 overflow-hidden">
          <div className="border-b border-dark-200 dark:border-dark-700">
            <nav className="flex space-x-1 p-2" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isDanger = tab.id === 'danger';
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all
                      ${isActive
                        ? isDanger
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                        : isDanger
                          ? 'text-dark-600 dark:text-dark-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400'
                          : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 hover:text-dark-900 dark:hover:text-white'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'general' && (
              <OrganizationGeneralTab 
                organization={currentOrganization}
                organizationDetails={organizationDetails}
              />
            )}
            {activeTab === 'members' && (
              <OrganizationMembersTab 
                organization={currentOrganization}
                organizationDetails={organizationDetails}
              />
            )}
            {activeTab === 'danger' && (
              <OrganizationDangerTab 
                organization={currentOrganization}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationSettingsPage;
