/**
 * Generic Migration Runner
 * 
 * Run any migration file from the migrations folder
 * 
 * Usage:
 *   npx ts-node scripts/run-migration.ts <migration_file>
 *   npx ts-node scripts/run-migration.ts 0029_add_request_logs_table.sql
 *   npx ts-node scripts/run-migration.ts --list
 *   npx ts-node scripts/run-migration.ts --all
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

interface MigrationResult {
  file: string;
  success: boolean;
  error?: string;
  duration: number;
}

async function getPool(): Promise<Pool> {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5440'),
    database: process.env.DB_NAME || 'skaftin_db',
    user: process.env.DB_USER || 'skaftin_user',
    password: process.env.DB_PASSWORD || 'skaftin_password',
  });
}

async function listMigrations(): Promise<string[]> {
  const files = fs.readdirSync(MIGRATIONS_DIR);
  return files
    .filter(f => f.endsWith('.sql'))
    .sort();
}

async function runMigration(pool: Pool, filename: string): Promise<MigrationResult> {
  const startTime = Date.now();
  const migrationPath = path.join(MIGRATIONS_DIR, filename);
  
  if (!fs.existsSync(migrationPath)) {
    return {
      file: filename,
      success: false,
      error: `File not found: ${migrationPath}`,
      duration: Date.now() - startTime
    };
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  try {
    console.log(`\n📦 Running migration: ${filename}`);
    await pool.query(sql);
    const duration = Date.now() - startTime;
    console.log(`✅ Migration completed in ${duration}ms`);
    return { file: filename, success: true, duration };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ Migration failed: ${err.message}`);
    return { file: filename, success: false, error: err.message, duration };
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage:
  npx ts-node scripts/run-migration.ts <migration_file>
  npx ts-node scripts/run-migration.ts 0029_add_request_logs_table.sql
  npx ts-node scripts/run-migration.ts --list
  npx ts-node scripts/run-migration.ts --all
  npx ts-node scripts/run-migration.ts --pending

Examples:
  npx ts-node scripts/run-migration.ts 0029_add_request_logs_table.sql
  npx ts-node scripts/run-migration.ts --list
    `);
    process.exit(0);
  }

  const pool = await getPool();

  try {
    // List migrations
    if (args[0] === '--list') {
      console.log('\n📋 Available migrations:\n');
      const migrations = await listMigrations();
      migrations.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));
      console.log(`\nTotal: ${migrations.length} migration(s)`);
      process.exit(0);
    }

    // Run all migrations
    if (args[0] === '--all') {
      console.log('\n🚀 Running ALL migrations...\n');
      const migrations = await listMigrations();
      const results: MigrationResult[] = [];
      
      for (const migration of migrations) {
        const result = await runMigration(pool, migration);
        results.push(result);
        if (!result.success) {
          console.error(`\n⚠️  Stopping due to error in ${migration}`);
          break;
        }
      }

      console.log('\n📊 Summary:');
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      console.log(`  ✅ Successful: ${successful}`);
      console.log(`  ❌ Failed: ${failed}`);
      process.exit(failed > 0 ? 1 : 0);
    }

    // Run specific migration
    const migrationFile = args[0];
    const result = await runMigration(pool, migrationFile);
    process.exit(result.success ? 0 : 1);

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
