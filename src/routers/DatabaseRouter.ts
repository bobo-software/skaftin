import express from 'express';
import DatabaseController from '../controllers/DatabaseController';
import { authenticateToken, verifyProjectAccess } from '../middleware/authMiddleware';

const router = express.Router();

// All database routes require authentication
router.use(authenticateToken);

// Apply verifyProjectAccess to each route individually (after params are parsed)
// GET routes
router.get('/:projectId/tables', verifyProjectAccess, DatabaseController.listTables);
router.get('/:projectId/tables/:tableName/schema', verifyProjectAccess, DatabaseController.getTableSchema);

// POST routes
router.post('/:projectId/tables/create', verifyProjectAccess, DatabaseController.createTable);
router.post('/:projectId/tables/:tableName/select', verifyProjectAccess, DatabaseController.selectData);
router.post('/:projectId/tables/:tableName/insert', verifyProjectAccess, DatabaseController.insertData);
router.post('/:projectId/tables/:tableName/bulk-insert', verifyProjectAccess, DatabaseController.bulkInsertData);
router.post('/:projectId/query', verifyProjectAccess, DatabaseController.executeQuery);

// PUT routes
router.put('/:projectId/tables/:tableName/update', verifyProjectAccess, DatabaseController.updateData);

// DELETE routes
router.delete('/:projectId/tables/:tableName/delete', verifyProjectAccess, DatabaseController.deleteData);
router.delete('/:projectId/tables/:tableName', verifyProjectAccess, DatabaseController.dropTable);

export { router };

