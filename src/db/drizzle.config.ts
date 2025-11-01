import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

let connection;
try {
  connection = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT as string, 10) || 5432,
    user: process.env.DB_USERNAME || process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || process.env.DB_NAME || 'skaftin_db',
    // Only use SSL if explicitly enabled
    ssl: process.env.DB_SSL === 'true' ? {
      rejectUnauthorized: false
    } : false
  });
  console.log("PostgreSQL connection established ✅");
} catch (error) {
  console.log('Database connection failed ❌:', error);
  throw error;
}

export const db = drizzle(connection);
