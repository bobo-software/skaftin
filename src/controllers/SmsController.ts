import { Request, Response } from 'express';
import { Pool } from 'pg';
import CommonUtils from '../utils/CommonUtils';
import { SmsService } from '../services/sms/SmsService';

export default class SmsController {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // ---------- SMS Providers CRUD ----------

  // GET /api/communications/:projectId/sms/providers
  listProviders = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    try {
      const query = `
        SELECT id, project_id, name, provider_type, post_url, is_active, created_at, updated_at
        FROM public.sms_providers
        WHERE project_id = $1
        ORDER BY created_at DESC
      `;
      const result = await this.pool.query(query, [projectId]);
      res.status(200).json({ success: true, data: result.rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message ?? 'Failed to list SMS providers' });
    }
  };

  // GET /api/communications/:projectId/sms/providers/:providerId
  getProvider = async (req: Request, res: Response): Promise<void> => {
    const { projectId, providerId } = req.params;
    try {
      const query = `
        SELECT id, project_id, name, provider_type, post_url, is_active, created_at, updated_at
        FROM public.sms_providers
        WHERE id = $1 AND project_id = $2
      `;
      const result = await this.pool.query(query, [providerId, projectId]);
      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'SMS provider not found' });
        return;
      }
      res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message ?? 'Failed to get SMS provider' });
    }
  };

  // POST /api/communications/:projectId/sms/providers
  createProvider = async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const { name, provider_type, api_key, api_secret, post_url, is_active } = req.body || {};
    if (!name || !provider_type || !api_key || !api_secret || !post_url) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }
    try {
      const query = `
        INSERT INTO public.sms_providers (project_id, name, provider_type, api_key, api_secret, post_url, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true))
        RETURNING id, project_id, name, provider_type, post_url, is_active, created_at, updated_at
      `;
      const result = await this.pool.query(query, [projectId, name, provider_type, api_key, api_secret, post_url, is_active]);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message ?? 'Failed to create SMS provider' });
    }
  };

  // PUT /api/communications/:projectId/sms/providers/:providerId
  updateProvider = async (req: Request, res: Response): Promise<void> => {
    const { projectId, providerId } = req.params;
    const allowed = ['name', 'provider_type', 'api_key', 'api_secret', 'post_url', 'is_active'];
    const updates = req.body || {};
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const [k, v] of Object.entries(updates)) {
      if (allowed.includes(k) && v !== undefined && v !== null && v !== '') {
        fields.push(`${k} = $${idx++}`);
        values.push(v);
      }
    }
    if (fields.length === 0) {
      res.status(400).json({ success: false, error: 'No fields to update' });
      return;
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(providerId, projectId);
    try {
      const query = `
        UPDATE public.sms_providers
        SET ${fields.join(', ')}
        WHERE id = $${idx++} AND project_id = $${idx++}
        RETURNING id, project_id, name, provider_type, post_url, is_active, created_at, updated_at
      `;
      const result = await this.pool.query(query, values);
      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'SMS provider not found' });
        return;
      }
      res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message ?? 'Failed to update SMS provider' });
    }
  };

  // DELETE /api/communications/:projectId/sms/providers/:providerId
  deleteProvider = async (req: Request, res: Response): Promise<void> => {
    const { projectId, providerId } = req.params;
    try {
      const query = `DELETE FROM public.sms_providers WHERE id = $1 AND project_id = $2 RETURNING id`;
      const result = await this.pool.query(query, [providerId, projectId]);
      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'SMS provider not found' });
        return;
      }
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message ?? 'Failed to delete SMS provider' });
    }
  };

  // POST /api/communications/:projectId/sms/send
  send = async (req: Request, res: Response): Promise<void> => {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (decodedToken instanceof Response) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { projectId } = req.params;
    const { messages } = req.body as { messages: { content: string; destination: string }[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ success: false, error: 'messages[] is required' });
      return;
    }

    try {
      const service = new SmsService(this.pool);
      const result = await service.send(projectId, messages);
      if (result.success) {
        res.status(200).json({ success: true, data: result.providerResponse });
        return;
      }
      res.status(502).json({ success: false, error: result.error });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message ?? 'Internal error' });
    }
  };

  // POST /api/communications/:projectId/sms/send-basic
  sendBasic = async (req: Request, res: Response): Promise<void> => {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (decodedToken instanceof Response) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { projectId } = req.params;
    const { message, destination } = req.body as { message: string; destination: string };

    if (!message || !destination) {
      res.status(400).json({ success: false, error: 'message and destination are required' });
      return;
    }

    try {
      const service = new SmsService(this.pool);
      const result = await service.send(projectId, [{ content: message, destination }]);
      if (result.success) {
        res.status(200).json({ success: true, data: result.providerResponse });
        return;
      }
      res.status(502).json({ success: false, error: result.error });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message ?? 'Internal error' });
    }
  };

  // POST /api/communications/:projectId/sms/webhook
  // Generic delivery webhook handler; stores payload for later analytics (MVP: echo)
  webhook = async (req: Request, res: Response): Promise<void> => {
    try {
      // In MVP, accept and ack; future: verify signature, persist to analytics table
      res.status(200).json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message ?? 'Internal error' });
    }
  };
}


