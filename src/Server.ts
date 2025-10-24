import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { config, validateConfig } from './backend/config/environment';

// SCHEDULED JOBS
// import './jobs/SomeJobs';

// ROUTERS
// Validate configuration on startup
validateConfig();

const app = express();
const port = config.backend.port;

// CORS configuration
const corsOptions = {
  origin: config.cors.origin,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  credentials: config.cors.credentials,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from Skaftin ⛪, be blessed!');
});

app.listen(port, () => {
  console.log(`Skaftin server running on port:${port}`);
});