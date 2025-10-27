import { Router, Request, Response } from 'express';
import Session from 'supertokens-node/recipe/session';
import ApiKeyService from '../services/apiKey.service';

const router = Router();

// Get all API keys for the authenticated user
router.get('/', async (req: Request, res: Response) => {
  try {
    const session = await Session.getSession(req, res);
    const userId = session.getUserId();

    const apiKeys = await ApiKeyService.listApiKeys(userId);
    
    // Don't return key hashes to the client
    // Note: Database returns snake_case, so we need to access with bracket notation
    const sanitizedKeys = apiKeys.map((key: any) => ({
      id: key.id,
      keyName: key.key_name || key.keyName,
      keyPrefix: key.key_prefix || key.keyPrefix,
      permissions: key.permissions,
      isActive: key.is_active,
      expiresAt: key.expires_at,
      lastUsedAt: key.last_used_at,
      createdAt: key.created_at,
    }));

    res.json({
      success: true,
      keys: sanitizedKeys,
    });
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create a new API key
router.post('/', async (req: Request, res: Response) => {
  try {
    const session = await Session.getSession(req, res);
    const userId = session.getUserId();

    const { keyName, projectId, permissions, expiresAt } = req.body;

    if (!keyName || !projectId || !permissions) {
      return res.status(400).json({
        success: false,
        error: 'keyName, projectId, and permissions are required',
      });
    }

    const newKey = await ApiKeyService.createApiKey({
      userId,
      projectId,
      keyName,
      permissions,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.json({
      success: true,
      key: {
        id: newKey.id,
        keyName: newKey.keyName,
        plainKey: newKey.plainKey, // Only returned once!
        keyPrefix: newKey.keyPrefix,
        permissions: newKey.permissions,
        expiresAt: newKey.expiresAt,
        createdAt: newKey.createdAt,
      },
      message: 'API key created successfully. Save this key securely - it will not be shown again.',
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get a specific API key
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const session = await Session.getSession(req, res);
    const userId = session.getUserId();

    const keyId = parseInt(req.params.id);
    const apiKey = await ApiKeyService.getApiKey(keyId, userId);

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found',
      });
    }

    res.json({
      success: true,
      key: {
        id: apiKey.id,
        keyName: apiKey.key_name,
        keyPrefix: apiKey.key_prefix,
        permissions: apiKey.permissions,
        isActive: apiKey.is_active,
        expiresAt: apiKey.expires_at,
        lastUsedAt: apiKey.last_used_at,
        createdAt: apiKey.created_at,
      },
    });
  } catch (error) {
    console.error('Error getting API key:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update an API key
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const session = await Session.getSession(req, res);
    const userId = session.getUserId();

    const keyId = parseInt(req.params.id);
    const updates = req.body;

    const updatedKey = await ApiKeyService.updateApiKey(keyId, userId, updates);

    res.json({
      success: true,
      key: {
        id: updatedKey.id,
        keyName: updatedKey.key_name,
        keyPrefix: updatedKey.key_prefix,
        permissions: updatedKey.permissions,
        isActive: updatedKey.is_active,
        expiresAt: updatedKey.expires_at,
        lastUsedAt: updatedKey.last_used_at,
        createdAt: updatedKey.created_at,
      },
    });
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete/Revoke an API key
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const session = await Session.getSession(req, res);
    const userId = session.getUserId();

    const keyId = parseInt(req.params.id);
    const success = await ApiKeyService.deleteApiKey(keyId, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'API key not found',
      });
    }

    res.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get API key usage statistics
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const session = await Session.getSession(req, res);
    const userId = session.getUserId();

    const keyId = parseInt(req.params.id);
    const days = parseInt(req.query.days as string) || 30;

    const stats = await ApiKeyService.getApiKeyStats(keyId, userId, days);

    res.json({
      success: true,
      stats,
      period: `${days} days`,
    });
  } catch (error) {
    console.error('Error getting API key stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
