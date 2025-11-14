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

  // App user authentication routes (project extracted from API key)
  router.post('/auth/register', projectExtractor, AppAuthController.register);
  router.post('/auth/login', projectExtractor, AppAuthController.login);
  router.post('/auth/verify', projectExtractor, AppAuthController.verify);
  router.post('/auth/logout', projectExtractor, AppAuthController.logout);
  router.post('/auth/verify-otp', projectExtractor, AppAuthController.verifyOTP);

  // ============================================
  // USER MANAGEMENT ROUTES (Platform admin auth required)
  // Project ID is extracted from API key automatically, or can be provided in URL for SuperTokens
  // ============================================

  // List all users for a project
  router.get('/users', projectExtractor, authMiddleware, AuthUsersController.listUsers);

  // Get users by role
  router.get('/users/by-role/:roleId', projectExtractor, authMiddleware, AuthUsersController.getUsersByRole);

  // Get a single user
  router.get('/users/:userId', projectExtractor, authMiddleware, AuthUsersController.getUser);

  // Create a new user
  router.post('/users', projectExtractor, authMiddleware, AuthUsersController.createUser);

  // Update a user
  router.put('/users/:userId', projectExtractor, authMiddleware, AuthUsersController.updateUser);

  // Delete a user (soft delete by default, permanent with ?permanent=true)
  router.delete('/users/:userId', projectExtractor, authMiddleware, AuthUsersController.deleteUser);

  // Assign role to user
  router.post('/users/:userId/roles', projectExtractor, authMiddleware, AuthUsersController.assignRole);

  // Remove role from user
  router.delete('/users/:userId/roles/:roleId', projectExtractor, authMiddleware, AuthUsersController.removeRole);

  // ============================================
  // ROLE MANAGEMENT ROUTES
  // ============================================

  // List all roles
  router.get('/roles', projectExtractor, authMiddleware, RolesController.listRoles);

  // Get a single role
  router.get('/roles/:roleId', projectExtractor, authMiddleware, RolesController.getRole);

  // Create a new role
  router.post('/roles', projectExtractor, authMiddleware, RolesController.createRole);

  // Update a role
  router.put('/roles/:roleId', projectExtractor, authMiddleware, RolesController.updateRole);

  // Delete a role
  router.delete('/roles/:roleId', projectExtractor, authMiddleware, RolesController.deleteRole);

  // Get role permissions
  router.get('/roles/:roleId/permissions', projectExtractor, authMiddleware, RolesController.getRolePermissions);

  // Update role permissions
  router.put('/roles/:roleId/permissions', projectExtractor, authMiddleware, RolesController.updateRolePermissions);

  // Update session duration for a role
  router.put('/roles/:roleId/session-duration', projectExtractor, authMiddleware, RolesController.updateSessionDuration);

  // ============================================
  // CUSTOM FIELDS ROUTES
  // ============================================

  // Get available tables (for reference fields)
  router.get('/fields/available-tables', projectExtractor, authMiddleware, CustomFieldsController.getAvailableTables);

  // List all custom fields
  router.get('/fields', projectExtractor, authMiddleware, CustomFieldsController.listCustomFields);

  // Get a single custom field
  router.get('/fields/:fieldId', projectExtractor, authMiddleware, CustomFieldsController.getCustomField);

  // Create a new custom field
  router.post('/fields', projectExtractor, authMiddleware, CustomFieldsController.createCustomField);

  // Update a custom field
  router.put('/fields/:fieldId', projectExtractor, authMiddleware, CustomFieldsController.updateCustomField);

  // Delete a custom field (soft delete by default, permanent with ?permanent=true)
  router.delete('/fields/:fieldId', projectExtractor, authMiddleware, CustomFieldsController.deleteCustomField);

  // Apply custom field (add column to app_users table)
  router.post('/fields/:fieldId/apply', projectExtractor, authMiddleware, CustomFieldsController.applyCustomField);

  // ============================================
  // AUTH SETTINGS ROUTES
  // ============================================

  // Get email providers for project
  router.get('/settings/email-providers', projectExtractor, authMiddleware, AuthSettingsController.getEmailProviders);

  // Get all session durations
  router.get('/settings/session-durations', projectExtractor, authMiddleware, AuthSettingsController.getAllSessionDurations);

  // Get session config for a specific role
  router.get('/settings/session-config/:roleId', projectExtractor, authMiddleware, AuthSettingsController.getSessionConfig);

  // Get auth settings
  router.get('/settings', projectExtractor, authMiddleware, AuthSettingsController.getAuthSettings);

  // Update auth settings
  router.put('/settings', projectExtractor, authMiddleware, AuthSettingsController.updateAuthSettings);

  // Send verification email
  router.post('/settings/send-verification', projectExtractor, authMiddleware, AuthSettingsController.sendVerificationEmail);

  // Send password reset email
  router.post('/settings/send-reset', projectExtractor, authMiddleware, AuthSettingsController.sendPasswordResetEmail);

  // Verify OTP
  router.post('/settings/verify-otp', projectExtractor, authMiddleware, AuthSettingsController.verifyOTP);

  // Test email provider
  router.post('/settings/test-email-provider', projectExtractor, authMiddleware, AuthSettingsController.testEmailProvider);

  return router;
}
