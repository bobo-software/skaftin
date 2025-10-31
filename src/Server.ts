import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand, CopyObjectCommand, ListObjectsV2Command, CreateBucketCommand, HeadBucketCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import multerS3 from 'multer-s3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createMCPRoutes } from './mcp/httpServer.js';

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

// MinIO/S3 client configuration
const accessKeyId = process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY;
const secretAccessKey = process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY;
const endpoint = process.env.MINIO_SERVER_URL || process.env.MINIO_ENDPOINT || 'http://localhost:9000';

if (!accessKeyId || !secretAccessKey || !endpoint) {
  throw new Error('MinIO credentials are not properly configured');
}

// Ensure endpoint has protocol
let minioEndpoint = endpoint;
if (!minioEndpoint.startsWith('http://') && !minioEndpoint.startsWith('https://')) {
  // Default to https if MINIO_USE_SSL is true, otherwise http
  const useSSL = process.env.MINIO_USE_SSL === 'true';
  minioEndpoint = useSSL ? `https://${endpoint}` : `http://${endpoint}`;
}

const s3Client = new S3Client({
  endpoint: minioEndpoint,
  region: process.env.MINIO_REGION || 'us-east-1',
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true,
  tls: process.env.MINIO_USE_SSL === 'true' || minioEndpoint.startsWith('https://'),
});

console.log('Initializing MinIO client with config:', {
  endpoint: minioEndpoint,
  region: process.env.MINIO_REGION || 'us-east-1',
  bucket: process.env.MINIO_BUCKET || 'skaftin',
  accessKeyId: '[REDACTED]',
  secretAccessKey: '[REDACTED]'
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'skaftin';

// Initialize MinIO bucket
const initializeMinIO = async () => {
  try {
    // Check if bucket exists
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
      console.log(`✓ MinIO bucket already exists: ${BUCKET_NAME}`);
    } catch (err: any) {
      // If bucket doesn't exist (404), create it
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
        console.log(`✓ Created MinIO bucket: ${BUCKET_NAME}`);
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error('✗ MinIO initialization error:', err);
    throw err;
  }
};

// Health check function
const performHealthChecks = async () => {
  console.log('\n🔍 Performing health checks...\n');
  
  const healthStatus = {
    database: { status: 'pending', message: '', details: '' },
    minio: { status: 'pending', message: '', details: '' },
  };

  // Check PostgreSQL Database
  try {
    const client = await pool.connect();
    const startTime = Date.now();
    const result = await client.query('SELECT NOW(), version(), current_database()');
    const responseTime = Date.now() - startTime;
    client.release();
    
    healthStatus.database = {
      status: 'healthy',
      message: 'Connected successfully',
      details: `Response time: ${responseTime}ms | DB: ${result.rows[0].current_database} | Version: ${result.rows[0].version.split(',')[0]}`,
    };
    console.log('✅ PostgreSQL Database:');
    console.log(`   Status: ${healthStatus.database.status}`);
    console.log(`   Message: ${healthStatus.database.message}`);
    console.log(`   Details: ${healthStatus.database.details}`);
  } catch (err) {
    healthStatus.database = {
      status: 'unhealthy',
      message: 'Connection failed',
      details: err instanceof Error ? err.message : 'Unknown error',
    };
    console.log('❌ PostgreSQL Database:');
    console.log(`   Status: ${healthStatus.database.status}`);
    console.log(`   Message: ${healthStatus.database.message}`);
    console.log(`   Error: ${healthStatus.database.details}`);
  }

  console.log('');

  // Check MinIO
  try {
    const startTime = Date.now();
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
      const responseTime = Date.now() - startTime;
      
      // List objects to verify full connectivity
      const listCommand = new ListObjectsV2Command({ Bucket: BUCKET_NAME, MaxKeys: 1 });
      const listResponse = await s3Client.send(listCommand);
      const fileCount = listResponse.KeyCount || 0;
      
      healthStatus.minio = {
        status: 'healthy',
        message: 'Connected successfully',
        details: `Response time: ${responseTime}ms | Endpoint: ${minioEndpoint} | Bucket: ${BUCKET_NAME}`,
      };
      console.log('✅ MinIO Storage:');
      console.log(`   Status: ${healthStatus.minio.status}`);
      console.log(`   Message: ${healthStatus.minio.message}`);
      console.log(`   Details: ${healthStatus.minio.details}`);
    } catch (err: any) {
      // If bucket doesn't exist, try to create it
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        const responseTime = Date.now() - startTime;
        healthStatus.minio = {
          status: 'warning',
          message: 'Connected but bucket does not exist',
          details: `Will attempt to create bucket: ${BUCKET_NAME}`,
        };
        console.log('⚠️  MinIO Storage:');
        console.log(`   Status: ${healthStatus.minio.status}`);
        console.log(`   Message: ${healthStatus.minio.message}`);
        console.log(`   Details: ${healthStatus.minio.details}`);
        // Try to create the bucket
        await initializeMinIO();
      } else {
        throw err;
      }
    }
  } catch (err) {
    healthStatus.minio = {
      status: 'unhealthy',
      message: 'Connection failed',
      details: err instanceof Error ? err.message : 'Unknown error',
    };
    console.log('❌ MinIO Storage:');
    console.log(`   Status: ${healthStatus.minio.status}`);
    console.log(`   Message: ${healthStatus.minio.message}`);
    console.log(`   Error: ${healthStatus.minio.details}`);
  }

  console.log('');
  
  // Summary
  const allHealthy = healthStatus.database.status === 'healthy' && 
                     (healthStatus.minio.status === 'healthy' || healthStatus.minio.status === 'warning');
  
  if (allHealthy) {
    console.log('✅ All services are ready!\n');
  } else {
    console.log('⚠️  Some services have issues. Server will start but some features may not work.\n');
  }

  return healthStatus;
};

