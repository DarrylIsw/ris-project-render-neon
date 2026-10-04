'use strict';

const { Client } = require('pg');

const timeoutMs = Number(process.env.DB_POSTGRES_CHECK_TIMEOUT_MS || 30000);
const sslEnabled = process.env.DATABASE_SSL === 'true';
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
const endpoints = [
  { envName: 'DATABASE_URL', label: 'runtime', required: true },
  { envName: 'DATABASE_URL_UNPOOLED', label: 'direct/migrations', required: false },
];

const safeMessage = message => String(message || 'Unknown database connection error')
  .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, '<connection-url>')
  .slice(0, 500);

const testEndpoint = async ({ envName, label, required }) => {
  const connectionString = process.env[envName];
  if (!connectionString) {
    const status = required ? 'CONFIG_FAILED' : 'SKIPPED';
    console.error(`[${label}] ${status}: ${envName} is ${required ? 'required but not set' : 'not set'}.`);
    return !required;
  }

  let endpoint;
  try {
    const url = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new Error('Expected a PostgreSQL connection URL.');
    }
    endpoint = {
      host: url.hostname,
      port: Number(url.port || 5432),
      database: decodeURIComponent(url.pathname.slice(1)),
    };
  } catch (error) {
    console.error(`[${label}] CONFIG_FAILED: ${safeMessage(error.message)}`);
    return false;
  }

  console.log(`\n[${label}] PostgreSQL target: ${endpoint.host}:${endpoint.port}/${endpoint.database}`);
  console.log(`[${label}] TLS config: DATABASE_SSL=${sslEnabled}, rejectUnauthorized=${rejectUnauthorized}`);

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: timeoutMs,
    ssl: sslEnabled ? { rejectUnauthorized } : false,
  });

  try {
    await client.connect();
    const result = await client.query(`
      SELECT
        current_database() AS database,
        inet_server_addr()::text AS server_ip
    `);
    console.log(`[${label}] POSTGRES_OK: ${JSON.stringify(result.rows[0])}`);
    return true;
  } catch (error) {
    console.error(`[${label}] POSTGRES_FAILED: ${JSON.stringify({
      name: error.name,
      code: error.code || null,
      message: safeMessage(error.message),
    })}`);
    return false;
  } finally {
    await client.end().catch(() => {});
  }
};

const main = async () => {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
    console.error('DB_POSTGRES_CHECK_TIMEOUT_MS must be an integer from 1000 to 60000.');
    process.exitCode = 1;
    return;
  }

  const results = await Promise.all(endpoints.map(testEndpoint));
  if (results.some(result => !result)) process.exitCode = 1;
};

main().catch(error => {
  console.error(`[diagnostic] FAILED: ${safeMessage(error.message)}`);
  process.exitCode = 1;
});
