import express from 'express';
import DatabaseController from '../controllers/DatabaseController';
import { authenticateAndVerifyProject } from '../middleware/supertokensAuthMiddleware';

const router = express.Router();

// All database routes require authentication AND project access verification
// GET routes
router.get('/:projectId/tables', authenticateAndVerifyProject, DatabaseController.listTables);
router.get('/:projectId/tables/:tableName/schema', authenticateAndVerifyProject, DatabaseController.getTableSchema);

// POST routes
router.post('/:projectId/tables/create', authenticateAndVerifyProject, DatabaseController.createTable);
router.post('/:projectId/tables/:tableName/select', authenticateAndVerifyProject, DatabaseController.selectData);
router.post('/:projectId/tables/:tableName/insert', authenticateAndVerifyProject, DatabaseController.insertData);
router.post('/:projectId/tables/:tableName/bulk-insert', authenticateAndVerifyProject, DatabaseController.bulkInsertData);
router.post('/:projectId/query', authenticateAndVerifyProject, DatabaseController.executeQuery);

// PUT routes
router.put('/:projectId/tables/:tableName/update', authenticateAndVerifyProject, DatabaseController.updateData);

// DELETE routes
router.delete('/:projectId/tables/:tableName/delete', authenticateAndVerifyProject, DatabaseController.deleteData);
router.delete('/:projectId/tables/:tableName', authenticateAndVerifyProject, DatabaseController.dropTable);

export { router };

