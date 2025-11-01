import { pgTable, serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  schema_name: varchar('schema_name', { length: 255 }).notNull().unique(),
  bucket_name: varchar('bucket_name', { length: 255 }).notNull().unique(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

