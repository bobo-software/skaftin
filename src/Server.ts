import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import * as dotenv from 'dotenv';

// SCHEDULED JOBS

dotenv.config();

const app = express();
const port = process.env.PORT || 4006;

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



app.listen(port, () => {
  console.log(`Skaftin Platform server running on port:${port}`);
});