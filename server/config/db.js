const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ quiet: true });

const hasDatabaseConfig = Boolean(
  process.env.DATABASE_URL_UNPOOLED
  || process.env.DATABASE_URL
  || (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER)
  || (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER)
);

const ssl = process.env.DATABASE_SSL === 'true'
  ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
  : false;

const pool = hasDatabaseConfig ? new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST || process.env.DB_HOST,
  port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
  database: process.env.PGDATABASE || process.env.DB_NAME,
  user: process.env.PGUSER || process.env.DB_USER,
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
  ssl,
}) : null;

const query = (text, params) => {
  if (!pool) {
    const error = new Error('PostgreSQL is not configured. Set DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD in .env.');
    error.code = 'DB_NOT_CONFIGURED';
    throw error;
  }
  return pool.query(text, params);
};

module.exports = {
  pool,
  query,
  isDatabaseConfigured: () => Boolean(pool),
};
