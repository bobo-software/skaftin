require('dotenv').config();

interface DBCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: {
    rejectUnauthorized: boolean;
  };
}

interface Config {
  schema: string;
  out: string;
  dialect: string;
  dbCredentials: DBCredentials;
}

const config: Config = {
  schema: "./src/db/schemas/**/*.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5440', 10),
    user: process.env.DB_USER || 'skaftin_user',
    password: process.env.DB_PASSWORD || 'skaftin_password',
    database: process.env.DB_NAME || 'skaftin_db',
    ssl: {
      rejectUnauthorized: false
    }
  },
};

export default config;
