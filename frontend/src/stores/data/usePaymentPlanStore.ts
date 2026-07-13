import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';

// ---------- Types ----------

export type PlanInterval = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'annually';

export interface PaymentPlan {
  id: number;
  project_id: number;
  provider_id: number;
  plan_code: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  interval: PlanInterval;
  is_active: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentPlanRequest {
  provider_id: number;
  name: string;
  description?: string;
  amount: number;
  currency?: string;
  interval: PlanInterval;
  metadata?: Record<string, any>;
}

export interface UpdatePaymentPlanRequest {
  name?: string;
  description?: string;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export const PLAN_INTERVALS: { value: PlanInterval; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannually', label: 'Biannually' },
  { value: 'annually', label: 'Annually' },
];

// ---------- Store Types ----------

interface PaymentPlanStoreState {
  plans: PaymentPlan[];
  plansLoading: boolean;
  plansError: string | null;
  syncingProviderId: number | null;
}

interface PaymentPlanStoreActions {
  fetchPlans: (projectId: string, providerId?: string) => Promise<void>;
  createPlan: (projectId: string, data: CreatePaymentPlanRequest) => Promise<PaymentPlan | null>;
  updatePlan: (projectId: string, planId: string, data: UpdatePaymentPlanRequest) => Promise<PaymentPlan | null>;
  deletePlan: (projectId: string, planId: string) => Promise<boolean>;
  syncPlans: (projectId: string, providerId: string) => Promise<PaymentPlan[] | null>;
  clearErrors: () => void;
  reset: () => void;
}

type PaymentPlanStore = PaymentPlanStoreState & PaymentPlanStoreActions;

// ---------- Helper ----------

const getToken = () => localStorage.getItem('skaftin-token') || '';

// ---------- Store ----------

const usePaymentPlanStore = create<PaymentPlanStore>()(
  devtools(
    (set, get) => ({
      plans: [],
      plansLoading: false,
      plansError: null,
      syncingProviderId: null,

      fetchPlans: async (projectId: string, providerId?: string) => {
        set({ plansLoading: true, plansError: null });
        try {
          const response = await RequestUtils.get(
            ApiRoutes.PAYMENTS.LIST_PLANS(projectId, providerId),
            getToken()
          );

          if (response.success) {
            set({ plans: response.data, plansLoading: false });
          } else {
            set({
              plansError: response.error || 'Failed to fetch payment plans',
              plansLoading: false,
            });
          }
        } catch (error: any) {
          console.error('Error fetching payment plans:', error);
          set({
            plansError: error.message || 'Network error while fetching payment plans',
            plansLoading: false,
          });
        }
      },

      createPlan: async (projectId: string, data: CreatePaymentPlanRequest) => {
        set({ plansLoading: true, plansError: null });
        try {
          const response = await RequestUtils.post(
            ApiRoutes.PAYMENTS.CREATE_PLAN(projectId),
            getToken(),
            data
          );

          if (response.success) {
            const newPlan = response.data;
            set((state) => ({
              plans: [...state.plans, newPlan],
              plansLoading: false,
            }));
            return newPlan;
          } else {
            set({
              plansError: response.error || 'Failed to create payment plan',
              plansLoading: false,
            });
            return null;
          }
        } catch (error: any) {
          console.error('Error creating payment plan:', error);
          set({
            plansError: error.message || 'Network error while creating payment plan',
            plansLoading: false,
          });
          return null;
        }
      },

      updatePlan: async (projectId: string, planId: string, data: UpdatePaymentPlanRequest) => {
        set({ plansLoading: true, plansError: null });
        try {
          const response = await RequestUtils.put(
            ApiRoutes.PAYMENTS.UPDATE_PLAN(projectId, planId),
            getToken(),
            data
          );

          if (response.success) {
            const updatedPlan = response.data;
            set((state) => ({
              plans: state.plans.map((p) => (p.id.toString() === planId ? { ...p, ...updatedPlan } : p)),
              plansLoading: false,
            }));
            return updatedPlan;
          } else {
            set({
              plansError: response.error || 'Failed to update payment plan',
              plansLoading: false,
            });
            return null;
          }
        } catch (error: any) {
          console.error('Error updating payment plan:', error);
          set({
            plansError: error.message || 'Network error while updating payment plan',
            plansLoading: false,
          });
          return null;
        }
      },

      deletePlan: async (projectId: string, planId: string) => {
        set({ plansLoading: true, plansError: null });
        try {
          const response = await RequestUtils.delete(
            ApiRoutes.PAYMENTS.DELETE_PLAN(projectId, planId),
            getToken(),
            {}
          );

          if (response.success) {
            set((state) => ({
              plans: state.plans.filter((p) => p.id.toString() !== planId),
              plansLoading: false,
            }));
            return true;
          } else {
            set({
              plansError: response.error || 'Failed to delete payment plan',
              plansLoading: false,
            });
            return false;
          }
        } catch (error: any) {
          console.error('Error deleting payment plan:', error);
          set({
            plansError: error.message || 'Network error while deleting payment plan',
            plansLoading: false,
          });
          return false;
        }
      },

      syncPlans: async (projectId: string, providerId: string) => {
        set({ syncingProviderId: parseInt(providerId, 10), plansError: null });
        try {
          const response = await RequestUtils.post(
            ApiRoutes.PAYMENTS.SYNC_PLANS(projectId, providerId),
            getToken(),
            {}
          );

          if (response.success) {
            const syncedPlans: PaymentPlan[] = response.data;
            set((state) => {
              const others = state.plans.filter((p) => p.provider_id.toString() !== providerId);
              return { plans: [...others, ...syncedPlans], syncingProviderId: null };
            });
            return syncedPlans;
          } else {
            set({
              plansError: response.error || 'Failed to sync payment plans',
              syncingProviderId: null,
            });
            return null;
          }
        } catch (error: any) {
          console.error('Error syncing payment plans:', error);
          set({
            plansError: error.message || 'Network error while syncing payment plans',
            syncingProviderId: null,
          });
          return null;
        }
      },

      clearErrors: () => {
        set({ plansError: null });
      },

      reset: () => {
        set({ plans: [], plansLoading: false, plansError: null, syncingProviderId: null });
      },
    }),
    {
      name: 'payment-plan-store',
    }
  )
);

export default usePaymentPlanStore;
