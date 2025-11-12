import { Router } from 'express';
import { Pool } from 'pg';
import AuthUsersController from '../controllers/AuthUsersController';
import RolesController from '../controllers/RolesController';
import CustomFieldsController from '../controllers/CustomFieldsController';
import AuthSettingsController from '../controllers/AuthSettingsController';
import { authenticateSession } from '../middleware/supertokensAuthMiddleware';

export function createAuthRouter(pool: Pool): Router {
  const router = Router();

  // Initialize controllers
  AuthUsersController.initialize(pool);
  RolesController.initialize(pool);
  CustomFieldsController.initialize(pool);
  AuthSettingsController.initialize(pool);

  // Apply authentication middleware to all routes
  router.use(authenticateSession);

  // ============================================
  // USER MANAGEMENT ROUTES
  // ============================================

  // List all users for a project
  router.get('/:projectId/users', AuthUsersController.listUsers);

  // Get users by role
  router.get('/:projectId/users/by-role/:roleId', AuthUsersController.getUsersByRole);

  // Get a single user
  router.get('/:projectId/users/:userId', AuthUsersController.getUser);

  // Create a new user
  router.post('/:projectId/users', AuthUsersController.createUser);

  // Update a user
  router.put('/:projectId/users/:userId', AuthUsersController.updateUser);

  // Delete a user (soft delete by default, permanent with ?permanent=true)
  router.delete('/:projectId/users/:userId', AuthUsersController.deleteUser);

  // Assign role to user
  router.post('/:projectId/users/:userId/roles', AuthUsersController.assignRole);

  // Remove role from user
  router.delete('/:projectId/users/:userId/roles/:roleId', AuthUsersController.removeRole);

  // ============================================
  // ROLE MANAGEMENT ROUTES
  // ============================================

  // List all roles
  router.get('/:projectId/roles', RolesController.listRoles);

  // Get a single role
  router.get('/:projectId/roles/:roleId', RolesController.getRole);

  // Create a new role
  router.post('/:projectId/roles', RolesController.createRole);

  // Update a role
  router.put('/:projectId/roles/:roleId', RolesController.updateRole);

  // Delete a role
  router.delete('/:projectId/roles/:roleId', RolesController.deleteRole);

  // Get role permissions
  router.get('/:projectId/roles/:roleId/permissions', RolesController.getRolePermissions);

  // Update role permissions
  router.put('/:projectId/roles/:roleId/permissions', RolesController.updateRolePermissions);

  // Update session duration for a role
  router.put('/:projectId/roles/:roleId/session-duration', RolesController.updateSessionDuration);

  // ============================================
  // CUSTOM FIELDS ROUTES
  // ============================================

  // Get available tables (for reference fields)
  router.get('/:projectId/fields/available-tables', CustomFieldsController.getAvailableTables);

  // List all custom fields
  router.get('/:projectId/fields', CustomFieldsController.listCustomFields);

  // Get a single custom field
  router.get('/:projectId/fields/:fieldId', CustomFieldsController.getCustomField);

  // Create a new custom field
  router.post('/:projectId/fields', CustomFieldsController.createCustomField);

  // Update a custom field
  router.put('/:projectId/fields/:fieldId', CustomFieldsController.updateCustomField);

  // Delete a custom field (soft delete by default, permanent with ?permanent=true)
  router.delete('/:projectId/fields/:fieldId', CustomFieldsController.deleteCustomField);

  // Apply custom field (add column to app_users table)
  router.post('/:projectId/fields/:fieldId/apply', CustomFieldsController.applyCustomField);

  // ============================================
  // AUTH SETTINGS ROUTES
  // ============================================

  // Get email providers for project
  router.get('/:projectId/settings/email-providers', AuthSettingsController.getEmailProviders);

  // Get all session durations
  router.get('/:projectId/settings/session-durations', AuthSettingsController.getAllSessionDurations);

  // Get session config for a specific role
  router.get('/:projectId/settings/session-config/:roleId', AuthSettingsController.getSessionConfig);

  // Get auth settings
  router.get('/:projectId/settings', AuthSettingsController.getAuthSettings);

  // Update auth settings
  router.put('/:projectId/settings', AuthSettingsController.updateAuthSettings);

  // Send verification email
  router.post('/:projectId/settings/send-verification', AuthSettingsController.sendVerificationEmail);

  // Send password reset email
  router.post('/:projectId/settings/send-reset', AuthSettingsController.sendPasswordResetEmail);

  // Verify OTP
  router.post('/:projectId/settings/verify-otp', AuthSettingsController.verifyOTP);

  // Test email provider
  router.post('/:projectId/settings/test-email-provider', AuthSettingsController.testEmailProvider);

  return router;
}
