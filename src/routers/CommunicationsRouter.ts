import express, { Router, Request, Response, NextFunction } from 'express';
import CommunicationsController from '../controllers/CommunicationsController';
import SmsController from '../controllers/SmsController';
import { Pool } from 'pg';
import { authenticateAndAttachUser, verifyProjectAccess } from '../middleware/supertokensAuthMiddleware';

// Debug middleware for communications routes
const debugMiddleware = (req: Request, res: Response, next: NextFunction) => {
  console.log('\n🔍 [CommunicationsRouter] Incoming Request:');
  console.log('  └─ Method:', req.method);
  console.log('  └─ URL:', req.originalUrl);
  console.log('  └─ Path:', req.path);
  console.log('  └─ Params:', req.params);
  console.log('  └─ Headers:');
  console.log('     └─ Authorization:', req.headers.authorization);
  console.log('     └─ Content-Type:', req.headers['content-type']);
  next();
};

export function createCommunicationsRouter(pool: Pool): Router {
  const router = express.Router();
  const controller = new CommunicationsController(pool);
  const smsController = new SmsController(pool);

  // Add debug middleware to all routes
  router.use(debugMiddleware);

  // All routes require SuperTokens authentication and project access verification
  const authMiddleware = [...authenticateAndAttachUser, verifyProjectAccess];

  // Email Provider Management Routes
  router.get('/:projectId/email/providers', authMiddleware, controller.listProviders);
  router.get('/:projectId/email/providers/:providerId', authMiddleware, controller.getProvider);
  router.post('/:projectId/email/providers', authMiddleware, controller.createProvider);
  router.put('/:projectId/email/providers/:providerId', authMiddleware, controller.updateProvider);
  router.delete('/:projectId/email/providers/:providerId', authMiddleware, controller.deleteProvider);

  // Email Provider Testing
  router.post('/:projectId/email/providers/:providerId/test', authMiddleware, controller.testConnection);

  // Email Sending
  router.post('/:projectId/email/send', authMiddleware, controller.sendEmail);

  // Email Template Management Routes
  router.get('/:projectId/email/templates', authMiddleware, controller.listEmailTemplates);
  router.get('/:projectId/email/templates/:templateId', authMiddleware, controller.getEmailTemplate);
  router.post('/:projectId/email/templates', authMiddleware, controller.createEmailTemplate);
  router.put('/:projectId/email/templates/:templateId', authMiddleware, controller.updateEmailTemplate);
  router.delete('/:projectId/email/templates/:templateId', authMiddleware, controller.deleteEmailTemplate);

  // SMS Template Management Routes
  router.get('/:projectId/sms/templates', authMiddleware, controller.listSmsTemplates);
  router.get('/:projectId/sms/templates/:templateId', authMiddleware, controller.getSmsTemplate);
  router.post('/:projectId/sms/templates', authMiddleware, controller.createSmsTemplate);
  router.put('/:projectId/sms/templates/:templateId', authMiddleware, controller.updateSmsTemplate);
  router.delete('/:projectId/sms/templates/:templateId', authMiddleware, controller.deleteSmsTemplate);

  // SMS Sending
  router.post('/:projectId/sms/send', authMiddleware, smsController.send);
  router.post('/:projectId/sms/send-basic', authMiddleware, smsController.sendBasic);

  // SMS Delivery Webhook (public endpoint for provider callbacks)
  router.post('/:projectId/sms/webhook', smsController.webhook);

  // SMS Provider Management Routes
  router.get('/:projectId/sms/providers', authMiddleware, smsController.listProviders);
  router.get('/:projectId/sms/providers/:providerId', authMiddleware, smsController.getProvider);
  router.post('/:projectId/sms/providers', authMiddleware, smsController.createProvider);
  router.put('/:projectId/sms/providers/:providerId', authMiddleware, smsController.updateProvider);
  router.delete('/:projectId/sms/providers/:providerId', authMiddleware, smsController.deleteProvider);

  // SMS Message Status
  router.post('/:projectId/sms/check-status', authMiddleware, smsController.checkMessageStatus);

  // WhatsApp Sending
  router.post('/:projectId/whatsapp/send', authMiddleware, smsController.sendWhatsApp);
  router.post('/:projectId/whatsapp/send-basic', authMiddleware, smsController.sendWhatsAppBasic);
  router.post('/:projectId/whatsapp/template', authMiddleware, smsController.sendWhatsAppTemplate);

  return router;
}

// Export a default router for backward compatibility
export const router = Router();

