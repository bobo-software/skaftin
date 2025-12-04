import { RouteDefinition } from '../registry/types';
import DatabaseController from '../../controllers/DatabaseController';

/**
 * Shared database route definitions
 * These can be used by both admin and client routers with different middleware
 */
export function createDatabaseRouteDefinitions(): RouteDefinition[] {
  return [
    // ============================================================================
    // TABLE ROUTES
    // ============================================================================

    {
      method: 'get',
      path: '/tables',
      handler: DatabaseController.listTables,
      description: 'List all tables in a project',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: '/tables/:tableName/schema',
      handler: DatabaseController.getTableSchema,
      description: 'Get table schema',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: '/tables/:tableName/select',
      handler: DatabaseController.selectDataGet,
      description: 'Select data from table (GET)',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/tables/create',
      handler: DatabaseController.createTable,
      description: 'Create a new table',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/tables/:tableName/rename',
      handler: DatabaseController.renameTable,
      description: 'Rename a table',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/tables/:tableName/select',
      handler: DatabaseController.selectData,
      description: 'Select data from table (POST)',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/tables/:tableName/insert',
      handler: DatabaseController.insertData,
      description: 'Insert data into table',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/tables/:tableName/bulk-insert',
      handler: DatabaseController.bulkInsertData,
      description: 'Bulk insert data into table',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'put',
      path: '/tables/:tableName/update',
      handler: DatabaseController.updateData,
      description: 'Update data in table',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'delete',
      path: '/tables/:tableName/delete',
      handler: DatabaseController.deleteData,
      description: 'Delete data from table',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'delete',
      path: '/tables/:tableName',
      handler: DatabaseController.dropTable,
      description: 'Drop a table',
      requiresProject: true,
      requiresAuth: true,
    },

    // ============================================================================
    // COLUMN ROUTES
    // ============================================================================

    {
      method: 'post',
      path: '/tables/:tableName/columns',
      handler: DatabaseController.addColumn,
      description: 'Add column to table',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'put',
      path: '/tables/:tableName/columns/:columnName',
      handler: DatabaseController.alterColumn,
      description: 'Alter column in table',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'delete',
      path: '/tables/:tableName/columns/:columnName',
      handler: DatabaseController.dropColumn,
      description: 'Drop column from table',
      requiresProject: true,
      requiresAuth: true,
    },

    // ============================================================================
    // CONSTRAINT ROUTES
    // ============================================================================

    {
      method: 'get',
      path: '/tables/:tableName/constraints',
      handler: DatabaseController.listConstraints,
      description: 'List all constraints for a table',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: '/tables/:tableName/foreign-keys',
      handler: DatabaseController.listForeignKeys,
      description: 'List foreign keys for a table',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/tables/:tableName/constraints/foreign-key',
      handler: DatabaseController.createForeignKey,
      description: 'Create foreign key constraint',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/tables/:tableName/constraints/unique',
      handler: DatabaseController.createUniqueConstraint,
      description: 'Create unique constraint',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/tables/:tableName/constraints/primary-key',
      handler: DatabaseController.createPrimaryKeyConstraint,
      description: 'Create primary key constraint',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/tables/:tableName/constraints/check',
      handler: DatabaseController.createCheckConstraint,
      description: 'Create check constraint',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'delete',
      path: '/tables/:tableName/constraints/:constraintName',
      handler: DatabaseController.dropConstraint,
      description: 'Drop constraint from table',
      requiresProject: true,
      requiresAuth: true,
    },

    // ============================================================================
    // QUERY ROUTES
    // ============================================================================

    {
      method: 'post',
      path: '/query',
      handler: DatabaseController.executeQuery,
      description: 'Execute SQL query',
      requiresProject: true,
      requiresAuth: true,
    },

    // ============================================================================
    // CRON JOB ROUTES
    // ============================================================================

    {
      method: 'get',
      path: '/cron',
      handler: DatabaseController.listCronJobs,
      description: 'List all cron jobs for a project',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'get',
      path: '/cron/:jobId/history',
      handler: DatabaseController.getCronJobHistory,
      description: 'Get cron job execution history',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/cron',
      handler: DatabaseController.createCronJob,
      description: 'Create a new cron job',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'put',
      path: '/cron/:jobId',
      handler: DatabaseController.updateCronJob,
      description: 'Update a cron job',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'patch',
      path: '/cron/:jobId/toggle',
      handler: DatabaseController.toggleCronJob,
      description: 'Toggle cron job active status',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'delete',
      path: '/cron/:jobId',
      handler: DatabaseController.deleteCronJob,
      description: 'Delete a cron job',
      requiresProject: true,
      requiresAuth: true,
    },

    // ============================================================================
    // IMPORT/EXPORT ROUTES
    // ============================================================================

    {
      method: 'post',
      path: '/import',
      handler: DatabaseController.importDatabaseDump,
      description: 'Import database dump',
      requiresProject: true,
      requiresAuth: true,
    },
    {
      method: 'post',
      path: '/export',
      handler: DatabaseController.exportDatabaseDump,
      description: 'Export database dump',
      requiresProject: true,
      requiresAuth: true,
    },
  ];
}


