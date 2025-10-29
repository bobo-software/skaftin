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
  port: parseInt(process.env.DB_PORT || '5440'),
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'skaftin_db',
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'skaftin_user',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'skaftin_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
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

app.listen(port, () => {
  console.log(`Skaftin Platform server running on port:${port}`);
});