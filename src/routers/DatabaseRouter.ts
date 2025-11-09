import express from 'express';
import DatabaseController from '../controllers/DatabaseController';
import { hybridAuthAndVerifyProject } from '../middleware/hybridAuthMiddleware';

const router = express.Router();

// All database routes require authentication (SuperTokens OR API key) AND project access verification
// GET routes
router.get('/:projectId/tables', hybridAuthAndVerifyProject, DatabaseController.listTables);
router.get('/:projectId/tables/:tableName/schema', hybridAuthAndVerifyProject, DatabaseController.getTableSchema);

// POST routes
router.post('/:projectId/tables/create', hybridAuthAndVerifyProject, DatabaseController.createTable);
router.post('/:projectId/tables/:tableName/rename', hybridAuthAndVerifyProject, DatabaseController.renameTable);
router.post('/:projectId/tables/:tableName/select', hybridAuthAndVerifyProject, DatabaseController.selectData);
router.post('/:projectId/tables/:tableName/insert', hybridAuthAndVerifyProject, DatabaseController.insertData);
router.post('/:projectId/tables/:tableName/bulk-insert', hybridAuthAndVerifyProject, DatabaseController.bulkInsertData);
router.post('/:projectId/tables/:tableName/columns', hybridAuthAndVerifyProject, DatabaseController.addColumn);
router.post('/:projectId/query', hybridAuthAndVerifyProject, DatabaseController.executeQuery);

// PUT routes
router.put('/:projectId/tables/:tableName/update', hybridAuthAndVerifyProject, DatabaseController.updateData);
router.put('/:projectId/tables/:tableName/columns/:columnName', hybridAuthAndVerifyProject, DatabaseController.alterColumn);

// DELETE routes
router.delete('/:projectId/tables/:tableName/delete', hybridAuthAndVerifyProject, DatabaseController.deleteData);
router.delete('/:projectId/tables/:tableName/columns/:columnName', hybridAuthAndVerifyProject, DatabaseController.dropColumn);
router.delete('/:projectId/tables/:tableName', hybridAuthAndVerifyProject, DatabaseController.dropTable);

// Constraint routes
router.get('/:projectId/tables/:tableName/constraints', hybridAuthAndVerifyProject, DatabaseController.listConstraints);
router.get('/:projectId/tables/:tableName/foreign-keys', hybridAuthAndVerifyProject, DatabaseController.listForeignKeys);
router.post('/:projectId/tables/:tableName/constraints/foreign-key', hybridAuthAndVerifyProject, DatabaseController.createForeignKey);
router.post('/:projectId/tables/:tableName/constraints/unique', hybridAuthAndVerifyProject, DatabaseController.createUniqueConstraint);
router.post('/:projectId/tables/:tableName/constraints/primary-key', hybridAuthAndVerifyProject, DatabaseController.createPrimaryKeyConstraint);
router.post('/:projectId/tables/:tableName/constraints/check', hybridAuthAndVerifyProject, DatabaseController.createCheckConstraint);
router.delete('/:projectId/tables/:tableName/constraints/:constraintName', hybridAuthAndVerifyProject, DatabaseController.dropConstraint);

// Cron routes
router.get('/:projectId/cron', hybridAuthAndVerifyProject, DatabaseController.listCronJobs);
router.get('/:projectId/cron/:jobId/history', hybridAuthAndVerifyProject, DatabaseController.getCronJobHistory);
router.post('/:projectId/cron', hybridAuthAndVerifyProject, DatabaseController.createCronJob);
router.put('/:projectId/cron/:jobId', hybridAuthAndVerifyProject, DatabaseController.updateCronJob);
router.patch('/:projectId/cron/:jobId/toggle', hybridAuthAndVerifyProject, DatabaseController.toggleCronJob);
router.delete('/:projectId/cron/:jobId', hybridAuthAndVerifyProject, DatabaseController.deleteCronJob);

// Import/Export routes
router.post('/:projectId/import', hybridAuthAndVerifyProject, DatabaseController.importDatabaseDump);

export { router };

