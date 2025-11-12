import { Router } from 'express';
import { Pool } from 'pg';
import AuthUsersController from '../controllers/AuthUsersController';
import AppAuthController from '../controllers/AppAuthController';
import RolesController from '../controllers/RolesController';
import CustomFieldsController from '../controllers/CustomFieldsController';
import AuthSettingsController from '../controllers/AuthSettingsController';
import { authenticateAndAttachUser, verifyProjectAccess } from '../middleware/supertokensAuthMiddleware';
import { extractProjectFromCredentials } from '../middleware/appUserAuthMiddleware';

export function createAuthRouter(pool: Pool): Router {
  const router = Router();

  // Initialize controllers
  AuthUsersController.initialize(pool);
  AppAuthController.initialize(pool);
  RolesController.initialize(pool);
  CustomFieldsController.initialize(pool);
  AuthSettingsController.initialize(pool);

  // Create middleware chains
  const authMiddleware = [...authenticateAndAttachUser, verifyProjectAccess];
  const projectExtractor = extractProjectFromCredentials(pool);

  // ============================================
  // APP USER AUTHENTICATION ROUTES (No auth required)
  // ============================================

  // New routes WITHOUT projectId in URL (project extracted from headers)
  router.post('/auth/register', projectExtractor, AppAuthController.register);
  router.post('/auth/login', projectExtractor, AppAuthController.login);
  router.post('/auth/verify', projectExtractor, AppAuthController.verify);
  router.post('/auth/logout', projectExtractor, AppAuthController.logout);
  router.post('/auth/verify-otp', projectExtractor, AppAuthController.verifyOTP);

  // Legacy routes WITH projectId in URL (backward compatibility)
  router.post('/:projectId/auth/register', projectExtractor, AppAuthController.register);
  router.post('/:projectId/auth/login', projectExtractor, AppAuthController.login);
  router.post('/:projectId/auth/verify', projectExtractor, AppAuthController.verify);
  router.post('/:projectId/auth/logout', projectExtractor, AppAuthController.logout);
  router.post('/:projectId/auth/verify-otp', projectExtractor, AppAuthController.verifyOTP);

  // ============================================
  // USER MANAGEMENT ROUTES (Platform admin auth required)
  // ============================================

  // List all users for a project
  router.get('/:projectId/users', authMiddleware, AuthUsersController.listUsers);

  // Get users by role
  router.get('/:projectId/users/by-role/:roleId', authMiddleware, AuthUsersController.getUsersByRole);

  // Get a single user
  router.get('/:projectId/users/:userId', authMiddleware, AuthUsersController.getUser);

  // Create a new user
  router.post('/:projectId/users', authMiddleware, AuthUsersController.createUser);

  // Update a user
  router.put('/:projectId/users/:userId', authMiddleware, AuthUsersController.updateUser);

  // Delete a user (soft delete by default, permanent with ?permanent=true)
  router.delete('/:projectId/users/:userId', authMiddleware, AuthUsersController.deleteUser);

  // Assign role to user
  router.post('/:projectId/users/:userId/roles', authMiddleware, AuthUsersController.assignRole);

  // Remove role from user
  router.delete('/:projectId/users/:userId/roles/:roleId', authMiddleware, AuthUsersController.removeRole);

  // ============================================
  // ROLE MANAGEMENT ROUTES
  // ============================================

  // List all roles
  router.get('/:projectId/roles', authMiddleware, RolesController.listRoles);

  // Get a single role
  router.get('/:projectId/roles/:roleId', authMiddleware, RolesController.getRole);

  // Create a new role
  router.post('/:projectId/roles', authMiddleware, RolesController.createRole);

  // Update a role
  router.put('/:projectId/roles/:roleId', authMiddleware, RolesController.updateRole);

  // Delete a role
  router.delete('/:projectId/roles/:roleId', authMiddleware, RolesController.deleteRole);

  // Get role permissions
  router.get('/:projectId/roles/:roleId/permissions', authMiddleware, RolesController.getRolePermissions);

  // Update role permissions
  router.put('/:projectId/roles/:roleId/permissions', authMiddleware, RolesController.updateRolePermissions);

  // Update session duration for a role
  router.put('/:projectId/roles/:roleId/session-duration', authMiddleware, RolesController.updateSessionDuration);

  // ============================================
  // CUSTOM FIELDS ROUTES
  // ============================================

  // Get available tables (for reference fields)
  router.get('/:projectId/fields/available-tables', authMiddleware, CustomFieldsController.getAvailableTables);

  // List all custom fields
  router.get('/:projectId/fields', authMiddleware, CustomFieldsController.listCustomFields);

  // Get a single custom field
  router.get('/:projectId/fields/:fieldId', authMiddleware, CustomFieldsController.getCustomField);

  // Create a new custom field
  router.post('/:projectId/fields', authMiddleware, CustomFieldsController.createCustomField);

  // Update a custom field
  router.put('/:projectId/fields/:fieldId', authMiddleware, CustomFieldsController.updateCustomField);

  // Delete a custom field (soft delete by default, permanent with ?permanent=true)
  router.delete('/:projectId/fields/:fieldId', authMiddleware, CustomFieldsController.deleteCustomField);

  // Apply custom field (add column to app_users table)
  router.post('/:projectId/fields/:fieldId/apply', authMiddleware, CustomFieldsController.applyCustomField);

  // ============================================
  // AUTH SETTINGS ROUTES
  // ============================================

  // Get email providers for project
  router.get('/:projectId/settings/email-providers', authMiddleware, AuthSettingsController.getEmailProviders);

  // Get all session durations
  router.get('/:projectId/settings/session-durations', authMiddleware, AuthSettingsController.getAllSessionDurations);

  // Get session config for a specific role
  router.get('/:projectId/settings/session-config/:roleId', authMiddleware, AuthSettingsController.getSessionConfig);

  // Get auth settings
  router.get('/:projectId/settings', authMiddleware, AuthSettingsController.getAuthSettings);

  // Update auth settings
  router.put('/:projectId/settings', authMiddleware, AuthSettingsController.updateAuthSettings);

  // Send verification email
  router.post('/:projectId/settings/send-verification', authMiddleware, AuthSettingsController.sendVerificationEmail);

  // Send password reset email
  router.post('/:projectId/settings/send-reset', authMiddleware, AuthSettingsController.sendPasswordResetEmail);

  // Verify OTP
  router.post('/:projectId/settings/verify-otp', authMiddleware, AuthSettingsController.verifyOTP);

  // Test email provider
  router.post('/:projectId/settings/test-email-provider', authMiddleware, AuthSettingsController.testEmailProvider);

  return router;
}
