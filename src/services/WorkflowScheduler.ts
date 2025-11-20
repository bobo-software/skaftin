import { Pool } from 'pg';
import { db } from '../db/drizzle.config';
import { workflows, workflowSchedules } from '../db/schemas/WorkflowsSchema';
import { eq } from 'drizzle-orm';
import * as cron from 'node-cron';
import { WorkflowEngine } from './WorkflowEngine';

/**
 * WorkflowScheduler - Manages cron job scheduling for workflows
 * Uses node-cron for scheduling (no PostgreSQL extensions required)
 * Singleton pattern to ensure one instance across the application
 */
export class WorkflowScheduler {
  private static instance: WorkflowScheduler | null = null;
  private pool: Pool;
  private workflowEngine: WorkflowEngine;
  private cronJobs: Map<number, cron.ScheduledTask> = new Map();

  private constructor(pool: Pool) {
    this.pool = pool;
    this.workflowEngine = new WorkflowEngine(pool);
  }

  /**
   * Get or create the singleton instance
   */
  static getInstance(pool?: Pool): WorkflowScheduler {
    if (!WorkflowScheduler.instance) {
      if (!pool) {
        throw new Error('WorkflowScheduler must be initialized with pool first');
      }
      WorkflowScheduler.instance = new WorkflowScheduler(pool);
    }
    return WorkflowScheduler.instance;
  }

  /**
   * Initialize the singleton instance (call this first)
   */
  static initialize(pool: Pool): WorkflowScheduler {
    if (WorkflowScheduler.instance) {
      console.warn('[WorkflowScheduler] Instance already exists, returning existing instance');
      return WorkflowScheduler.instance;
    }
    WorkflowScheduler.instance = new WorkflowScheduler(pool);
    return WorkflowScheduler.instance;
  }

