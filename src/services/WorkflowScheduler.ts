import { Pool } from 'pg';
import { db } from '../db/drizzle.config';
import { workflows, workflowSchedules } from '../db/schemas/WorkflowsSchema';
import { eq } from 'drizzle-orm';

/**
 * WorkflowScheduler - Manages cron job scheduling for workflows
 * Uses pg_cron extension for scheduling
 */
export class WorkflowScheduler {
  private pool: Pool;
  private baseUrl: string; // Base URL for workflow execution endpoint

  constructor(pool: Pool, baseUrl: string = 'http://localhost:8001') {
    this.pool = pool;
    this.baseUrl = baseUrl;
  }

  /**
   * Schedule a workflow with a cron expression
   */
  async scheduleWorkflow(
    workflowId: number,
    schedule: string
  ): Promise<{ success: boolean; cronJobId?: number; error?: string }> {
    const client = await this.pool.connect();

    try {
      // Check if pg_cron extension is installed
      const extensionCheck = await client.query(
        `SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'`
      );

      if (extensionCheck.rows.length === 0) {
        return {
          success: false,
          error: 'pg_cron extension is not installed. Please install it first.',
        };
      }

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

      // Check if workflow already has a schedule
      if (workflow.cron_job_id) {
        // Update existing cron job
        await client.query(
          `UPDATE cron.job SET schedule = $1 WHERE jobid = $2`,
          [schedule, workflow.cron_job_id]
        );

        // Update workflow schedule record
        await db
          .update(workflowSchedules)
          .set({
            schedule,
            updated_at: new Date(),
          })
          .where(eq(workflowSchedules.workflow_id, workflowId));

        return {
          success: true,
          cronJobId: workflow.cron_job_id,
        };
      }

      // Create new cron job
      // The cron job will call the workflow execution endpoint
      const jobName = `workflow_${workflowId}`;
      const command = `SELECT net.http_post(
        url := '${this.baseUrl}/api/workflows/${workflowId}/execute',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{"triggeredBy": "cron"}'::jsonb
      )::text`;

      const cronResult = await client.query(
        `SELECT cron.schedule($1, $2, $3) as jobid`,
        [jobName, schedule, command]
      );

      const cronJobId = cronResult.rows[0].jobid;

      // Update workflow with cron job ID
      await db
        .update(workflows)
        .set({
          cron_job_id: cronJobId,
          schedule,
        })
        .where(eq(workflows.id, workflowId));

      // Create or update schedule record
      await db
        .insert(workflowSchedules)
        .values({
          workflow_id: workflowId,
          cron_job_id: cronJobId,
          schedule,
          enabled: true,
        })
        .onConflictDoUpdate({
          target: workflowSchedules.workflow_id,
          set: {
            cron_job_id: cronJobId,
            schedule,
            enabled: true,
            updated_at: new Date(),
          },
        });

      return {
        success: true,
        cronJobId,
      };
    } catch (error) {
      console.error(`Error scheduling workflow ${workflowId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Unschedule a workflow (remove cron job)
   */
  async unscheduleWorkflow(
    workflowId: number
  ): Promise<{ success: boolean; error?: string }> {
    const client = await this.pool.connect();

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

      if (!workflow.cron_job_id) {
        return {
          success: true, // Already unscheduled
        };
      }

      // Remove cron job
      await client.query(`SELECT cron.unschedule($1)`, [workflow.cron_job_id]);

      // Update workflow
      await db
        .update(workflows)
        .set({
          cron_job_id: null,
          schedule: null,
        })
        .where(eq(workflows.id, workflowId));

      // Update schedule record
      await db
        .update(workflowSchedules)
        .set({
          enabled: false,
        })
        .where(eq(workflowSchedules.workflow_id, workflowId));

      return {
        success: true,
      };
    } catch (error) {
      console.error(`Error unscheduling workflow ${workflowId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Enable/disable a scheduled workflow
   */
  async toggleWorkflowSchedule(
    workflowId: number,
    enabled: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const client = await this.pool.connect();

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

      if (!workflow.cron_job_id) {
        return {
          success: false,
          error: 'Workflow is not scheduled',
        };
      }

      // Toggle cron job
      await client.query(
        `UPDATE cron.job SET active = $1 WHERE jobid = $2`,
        [enabled, workflow.cron_job_id]
      );

      // Update schedule record
      await db
        .update(workflowSchedules)
        .set({
          enabled,
        })
        .where(eq(workflowSchedules.workflow_id, workflowId));

      return {
        success: true,
      };
    } catch (error) {
      console.error(`Error toggling workflow schedule ${workflowId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get schedule information for a workflow
   */
  async getWorkflowSchedule(workflowId: number): Promise<{
    schedule?: string;
    cronJobId?: number;
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
        cronJobId: schedule.cron_job_id,
        enabled: schedule.enabled,
      };
    } catch (error) {
      console.error(`Error getting workflow schedule ${workflowId}:`, error);
      return null;
    }
  }
}

