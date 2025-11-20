import { pgTable, serial, varchar, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { projects } from './ProjectsSchema';

// Backup schedules table - stores automatic backup configurations
export const backupSchedules = pgTable('backup_schedules', {
  id: serial('id').primaryKey(),
  project_id: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  schedule: varchar('schedule', { length: 100 }).notNull(), // Cron expression (e.g., "0 2 * * *")
  enabled: boolean('enabled').default(true).notNull(),
  backup_name_prefix: varchar('backup_name_prefix', { length: 255 }), // Optional prefix for backup names
  retention_days: integer('retention_days'), // Optional: delete backups older than X days
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  created_by: varchar('created_by', { length: 255 }), // User ID
  last_run_at: timestamp('last_run_at'), // Last successful backup time
  next_run_at: timestamp('next_run_at'), // Next scheduled backup time
});

export type BackupSchedule = typeof backupSchedules.$inferSelect;
export type NewBackupSchedule = typeof backupSchedules.$inferInsert;

