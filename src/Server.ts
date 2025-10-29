import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';

// SCHEDULED JOBS

dotenv.config();

const app = express();
const port = process.env.PORT || 4006;

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'skaftin_db',
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'skaftin_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize database tables
const initializeDatabase = async () => {
  try {
    const client = await pool.connect();

    // Create users table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index on email
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    // Insert test users if table is empty
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO users (username, email, full_name) VALUES
          ('alice', 'alice@example.com', 'Alice Johnson'),
          ('bob', 'bob@example.com', 'Bob Smith'),
          ('charlie', 'charlie@example.com', 'Charlie Brown'),
          ('diana', 'diana@example.com', 'Diana Prince'),
          ('eve', 'eve@example.com', 'Eve Wilson')
        ON CONFLICT (username) DO NOTHING;
      `);
      console.log('Test users inserted');
    }

    client.release();
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
};

// Test database connection
pool.on('connect', async () => {
  console.log('Connected to PostgreSQL database');
  await initializeDatabase();
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
});

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3006', 'http://localhost:3000', 'http://102.218.215.251:3006', 'http://coolify.bobosoftware.co.za:3006'];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Log rejected origins for debugging
      console.log(`CORS: Rejected origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,POST,PUT,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization',
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from the Skaftin Platform');
});

// Database test endpoint
app.get('/api/test/db', async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    client.release();

    res.json({
      status: 'success',
      message: 'Database connection successful',
      data: {
        currentTime: result.rows[0].current_time,
        version: result.rows[0].version,
      },
    });
  } catch (err) {
    console.error('Database test error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// Health check endpoint with database status
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();

    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: result.rows[0].now,
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// Get all users
app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT id, username, email, full_name, created_at FROM users ORDER BY created_at DESC');
    client.release();

    res.json({
      status: 'success',
      data: result.rows,
    });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// Create a new user
app.post('/api/users', async (req: Request, res: Response) => {
  try {
    const { username, email, full_name } = req.body;

    if (!username || !email) {
      return res.status(400).json({
        status: 'error',
        message: 'Username and email are required',
      });
    }

    const client = await pool.connect();
    const result = await client.query(
      'INSERT INTO users (username, email, full_name) VALUES ($1, $2, $3) RETURNING id, username, email, full_name, created_at',
      [username, email, full_name || null]
    );
    client.release();

    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      data: result.rows[0],
    });
  } catch (err: any) {
    console.error('Create user error:', err);

    // Handle unique constraint violations
    if (err.code === '23505') {
      return res.status(409).json({
        status: 'error',
        message: 'Username or email already exists',
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to create user',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

app.listen(port, () => {
  console.log(`Skaftin Platform server running on port:${port}`);
});