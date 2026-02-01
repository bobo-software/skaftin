/**
 * Run migration 0026: Fix payment_type constraint (once -> once_off)
 * Usage: npx ts-node scripts/run-migration-0026.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5440'),
    database: process.env.DB_NAME || 'skaftin_db',
    user: process.env.DB_USER || 'skaftin_user',
    password: process.env.DB_PASSWORD || 'skaftin_password',
  });

  const migrationPath = path.join(__dirname, '../migrations/0026_fix_payment_type_constraint.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  try {
    console.log('Running migration 0026_fix_payment_type_constraint.sql...');
    await pool.query(sql);
    console.log('Migration completed successfully.');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
