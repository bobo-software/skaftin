import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import * as Minio from 'minio';
import multer from 'multer';

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

// MinIO client
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'minio',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'skaftin_minio',
  secretKey: process.env.MINIO_SECRET_KEY || 'skaftin_minio_password',
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
    
    // Test MinIO connection
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
    
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      minio: bucketExists ? 'connected' : 'disconnected',
      timestamp: result.rows[0].now 
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      minio: 'disconnected',
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

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileName = `${Date.now()}-${req.file.originalname}`;
    const metaData = {
      'Content-Type': req.file.mimetype,
      'Original-Name': req.file.originalname,
    };

    await minioClient.putObject(BUCKET_NAME, fileName, req.file.buffer, req.file.size, metaData);
    
    res.json({
      success: true,
      fileName: fileName,
      originalName: req.file.originalname,
      size: req.file.size,
      url: `http://localhost:9000/${BUCKET_NAME}/${fileName}`
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload file' });
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
        url: `http://localhost:9000/${BUCKET_NAME}/${obj.name}`
      });
    });
    
    stream.on('end', () => {
      res.json(objectsList);
    });
    
    stream.on('error', (err) => {
      console.error('List files error:', err);
      res.status(500).json({ error: 'Failed to list files' });
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list files' });
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
    res.status(404).json({ error: 'File not found' });
  }
});

app.listen(port, () => {
  console.log(`Skaftin Platform server running on port:${port}`);
});