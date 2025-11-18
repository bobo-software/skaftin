import { Response } from 'express';
import { Pool } from 'pg';
import { db } from '../db/drizzle.config';
import {
  workflows,
  workflowNodes,
  workflowEdges,
  workflowExecutions,
  workflowNodeExecutions,
} from '../db/schemas/WorkflowsSchema';
import { eq, desc } from 'drizzle-orm';
import ResponseUtils from '../utils/ResponseUtils';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import { WorkflowEngine } from '../services/WorkflowEngine';
import { WorkflowScheduler } from '../services/WorkflowScheduler';
import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
} from '../types/workflow.types';

type WorkflowRequest = SuperTokensAuthenticatedRequest & {
  projectId?: number;
};

class WorkflowsController {
  private static pool: Pool;
  private static workflowEngine: WorkflowEngine;
  private static workflowScheduler: WorkflowScheduler;

  static initialize(pool: Pool, baseUrl: string = 'http://localhost:8001') {
    WorkflowsController.pool = pool;
    WorkflowsController.workflowEngine = new WorkflowEngine(pool);
    WorkflowsController.workflowScheduler = new WorkflowScheduler(pool, baseUrl);
  }

  /**
   * Get project ID from request
   */
  private static getProjectId(req: WorkflowRequest): number | null {
    if (req.projectId) {
      return req.projectId;
    }
    const projectId = req.params.projectId;
    return projectId ? parseInt(projectId, 10) : null;
  }

  /**
   * List all workflows for a project
   * GET /api/workflows/:projectId
   */
  static async listWorkflows(req: WorkflowRequest, res: Response) {
    try {
      const projectId = WorkflowsController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const workflowsList = await db
        .select()
        .from(workflows)
        .where(eq(workflows.project_id, projectId));

      ResponseUtils.success(res, 'Workflows fetched successfully', workflowsList);
    } catch (error) {
      console.error('Error listing workflows:', error);
      ResponseUtils.error(res, 'Failed to list workflows', error);
    }
  }

  /**
   * Get a specific workflow
   * GET /api/workflows/:projectId/:workflowId
   */
  static async getWorkflow(req: WorkflowRequest, res: Response) {
    try {
      const projectId = WorkflowsController.getProjectId(req);
      const workflowId = parseInt(req.params.workflowId, 10);

      if (!projectId || isNaN(workflowId)) {
        return ResponseUtils.error(res, 'Project ID and Workflow ID are required', null, null, 400);
      }

      const workflow = await WorkflowsController.workflowEngine.loadWorkflow(workflowId);

      if (!workflow || workflow.projectId !== projectId) {
        return ResponseUtils.error(res, 'Workflow not found', null, null, 404);
      }

      ResponseUtils.success(res, 'Workflow fetched successfully', workflow);
    } catch (error) {
      console.error('Error getting workflow:', error);
      ResponseUtils.error(res, 'Failed to get workflow', error);
    }
  }

