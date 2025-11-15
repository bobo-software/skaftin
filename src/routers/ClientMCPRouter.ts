import express from 'express';
import ClientMCPController from '../controllers/ClientMCPController';

const router = express.Router();

// GET routes
router.get('/tools', ClientMCPController.listTools);

// POST routes
router.post('/call', ClientMCPController.callTool);
router.post('/protocol', ClientMCPController.mcpProtocolHandler); // JSON-RPC 2.0 endpoint for Cursor

export { router };

