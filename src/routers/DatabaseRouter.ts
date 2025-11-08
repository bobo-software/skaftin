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
router.post('/:projectId/tables/:tableName/rename', authenticateAndVerifyProject, DatabaseController.renameTable);
router.post('/:projectId/tables/:tableName/select', authenticateAndVerifyProject, DatabaseController.selectData);
router.post('/:projectId/tables/:tableName/insert', authenticateAndVerifyProject, DatabaseController.insertData);
router.post('/:projectId/tables/:tableName/bulk-insert', authenticateAndVerifyProject, DatabaseController.bulkInsertData);
router.post('/:projectId/tables/:tableName/columns', authenticateAndVerifyProject, DatabaseController.addColumn);
router.post('/:projectId/query', authenticateAndVerifyProject, DatabaseController.executeQuery);

// PUT routes
router.put('/:projectId/tables/:tableName/update', authenticateAndVerifyProject, DatabaseController.updateData);
router.put('/:projectId/tables/:tableName/columns/:columnName', authenticateAndVerifyProject, DatabaseController.alterColumn);

// DELETE routes
router.delete('/:projectId/tables/:tableName/delete', authenticateAndVerifyProject, DatabaseController.deleteData);
router.delete('/:projectId/tables/:tableName/columns/:columnName', authenticateAndVerifyProject, DatabaseController.dropColumn);
router.delete('/:projectId/tables/:tableName', authenticateAndVerifyProject, DatabaseController.dropTable);

// Constraint routes
router.get('/:projectId/tables/:tableName/constraints', authenticateAndVerifyProject, DatabaseController.listConstraints);
router.get('/:projectId/tables/:tableName/foreign-keys', authenticateAndVerifyProject, DatabaseController.listForeignKeys);
router.post('/:projectId/tables/:tableName/constraints/foreign-key', authenticateAndVerifyProject, DatabaseController.createForeignKey);
router.post('/:projectId/tables/:tableName/constraints/unique', authenticateAndVerifyProject, DatabaseController.createUniqueConstraint);
router.post('/:projectId/tables/:tableName/constraints/primary-key', authenticateAndVerifyProject, DatabaseController.createPrimaryKeyConstraint);
router.post('/:projectId/tables/:tableName/constraints/check', authenticateAndVerifyProject, DatabaseController.createCheckConstraint);
router.delete('/:projectId/tables/:tableName/constraints/:constraintName', authenticateAndVerifyProject, DatabaseController.dropConstraint);

// Cron routes
router.get('/:projectId/cron', authenticateAndVerifyProject, DatabaseController.listCronJobs);
router.get('/:projectId/cron/:jobId/history', authenticateAndVerifyProject, DatabaseController.getCronJobHistory);
router.post('/:projectId/cron', authenticateAndVerifyProject, DatabaseController.createCronJob);
router.put('/:projectId/cron/:jobId', authenticateAndVerifyProject, DatabaseController.updateCronJob);
router.patch('/:projectId/cron/:jobId/toggle', authenticateAndVerifyProject, DatabaseController.toggleCronJob);
router.delete('/:projectId/cron/:jobId', authenticateAndVerifyProject, DatabaseController.deleteCronJob);

export { router };

