import { Pool, PoolClient } from 'pg';
import { db } from '../db/drizzle.config';
import { workflows, workflowNodes, workflowEdges, workflowExecutions, workflowNodeExecutions } from '../db/schemas/WorkflowsSchema';
import { eq } from 'drizzle-orm';
import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowExecutionContext,
  NodeExecutionResult,
  WorkflowExecutionStatus,
} from '../types/workflow.types';
import { NodeExecutorRegistry } from './workflows/executors/NodeExecutorRegistry';

/**
 * WorkflowEngine - Orchestrates workflow execution
 */
export class WorkflowEngine {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Load workflow definition from database
   */
  async loadWorkflow(workflowId: number): Promise<WorkflowDefinition | null> {
    try {
      // Load workflow
      const workflowResult = await db
        .select()
        .from(workflows)
        .where(eq(workflows.id, workflowId))
        .limit(1);

      if (workflowResult.length === 0) {
        return null;
      }

      const workflow = workflowResult[0];

      // Load nodes
      const nodesResult = await db
        .select()
        .from(workflowNodes)
        .where(eq(workflowNodes.workflow_id, workflowId));

      const nodes: WorkflowNode[] = nodesResult.map((n) => ({
        id: n.node_id,
        type: n.type as any,
        position: { x: n.position_x, y: n.position_y },
        data: n.data as any,
      }));

      // Load edges
      const edgesResult = await db
        .select()
        .from(workflowEdges)
        .where(eq(workflowEdges.workflow_id, workflowId));

      const edges: WorkflowEdge[] = edgesResult.map((e) => ({
        id: e.id.toString(),
        source: e.source_node_id,
        target: e.target_node_id,
        sourceHandle: e.source_handle || undefined,
        targetHandle: e.target_handle || undefined,
      }));

      return {
        id: workflow.id,
        projectId: workflow.project_id,
        name: workflow.name,
        description: workflow.description || undefined,
        enabled: workflow.enabled,
        schedule: workflow.schedule || undefined,
        cronJobId: workflow.cron_job_id || undefined,
        nodes,
        edges,
      };
    } catch (error) {
      console.error(`Error loading workflow ${workflowId}:`, error);
      return null;
    }
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: number,
    inputs: Record<string, any> = {},
    triggeredBy: 'manual' | 'cron' | 'api' = 'manual'
  ): Promise<{
    executionId: number;
    status: WorkflowExecutionStatus;
    result?: any;
    error?: string;
  }> {
    const startTime = new Date();

    // Load workflow
    const workflow = await this.loadWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (!workflow.enabled) {
      throw new Error(`Workflow ${workflowId} is disabled`);
    }

    // Get project schema name
    const projectResult = await this.pool.query(
      'SELECT schema_name FROM projects WHERE id = $1',
      [workflow.projectId]
    );

    if (projectResult.rows.length === 0) {
      throw new Error(`Project ${workflow.projectId} not found`);
    }

    const schemaName = projectResult.rows[0].schema_name;

    // Create execution record
    const executionResult = await db
      .insert(workflowExecutions)
      .values({
        workflow_id: workflowId,
        status: 'running',
        triggered_by: triggeredBy,
        input_data: inputs,
        started_at: startTime,
      })
      .returning();

    const executionId = executionResult[0].id;
    console.log(`[Workflow ${workflowId}] [Execution ${executionId}] Workflow execution started`);
    console.log(`[Workflow ${workflowId}] [Execution ${executionId}] Triggered by: ${triggeredBy}`);
    console.log(`[Workflow ${workflowId}] [Execution ${executionId}] Inputs:`, JSON.stringify(inputs, null, 2));
    let executionStatus: WorkflowExecutionStatus = 'running';
    let executionError: string | undefined;
    let executionResultData: any;

    // Get project database client
    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}, public`);

      // Build execution context
      const context: WorkflowExecutionContext = {
        workflowId,
        executionId,
        projectId: workflow.projectId,
        schemaName,
        inputs,
        nodeResults: {},
        variables: {},
        startTime,
      };

      // Build execution graph and validate
      const executionOrder = this.buildExecutionOrder(workflow.nodes, workflow.edges);
      if (executionOrder.length === 0) {
        throw new Error('No executable nodes found');
      }

      // Execute nodes in order
      console.log(`[Workflow ${workflowId}] [Execution ${executionId}] Starting execution with ${executionOrder.length} nodes`);
      console.log(`[Workflow ${workflowId}] [Execution ${executionId}] Execution order:`, executionOrder);

      for (const nodeId of executionOrder) {
        const node = workflow.nodes.find((n) => n.id === nodeId);
        if (!node) continue;

        const nodeStartTime = Date.now();
        let nodeResult: NodeExecutionResult;

        try {
          console.log(`[Workflow ${workflowId}] [Execution ${executionId}] [Node ${nodeId}] Executing ${node.type} node`);
          console.log(`[Workflow ${workflowId}] [Execution ${executionId}] [Node ${nodeId}] Node data:`, JSON.stringify(node.data, null, 2));

          // Create executor for this node
          const executor = NodeExecutorRegistry.createExecutor(
            node.type,
            client,
            context
          );

          // Execute node
          nodeResult = await executor.execute(node, context);
          nodeResult.executionTimeMs = Date.now() - nodeStartTime;

          // Log node execution result
          console.log(`[Workflow ${workflowId}] [Execution ${executionId}] [Node ${nodeId}] Execution completed`);
          console.log(`[Workflow ${workflowId}] [Execution ${executionId}] [Node ${nodeId}] Status: ${nodeResult.status}`);
          console.log(`[Workflow ${workflowId}] [Execution ${executionId}] [Node ${nodeId}] Execution time: ${nodeResult.executionTimeMs}ms`);
          if (nodeResult.data) {
            console.log(`[Workflow ${workflowId}] [Execution ${executionId}] [Node ${nodeId}] Result data:`, JSON.stringify(nodeResult.data, null, 2));
          }
          if (nodeResult.error) {
            console.error(`[Workflow ${workflowId}] [Execution ${executionId}] [Node ${nodeId}] Error:`, nodeResult.error);
          }

          // Store result in context
          context.nodeResults[nodeId] = nodeResult;

          // Handle special node types
          if (node.type === 'condition') {
            // Condition node determines next nodes to execute
            const conditionResult = nodeResult.data as { result: boolean };
            if (conditionResult?.result === false) {
              // Skip false branch nodes
              const falseBranchNodes = this.getBranchNodes(
                workflow.edges,
                nodeId,
                'false'
              );
              for (const branchNodeId of falseBranchNodes) {
                context.nodeResults[branchNodeId] = {
                  nodeId: branchNodeId,
                  status: 'skipped',
                  timestamp: new Date().toISOString(),
                };
              }
            }
          } else if (node.type === 'forLoop') {
            // ForLoop node will be handled by its executor
            // The executor will execute child nodes for each iteration
          }

          // Save node execution result
          await db.insert(workflowNodeExecutions).values({
            execution_id: executionId,
            node_id: nodeId,
            status: nodeResult.status,
            result_data: nodeResult.data,
            error_message: nodeResult.error || null,
            execution_time_ms: nodeResult.executionTimeMs,
            started_at: new Date(nodeResult.timestamp),
            completed_at: new Date(),
          });

          // If node failed and it's critical, stop execution
          if (nodeResult.status === 'fail' && node.type !== 'condition') {
            console.error(`[Workflow ${workflowId}] [Execution ${executionId}] [Node ${nodeId}] Node failed, stopping execution`);
            executionStatus = 'failed';
            executionError = `Node ${nodeId} failed: ${nodeResult.error}`;
            break;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[Workflow ${workflowId}] [Execution ${executionId}] [Node ${nodeId}] Execution error:`, errorMessage);
          console.error(`[Workflow ${workflowId}] [Execution ${executionId}] [Node ${nodeId}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
          
          nodeResult = {
            nodeId,
            status: 'fail',
            error: errorMessage,
            executionTimeMs: Date.now() - nodeStartTime,
            timestamp: new Date().toISOString(),
          };

          context.nodeResults[nodeId] = nodeResult;

          await db.insert(workflowNodeExecutions).values({
            execution_id: executionId,
            node_id: nodeId,
            status: 'fail',
            error_message: nodeResult.error || null,
            execution_time_ms: nodeResult.executionTimeMs,
            started_at: new Date(),
            completed_at: new Date(),
          });

          executionStatus = 'failed';
          executionError = `Node ${nodeId} error: ${nodeResult.error}`;
          break;
        }
      }

      // Get final result from last executed node
      if (executionOrder.length > 0) {
        const lastNodeId = executionOrder[executionOrder.length - 1];
        const lastResult = context.nodeResults[lastNodeId];
        if (lastResult) {
          executionResultData = lastResult.data;
        }
      }

      if (executionStatus === 'running') {
        executionStatus = 'completed';
        console.log(`[Workflow ${workflowId}] [Execution ${executionId}] Execution completed successfully`);
      }
    } catch (error) {
      executionStatus = 'failed';
      executionError = error instanceof Error ? error.message : String(error);
      console.error(`[Workflow ${workflowId}] [Execution ${executionId}] Workflow execution error:`, error);
      console.error(`[Workflow ${workflowId}] [Execution ${executionId}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    } finally {
      client.release();

      // Update execution record
      await db
        .update(workflowExecutions)
        .set({
          status: executionStatus,
          completed_at: new Date(),
          result_data: executionResultData,
          error_message: executionError || null,
        })
        .where(eq(workflowExecutions.id, executionId));
    }

    return {
      executionId,
      status: executionStatus,
      result: executionResultData,
      error: executionError,
    };
  }

  /**
   * Build execution order using topological sort
   */
  private buildExecutionOrder(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[]
  ): string[] {
    // Find start nodes (nodes with no incoming edges)
    const startNodes = nodes.filter(
      (node) => !edges.some((edge) => edge.target === node.id)
    );

    if (startNodes.length === 0) {
      return [];
    }

    // Build adjacency list
    const graph: Map<string, string[]> = new Map();
    const inDegree: Map<string, number> = new Map();

    // Initialize
    for (const node of nodes) {
      graph.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    // Build graph
    for (const edge of edges) {
      const sourceList = graph.get(edge.source) || [];
      sourceList.push(edge.target);
      graph.set(edge.source, sourceList);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    // Topological sort
    const queue: string[] = startNodes.map((n) => n.id);
    const result: string[] = [];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        const degree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, degree);
        if (degree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  /**
   * Get nodes connected to a branch (for condition nodes)
   */
  private getBranchNodes(
    edges: WorkflowEdge[],
    sourceNodeId: string,
    branch: 'true' | 'false'
  ): string[] {
    const branchEdges = edges.filter(
      (e) => e.source === sourceNodeId && e.sourceHandle === branch
    );
    return branchEdges.map((e) => e.target);
  }
}

