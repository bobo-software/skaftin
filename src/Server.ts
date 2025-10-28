import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';

// SCHEDULED JOBS

dotenv.config();

const app = express();
const port = process.env.PORT || 4006;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'skaftin_db',
  user: process.env.DB_USER || 'skaftin_user',
  password: process.env.DB_PASSWORD || 'skaftin_password',
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
const corsOptions = {
  origin: true,
  methods: 'GET,POST,PUT,DELETE',
  allowedHeaders: 'Content-Type,Authorization',
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from the Skaftin Platform');
});

// Database health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: result.rows[0].now 
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

// Get platform stats
app.get('/api/stats', async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM platform_stats ORDER BY recorded_at DESC');
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get users
app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT id, username, email, created_at FROM users ORDER BY created_at DESC');
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.listen(port, () => {
  console.log(`Skaftin Platform server running on port:${port}`);
});