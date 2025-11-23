import { pgTable, serial, varchar, text, timestamp, integer, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { projects } from './ProjectsSchema';

// Workflow execution status enum
export const workflowExecutionStatusEnum = pgEnum('workflow_execution_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

// Workflows table - stores workflow definitions
export const workflows = pgTable('skaftin_system_workflows', {
  id: serial('id').primaryKey(),
  project_id: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  enabled: boolean('enabled').default(true).notNull(),
  schedule: varchar('schedule', { length: 100 }), // Cron expression (e.g., "0 0 * * *")
  cron_job_id: integer('cron_job_id'), // Reference to pg_cron job ID
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  created_by: varchar('created_by', { length: 255 }), // User ID
});

// Workflow nodes table - stores node configurations
export const workflowNodes = pgTable('skaftin_system_workflow_nodes', {
  id: serial('id').primaryKey(),
  workflow_id: integer('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  node_id: varchar('node_id', { length: 100 }).notNull(), // Unique within workflow (e.g., "start-1", "dbSelect-2")
  type: varchar('type', { length: 50 }).notNull(), // 'start', 'dbSelect', 'condition', etc.
  position_x: integer('position_x').notNull(),
  position_y: integer('position_y').notNull(),
  data: jsonb('data').notNull(), // Node-specific configuration as JSONB
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Workflow edges table - stores connections between nodes
export const workflowEdges = pgTable('skaftin_system_workflow_edges', {
  id: serial('id').primaryKey(),
  workflow_id: integer('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  source_node_id: varchar('source_node_id', { length: 100 }).notNull(),
  target_node_id: varchar('target_node_id', { length: 100 }).notNull(),
  source_handle: varchar('source_handle', { length: 100 }), // For condition nodes: 'true' or 'false'
  target_handle: varchar('target_handle', { length: 100 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Workflow executions table - tracks execution history
export const workflowExecutions = pgTable('skaftin_system_workflow_executions', {
  id: serial('id').primaryKey(),
  workflow_id: integer('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  status: workflowExecutionStatusEnum('status').default('pending').notNull(),
  started_at: timestamp('started_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'),
  triggered_by: varchar('triggered_by', { length: 50 }), // 'manual', 'cron', 'api'
  input_data: jsonb('input_data'), // Workflow input parameters
  result_data: jsonb('result_data'), // Final workflow result
  error_message: text('error_message'),
  execution_log: jsonb('execution_log'), // Detailed execution log
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Workflow node executions table - tracks individual node execution results
export const workflowNodeExecutions = pgTable('skaftin_system_workflow_node_executions', {
  id: serial('id').primaryKey(),
  execution_id: integer('execution_id').notNull().references(() => workflowExecutions.id, { onDelete: 'cascade' }),
  node_id: varchar('node_id', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'fail', 'skipped'
  started_at: timestamp('started_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'),
  result_data: jsonb('result_data'), // Node-specific result
  error_message: text('error_message'),
  execution_time_ms: integer('execution_time_ms'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Workflow schedules table - links workflows to cron jobs (optional, for tracking)
export const workflowSchedules = pgTable('skaftin_system_workflow_schedules', {
  id: serial('id').primaryKey(),
  workflow_id: integer('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }).unique(),
  cron_job_id: integer('cron_job_id').notNull(), // pg_cron job ID
  schedule: varchar('schedule', { length: 100 }).notNull(), // Cron expression
  enabled: boolean('enabled').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

