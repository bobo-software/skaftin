import { pgTable, serial, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { projects } from './ProjectsSchema';

/**
 * Project Buckets Table
 * Each project can have multiple storage buckets
 * Buckets are manually created by users
 */
export const project_buckets = pgTable('skaftin_system_project_buckets', {
  id: serial('id').primaryKey(),
  project_id: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  bucket_name: varchar('bucket_name', { length: 255 }).notNull().unique(),
  description: text('description'),
  access_policy: varchar('access_policy', { length: 20 }).notNull().default('public'), // 'private' or 'public'
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export type ProjectBucket = typeof project_buckets.$inferSelect;
export type ProjectBucketInsert = typeof project_buckets.$inferInsert;

