import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import * as Minio from 'minio';
import multer from 'multer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// SCHEDULED JOBS

dotenv.config();

const app = express();
const port = process.env.PORT || 4006;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'skaftin_db',
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'skaftin_user',
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
        password_hash VARCHAR(255),
        full_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add password_hash column if it doesn't exist (migration for existing databases)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='users' AND column_name='password_hash') THEN
          ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
        END IF;
      END $$;
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
  await initializeDatabaseWithProjects();
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
});

// MinIO client
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'minio',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY || 'skaftin_minio',
  secretKey: process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY || 'skaftin_password',
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'skaftin-files';

// Initialize MinIO bucket
const initializeMinIO = async () => {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`Created bucket: ${BUCKET_NAME}`);
    } else {
      console.log(`Bucket ${BUCKET_NAME} already exists`);
    }
  } catch (err) {
    console.error('MinIO initialization error:', err);
  }
};

// Initialize MinIO on startup
initializeMinIO();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
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

// File upload endpoint
app.post('/api/files/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded',
      });
    }

    const fileName = `${Date.now()}-${req.file.originalname}`;
    const metaData = {
      'Content-Type': req.file.mimetype,
      'Original-Name': req.file.originalname,
    };

    await minioClient.putObject(BUCKET_NAME, fileName, req.file.buffer, req.file.size, metaData);

    res.json({
      status: 'success',
      message: 'File uploaded successfully',
      data: {
        fileName: fileName,
        originalName: req.file.originalname,
        size: req.file.size,
        contentType: req.file.mimetype,
      },
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload file',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// List files endpoint
app.get('/api/files', async (req: Request, res: Response) => {
  try {
    const objectsList: any[] = [];
    const stream = minioClient.listObjects(BUCKET_NAME, '', true);

    stream.on('data', (obj) => {
      objectsList.push({
        name: obj.name,
        size: obj.size,
        lastModified: obj.lastModified,
      });
    });

    stream.on('end', () => {
      res.json({
        status: 'success',
        data: objectsList,
      });
    });

    stream.on('error', (err) => {
      console.error('List files error:', err);
      res.status(500).json({
        status: 'error',
        message: 'Failed to list files',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to list files',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// Download file endpoint
app.get('/api/files/:fileName', async (req: Request, res: Response) => {
  try {
    const fileName = req.params.fileName;
    const stat = await minioClient.statObject(BUCKET_NAME, fileName);

    res.setHeader('Content-Type', stat.metaData['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${stat.metaData['original-name'] || fileName}"`);

    const stream = await minioClient.getObject(BUCKET_NAME, fileName);
    stream.pipe(res);
  } catch (err) {
    console.error('Download error:', err);
    res.status(404).json({
      status: 'error',
      message: 'File not found',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// Delete file endpoint
app.delete('/api/files/:fileName', async (req: Request, res: Response) => {
  try {
    const fileName = req.params.fileName;
    await minioClient.removeObject(BUCKET_NAME, fileName);

    res.json({
      status: 'success',
      message: 'File deleted successfully',
    });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete file',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// MinIO test endpoint
app.get('/api/test/minio', async (req: Request, res: Response) => {
  try {
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
    const objectsList: any[] = [];
    const stream = minioClient.listObjects(BUCKET_NAME, '', true);

    stream.on('data', (obj) => {
      objectsList.push(obj.name);
    });

    stream.on('end', () => {
      res.json({
        status: 'success',
        message: 'MinIO connection successful',
        data: {
          bucketExists,
          bucketName: BUCKET_NAME,
          fileCount: objectsList.length,
        },
      });
    });

    stream.on('error', (err) => {
      res.status(500).json({
        status: 'error',
        message: 'MinIO connection failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'MinIO connection failed',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

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

// Health check endpoint with database and MinIO status
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();

    // Test MinIO connection
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);

    res.json({
      status: 'healthy',
      database: 'connected',
      minio: bucketExists ? 'connected' : 'disconnected',
      timestamp: result.rows[0].now,
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      minio: 'disconnected',
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

// Register endpoint
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters',
      });
    }

    const client = await pool.connect();
    
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      client.release();
      return res.status(409).json({
        status: 'error',
        message: 'Email already registered',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Generate username from email if not provided
    const username = email.split('@')[0];

    // Create user
    const result = await client.query(
      'INSERT INTO users (username, email, password_hash, full_name) VALUES ($1, $2, $3, $4) RETURNING id, username, email, full_name, created_at',
      [username, email, passwordHash, full_name || null]
    );

    client.release();

    // Generate JWT token
    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id.toString(),
          email: user.email,
          name: user.full_name || user.username,
        },
        token,
      },
    });
  } catch (err: any) {
    console.error('Register error:', err);

    // Handle unique constraint violations
    if (err.code === '23505') {
      return res.status(409).json({
        status: 'error',
        message: 'Email already registered',
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to register user',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required',
      });
    }

    const client = await pool.connect();
    
    // Find user by email
    const result = await client.query(
      'SELECT id, username, email, password_hash, full_name FROM users WHERE email = $1',
      [email]
    );

    client.release();

    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password',
      });
    }

    const user = result.rows[0];

    // Check if user has a password_hash (for existing users without passwords)
    if (!user.password_hash) {
      return res.status(401).json({
        status: 'error',
        message: 'Account not set up for password authentication. Please use registration.',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user.id.toString(),
          email: user.email,
          name: user.full_name || user.username,
        },
        token,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to login',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// JWT authentication middleware
const authenticateToken = (req: any, res: Response, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication token required',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      status: 'error',
      message: 'Invalid or expired token',
    });
  }
};

// Initialize database with projects table
const initializeDatabaseWithProjects = async () => {
  try {
    const client = await pool.connect();

    // Create projects table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        schema_name VARCHAR(255) NOT NULL UNIQUE,
        bucket_name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index on user_id
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
    `);

    client.release();
    console.log('Projects table initialized');
  } catch (err) {
    console.error('Projects table initialization error:', err);
  }
};

// Get user projects
app.get('/api/projects', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    
    const client = await pool.connect();
    const result = await client.query(
      'SELECT id, name, description, schema_name, bucket_name, created_at, updated_at FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    client.release();

    res.json({
      status: 'success',
      data: result.rows,
    });
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch projects',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// Create new project
app.post('/api/projects', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        status: 'error',
        message: 'Project name is required',
      });
    }

    // Generate schema and bucket names
    const schemaName = `project_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const bucketName = `project-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;

    const client = await pool.connect();
    
    // Create project
    const result = await client.query(
      'INSERT INTO projects (user_id, name, description, schema_name, bucket_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, description, schema_name, bucket_name, created_at, updated_at',
      [userId, name, description || null, schemaName, bucketName]
    );

    // Create database schema
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    } catch (schemaErr) {
      console.error('Schema creation error:', schemaErr);
      // Continue even if schema creation fails
    }

    // Create MinIO bucket
    try {
      await minioClient.makeBucket(bucketName, 'us-east-1');
    } catch (bucketErr) {
      console.error('Bucket creation error:', bucketErr);
      // Continue even if bucket creation fails
    }

    client.release();

    res.status(201).json({
      status: 'success',
      message: 'Project created successfully',
      data: result.rows[0],
    });
  } catch (err: any) {
    console.error('Create project error:', err);
    
    // Handle unique constraint violations
    if (err.code === '23505') {
      return res.status(409).json({
        status: 'error',
        message: 'Project name already exists',
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to create project',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

app.listen(port, () => {
  console.log(`Skaftin Platform server running on port:${port}`);
});