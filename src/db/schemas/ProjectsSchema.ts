import { pgTable, serial, varchar, text, timestamp } from 'drizzle-orm/pg-core';

// Note: user_id is now a VARCHAR (SuperTokens user ID, not a foreign key)
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  user_id: varchar('user_id', { length: 255 }).notNull(), // SuperTokens user ID
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  schema_name: varchar('schema_name', { length: 255 }).notNull().unique(),
  bucket_name: varchar('bucket_name', { length: 255 }).notNull().unique(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});
