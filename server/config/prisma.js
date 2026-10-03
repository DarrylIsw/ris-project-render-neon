require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');

if (!process.env.DATABASE_URL) {
  const host = process.env.PGHOST || process.env.DB_HOST;
  const database = process.env.PGDATABASE || process.env.DB_NAME;
  const user = process.env.PGUSER || process.env.DB_USER;
  const password = process.env.PGPASSWORD || process.env.DB_PASSWORD;
  if (host && database && user && password) {
    const url = new URL('postgresql://database.invalid');
    url.hostname = host;
    url.port = process.env.PGPORT || process.env.DB_PORT || '5432';
    url.pathname = `/${database}`;
    url.username = user;
    url.password = password;
    url.searchParams.set('schema', 'public');
    process.env.DATABASE_URL = url.toString();
  }
}

if (process.env.DATABASE_SSL === 'true' && process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  if (url.searchParams.get('sslmode') === 'disable') {
    throw new Error('DATABASE_SSL=true tidak dapat digunakan bersama sslmode=disable.');
  }
  url.searchParams.set('sslmode', 'require');
  url.searchParams.set(
    'sslaccept',
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false' ? 'accept_invalid_certs' : 'strict'
  );
  process.env.DATABASE_URL = url.toString();
}

// PostgreSQL local installs commonly listen only on IPv4. Prisma may resolve
// localhost to IPv6 first, so keep local development on the IPv4 loopback.
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  if (url.hostname === 'localhost') {
    url.hostname = '127.0.0.1';
    process.env.DATABASE_URL = url.toString();
  }
}

module.exports = new PrismaClient();
