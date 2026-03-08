import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';

// ---------- Types ----------

export interface EmailProvider {
  id?: number;
  project_id: string;
  name: string;
  provider_type: 'smtp' | 'mailtrap' | 'aws_ses';
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password?: string;
  from_email: string;
  from_name?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SmsProvider {
  id?: number;
  project_id: string;
  name: string;
  provider_type: 'mymobileapi' | 'sa_mobile_sms' | 'twilio';
  api_key?: string;
  api_secret?: string;
  post_url?: string;
  messaging_service_sid?: string;
  phone_number?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateEmailProviderRequest {
  name: string;
  provider_type: 'smtp' | 'mailtrap' | 'aws_ses';
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name?: string;
  is_active?: boolean;
}

export interface UpdateEmailProviderRequest {
  name?: string;
  provider_type?: 'smtp' | 'mailtrap' | 'aws_ses';
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: boolean;
  smtp_user?: string;
  smtp_password?: string;
  from_email?: string;
  from_name?: string;
  is_active?: boolean;
}

export interface CreateSmsProviderRequest {
  name: string;
  provider_type: 'mymobileapi' | 'sa_mobile_sms' | 'twilio';
  api_key: string;
  api_secret: string;
  post_url?: string;
  messaging_service_sid?: string;
  phone_number?: string;
  is_active?: boolean;
}

export interface UpdateSmsProviderRequest {
  name?: string;
  provider_type?: 'mymobileapi' | 'sa_mobile_sms' | 'twilio';
  api_key?: string;
  api_secret?: string;
  post_url?: string;
  messaging_service_sid?: string;
  phone_number?: string;
  is_active?: boolean;
}

// ---------- Store Types ----------

interface ComProviderStoreState {
  // Email providers state
  emailProviders: EmailProvider[];
  emailProvidersLoading: boolean;
  emailProvidersError: string | null;

  // SMS providers state
  smsProviders: SmsProvider[];
  smsProvidersLoading: boolean;
  smsProvidersError: string | null;

  // Current project ID being tracked
  currentProjectId: string | null;
}

interface ComProviderStoreActions {
  // Email provider actions
  fetchEmailProviders: (projectId: string) => Promise<void>;
  getEmailProvider: (projectId: string, providerId: string) => Promise<EmailProvider | null>;
  createEmailProvider: (projectId: string, data: CreateEmailProviderRequest) => Promise<EmailProvider | null>;
  updateEmailProvider: (projectId: string, providerId: string, data: UpdateEmailProviderRequest) => Promise<EmailProvider | null>;
  deleteEmailProvider: (projectId: string, providerId: string) => Promise<boolean>;
  testEmailConnection: (projectId: string, providerId: string, testEmail?: string) => Promise<boolean>;

  // SMS provider actions
  fetchSmsProviders: (projectId: string) => Promise<void>;
  getSmsProvider: (projectId: string, providerId: string) => Promise<SmsProvider | null>;
  createSmsProvider: (projectId: string, data: CreateSmsProviderRequest) => Promise<SmsProvider | null>;
  updateSmsProvider: (projectId: string, providerId: string, data: UpdateSmsProviderRequest) => Promise<SmsProvider | null>;
  deleteSmsProvider: (projectId: string, providerId: string) => Promise<boolean>;

  // Utility actions
  clearErrors: () => void;
  reset: () => void;
}

type ComProviderStore = ComProviderStoreState & ComProviderStoreActions;

// ---------- Helper ----------

const getToken = () => localStorage.getItem('skaftin-token') || '';

// ---------- Store ----------

const useComProviderStore = create<ComProviderStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      emailProviders: [],
      emailProvidersLoading: false,
      emailProvidersError: null,

      smsProviders: [],
      smsProvidersLoading: false,
      smsProvidersError: null,

      currentProjectId: null,

      // ---------- Email Provider Actions ----------

      fetchEmailProviders: async (projectId: string) => {
        set({ emailProvidersLoading: true, emailProvidersError: null, currentProjectId: projectId });
        try {
          const response = await RequestUtils.get(
            ApiRoutes.COMMUNICATIONS.LIST_PROVIDERS(projectId),
            getToken()
          );

          if (response.success) {
            set({ emailProviders: response.data, emailProvidersLoading: false });
          } else {
            set({
              emailProvidersError: response.error || 'Failed to fetch email providers',
              emailProvidersLoading: false,
            });
          }
        } catch (error: any) {
          console.error('Error fetching email providers:', error);
          set({
            emailProvidersError: error.message || 'Network error while fetching email providers',
            emailProvidersLoading: false,
          });
        }
      },

      getEmailProvider: async (projectId: string, providerId: string) => {
        try {
          const response = await RequestUtils.get(
            ApiRoutes.COMMUNICATIONS.GET_PROVIDER(projectId, providerId),
            getToken()
          );

          if (response.success) {
            return response.data;
          }
          return null;
        } catch (error: any) {
          console.error('Error getting email provider:', error);
          return null;
        }
      },

      createEmailProvider: async (projectId: string, data: CreateEmailProviderRequest) => {
        set({ emailProvidersLoading: true, emailProvidersError: null });
        try {
          const response = await RequestUtils.post(
            ApiRoutes.COMMUNICATIONS.CREATE_PROVIDER(projectId),
            getToken(),
            data
          );

          if (response.success) {
            const newProvider = response.data;
            set((state) => ({
              emailProviders: [...state.emailProviders, newProvider],
              emailProvidersLoading: false,
            }));
            return newProvider;
          } else {
            set({
              emailProvidersError: response.error || 'Failed to create email provider',
              emailProvidersLoading: false,
            });
            return null;
          }
        } catch (error: any) {
          console.error('Error creating email provider:', error);
          set({
            emailProvidersError: error.message || 'Network error while creating email provider',
            emailProvidersLoading: false,
          });
          return null;
        }
      },

      updateEmailProvider: async (projectId: string, providerId: string, data: UpdateEmailProviderRequest) => {
        set({ emailProvidersLoading: true, emailProvidersError: null });
        try {
          const response = await RequestUtils.put(
            ApiRoutes.COMMUNICATIONS.UPDATE_PROVIDER(projectId, providerId),
            getToken(),
            data
          );

          if (response.success) {
            const updatedProvider = response.data;
            set((state) => ({
              emailProviders: state.emailProviders.map((p) =>
                p.id?.toString() === providerId ? { ...p, ...updatedProvider } : p
              ),
              emailProvidersLoading: false,
            }));
            return updatedProvider;
          } else {
            set({
              emailProvidersError: response.error || 'Failed to update email provider',
              emailProvidersLoading: false,
            });
            return null;
          }
        } catch (error: any) {
          console.error('Error updating email provider:', error);
          set({
            emailProvidersError: error.message || 'Network error while updating email provider',
            emailProvidersLoading: false,
          });
          return null;
        }
      },

      deleteEmailProvider: async (projectId: string, providerId: string) => {
        set({ emailProvidersLoading: true, emailProvidersError: null });
        try {
          const response = await RequestUtils.delete(
            ApiRoutes.COMMUNICATIONS.DELETE_PROVIDER(projectId, providerId),
            getToken(),
            {}
          );

          if (response.success) {
            set((state) => ({
              emailProviders: state.emailProviders.filter((p) => p.id?.toString() !== providerId),
              emailProvidersLoading: false,
            }));
            return true;
          } else {
            set({
              emailProvidersError: response.error || 'Failed to delete email provider',
              emailProvidersLoading: false,
            });
            return false;
          }
        } catch (error: any) {
          console.error('Error deleting email provider:', error);
          set({
            emailProvidersError: error.message || 'Network error while deleting email provider',
            emailProvidersLoading: false,
          });
          return false;
        }
      },

      testEmailConnection: async (projectId: string, providerId: string, testEmail?: string) => {
        try {
          const response = await RequestUtils.post(
            ApiRoutes.COMMUNICATIONS.TEST_CONNECTION(projectId, providerId),
            getToken(),
            testEmail ? { test_email: testEmail } : {}
          );
          return response.success;
        } catch (error: any) {
          console.error('Error testing email connection:', error);
          return false;
        }
      },

      // ---------- SMS Provider Actions ----------

      fetchSmsProviders: async (projectId: string) => {
        set({ smsProvidersLoading: true, smsProvidersError: null, currentProjectId: projectId });
        try {
          const response = await RequestUtils.get(
            ApiRoutes.COMMUNICATIONS.LIST_SMS_PROVIDERS(projectId),
            getToken()
          );

          if (response.success) {
            set({ smsProviders: response.data, smsProvidersLoading: false });
          } else {
            set({
              smsProvidersError: response.error || 'Failed to fetch SMS providers',
              smsProvidersLoading: false,
            });
          }
        } catch (error: any) {
          console.error('Error fetching SMS providers:', error);
          set({
            smsProvidersError: error.message || 'Network error while fetching SMS providers',
            smsProvidersLoading: false,
          });
        }
      },

      getSmsProvider: async (projectId: string, providerId: string) => {
        try {
          const response = await RequestUtils.get(
            ApiRoutes.COMMUNICATIONS.GET_SMS_PROVIDER(projectId, providerId),
            getToken()
          );

          if (response.success) {
            return response.data;
          }
          return null;
        } catch (error: any) {
          console.error('Error getting SMS provider:', error);
          return null;
        }
      },

      createSmsProvider: async (projectId: string, data: CreateSmsProviderRequest) => {
        set({ smsProvidersLoading: true, smsProvidersError: null });
        try {
          const response = await RequestUtils.post(
            ApiRoutes.COMMUNICATIONS.CREATE_SMS_PROVIDER(projectId),
            getToken(),
            data
          );

          if (response.success) {
            const newProvider = response.data;
            set((state) => ({
              smsProviders: [...state.smsProviders, newProvider],
              smsProvidersLoading: false,
            }));
            return newProvider;
          } else {
            set({
              smsProvidersError: response.error || 'Failed to create SMS provider',
              smsProvidersLoading: false,
            });
            return null;
          }
        } catch (error: any) {
          console.error('Error creating SMS provider:', error);
          set({
            smsProvidersError: error.message || 'Network error while creating SMS provider',
            smsProvidersLoading: false,
          });
          return null;
        }
      },

      updateSmsProvider: async (projectId: string, providerId: string, data: UpdateSmsProviderRequest) => {
        set({ smsProvidersLoading: true, smsProvidersError: null });
        try {
          const response = await RequestUtils.put(
            ApiRoutes.COMMUNICATIONS.UPDATE_SMS_PROVIDER(projectId, providerId),
            getToken(),
            data
          );

          if (response.success) {
            const updatedProvider = response.data;
            set((state) => ({
              smsProviders: state.smsProviders.map((p) =>
                p.id?.toString() === providerId ? { ...p, ...updatedProvider } : p
              ),
              smsProvidersLoading: false,
            }));
            return updatedProvider;
          } else {
            set({
              smsProvidersError: response.error || 'Failed to update SMS provider',
              smsProvidersLoading: false,
            });
            return null;
          }
        } catch (error: any) {
          console.error('Error updating SMS provider:', error);
          set({
            smsProvidersError: error.message || 'Network error while updating SMS provider',
            smsProvidersLoading: false,
          });
          return null;
        }
      },

      deleteSmsProvider: async (projectId: string, providerId: string) => {
        set({ smsProvidersLoading: true, smsProvidersError: null });
        try {
          const response = await RequestUtils.delete(
            ApiRoutes.COMMUNICATIONS.DELETE_SMS_PROVIDER(projectId, providerId),
            getToken(),
            {}
          );

          if (response.success) {
            set((state) => ({
              smsProviders: state.smsProviders.filter((p) => p.id?.toString() !== providerId),
              smsProvidersLoading: false,
            }));
            return true;
          } else {
            set({
              smsProvidersError: response.error || 'Failed to delete SMS provider',
              smsProvidersLoading: false,
            });
            return false;
          }
        } catch (error: any) {
          console.error('Error deleting SMS provider:', error);
          set({
            smsProvidersError: error.message || 'Network error while deleting SMS provider',
            smsProvidersLoading: false,
          });
          return false;
        }
      },

      // ---------- Utility Actions ----------

      clearErrors: () => {
        set({ emailProvidersError: null, smsProvidersError: null });
      },

      reset: () => {
        set({
          emailProviders: [],
          emailProvidersLoading: false,
          emailProvidersError: null,
          smsProviders: [],
          smsProvidersLoading: false,
          smsProvidersError: null,
          currentProjectId: null,
        });
      },
    }),
    {
      name: 'com-provider-store',
    }
  )
);

export default useComProviderStore;
