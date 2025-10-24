import { Router, Request, Response } from 'express';
import { testConnection, getDatabaseInfo } from '../db/connection';

const router = Router();

// Health check endpoint
router.get('/', async (req: Request, res: Response) => {
  try {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Skaftin backend is running'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Database connection test endpoint
router.get('/db', async (req: Request, res: Response) => {
  try {
    console.log('🧪 Testing database connection...');
    
    const isConnected = await testConnection();
    
    if (isConnected) {
      const dbInfo = await getDatabaseInfo();
      
      res.json({
        status: 'success',
        message: 'Database connection successful',
        database: dbInfo
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Database connection failed'
      });
    }
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
