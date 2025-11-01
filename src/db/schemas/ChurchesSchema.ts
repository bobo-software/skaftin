import { integer, pgTable, varchar, timestamp, bigserial } from 'drizzle-orm/pg-core';

export const churches = pgTable('churches', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  street: varchar('street', { length: 255 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  postal_code: integer('postal_code'),
  country: varchar('country', { length: 100 }),
  owner_id: integer('owner_id'),
  timestamp: timestamp('timestamp').defaultNow()
});