  /**
   * Create a new workflow
   * POST /api/workflows/:projectId
   */
  static async createWorkflow(req: WorkflowRequest, res: Response) {
    try {
      const projectId = WorkflowsController.getProjectId(req);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const { name, description, enabled, schedule, nodes, edges } = req.body;

      if (!name) {
        return ResponseUtils.error(res, 'Workflow name is required', null, null, 400);
      }

      if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
        return ResponseUtils.error(res, 'Workflow must have at least one node', null, null, 400);
      }

      const userId = (req as any).userId || null;

      // Create workflow
      const workflowResult = await db
        .insert(workflows)
        .values({
          project_id: projectId,
          name,
          description: description || null,
          enabled: enabled !== false,
          schedule: schedule || null,
          created_by: userId,
        })
        .returning();

      const workflowId = workflowResult[0].id;

      // Create nodes
      for (const node of nodes) {
        await db.insert(workflowNodes).values({
          workflow_id: workflowId,
          node_id: node.id,
          type: node.type,
          position_x: Math.round(node.position.x),
          position_y: Math.round(node.position.y),
          data: node.data,
        });
      }

      // Create edges
      if (edges && Array.isArray(edges)) {
        for (const edge of edges) {
          await db.insert(workflowEdges).values({
            workflow_id: workflowId,
            source_node_id: edge.source,
            target_node_id: edge.target,
            source_handle: edge.sourceHandle || null,
            target_handle: edge.targetHandle || null,
          });
        }
      }

      // Schedule workflow if schedule is provided
      if (schedule) {
        await WorkflowsController.workflowScheduler.scheduleWorkflow(
          workflowId,
          schedule
        );
      }

      const workflow = await WorkflowsController.workflowEngine.loadWorkflow(workflowId);

      ResponseUtils.success(res, 'Workflow created successfully', workflow, 201);
    } catch (error) {
      console.error('Error creating workflow:', error);
      ResponseUtils.error(res, 'Failed to create workflow', error);
    }
  }

  /**
   * Update a workflow
   * PUT /api/workflows/:projectId/:workflowId
   */
  static async updateWorkflow(req: WorkflowRequest, res: Response) {
    try {
      const projectId = WorkflowsController.getProjectId(req);
      const workflowId = parseInt(req.params.workflowId, 10);

      if (!projectId || isNaN(workflowId)) {
        return ResponseUtils.error(res, 'Project ID and Workflow ID are required', null, null, 400);
      }

      const { name, description, enabled, schedule, nodes, edges } = req.body;

      // Verify workflow exists and belongs to project
      const existingWorkflow = await WorkflowsController.workflowEngine.loadWorkflow(workflowId);
      if (!existingWorkflow || existingWorkflow.projectId !== projectId) {
        return ResponseUtils.error(res, 'Workflow not found', null, null, 404);
      }

      // Update workflow
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (enabled !== undefined) updateData.enabled = enabled;
      if (schedule !== undefined) updateData.schedule = schedule;
      updateData.updated_at = new Date();

      await db.update(workflows).set(updateData).where(eq(workflows.id, workflowId));

      // Update nodes if provided
      if (nodes && Array.isArray(nodes)) {
        // Delete existing nodes
        await db.delete(workflowNodes).where(eq(workflowNodes.workflow_id, workflowId));

        // Insert new nodes
        for (const node of nodes) {
          await db.insert(workflowNodes).values({
            workflow_id: workflowId,
            node_id: node.id,
            type: node.type,
            position_x: Math.round(node.position.x),
            position_y: Math.round(node.position.y),
            data: node.data,
          });
        }
      }

      // Update edges if provided
      if (edges && Array.isArray(edges)) {
        // Delete existing edges
        await db.delete(workflowEdges).where(eq(workflowEdges.workflow_id, workflowId));

        // Insert new edges
        for (const edge of edges) {
          await db.insert(workflowEdges).values({
            workflow_id: workflowId,
            source_node_id: edge.source,
            target_node_id: edge.target,
            source_handle: edge.sourceHandle || null,
            target_handle: edge.targetHandle || null,
          });
        }
      }

      // Update schedule if provided
      if (schedule !== undefined) {
        if (schedule) {
          await WorkflowsController.workflowScheduler.scheduleWorkflow(
            workflowId,
            schedule
          );
        } else {
          await WorkflowsController.workflowScheduler.unscheduleWorkflow(workflowId);
        }
      }

      const workflow = await WorkflowsController.workflowEngine.loadWorkflow(workflowId);

      ResponseUtils.success(res, 'Workflow updated successfully', workflow);
    } catch (error) {
      console.error('Error updating workflow:', error);
      ResponseUtils.error(res, 'Failed to update workflow', error);
    }
  }

  /**
   * Delete a workflow
   * DELETE /api/workflows/:projectId/:workflowId
   */
  static async deleteWorkflow(req: WorkflowRequest, res: Response) {
    try {
      const projectId = WorkflowsController.getProjectId(req);
      const workflowId = parseInt(req.params.workflowId, 10);

      if (!projectId || isNaN(workflowId)) {
        return ResponseUtils.error(res, 'Project ID and Workflow ID are required', null, null, 400);
      }

      // Verify workflow exists and belongs to project
      const existingWorkflow = await WorkflowsController.workflowEngine.loadWorkflow(workflowId);
      if (!existingWorkflow || existingWorkflow.projectId !== projectId) {
        return ResponseUtils.error(res, 'Workflow not found', null, null, 404);
      }

      // Unschedule workflow if scheduled
      if (existingWorkflow.cronJobId) {
        await WorkflowsController.workflowScheduler.unscheduleWorkflow(workflowId);
      }

      // Delete workflow (cascade will delete nodes, edges, executions)
      await db.delete(workflows).where(eq(workflows.id, workflowId));

      ResponseUtils.success(res, 'Workflow deleted successfully', { workflowId });
    } catch (error) {
      console.error('Error deleting workflow:', error);
      ResponseUtils.error(res, 'Failed to delete workflow', error);
    }
  }

  /**
   * Execute a workflow
   * POST /api/workflows/:projectId/:workflowId/execute
   */
  static async executeWorkflow(req: WorkflowRequest, res: Response) {
    try {
      const projectId = WorkflowsController.getProjectId(req);
      const workflowId = parseInt(req.params.workflowId, 10);

      if (!projectId || isNaN(workflowId)) {
        return ResponseUtils.error(res, 'Project ID and Workflow ID are required', null, null, 400);
      }

      const { inputs, triggeredBy } = req.body;

      const result = await WorkflowsController.workflowEngine.executeWorkflow(
        workflowId,
        inputs || {},
        triggeredBy || 'manual'
      );

      ResponseUtils.success(res, 'Workflow execution started', result);
    } catch (error) {
      console.error('Error executing workflow:', error);
      ResponseUtils.error(res, 'Failed to execute workflow', error);
    }
  }

  /**
   * Get workflow execution history
   * GET /api/workflows/:projectId/:workflowId/executions
   */
  static async getWorkflowExecutions(req: WorkflowRequest, res: Response) {
    try {
      const projectId = WorkflowsController.getProjectId(req);
      const workflowId = parseInt(req.params.workflowId, 10);

      if (!projectId || isNaN(workflowId)) {
        return ResponseUtils.error(res, 'Project ID and Workflow ID are required', null, null, 400);
      }

      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const executions = await db
        .select()
        .from(workflowExecutions)
        .where(eq(workflowExecutions.workflow_id, workflowId))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(workflowExecutions.started_at));

      ResponseUtils.success(res, 'Workflow executions fetched successfully', executions);
    } catch (error) {
      console.error('Error getting workflow executions:', error);
      ResponseUtils.error(res, 'Failed to get workflow executions', error);
    }
  }

  /**
   * Get execution logs with node details
   * GET /api/workflows/:projectId/:workflowId/executions/:executionId/logs
   */
  static async getExecutionLogs(req: WorkflowRequest, res: Response) {
    try {
      const projectId = WorkflowsController.getProjectId(req);
      const workflowId = parseInt(req.params.workflowId, 10);
      const executionId = parseInt(req.params.executionId, 10);

      if (!projectId || isNaN(workflowId) || isNaN(executionId)) {
        return ResponseUtils.error(res, 'Project ID, Workflow ID, and Execution ID are required', null, null, 400);
      }

      // Get execution details
      const execution = await db
        .select()
        .from(workflowExecutions)
        .where(eq(workflowExecutions.id, executionId))
        .limit(1);

      if (execution.length === 0) {
        return ResponseUtils.error(res, 'Execution not found', null, null, 404);
      }

      if (execution[0].workflow_id !== workflowId) {
        return ResponseUtils.error(res, 'Execution does not belong to this workflow', null, null, 404);
      }

      // Get node executions
      const nodeExecutions = await db
        .select()
        .from(workflowNodeExecutions)
        .where(eq(workflowNodeExecutions.execution_id, executionId))
        .orderBy(workflowNodeExecutions.started_at);

      // Get node definitions for context
      const nodes = await db
        .select()
        .from(workflowNodes)
        .where(eq(workflowNodes.workflow_id, workflowId));

      const nodeMap = new Map(nodes.map((n) => [n.node_id, n]));

      // Enrich node executions with node type and data
      const enrichedLogs = nodeExecutions.map((nodeExec) => {
        const node = nodeMap.get(nodeExec.node_id);
        return {
          nodeId: nodeExec.node_id,
          nodeType: node?.type || 'unknown',
          nodeData: node?.data || null,
          status: nodeExec.status,
          startedAt: nodeExec.started_at,
          completedAt: nodeExec.completed_at,
          executionTimeMs: nodeExec.execution_time_ms,
          resultData: nodeExec.result_data,
          errorMessage: nodeExec.error_message,
        };
      });

      ResponseUtils.success(res, 'Execution logs fetched successfully', {
        execution: execution[0],
        nodeLogs: enrichedLogs,
      });
    } catch (error) {
      console.error('Error getting execution logs:', error);
      ResponseUtils.error(res, 'Failed to get execution logs', error);
    }
  }

  /**
   * Schedule a workflow
   * POST /api/workflows/:projectId/:workflowId/schedule
   */
  static async scheduleWorkflow(req: WorkflowRequest, res: Response) {
    try {
      const projectId = WorkflowsController.getProjectId(req);
      const workflowId = parseInt(req.params.workflowId, 10);

      if (!projectId || isNaN(workflowId)) {
        return ResponseUtils.error(res, 'Project ID and Workflow ID are required', null, null, 400);
      }

      const { schedule } = req.body;

      if (!schedule) {
        return ResponseUtils.error(res, 'Schedule (cron expression) is required', null, null, 400);
      }

      const result = await WorkflowsController.workflowScheduler.scheduleWorkflow(
        workflowId,
        schedule
      );

      if (!result.success) {
        return ResponseUtils.error(res, result.error || 'Failed to schedule workflow', null, null, 400);
      }

      ResponseUtils.success(res, 'Workflow scheduled successfully', result);
    } catch (error) {
      console.error('Error scheduling workflow:', error);
      ResponseUtils.error(res, 'Failed to schedule workflow', error);
    }
  }

  /**
   * Unschedule a workflow
   * DELETE /api/workflows/:projectId/:workflowId/schedule
   */
  static async unscheduleWorkflow(req: WorkflowRequest, res: Response) {
    try {
      const projectId = WorkflowsController.getProjectId(req);
      const workflowId = parseInt(req.params.workflowId, 10);

      if (!projectId || isNaN(workflowId)) {
        return ResponseUtils.error(res, 'Project ID and Workflow ID are required', null, null, 400);
      }

      const result = await WorkflowsController.workflowScheduler.unscheduleWorkflow(workflowId);

      if (!result.success) {
        return ResponseUtils.error(res, result.error || 'Failed to unschedule workflow', null, null, 400);
      }

      ResponseUtils.success(res, 'Workflow unscheduled successfully', result);
    } catch (error) {
      console.error('Error unscheduling workflow:', error);
      ResponseUtils.error(res, 'Failed to unschedule workflow', error);
    }
  }
}

export default WorkflowsController;

