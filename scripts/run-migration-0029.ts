/**
 * Run migration 0029: Add request logs table to public schema
 * Usage: npx ts-node scripts/run-migration-0029.ts
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

  const migrationPath = path.join(__dirname, '../migrations/0029_add_request_logs_table.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  try {
    console.log('🚀 Running migration 0029_add_request_logs_table.sql...');
    console.log(`   Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    await pool.query(sql);
    console.log('✅ Migration completed successfully.');
    
    // Verify the table was created
    const verifyResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'skaftin_system_request_logs'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Table structure:');
    verifyResult.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });
    
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
