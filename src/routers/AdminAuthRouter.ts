import { Router } from 'express';
import { Pool } from 'pg';
import AuthUsersController from '../controllers/AuthUsersController';
import RolesController from '../controllers/RolesController';
import CustomFieldsController from '../controllers/CustomFieldsController';
import AuthSettingsController from '../controllers/AuthSettingsController';
import { authenticateAndVerifyProject } from '../middleware/supertokensAuthMiddleware';

export function createAdminAuthRouter(pool: Pool): Router {
  const router = Router();

  // Initialize controllers
  AuthUsersController.initialize(pool);
  RolesController.initialize(pool);
  CustomFieldsController.initialize(pool);
  AuthSettingsController.initialize(pool);

  // ============================================
  // USER MANAGEMENT ROUTES (Admin API - SuperTokens authentication)
  // Project ID is provided in the URL path: /api/auth/:projectId/...
  // ============================================

  // List all users for a project
  router.get('/:projectId/users', authenticateAndVerifyProject, AuthUsersController.listUsers);

  // Get users by role
  router.get('/:projectId/users/by-role/:roleId', authenticateAndVerifyProject, AuthUsersController.getUsersByRole);

  // Get a single user
  router.get('/:projectId/users/:userId', authenticateAndVerifyProject, AuthUsersController.getUser);

  // Create a new user
  router.post('/:projectId/users', authenticateAndVerifyProject, AuthUsersController.createUser);

  // Update a user
  router.put('/:projectId/users/:userId', authenticateAndVerifyProject, AuthUsersController.updateUser);

  // Delete a user (soft delete by default, permanent with ?permanent=true)
  router.delete('/:projectId/users/:userId', authenticateAndVerifyProject, AuthUsersController.deleteUser);

  // Assign role to user
  router.post('/:projectId/users/:userId/roles', authenticateAndVerifyProject, AuthUsersController.assignRole);

  // Remove role from user
  router.delete('/:projectId/users/:userId/roles/:roleId', authenticateAndVerifyProject, AuthUsersController.removeRole);

  // ============================================
  // ROLE MANAGEMENT ROUTES
  // ============================================

  // List all roles
  router.get('/:projectId/roles', authenticateAndVerifyProject, RolesController.listRoles);

  // Get a single role
  router.get('/:projectId/roles/:roleId', authenticateAndVerifyProject, RolesController.getRole);

  // Create a new role
  router.post('/:projectId/roles', authenticateAndVerifyProject, RolesController.createRole);

  // Update a role
  router.put('/:projectId/roles/:roleId', authenticateAndVerifyProject, RolesController.updateRole);

  // Delete a role
  router.delete('/:projectId/roles/:roleId', authenticateAndVerifyProject, RolesController.deleteRole);

  // Get role permissions
  router.get('/:projectId/roles/:roleId/permissions', authenticateAndVerifyProject, RolesController.getRolePermissions);

  // Update role permissions
  router.put('/:projectId/roles/:roleId/permissions', authenticateAndVerifyProject, RolesController.updateRolePermissions);

  // Update session duration for a role
  router.put('/:projectId/roles/:roleId/session-duration', authenticateAndVerifyProject, RolesController.updateSessionDuration);

  // ============================================
  // CUSTOM FIELDS ROUTES
  // ============================================

  // Get available tables (for reference fields)
  router.get('/:projectId/fields/available-tables', authenticateAndVerifyProject, CustomFieldsController.getAvailableTables);

  // List all custom fields
  router.get('/:projectId/fields', authenticateAndVerifyProject, CustomFieldsController.listCustomFields);

  // Get a single custom field
  router.get('/:projectId/fields/:fieldId', authenticateAndVerifyProject, CustomFieldsController.getCustomField);

  // Create a new custom field
  router.post('/:projectId/fields', authenticateAndVerifyProject, CustomFieldsController.createCustomField);

  // Update a custom field
  router.put('/:projectId/fields/:fieldId', authenticateAndVerifyProject, CustomFieldsController.updateCustomField);

  // Delete a custom field (soft delete by default, permanent with ?permanent=true)
  router.delete('/:projectId/fields/:fieldId', authenticateAndVerifyProject, CustomFieldsController.deleteCustomField);

  // Apply custom field (add column to app_users table)
  router.post('/:projectId/fields/:fieldId/apply', authenticateAndVerifyProject, CustomFieldsController.applyCustomField);

  // ============================================
  // AUTH SETTINGS ROUTES
  // ============================================

  // Get email providers for project
  router.get('/:projectId/settings/email-providers', authenticateAndVerifyProject, AuthSettingsController.getEmailProviders);

  // Get all session durations
  router.get('/:projectId/settings/session-durations', authenticateAndVerifyProject, AuthSettingsController.getAllSessionDurations);

  // Get session config for a specific role
  router.get('/:projectId/settings/session-config/:roleId', authenticateAndVerifyProject, AuthSettingsController.getSessionConfig);

  // Get auth settings
  router.get('/:projectId/settings', authenticateAndVerifyProject, AuthSettingsController.getAuthSettings);

  // Update auth settings
  router.put('/:projectId/settings', authenticateAndVerifyProject, AuthSettingsController.updateAuthSettings);

  // Send verification email
  router.post('/:projectId/settings/send-verification', authenticateAndVerifyProject, AuthSettingsController.sendVerificationEmail);

  // Send password reset email
  router.post('/:projectId/settings/send-reset', authenticateAndVerifyProject, AuthSettingsController.sendPasswordResetEmail);

  // Verify OTP
  router.post('/:projectId/settings/verify-otp', authenticateAndVerifyProject, AuthSettingsController.verifyOTP);

  // Test email provider
  router.post('/:projectId/settings/test-email-provider', authenticateAndVerifyProject, AuthSettingsController.testEmailProvider);

  return router;
}

