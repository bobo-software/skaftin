import express from 'express';
import MCPController from '../controllers/MCPController';

const router = express.Router();

// GET routes
router.get('/tools', MCPController.listTools);

// POST routes
router.post('/call', MCPController.callTool);
router.post('/protocol', MCPController.mcpProtocolHandler); // JSON-RPC 2.0 endpoint for Cursor

// Legacy endpoint (for compatibility)
router.post('/', MCPController.legacyHandler);

export { router };

