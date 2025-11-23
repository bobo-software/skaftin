import { pgTable, serial, varchar, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Organizations Table
 * Each organization can have multiple members and projects
 */
export const organizations = pgTable('skaftin_system_organizations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  owner_id: varchar('owner_id', { length: 255 }).notNull(), // SuperTokens user ID of the owner
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

/**
 * Organization Members Table
 * Manages team members and their roles within an organization
 */
export const organization_members = pgTable('skaftin_system_organization_members', {
  id: serial('id').primaryKey(),
  organization_id: serial('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  user_id: varchar('user_id', { length: 255 }).notNull(), // SuperTokens user ID
  role: varchar('role', { length: 50 }).notNull().default('member'), // admin, dev, member, viewer
  joined_at: timestamp('joined_at').defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type OrganizationInsert = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organization_members.$inferSelect;
export type OrganizationMemberInsert = typeof organization_members.$inferInsert;

