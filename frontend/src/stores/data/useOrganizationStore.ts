import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import OrganizationService from '../../services/OrganizationService';
import {
  Organization,
  OrganizationWithMembers,
  CreateOrganizationDto,
  UpdateOrganizationDto,
  AddMemberByIdDto,
  OrganizationRole,
  OrganizationStore as OrganizationStoreType,
} from '../../types/Types';

const ORGANIZATION_STALE_MS = 30_000;
let inFlightFetchOrganizations: Promise<void> | null = null;
let lastOrganizationsLoadedAt = 0;
const traceOrganization = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.debug('[org-bootstrap]', ...args);
  }
};

const useOrganizationStore = create<OrganizationStoreType>()(
  devtools(
    (set, get) => ({
      // Initial state
      organizations: [],
      currentOrganization: null,
      loading: false,
      error: null,

      // Fetch all organizations for the user
      fetchOrganizations: async (options = {}) => {
        const { force = false, skipIfFresh = false } = options;
        const hasOrganizations = get().organizations.length > 0;
        const isFresh = Date.now() - lastOrganizationsLoadedAt < ORGANIZATION_STALE_MS;

        if (!force && skipIfFresh && hasOrganizations && isFresh) {
          traceOrganization('using cached organizations');
          return;
        }

        if (!force && inFlightFetchOrganizations) {
          traceOrganization('joining in-flight organization request');
          return inFlightFetchOrganizations;
        }

        inFlightFetchOrganizations = (async () => {
          traceOrganization('fetch organizations start', { force, skipIfFresh });
          set({ loading: true, error: null });
          try {
            const result = await OrganizationService.getUserOrganizations();

            if (result.success && result.organizations) {
              lastOrganizationsLoadedAt = Date.now();
              traceOrganization('fetch organizations success', { count: result.organizations.length });
              set({
                organizations: result.organizations,
                loading: false
              });
            } else {
              traceOrganization('fetch organizations failed', result.error || 'unknown error');
              set({
                error: result.error || 'Failed to fetch organizations',
                loading: false
              });
            }
          } catch (error) {
            console.error('Error fetching organizations:', error);
            traceOrganization('fetch organizations network error');
            set({
              error: 'Network error while fetching organizations',
              loading: false
            });
          } finally {
            inFlightFetchOrganizations = null;
          }
        })();

        return inFlightFetchOrganizations;
      },

      // Get a specific organization by ID
      getOrganizationById: async (id: number): Promise<OrganizationWithMembers | null> => {
        set({ loading: true, error: null });
        try {
          const result = await OrganizationService.getOrganizationById(id);
          
          if (result.success && result.organization) {
            set({ loading: false });
            return result.organization;
          } else {
            set({ 
              error: result.error || 'Failed to fetch organization',
              loading: false 
            });
            return null;
          }
        } catch (error) {
          console.error('Error fetching organization:', error);
          set({ 
            error: 'Network error while fetching organization',
            loading: false 
          });
          return null;
        }
      },

      // Set current organization
      setCurrentOrganization: (org: Organization | null) => {
        set({ currentOrganization: org });
      },

      // Create a new organization
      createOrganization: async (data: CreateOrganizationDto): Promise<Organization | null> => {
        set({ loading: true, error: null });
        try {
          const result = await OrganizationService.createOrganization(data);
          
          if (result.success && result.organization) {
            set(state => ({
              organizations: [result.organization!, ...state.organizations],
              loading: false
            }));
            return result.organization;
          } else {
            set({ 
              error: result.error || 'Failed to create organization',
              loading: false 
            });
            return null;
          }
        } catch (error) {
          console.error('Error creating organization:', error);
          set({ 
            error: 'Network error while creating organization',
            loading: false 
          });
          return null;
        }
      },

      // Update an organization
      updateOrganization: async (id: number, data: UpdateOrganizationDto) => {
        set({ loading: true, error: null });
        try {
          const result = await OrganizationService.updateOrganization(id, data);
          
          if (result.success && result.organization) {
            set(state => ({
              organizations: state.organizations.map(org => 
                org.id === id ? result.organization! : org
              ),
              currentOrganization: state.currentOrganization?.id === id 
                ? result.organization 
                : state.currentOrganization,
              loading: false
            }));
          } else {
            set({ 
              error: result.error || 'Failed to update organization',
              loading: false 
            });
          }
        } catch (error) {
          console.error('Error updating organization:', error);
          set({ 
            error: 'Network error while updating organization',
            loading: false 
          });
        }
      },

      // Delete an organization
      deleteOrganization: async (id: number) => {
        set({ loading: true, error: null });
        try {
          const result = await OrganizationService.deleteOrganization(id);
          
          if (result.success) {
            set(state => ({
              organizations: state.organizations.filter(org => org.id !== id),
              currentOrganization: state.currentOrganization?.id === id 
                ? null 
                : state.currentOrganization,
              loading: false
            }));
          } else {
            set({ 
              error: result.error || 'Failed to delete organization',
              loading: false 
            });
          }
        } catch (error) {
          console.error('Error deleting organization:', error);
          set({ 
            error: 'Network error while deleting organization',
            loading: false 
          });
        }
      },

      // Add a member to an organization
      addMember: async (orgId: number, data: AddMemberByIdDto) => {
        set({ loading: true, error: null });
        try {
          const result = await OrganizationService.addMemberById(orgId, data);
          
          if (result.success) {
            // Optionally refresh the organization data
            await get().getOrganizationById(orgId);
            set({ loading: false });
          } else {
            set({ 
              error: result.error || 'Failed to add member',
              loading: false 
            });
          }
        } catch (error) {
          console.error('Error adding member:', error);
          set({ 
            error: 'Network error while adding member',
            loading: false 
          });
        }
      },

      // Update a member's role
      updateMemberRole: async (orgId: number, memberId: number, role: OrganizationRole) => {
        set({ loading: true, error: null });
        try {
          const result = await OrganizationService.updateMemberRole(orgId, memberId, role);
          
          if (result.success) {
            // Optionally refresh the organization data
            await get().getOrganizationById(orgId);
            set({ loading: false });
          } else {
            set({ 
              error: result.error || 'Failed to update member role',
              loading: false 
            });
          }
        } catch (error) {
          console.error('Error updating member role:', error);
          set({ 
            error: 'Network error while updating member role',
            loading: false 
          });
        }
      },

      // Remove a member from an organization
      removeMember: async (orgId: number, memberId: number) => {
        set({ loading: true, error: null });
        try {
          const result = await OrganizationService.removeMember(orgId, memberId);
          
          if (result.success) {
            // Optionally refresh the organization data
            await get().getOrganizationById(orgId);
            set({ loading: false });
          } else {
            set({ 
              error: result.error || 'Failed to remove member',
              loading: false 
            });
          }
        } catch (error) {
          console.error('Error removing member:', error);
          set({ 
            error: 'Network error while removing member',
            loading: false 
          });
        }
      },
    }),
    {
      name: 'organization-store',
    }
  )
);

export default useOrganizationStore;