// Configure multer for file uploads with S3 storage
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req: Request, file: Express.Multer.File, cb: (error: any, metadata?: any) => void) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req: Request, file: Express.Multer.File, cb: (error: any, key?: string) => void) {
      const fileName = `${Date.now()}-${file.originalname}`;
      cb(null, fileName);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// CORS configuration - allow all origins
app.use(cors({
  origin: '*',
  methods: 'GET,POST,PUT,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization',
  credentials: false,
}));
app.use(bodyParser.json());

// File upload endpoint (handled by multer-s3, file is already uploaded)
app.post('/api/files/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded',
      });
    }

    // With multer-s3, req.file.location contains the S3 URL
    // req.file.key contains the object key
    const fileLocation = (req.file as any).location || `${minioEndpoint}/${BUCKET_NAME}/${(req.file as any).key}`;
    const fileName = (req.file as any).key || req.file.originalname;

    res.json({
      status: 'success',
      message: 'File uploaded successfully',
      data: {
        fileName: fileName,
        originalName: req.file.originalname,
        size: req.file.size,
        contentType: req.file.mimetype,
        location: fileLocation,
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
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const response = await s3Client.send(command);

      if (response.Contents) {
        for (const obj of response.Contents) {
          objectsList.push({
            name: obj.Key,
            size: obj.Size,
            lastModified: obj.LastModified,
          });
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    res.json({
      status: 'success',
      data: objectsList,
    });
  } catch (err) {
    console.error('List files error:', err);
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

    // Get file metadata
    const headCommand = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
    });

    const metadata = await s3Client.send(headCommand);

    // Generate a presigned URL for download (valid for 1 hour)
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
    });

    const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

    // Redirect to the presigned URL, or you can stream the file directly
    // For now, redirect to the presigned URL
    res.redirect(signedUrl);

    // Alternative: Stream the file directly (uncomment to use)
    // const { Readable } = await import('stream');
    // const response = await s3Client.send(getCommand);
    // if (response.Body && response.Body instanceof Readable) {
    //   res.setHeader('Content-Type', metadata.ContentType || 'application/octet-stream');
    //   res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    //   response.Body.pipe(res);
    // } else {
    //   throw new Error('File body is not a readable stream');
    // }
  } catch (err: any) {
    console.error('Download error:', err);
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      res.status(404).json({
        status: 'error',
        message: 'File not found',
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to download file',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
});

// Delete file endpoint
app.delete('/api/files/:fileName', async (req: Request, res: Response) => {
  try {
    const fileName = req.params.fileName;
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
    });

    await s3Client.send(command);

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
    let bucketExists = false;
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
      bucketExists = true;
    } catch (err: any) {
      if (err.name !== 'NotFound' && err.$metadata?.httpStatusCode !== 404) {
        throw err;
      }
    }

    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 1000,
    });

    const response = await s3Client.send(command);
    const fileCount = response.Contents?.length || 0;

    res.json({
      status: 'success',
      message: 'MinIO connection successful',
      data: {
        bucketExists,
        bucketName: BUCKET_NAME,
        fileCount,
        endpoint: minioEndpoint,
      },
    });
  } catch (err) {
    console.error('MinIO test error:', err);
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
    let bucketExists = false;
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
      bucketExists = true;
    } catch (err) {
      // Bucket doesn't exist or connection failed
    }

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
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
    } catch (bucketErr: any) {
      // If bucket already exists, that's okay
      if (bucketErr.name !== 'BucketAlreadyOwnedByYou' && bucketErr.name !== 'BucketAlreadyExists') {
        console.error('MinIO Bucket creation error:', bucketErr);
      }
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

// MCP routes
const mcpRoutes = createMCPRoutes({ pool, s3Client });

// MCP endpoint - list tools
app.get('/api/mcp/tools', mcpRoutes.listTools);

// MCP endpoint - call tool
app.post('/api/mcp/call', mcpRoutes.callTool);

// Legacy MCP endpoint (for compatibility)
app.post('/api/mcp', (req: Request, res: Response) => {
  // Redirect to new endpoint structure
  if (req.body.method === 'tools/list') {
    return mcpRoutes.listTools(req, res);
  } else if (req.body.method === 'tools/call') {
    return mcpRoutes.callTool(req, res);
  } else {
    res.status(400).json({ error: 'Invalid MCP method' });
  }
});

// Startup function
const startServer = async () => {
  // Display startup banner
  console.log('\n' + '='.repeat(60));
  console.log('🚀  SKAFTIN PLATFORM - Starting Server');
  console.log('='.repeat(60));
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 Server Port: ${port}`);
  console.log(`📊 Database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}`);
  console.log(`📦 MinIO: ${minioEndpoint}`);
  console.log('='.repeat(60) + '\n');

  // Perform health checks
  await performHealthChecks();

  // Start server
  app.listen(port, () => {
    console.log('='.repeat(60));
    console.log(`✅ Skaftin Platform server is running!`);
    console.log(`🌐 Server URL: http://localhost:${port}`);
    console.log(`📡 API Base: http://localhost:${port}/api`);
    console.log(`🔧 MCP Endpoint: http://localhost:${port}/api/mcp`);
    console.log('='.repeat(60) + '\n');
  });
};

// Start the server
startServer().catch((err) => {
  console.error('\n❌ Failed to start server:', err);
  process.exit(1);
});