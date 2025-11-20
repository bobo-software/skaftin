import { pgTable, serial, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './OrganizationsSchema';

// Note: Projects now belong to organizations instead of individual users
// Note: Projects no longer have a single bucket_name - use project_buckets table instead
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  organization_id: serial('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  user_id: varchar('user_id', { length: 255 }).notNull(), // SuperTokens user ID of creator (kept for legacy/audit)
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  schema_name: varchar('schema_name', { length: 255 }).notNull().unique(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});
