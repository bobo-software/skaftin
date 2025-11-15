import express from 'express';
import DatabaseController from '../controllers/DatabaseController';
import { hybridAuthAndVerifyProject } from '../middleware/hybridAuthMiddleware';

const router = express.Router();

// All database routes require authentication (SuperTokens OR API key) AND project access verification
// Project ID is extracted from API key automatically, or can be provided in URL for SuperTokens
// GET routes
router.get('/tables', hybridAuthAndVerifyProject, DatabaseController.listTables);
router.get('/tables/:tableName/schema', hybridAuthAndVerifyProject, DatabaseController.getTableSchema);
router.get('/tables/:tableName/select', hybridAuthAndVerifyProject, DatabaseController.selectDataGet);

// POST routes
router.post('/tables/create', hybridAuthAndVerifyProject, DatabaseController.createTable);
router.post('/tables/:tableName/rename', hybridAuthAndVerifyProject, DatabaseController.renameTable);
router.post('/tables/:tableName/select', hybridAuthAndVerifyProject, DatabaseController.selectData);
router.post('/tables/:tableName/insert', hybridAuthAndVerifyProject, DatabaseController.insertData);
router.post('/tables/:tableName/bulk-insert', hybridAuthAndVerifyProject, DatabaseController.bulkInsertData);
router.post('/tables/:tableName/columns', hybridAuthAndVerifyProject, DatabaseController.addColumn);
router.post('/query', hybridAuthAndVerifyProject, DatabaseController.executeQuery);

// PUT routes
router.put('/tables/:tableName/update', hybridAuthAndVerifyProject, DatabaseController.updateData);
router.put('/tables/:tableName/columns/:columnName', hybridAuthAndVerifyProject, DatabaseController.alterColumn);

// DELETE routes
router.delete('/tables/:tableName/delete', hybridAuthAndVerifyProject, DatabaseController.deleteData);
router.delete('/tables/:tableName/columns/:columnName', hybridAuthAndVerifyProject, DatabaseController.dropColumn);
router.delete('/tables/:tableName', hybridAuthAndVerifyProject, DatabaseController.dropTable);

// Constraint routes
router.get('/tables/:tableName/constraints', hybridAuthAndVerifyProject, DatabaseController.listConstraints);
router.get('/tables/:tableName/foreign-keys', hybridAuthAndVerifyProject, DatabaseController.listForeignKeys);
router.post('/tables/:tableName/constraints/foreign-key', hybridAuthAndVerifyProject, DatabaseController.createForeignKey);
router.post('/tables/:tableName/constraints/unique', hybridAuthAndVerifyProject, DatabaseController.createUniqueConstraint);
router.post('/tables/:tableName/constraints/primary-key', hybridAuthAndVerifyProject, DatabaseController.createPrimaryKeyConstraint);
router.post('/tables/:tableName/constraints/check', hybridAuthAndVerifyProject, DatabaseController.createCheckConstraint);
router.delete('/tables/:tableName/constraints/:constraintName', hybridAuthAndVerifyProject, DatabaseController.dropConstraint);

// Cron routes
router.get('/cron', hybridAuthAndVerifyProject, DatabaseController.listCronJobs);
router.get('/cron/:jobId/history', hybridAuthAndVerifyProject, DatabaseController.getCronJobHistory);
router.post('/cron', hybridAuthAndVerifyProject, DatabaseController.createCronJob);
router.put('/cron/:jobId', hybridAuthAndVerifyProject, DatabaseController.updateCronJob);
router.patch('/cron/:jobId/toggle', hybridAuthAndVerifyProject, DatabaseController.toggleCronJob);
router.delete('/cron/:jobId', hybridAuthAndVerifyProject, DatabaseController.deleteCronJob);

// Import/Export routes
router.post('/import', hybridAuthAndVerifyProject, DatabaseController.importDatabaseDump);

export { router };

