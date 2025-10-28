import { Pool, PoolClient } from 'pg';
import { config } from '../config/environment';

// Create connection pool
export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  user: config.database.username,
  password: config.database.password,
  max: config.database.maxConnections,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
export async function testConnection(): Promise<boolean> {
  let client: PoolClient | null = null;
  
  try {
    console.log('🔄 Testing database connection...');
    console.log(`📡 Connecting to: ${config.database.host}:${config.database.port}/${config.database.database}`);
    console.log(`👤 Database user: ${config.database.username}`);
    console.log(`🔐 Password set: ${config.database.password ? 'Yes' : 'No'}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🐳 Docker environment: ${process.env.DOCKER ? 'Yes' : 'No'}`);
    
    // Log all database-related environment variables
    console.log('📋 Database Environment Variables:');
    console.log(`  DB_HOST: ${process.env.DB_HOST || 'not set'}`);
    console.log(`  DB_PORT: ${process.env.DB_PORT || 'not set'}`);
    console.log(`  DB_USER: ${process.env.DB_USER || 'not set'}`);
    console.log(`  DB_PASSWORD: ${process.env.DB_PASSWORD ? 'set' : 'not set'}`);
    console.log(`  DB_NAME: ${process.env.DB_NAME || 'not set'}`);
    
    client = await pool.connect();
    
    // Simple query to test connection
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    
    console.log('✅ Database connection successful!');
    console.log(`⏰ Current time: ${result.rows[0].current_time}`);
    console.log(`🐘 PostgreSQL version: ${result.rows[0].postgres_version}`);
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error details:', error);
    
    // Additional diagnostic information
    console.log('🔍 Diagnostic Information:');
    console.log(`  Attempted connection: ${config.database.host}:${config.database.port}`);
    console.log(`  Network interface check: ${config.database.host === 'localhost' ? 'Using localhost - may not work in Docker' : 'Using container name - good for Docker'}`);
    
    // Check if we're in Docker
    if (process.env.NODE_ENV === 'production' || process.env.DOCKER) {
      console.log('🐳 Running in containerized environment');
      console.log('💡 Tip: Ensure DB_HOST is set to container name (e.g., "postgres") not "localhost"');
    }
    
    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        console.error('💡 Make sure PostgreSQL is running on the specified host and port');
        console.error('💡 In Docker: Use container name (e.g., "postgres") instead of "localhost"');
        console.error('💡 Check if PostgreSQL container is running: docker ps | grep postgres');
      } else if (error.message.includes('password authentication failed')) {
        console.error('💡 Check your database credentials in .env file');
      } else if (error.message.includes('database') && error.message.includes('does not exist')) {
        console.error('💡 Make sure the database exists or create it first');
      }
    }
    
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Get database info
export async function getDatabaseInfo(): Promise<any> {
  let client: PoolClient | null = null;
  
  try {
    client = await pool.connect();
    
    // Get database information
    const queries = [
      'SELECT current_database() as database_name',
      'SELECT current_user as current_user',
      'SELECT inet_server_addr() as server_address',
      'SELECT inet_server_port() as server_port',
      'SELECT version() as postgres_version'
    ];
    
    const results = await Promise.all(queries.map(query => client!.query(query)));
    
    return {
      database: results[0].rows[0].database_name,
      user: results[1].rows[0].current_user,
      serverAddress: results[2].rows[0].server_address,
      serverPort: results[3].rows[0].server_port,
      version: results[4].rows[0].postgres_version
    };
  } catch (error) {
    console.error('Error getting database info:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Graceful shutdown
export async function closeConnection(): Promise<void> {
  try {
    await pool.end();
    console.log('🔌 Database connection pool closed');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, closing database connections...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, closing database connections...');
  await closeConnection();
  process.exit(0);
});
