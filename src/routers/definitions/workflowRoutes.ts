import { RouteDefinition } from '../registry/types';
import WorkflowsController from '../../controllers/WorkflowsController';

/**
 * Workflow API routes
 */
export function createWorkflowRouteDefinitions(): RouteDefinition[] {
  return [
    // List workflows
    {
      method: 'get',
      path: '/',
      handler: WorkflowsController.listWorkflows,
      description: 'List all workflows for a project',
      requiresProject: true,
      requiresAuth: true,
    },
    // Get workflow
    {
      method: 'get',
      path: '/:workflowId',
      handler: WorkflowsController.getWorkflow,
      description: 'Get a specific workflow',
      requiresProject: true,
      requiresAuth: true,
    },
    // Create workflow
    {
      method: 'post',
      path: '/',
      handler: WorkflowsController.createWorkflow,
      description: 'Create a new workflow',
      requiresProject: true,
      requiresAuth: true,
    },
    // Update workflow
    {
      method: 'put',
      path: '/:workflowId',
      handler: WorkflowsController.updateWorkflow,
      description: 'Update a workflow',
      requiresProject: true,
      requiresAuth: true,
    },
    // Delete workflow
    {
      method: 'delete',
      path: '/:workflowId',
      handler: WorkflowsController.deleteWorkflow,
      description: 'Delete a workflow',
      requiresProject: true,
      requiresAuth: true,
    },
    // Execute workflow
    {
      method: 'post',
      path: '/:workflowId/execute',
      handler: WorkflowsController.executeWorkflow,
      description: 'Execute a workflow manually',
      requiresProject: true,
      requiresAuth: true,
    },
    // Get execution history
    {
      method: 'get',
      path: '/:workflowId/executions',
      handler: WorkflowsController.getWorkflowExecutions,
      description: 'Get workflow execution history',
      requiresProject: true,
      requiresAuth: true,
    },
    // Get execution logs
    {
      method: 'get',
      path: '/:workflowId/executions/:executionId/logs',
      handler: WorkflowsController.getExecutionLogs,
      description: 'Get execution logs with node details',
      requiresProject: true,
      requiresAuth: true,
    },
    // Schedule workflow
    {
      method: 'post',
      path: '/:workflowId/schedule',
      handler: WorkflowsController.scheduleWorkflow,
      description: 'Schedule a workflow with cron expression',
      requiresProject: true,
      requiresAuth: true,
    },
    // Unschedule workflow
    {
      method: 'delete',
      path: '/:workflowId/schedule',
      handler: WorkflowsController.unscheduleWorkflow,
      description: 'Unschedule a workflow',
      requiresProject: true,
      requiresAuth: true,
    },
  ];
}

