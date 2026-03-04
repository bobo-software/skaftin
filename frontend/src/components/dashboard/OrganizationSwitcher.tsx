import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, Check, Plus, Settings } from 'lucide-react';
import { useOrganizationStore } from '../../stores/StoresIndex';
import AppText from '../forms/AppText';

const OrganizationSwitcher = () => {
  const navigate = useNavigate();
  const { organizations, currentOrganization, fetchOrganizations, setCurrentOrganization } = useOrganizationStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Set first organization as current if none selected
  useEffect(() => {
    if (!currentOrganization && organizations.length > 0) {
      setCurrentOrganization(organizations[0]);
    }
  }, [organizations, currentOrganization, setCurrentOrganization]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectOrganization = (orgId: number) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setCurrentOrganization(org);
      setIsOpen(false);
      // Optionally navigate back to projects to show the new org's projects
      navigate('/projects');
    }
  };

  const handleCreateOrganization = () => {
    setIsOpen(false);
    navigate('/organizations/create');
  };

  const handleOrganizationSettings = () => {
    setIsOpen(false);
    navigate('/organizations/settings');
  };

  if (!currentOrganization) {
    return null; // Or a loading state
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Organization Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg 
                   hover:bg-dark-100 dark:hover:bg-dark-700 
                   transition-colors group"
        title="Switch organization"
      >
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 
                        flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="hidden md:flex flex-col items-start min-w-0">
            <AppText
              children="Organization"
              size="xs"
              color="default" 
              weight="thin"
              align="left"
            />
            <AppText
              children={currentOrganization.name}
              size="xs"
              color="default"
              weight="medium"
              align="left"
              truncate={true}
            />
          </div>
        </div>
        <ChevronDown 
          className={`w-4 h-4 text-dark-500 dark:text-dark-400 transition-transform flex-shrink-0 hidden md:block
                     ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-dark-800 
                      rounded-lg shadow-xl border border-dark-200 dark:border-dark-700 
                      py-2 z-50 max-h-80 overflow-y-auto">
          {/* Header */}
          <div className="px-4 py-2 border-b border-dark-200 dark:border-dark-700">
            <p className="text-xs font-medium text-dark-500 dark:text-dark-400 uppercase">
              Your Organizations
            </p>
          </div>

          {/* Organization List */}
          <div className="py-1">
            {organizations.length === 0 ? (
              <div className="px-4 py-3 text-sm text-dark-500 dark:text-dark-400 text-center">
                No organizations yet
              </div>
            ) : (
              organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSelectOrganization(org.id)}
                  className="w-full px-4 py-2.5 flex items-center justify-between
                           hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors
                           text-left"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 
                                  flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-dark-900 dark:text-white truncate">
                        {org.name}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-dark-500 dark:text-dark-400">
                        <span className="capitalize">{org.role || 'member'}</span>
                        {org.projectCount !== undefined && (
                          <>
                            <span>•</span>
                            <span>{org.projectCount} {org.projectCount === 1 ? 'project' : 'projects'}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {currentOrganization.id === org.id && (
                    <Check className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Organization Settings */}
          <div className="border-t border-dark-200 dark:border-dark-700 py-1">
            <button
              onClick={handleOrganizationSettings}
              className="w-full px-4 py-2.5 flex items-center space-x-3
                       hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors
                       text-dark-600 dark:text-dark-400"
            >
              <div className="w-8 h-8 rounded-lg bg-dark-100 dark:bg-dark-700
                            flex items-center justify-center flex-shrink-0">
                <Settings className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">Organization Settings</span>
            </button>

            {/* Create New Organization */}
            <button
              onClick={handleCreateOrganization}
              className="w-full px-4 py-2.5 flex items-center space-x-3
                       hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors
                       text-primary-600 dark:text-primary-400"
            >
              <div className="w-8 h-8 rounded-lg border-2 border-dashed border-primary-300 dark:border-primary-600
                            flex items-center justify-center flex-shrink-0">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">Create New Organization</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationSwitcher;