  /**
   * Schedule a workflow with a cron expression
   */
  async scheduleWorkflow(
    workflowId: number,
    schedule: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get workflow details
      const workflowResult = await db
        .select()
        .from(workflows)
        .where(eq(workflows.id, workflowId))
        .limit(1);

      if (workflowResult.length === 0) {
        return {
          success: false,
          error: `Workflow ${workflowId} not found`,
        };
      }

      const workflow = workflowResult[0];

      // Validate cron expression
      if (!cron.validate(schedule)) {
        return {
          success: false,
          error: `Invalid cron expression: ${schedule}`,
        };
      }

      // If workflow already has a schedule, unschedule it first
      if (this.cronJobs.has(workflowId)) {
        console.log(`[WorkflowScheduler] 🔄 Workflow ${workflowId} already has a schedule, unscheduling existing job first`);
        this.unscheduleWorkflowInMemory(workflowId);
      }

      // Create node-cron job
      console.log(`[WorkflowScheduler] Creating cron job for workflow ${workflowId} with schedule: ${schedule}`);
      const task = cron.schedule(schedule, async () => {
        const executionStartTime = new Date().toISOString();
        console.log(`[WorkflowScheduler] ⏰ Cron triggered for workflow ${workflowId} at ${executionStartTime}`);
        
        try {
          // Check if workflow is still enabled
          const currentWorkflow = await db
            .select()
            .from(workflows)
            .where(eq(workflows.id, workflowId))
            .limit(1);

          if (currentWorkflow.length === 0) {
            console.log(`[WorkflowScheduler] ⚠️  Workflow ${workflowId} not found, skipping execution`);
            return;
          }

          if (!currentWorkflow[0].enabled) {
            console.log(`[WorkflowScheduler] ⚠️  Workflow ${workflowId} is disabled, skipping execution`);
            return;
          }

          // Get project ID from workflow
          const projectId = currentWorkflow[0].project_id;
          if (!projectId) {
            console.error(`[WorkflowScheduler] ❌ Workflow ${workflowId} has no project_id, cannot execute`);
            return;
          }

          // Execute workflow directly using WorkflowEngine (no HTTP overhead, no auth needed)
          console.log(`[WorkflowScheduler] 🚀 Starting execution of workflow ${workflowId} (${currentWorkflow[0].name || 'unnamed'}) in project ${projectId}`);
          
          const executionStartTime = Date.now();
          const result = await this.workflowEngine.executeWorkflow(
            workflowId,
            {}, // No inputs for cron-triggered workflows
            'cron'
          );
          const executionDuration = Date.now() - executionStartTime;

          console.log(`[WorkflowScheduler] ✅ Successfully executed workflow ${workflowId} in ${executionDuration}ms`);
          console.log(`[WorkflowScheduler]   Execution ID: ${result.executionId}, Status: ${result.status}`);
        } catch (error: any) {
          console.error(`[WorkflowScheduler] ❌ Error executing workflow ${workflowId}:`, error.message);
          if (error.stack) {
            console.error(`[WorkflowScheduler]   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
          }
        }
      }, {
        timezone: 'UTC',
      });
      
      console.log(`[WorkflowScheduler] ✅ Cron job created and started for workflow ${workflowId}`);

      // Store the cron job
      this.cronJobs.set(workflowId, task);
      console.log(`[WorkflowScheduler] 📝 Stored cron job in memory (total active jobs: ${this.cronJobs.size})`);

      // Update workflow in database
      await db
        .update(workflows)
        .set({
          schedule,
          updated_at: new Date(),
        })
        .where(eq(workflows.id, workflowId));

      // Create or update schedule record
      await db
        .insert(workflowSchedules)
        .values({
          workflow_id: workflowId,
          cron_job_id: workflowId, // Use workflow ID as identifier (not pg_cron job ID)
          schedule,
          enabled: true,
        })
        .onConflictDoUpdate({
          target: workflowSchedules.workflow_id,
          set: {
            schedule,
            enabled: true,
            updated_at: new Date(),
          },
        });

      console.log(`[WorkflowScheduler] Scheduled workflow ${workflowId} with cron: ${schedule}`);
      return {
        success: true,
      };
    } catch (error) {
      console.error(`[WorkflowScheduler] Error scheduling workflow ${workflowId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Unschedule a workflow (remove cron job)
   */
  async unscheduleWorkflow(
    workflowId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get workflow
      const workflowResult = await db
        .select()
        .from(workflows)
        .where(eq(workflows.id, workflowId))
        .limit(1);

      if (workflowResult.length === 0) {
        return {
          success: false,
          error: `Workflow ${workflowId} not found`,
        };
      }

      // Stop the cron job if it exists
      this.unscheduleWorkflowInMemory(workflowId);

      // Update workflow in database
      await db
        .update(workflows)
        .set({
          schedule: null,
          cron_job_id: null,
          updated_at: new Date(),
        })
        .where(eq(workflows.id, workflowId));

      // Update schedule record
      await db
        .update(workflowSchedules)
        .set({
          enabled: false,
        })
        .where(eq(workflowSchedules.workflow_id, workflowId));

      console.log(`[WorkflowScheduler] Unscheduled workflow ${workflowId}`);
      return {
        success: true,
      };
    } catch (error) {
      console.error(`[WorkflowScheduler] Error unscheduling workflow ${workflowId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Enable/disable a scheduled workflow
   */
  async toggleWorkflowSchedule(
    workflowId: number,
    enabled: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get workflow
      const workflowResult = await db
        .select()
        .from(workflows)
        .where(eq(workflows.id, workflowId))
        .limit(1);

      if (workflowResult.length === 0) {
        return {
          success: false,
          error: `Workflow ${workflowId} not found`,
        };
      }

      const workflow = workflowResult[0];

      if (!workflow.schedule) {
        return {
          success: false,
          error: 'Workflow is not scheduled',
        };
      }

      // Toggle the cron job
      const task = this.cronJobs.get(workflowId);
      if (task) {
        if (enabled) {
          console.log(`[WorkflowScheduler] ▶️  Starting cron job for workflow ${workflowId}`);
          task.start();
        } else {
          console.log(`[WorkflowScheduler] ⏸️  Stopping cron job for workflow ${workflowId}`);
          task.stop();
        }
      } else {
        console.warn(`[WorkflowScheduler] ⚠️  No cron job found for workflow ${workflowId} to toggle`);
      }

      // Update schedule record
      await db
        .update(workflowSchedules)
        .set({
          enabled,
        })
        .where(eq(workflowSchedules.workflow_id, workflowId));

      console.log(`[WorkflowScheduler] ${enabled ? 'Enabled' : 'Disabled'} workflow ${workflowId}`);
      return {
        success: true,
      };
    } catch (error) {
      console.error(`[WorkflowScheduler] Error toggling workflow schedule ${workflowId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get schedule information for a workflow
   */
  async getWorkflowSchedule(workflowId: number): Promise<{
    schedule?: string;
    enabled: boolean;
  } | null> {
    try {
      const scheduleResult = await db
        .select()
        .from(workflowSchedules)
        .where(eq(workflowSchedules.workflow_id, workflowId))
        .limit(1);

      if (scheduleResult.length === 0) {
        return null;
      }

      const schedule = scheduleResult[0];
      return {
        schedule: schedule.schedule,
        enabled: schedule.enabled,
      };
    } catch (error) {
      console.error(`[WorkflowScheduler] Error getting workflow schedule ${workflowId}:`, error);
      return null;
    }
  }

  /**
   * Load all scheduled workflows from database and start their cron jobs
   * Call this on server startup
   */
  async loadScheduledWorkflows(): Promise<void> {
    try {
      console.log('[WorkflowScheduler] Loading scheduled workflows from database...');
      
      // Get all workflows with schedules
      const allWorkflows = await db.select().from(workflows);
      const workflowsWithSchedules = allWorkflows.filter(w => w.schedule && w.enabled);

      console.log(`[WorkflowScheduler] Found ${workflowsWithSchedules.length} scheduled workflows`);

      for (const workflow of workflowsWithSchedules) {
        if (workflow.schedule && workflow.enabled) {
          // Validate cron expression
          if (cron.validate(workflow.schedule)) {
            // Create the cron job without updating the database (already scheduled)
            console.log(`[WorkflowScheduler] Creating cron job for workflow ${workflow.id} with schedule: ${workflow.schedule}`);
            const task = cron.schedule(workflow.schedule, async () => {
              const executionStartTime = new Date().toISOString();
              console.log(`[WorkflowScheduler] ⏰ Cron triggered for workflow ${workflow.id} at ${executionStartTime}`);
              
              try {
                // Check if workflow is still enabled
                const currentWorkflow = await db
                  .select()
                  .from(workflows)
                  .where(eq(workflows.id, workflow.id))
                  .limit(1);

                if (currentWorkflow.length === 0) {
                  console.log(`[WorkflowScheduler] ⚠️  Workflow ${workflow.id} not found, skipping execution`);
                  return;
                }

                if (!currentWorkflow[0].enabled) {
                  console.log(`[WorkflowScheduler] ⚠️  Workflow ${workflow.id} is disabled, skipping execution`);
                  return;
                }

                // Get project ID from workflow
                const projectId = currentWorkflow[0].project_id;
                if (!projectId) {
                  console.error(`[WorkflowScheduler] ❌ Workflow ${workflow.id} has no project_id, cannot execute`);
                  return;
                }

                // Execute workflow directly using WorkflowEngine (no HTTP overhead, no auth needed)
                console.log(`[WorkflowScheduler] 🚀 Starting execution of workflow ${workflow.id} (${currentWorkflow[0].name || 'unnamed'}) in project ${projectId}`);
                
                const executionStartTime = Date.now();
                const result = await this.workflowEngine.executeWorkflow(
                  workflow.id,
                  {}, // No inputs for cron-triggered workflows
                  'cron'
                );
                const executionDuration = Date.now() - executionStartTime;

                console.log(`[WorkflowScheduler] ✅ Successfully executed workflow ${workflow.id} in ${executionDuration}ms`);
                console.log(`[WorkflowScheduler]   Execution ID: ${result.executionId}, Status: ${result.status}`);
              } catch (error: any) {
                console.error(`[WorkflowScheduler] ❌ Error executing workflow ${workflow.id}:`, error.message);
                if (error.stack) {
                  console.error(`[WorkflowScheduler]   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
                }
              }
            }, {
              timezone: 'UTC',
            });
            
            console.log(`[WorkflowScheduler] ✅ Cron job created and started for workflow ${workflow.id}`);

            this.cronJobs.set(workflow.id, task);
            console.log(`[WorkflowScheduler] Loaded scheduled workflow ${workflow.id} with cron: ${workflow.schedule}`);
          } else {
            console.warn(`[WorkflowScheduler] Invalid cron expression for workflow ${workflow.id}: ${workflow.schedule}`);
          }
        }
      }

      console.log(`[WorkflowScheduler] Loaded ${this.cronJobs.size} scheduled workflows`);
    } catch (error) {
      console.error('[WorkflowScheduler] Error loading scheduled workflows:', error);
    }
  }

  /**
   * Stop all cron jobs (call on server shutdown)
   */
  stopAll(): void {
    console.log(`[WorkflowScheduler] Stopping ${this.cronJobs.size} scheduled workflows...`);
    for (const [workflowId, task] of this.cronJobs.entries()) {
      task.stop();
      console.log(`[WorkflowScheduler] Stopped workflow ${workflowId}`);
    }
    this.cronJobs.clear();
  }

  /**
   * Unschedule a workflow from memory (stop the cron job)
   */
  private unscheduleWorkflowInMemory(workflowId: number): void {
    const task = this.cronJobs.get(workflowId);
    if (task) {
      console.log(`[WorkflowScheduler] 🛑 Stopping cron job for workflow ${workflowId}`);
      task.stop();
      this.cronJobs.delete(workflowId);
      console.log(`[WorkflowScheduler] ✅ Removed cron job from memory (remaining active jobs: ${this.cronJobs.size})`);
    } else {
      console.log(`[WorkflowScheduler] ℹ️  No cron job found in memory for workflow ${workflowId}`);
    }
  }
}
