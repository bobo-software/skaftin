import { Router } from 'express';
import { Pool } from 'pg';
import { createMiddlewareBuilder } from './builders/MiddlewareBuilder';
import { applyClientRoutes } from './helpers/routeHelper';
import CommunicationsController from '../controllers/CommunicationsController';
import SmsController from '../controllers/SmsController';
import { RouteDefinition } from './registry/types';

/**
 * Create client communications router
 * Uses hybrid authentication (API key or SuperTokens) with project ID from API key or URL
 */
export function createClientCommunicationsRouter(pool: Pool): Router {
  const router = Router();
  
  const controller = new CommunicationsController(pool);
  const smsController = new SmsController(pool);
  
  const middlewareBuilder = createMiddlewareBuilder(pool, false); // isAdmin = false
  
  // Define routes (project ID will be auto-extracted from API key)
  const routes: RouteDefinition[] = [
    // SMS Sending
    {
      method: 'post',
      path: '/sms/send',
      handler: smsController.send,
      description: 'Send bulk SMS messages',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/sms/send-basic',
      handler: smsController.sendBasic,
      description: 'Send single SMS message',
      requiresProject: true,
      requiresAuth: true,
    },
    // SMS Provider Management
    {
      method: 'get',
      path: '/sms/providers',
      handler: smsController.listProviders,
      description: 'List SMS providers',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: '/sms/providers/:providerId',
      handler: smsController.getProvider,
      description: 'Get SMS provider',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/sms/providers',
      handler: smsController.createProvider,
      description: 'Create SMS provider',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'put',
      path: '/sms/providers/:providerId',
      handler: smsController.updateProvider,
      description: 'Update SMS provider',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'delete',
      path: '/sms/providers/:providerId',
      handler: smsController.deleteProvider,
      description: 'Delete SMS provider',
      requiresProject: true,
      requiresAuth: true,
    },
    // SMS Templates
    {
      method: 'get',
      path: '/sms/templates',
      handler: controller.listSmsTemplates,
      description: 'List SMS templates',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: '/sms/templates/:templateId',
      handler: controller.getSmsTemplate,
      description: 'Get SMS template',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/sms/templates',
      handler: controller.createSmsTemplate,
      description: 'Create SMS template',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'put',
      path: '/sms/templates/:templateId',
      handler: controller.updateSmsTemplate,
      description: 'Update SMS template',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'delete',
      path: '/sms/templates/:templateId',
      handler: controller.deleteSmsTemplate,
      description: 'Delete SMS template',
      requiresProject: true,
      requiresAuth: true,
    },
  ];
  
  // Apply routes with hybrid auth middleware
  applyClientRoutes(router, routes, middlewareBuilder.buildAuthChain());
  
  return router;
}

