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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  },
};

// Basic validation function (no database or auth requirements)
export function validateConfig() {
  console.log('✅ Basic configuration loaded successfully');
  return true;
}