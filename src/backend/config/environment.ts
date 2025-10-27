import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server Configuration
  backend: {
    port: parseInt(process.env.BACKEND_PORT || '4005'),
    host: process.env.BACKEND_HOST || 'localhost',
    url: process.env.BACKEND_URL || `http://localhost:${process.env.BACKEND_PORT || 4005}`,
  },
  frontend: {
    port: parseInt(process.env.FRONTEND_PORT || '3005'),
    host: process.env.FRONTEND_HOST || 'localhost',
    url: process.env.FRONTEND_URL || `http://localhost:${process.env.FRONTEND_PORT || 3005}`,
  },

  // Database Configuration
  database: {
    connection: process.env.DB_CONNECTION || 'postgresql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'postgres',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // MinIO Configuration
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost:9000',
    accessKey: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
    bucketPrefix: process.env.MINIO_BUCKET_PREFIX || 'skaftin',
    region: process.env.MINIO_REGION || 'us-east-1',
    useSSL: process.env.MINIO_USE_SSL === 'true',
  },

  // Email Configuration
  email: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
  },

  // Redis Configuration (for future use)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0'),
  },

  // Environment
  environment: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // CORS Configuration
  cors: {
    origin: [
      `http://localhost:${process.env.FRONTEND_PORT || 3005}`,
      `http://127.0.0.1:${process.env.FRONTEND_PORT || 3005}`,
      process.env.FRONTEND_URL || `http://localhost:${process.env.FRONTEND_PORT || 3005}`,
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'rid', 'fdi-version', 'anti-csrf', 'st-auth-mode', 'Content-Encoding'],
    credentials: true,
    exposedHeaders: ['Set-Cookie'],
  },

  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'), // requests per window
  },

  // SuperTokens Configuration
  supertokens: {
    connectionURI: process.env.SUPERTOKENS_CONNECTION_URI || 'http://localhost:3567',
    apiKey: process.env.SUPERTOKENS_API_KEY || 'dev-api-key-change-in-production',
  },

  // OAuth Configuration
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    },
  },
};

// Validation function
export function validateConfig() {
  const requiredVars = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT secret in production
  if (config.isProduction && config.jwt.secret === 'your-super-secret-jwt-key-change-in-production') {
    throw new Error('JWT_SECRET must be set in production environment');
  }

  console.log('✅ Configuration validated successfully');
  return true;
}

// Export database connection string
export const getDatabaseUrl = () => {
  const { host, port, database, username, password } = config.database;
  return `postgresql://${username}:${password}@${host}:${port}/${database}`;
};

// Export MinIO connection config
export const getMinioConfig = () => ({
  endPoint: config.minio.endpoint.split(':')[0],
  port: parseInt(config.minio.endpoint.split(':')[1]) || 9000,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
  region: config.minio.region,
});
