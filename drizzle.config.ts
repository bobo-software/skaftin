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
    host: process.env.DB_HOST || '102.218.215.251',
    port: parseInt(process.env.DB_PORT || '5433', 10),
    user: process.env.DB_USERNAME || 'kcd_user',
    password: process.env.DB_PASSWORD || ' ',
    database: process.env.DB_DATABASE || 'kcd',
    ssl: {
      rejectUnauthorized: false
    }
  },
};

export default config;
