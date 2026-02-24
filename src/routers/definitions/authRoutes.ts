import { RouteDefinition } from '../registry/types';
import AppAuthController from '../../controllers/AppAuthController';
import AuthUsersController from '../../controllers/AuthUsersController';
import RolesController from '../../controllers/RolesController';
import CustomFieldsController from '../../controllers/CustomFieldsController';
import AuthSettingsController from '../../controllers/AuthSettingsController';
import CommonUtils from '../../utils/CommonUtils';

/**
 * Helper to create a path that works for both admin and client routes
 * If admin=true, adds /:projectId prefix if path doesn't already have it
 * If admin=false, removes /:projectId prefix if it exists
 */
function createPath(path: string, isAdmin: boolean): string {
  if (isAdmin) {
    return CommonUtils.addProjectIdPrefix(path);
  } else {
    return CommonUtils.removeProjectIdPrefix(path);
  }
}

/**
 * Shared auth route definitions
 * These can be used by both admin and client routers with different middleware
 */
export function createAuthRouteDefinitions(isAdmin: boolean): RouteDefinition[] {
  return [
    // ============================================================================
    // APP USER AUTHENTICATION ROUTES (No auth required)
    // ============================================================================

    {
      method: 'post',
      path: createPath('/auth/register', isAdmin),
      handler: AppAuthController.register,
      description: 'Register a new app user',
      requiresProject: true,
      requiresAuth: false, // Public endpoint
    },
    {
      method: 'post',
      path: createPath('/auth/login', isAdmin),
      handler: AppAuthController.login,
      description: 'Login app user',
      requiresProject: true,
      requiresAuth: false, // Public endpoint
    },
    {
      method: 'post',
      path: createPath('/auth/single-credential-login', isAdmin),
      handler: AppAuthController.singleCredentialLogin,
      description: 'Passwordless login with single credential (email, phone, custom_field_1, or custom_field_2)',
      requiresProject: true,
      requiresAuth: false, // Public endpoint
    },
    {
      method: 'post',
      path: createPath('/auth/otp-login', isAdmin),
      handler: AppAuthController.requestOTPLogin,
      description: 'Request OTP for passwordless login (sends OTP to email or phone)',
      requiresProject: true,
      requiresAuth: false, // Public endpoint
    },
    {
      method: 'post',
      path: createPath('/auth/verify-otp-login', isAdmin),
      handler: AppAuthController.verifyOTPLogin,
      description: 'Verify OTP and complete passwordless login',
      requiresProject: true,
      requiresAuth: false, // Public endpoint
    },
    {
      method: 'post',
      path: createPath('/auth/verify', isAdmin),
      handler: AppAuthController.verify,
      description: 'Verify app user JWT token',
      requiresProject: true,
      requiresAuth: false, // Public endpoint
    },
    {
      method: 'post',
      path: createPath('/auth/logout', isAdmin),
      handler: AppAuthController.logout,
      description: 'Logout app user',
      requiresProject: true,
      requiresAuth: false, // Public endpoint
    },
    {
      method: 'post',
      path: createPath('/auth/verify-otp', isAdmin),
      handler: AppAuthController.verifyOTP,
      description: 'Verify OTP for app user',
      requiresProject: true,
      requiresAuth: false, // Public endpoint
    },
    {
      method: 'post',
      path: createPath('/auth/forgot-password', isAdmin),
      handler: AppAuthController.sendForgotPasswordOTP,
      description: 'Send OTP for forgot password',
      requiresProject: true,
      requiresAuth: false, // Public endpoint
    },
    {
      method: 'post',
      path: createPath('/auth/verify-forgot-password-otp', isAdmin),
      handler: AppAuthController.verifyForgotPasswordOTP,
      description: 'Verify OTP for forgot password',
      requiresProject: true,
      requiresAuth: false, // Public endpoint
    },
    {
      method: 'post',
      path: createPath('/auth/reset-password', isAdmin),
      handler: AppAuthController.resetPassword,
      description: 'Reset password after OTP verification',
      requiresProject: true,
      requiresAuth: false, // Public endpoint
    },
    {
      method: 'post',
      path: createPath('/auth/change-password-request', isAdmin),
      handler: AppAuthController.changePasswordRequest,
      description: 'Request password change (logged-in users)',
      requiresProject: true,
      requiresAuth: true, // Requires authentication
    },
    {
      method: 'post',
      path: createPath('/auth/verify-password-change-otp', isAdmin),
      handler: AppAuthController.verifyPasswordChangeOTP,
      description: 'Verify OTP for password change',
      requiresProject: true,
      requiresAuth: true, // Requires authentication
    },
    {
      method: 'post',
      path: createPath('/auth/request-account-deletion', isAdmin),
      handler: AppAuthController.requestAccountDeletion,
      description: 'Request account deletion (logged-in users)',
      requiresProject: true,
      requiresAuth: true, // Requires authentication
    },
    {
      method: 'post',
      path: createPath('/auth/verify-account-deletion-otp', isAdmin),
      handler: AppAuthController.verifyAccountDeletionOTP,
      description: 'Verify OTP for account deletion',
      requiresProject: true,
      requiresAuth: true, // Requires authentication
    },
    {
      method: 'post',
      path: createPath('/auth/cancel-account-deletion', isAdmin),
      handler: AppAuthController.cancelAccountDeletion,
      description: 'Cancel scheduled account deletion',
      requiresProject: true,
      requiresAuth: true, // Requires authentication
    },

    // ============================================================================
    // USER MANAGEMENT ROUTES (Auth required)
    // ============================================================================

    {
      method: 'get',
      path: createPath('/users', isAdmin),
      handler: AuthUsersController.listUsers,
      description: 'List all users for a project',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: createPath('/users/by-role/:roleId', isAdmin),
      handler: AuthUsersController.getUsersByRole,
      description: 'Get users by role',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: createPath('/users/:userId', isAdmin),
      handler: AuthUsersController.getUser,
      description: 'Get a single user',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: createPath('/users/:userId/password', isAdmin),
      handler: AuthUsersController.getUserPassword,
      description: 'Get user password (admin only - hidden feature)',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: createPath('/users/:userId/password', isAdmin),
      handler: AuthUsersController.setUserPassword,
      description: 'Set/Create user password (admin only - hidden feature)',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: createPath('/users', isAdmin),
      handler: AuthUsersController.createUser,
      description: 'Create a new user',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'put',
      path: createPath('/users/:userId', isAdmin),
      handler: AuthUsersController.updateUser,
      description: 'Update a user',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'delete',
      path: createPath('/users/:userId', isAdmin),
      handler: AuthUsersController.deleteUser,
      description: 'Delete a user (soft delete by default, permanent with ?permanent=true)',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: createPath('/users/:userId/otp-status', isAdmin),
      handler: AuthUsersController.getUserOTPStatus,
      description: 'Get user OTP verification status',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: createPath('/users/:userId/resend-otp', isAdmin),
      handler: AuthUsersController.resendOTP,
      description: 'Resend OTP to user',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: createPath('/users/:userId/manual-verify', isAdmin),
      handler: AuthUsersController.manuallyVerifyUser,
      description: 'Manually verify user without OTP',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: createPath('/users/:userId/roles', isAdmin),
      handler: AuthUsersController.assignRole,
      description: 'Assign role to user',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'delete',
      path: createPath('/users/:userId/roles/:roleId', isAdmin),
      handler: AuthUsersController.removeRole,
      description: 'Remove role from user',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: createPath('/users/export', isAdmin),
      handler: AuthUsersController.exportUsers,
      description: 'Export users as SQL dump',
      requiresProject: true,
      requiresAuth: true,
    },
    // ============================================================================
    // ROLE MANAGEMENT ROUTES
    // ============================================================================

    {
      method: 'get',
      path: createPath('/roles', isAdmin),
      handler: RolesController.listRoles,
      description: 'List all roles',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: createPath('/roles/:roleId', isAdmin),
      handler: RolesController.getRole,
      description: 'Get a single role',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: createPath('/roles', isAdmin),
      handler: RolesController.createRole,
      description: 'Create a new role',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'put',
      path: createPath('/roles/:roleId', isAdmin),
      handler: RolesController.updateRole,
      description: 'Update a role',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'delete',
      path: createPath('/roles/:roleId', isAdmin),
      handler: RolesController.deleteRole,
      description: 'Delete a role',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: createPath('/roles/:roleId/permissions', isAdmin),
      handler: RolesController.getRolePermissions,
      description: 'Get role permissions',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'put',
      path: createPath('/roles/:roleId/permissions', isAdmin),
      handler: RolesController.updateRolePermissions,
      description: 'Update role permissions',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'put',
      path: createPath('/roles/:roleId/session-duration', isAdmin),
      handler: RolesController.updateSessionDuration,
      description: 'Update session duration for a role',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: createPath('/roles/:roleId/verify-org-context', isAdmin),
      handler: RolesController.verifyOrgContext,
      description: 'Verify organization context configuration for a role',
      requiresProject: true,
      requiresAuth: true,
    },

    // ============================================================================
    // CUSTOM FIELDS ROUTES
    // ============================================================================

    {
      method: 'get',
      path: createPath('/fields/available-tables', isAdmin),
      handler: CustomFieldsController.getAvailableTables,
      description: 'Get available tables (for reference fields)',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: createPath('/fields', isAdmin),
      handler: CustomFieldsController.listCustomFields,
      description: 'List all custom fields',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: createPath('/fields/:fieldId', isAdmin),
      handler: CustomFieldsController.getCustomField,
      description: 'Get a single custom field',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: createPath('/fields', isAdmin),
      handler: CustomFieldsController.createCustomField,
      description: 'Create a new custom field',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'put',
      path: createPath('/fields/:fieldId', isAdmin),
      handler: CustomFieldsController.updateCustomField,
      description: 'Update a custom field',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'delete',
      path: createPath('/fields/:fieldId', isAdmin),
      handler: CustomFieldsController.deleteCustomField,
      description: 'Delete a custom field (soft delete by default, permanent with ?permanent=true)',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: createPath('/fields/:fieldId/apply', isAdmin),
      handler: CustomFieldsController.applyCustomField,
      description: 'Apply custom field (add column to skaftin_system_users table)',
      requiresProject: true,
      requiresAuth: true,
    },

    // ============================================================================
    // AUTH SETTINGS ROUTES
    // ============================================================================

    {
      method: 'get',
      path: createPath('/settings/email-providers', isAdmin),
      handler: AuthSettingsController.getEmailProviders,
      description: 'Get email providers for project',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: createPath('/settings/sms-providers', isAdmin),
      handler: AuthSettingsController.getSmsProviders,
      description: 'Get SMS providers for project',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: createPath('/settings/session-durations', isAdmin),
      handler: AuthSettingsController.getAllSessionDurations,
      description: 'Get all session durations',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: createPath('/settings/session-config/:roleId', isAdmin),
      handler: AuthSettingsController.getSessionConfig,
      description: 'Get session config for a specific role',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: createPath('/settings', isAdmin),
      handler: AuthSettingsController.getAuthSettings,
      description: 'Get auth settings',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'put',
      path: createPath('/settings', isAdmin),
      handler: AuthSettingsController.updateAuthSettings,
      description: 'Update auth settings',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: createPath('/settings/send-verification', isAdmin),
      handler: AuthSettingsController.sendVerificationEmail,
      description: 'Send verification email',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: createPath('/settings/send-reset', isAdmin),
      handler: AuthSettingsController.sendPasswordResetEmail,
      description: 'Send password reset email',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: createPath('/settings/verify-otp', isAdmin),
      handler: AuthSettingsController.verifyOTP,
      description: 'Verify OTP',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: createPath('/settings/test-email-provider', isAdmin),
      handler: AuthSettingsController.testEmailProvider,
      description: 'Test email provider',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: createPath('/settings/test-sms-provider', isAdmin),
      handler: AuthSettingsController.testSmsProvider,
      description: 'Test SMS provider',
      requiresProject: true,
      requiresAuth: true,
    },
  ];
}


