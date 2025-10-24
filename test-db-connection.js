#!/usr/bin/env node

/**
 * Simple database connection test script
 * Run with: node test-db-connection.js
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database configuration from .env
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function testConnection() {
  let client;
  
  try {
    console.log('🔄 Testing database connection...');
    console.log(`📡 Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`📡 Port: ${process.env.DB_PORT || '5432'}`);
    console.log(`📡 Database: ${process.env.DB_NAME || 'postgres'}`);
    console.log(`📡 User: ${process.env.DB_USER || 'postgres'}`);
    
    client = await pool.connect();
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    
    console.log('\n✅ Database connection successful!');
    console.log(`⏰ Current time: ${result.rows[0].current_time}`);
    console.log(`🐘 PostgreSQL version: ${result.rows[0].postgres_version}`);
    
    // Test database info
    const dbInfo = await client.query(`
      SELECT 
        current_database() as database_name,
        current_user as current_user,
        inet_server_addr() as server_address,
        inet_server_port() as server_port
    `);
    
    console.log('\n📊 Database Information:');
    console.log(`   Database: ${dbInfo.rows[0].database_name}`);
    console.log(`   User: ${dbInfo.rows[0].current_user}`);
    console.log(`   Server: ${dbInfo.rows[0].server_address}:${dbInfo.rows[0].server_port}`);
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Database connection failed:');
    console.error('Error:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   - Make sure PostgreSQL is running');
      console.error('   - Check if the host and port are correct');
      console.error('   - Try: sudo systemctl status postgresql');
    } else if (error.message.includes('password authentication failed')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   - Check your database credentials in .env file');
      console.error('   - Verify the username and password are correct');
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   - Create the database first:');
      console.error('     sudo -u postgres createdb ' + (process.env.DB_NAME || 'postgres'));
    }
    
    return false;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the test
testConnection()
  .then(success => {
    if (success) {
      console.log('\n🎉 Database connection test completed successfully!');
      process.exit(0);
    } else {
      console.log('\n💥 Database connection test failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });
