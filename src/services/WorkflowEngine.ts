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
  ForLoopExecutionResult,
  ForLoopIterationContext,
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
            await this.executeForLoopIterations(
              workflow,
              nodeId,
              nodeResult,
              context,
              client,
              workflowId,
              executionId
            );
          }

          // Save node execution result
          await this.saveNodeExecution(executionId, nodeId, nodeResult);

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

          await this.saveNodeExecution(executionId, nodeId, nodeResult);

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
   * Excludes child nodes of forLoop nodes (they're executed inside the loop)
   */
  private buildExecutionOrder(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[]
  ): string[] {
    // Find child nodes of forLoop nodes (these will be executed inside the loop)
    const forLoopNodes = nodes.filter((n) => n.type === 'forLoop');
    const forLoopChildNodeIds = new Set<string>();
    for (const forLoopNode of forLoopNodes) {
      const childEdges = edges.filter((e) => e.source === forLoopNode.id);
      for (const childEdge of childEdges) {
        forLoopChildNodeIds.add(childEdge.target);
      }
    }

    // Find start nodes (nodes with no incoming edges, excluding forLoop children)
    const startNodes = nodes.filter(
      (node) => 
        !forLoopChildNodeIds.has(node.id) &&
        !edges.some((edge) => edge.target === node.id)
    );

    if (startNodes.length === 0) {
      return [];
    }

    // Build adjacency list (excluding edges from forLoop to their children)
    const graph: Map<string, string[]> = new Map();
    const inDegree: Map<string, number> = new Map();

    // Initialize (excluding forLoop children)
    for (const node of nodes) {
      if (!forLoopChildNodeIds.has(node.id)) {
        graph.set(node.id, []);
        inDegree.set(node.id, 0);
      }
    }

    // Build graph (excluding edges from forLoop to their children)
    for (const edge of edges) {
      // Skip edges from forLoop nodes to their children
      if (forLoopChildNodeIds.has(edge.target)) {
        continue;
      }

      if (graph.has(edge.source) && graph.has(edge.target)) {
        const sourceList = graph.get(edge.source) || [];
        sourceList.push(edge.target);
        graph.set(edge.source, sourceList);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      }
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

  /**
   * Execute child nodes for each iteration of a forLoop node
   */
  private async executeForLoopIterations(
    workflow: WorkflowDefinition,
    forLoopNodeId: string,
    forLoopResult: NodeExecutionResult,
    context: WorkflowExecutionContext,
    client: PoolClient,
    workflowId: number,
    executionId: number
  ): Promise<void> {
    const loopData = forLoopResult.data as ForLoopExecutionResult;

    // Get child nodes (nodes connected from this forLoop node)
    const childNodeIds = workflow.edges
      .filter((e) => e.source === forLoopNodeId)
      .map((e) => e.target);

    if (childNodeIds.length === 0 || !loopData.iterations) {
      return;
    }

    console.log(
      `[Workflow ${workflowId}] [Execution ${executionId}] [Node ${forLoopNodeId}] Executing ${loopData.iterations.length} iterations for ${childNodeIds.length} child node(s)`
    );

    // Declare iterationExecutionContext outside the loop so it's accessible after
    let iterationExecutionContext: WorkflowExecutionContext = context;

    // Execute child nodes for each iteration
    for (const iteration of loopData.iterations) {
      const iterationContext: ForLoopIterationContext = {
        item: iteration.item,
        index: iteration.index,
        variableName: iteration.variableName,
      };

      // Create a new context with iteration context for child nodes
      iterationExecutionContext = {
        ...context,
        iterationContext,
      };

      // Execute each child node with the iteration context
      for (const childNodeId of childNodeIds) {
        await this.executeChildNodeInIteration(
          workflow,
          childNodeId,
          iterationContext,
          iterationExecutionContext,
          client,
          workflowId,
          executionId
        );
      }
    }

    // Update main context with results from last iteration
    this.updateContextWithLastIterationResults(
      context,
      iterationExecutionContext,
      childNodeIds
    );
  }

  /**
   * Execute a single child node within a forLoop iteration
   */
  private async executeChildNodeInIteration(
    workflow: WorkflowDefinition,
    childNodeId: string,
    iterationContext: ForLoopIterationContext,
    iterationExecutionContext: WorkflowExecutionContext,
    client: PoolClient,
    workflowId: number,
    executionId: number
  ): Promise<void> {
    const childNode = workflow.nodes.find((n) => n.id === childNodeId);
    if (!childNode) {
      console.warn(
        `[Workflow ${workflowId}] [Execution ${executionId}] Child node ${childNodeId} not found`
      );
      return;
    }

    const startTime = Date.now();
    let childNodeResult: NodeExecutionResult;

    try {
      console.log(
        `[Workflow ${workflowId}] [Execution ${executionId}] [Node ${childNodeId}] [Iteration ${iterationContext.index}] Executing ${childNode.type} node`
      );

      // Create executor for child node
      const childExecutor = NodeExecutorRegistry.createExecutor(
        childNode.type,
        client,
        iterationExecutionContext
      );

      // Execute child node with iteration context
      childNodeResult = await childExecutor.execute(
        childNode,
        iterationExecutionContext
      );
      childNodeResult.executionTimeMs = Date.now() - startTime;

      console.log(
        `[Workflow ${workflowId}] [Execution ${executionId}] [Node ${childNodeId}] [Iteration ${iterationContext.index}] Execution completed`
      );
      console.log(
        `[Workflow ${workflowId}] [Execution ${executionId}] [Node ${childNodeId}] [Iteration ${iterationContext.index}] Status: ${childNodeResult.status}`
      );

      // Store result in context (overwrite previous iteration results)
      iterationExecutionContext.nodeResults[childNodeId] = childNodeResult;

      // Save child node execution result
      await this.saveNodeExecution(
        executionId,
        childNodeId,
        childNodeResult
      );

      // If child node failed, log but continue with next iteration
      if (childNodeResult.status === 'fail') {
        console.error(
          `[Workflow ${workflowId}] [Execution ${executionId}] [Node ${childNodeId}] [Iteration ${iterationContext.index}] Node failed, continuing with next iteration`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[Workflow ${workflowId}] [Execution ${executionId}] [Node ${childNodeId}] [Iteration ${iterationContext.index}] Execution error:`,
        errorMessage
      );

      childNodeResult = {
        nodeId: childNodeId,
        status: 'fail',
        error: errorMessage,
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      iterationExecutionContext.nodeResults[childNodeId] = childNodeResult;

      await this.saveNodeExecution(executionId, childNodeId, childNodeResult);
    }
  }

  /**
   * Update main context with results from the last iteration
   */
  private updateContextWithLastIterationResults(
    context: WorkflowExecutionContext,
    iterationExecutionContext: WorkflowExecutionContext,
    childNodeIds: string[]
  ): void {
    for (const childNodeId of childNodeIds) {
      if (iterationExecutionContext.nodeResults[childNodeId]) {
        // Keep the last iteration's result
        context.nodeResults[childNodeId] =
          iterationExecutionContext.nodeResults[childNodeId];
      }
    }
  }

  /**
   * Save node execution result to database
   */
  private async saveNodeExecution(
    executionId: number,
    nodeId: string,
    result: NodeExecutionResult
  ): Promise<void> {
    await db.insert(workflowNodeExecutions).values({
      execution_id: executionId,
      node_id: nodeId,
      status: result.status,
      result_data: result.data,
      error_message: result.error || null,
      execution_time_ms: result.executionTimeMs,
      started_at: new Date(result.timestamp),
      completed_at: new Date(),
    });
  }
}

