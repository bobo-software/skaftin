import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = parseInt(process.env.BACKEND_PORT || '4005');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.get('/', (req: Request, res: Response) => {
  res.send('Hello from Skaftin ⛪, be blessed!');
});

app.get('/test', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Basic server test endpoint working',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Skaftin backend is running'
  });
});

app.get('/api/health/info', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Basic Skaftin server is running',
    version: '1.0.0',
    features: {
      database: false,
      authentication: false,
      mcp: false,
      websocket: false
    }
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Skaftin server running on port: ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/api/health`);
  console.log(`🧪 Test endpoint: http://localhost:${port}/test`);
  console.log(`ℹ️  Server info: http://localhost:${port}/api/health/info`);
});