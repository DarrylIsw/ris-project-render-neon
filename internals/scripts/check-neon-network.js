'use strict';

const dns = require('node:dns').promises;
const net = require('node:net');

const timeoutMs = Number(process.env.DB_NETWORK_CHECK_TIMEOUT_MS || 12000);
const endpoints = [
  { envName: 'DATABASE_URL', label: 'pooled/runtime' },
  { envName: 'DATABASE_URL_UNPOOLED', label: 'direct/migrations' },
];

const parseEndpoint = envName => {
  const value = process.env[envName];
  if (!value) return null;

  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${envName} must use the PostgreSQL URL scheme.`);
  }

  return {
    host: url.hostname,
    port: Number(url.port || 5432),
  };
};

const checkTcp = (host, port) => new Promise((resolve, reject) => {
  const socket = net.createConnection({ host, port });
  let settled = false;

  const finish = error => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    socket.destroy();
    if (error) reject(error);
    else resolve();
  };

  const timer = setTimeout(() => {
    const error = new Error(`TCP connection timed out after ${timeoutMs}ms.`);
    error.code = 'ETIMEDOUT';
    finish(error);
  }, timeoutMs);

  socket.once('connect', () => finish());
  socket.once('error', finish);
});

const checkEndpoint = async ({ envName, label }) => {
  let endpoint;
  try {
    endpoint = parseEndpoint(envName);
  } catch (error) {
    console.error(`[${label}] CONFIG_FAILED: ${error.message}`);
    return false;
  }

  if (!endpoint) {
    console.log(`[${label}] SKIPPED: ${envName} is not set.`);
    return envName !== 'DATABASE_URL';
  }

  const { host, port } = endpoint;
  console.log(`\n[${label}] Target: ${host}:${port}`);

  let addresses;
  try {
    addresses = await dns.lookup(host, { all: true, verbatim: true });
    console.log(`[${label}] DNS_OK: ${addresses.map(({ address, family }) => `${address}/IPv${family}`).join(', ')}`);
  } catch (error) {
    console.error(`[${label}] DNS_FAILED: ${error.code || 'UNKNOWN'} ${error.message}`);
    return false;
  }

  try {
    await checkTcp(host, port);
    console.log(`[${label}] TCP_OK`);
    return true;
  } catch (error) {
    console.error(`[${label}] TCP_FAILED: ${error.code || 'UNKNOWN'} ${error.message}`);
    return false;
  }
};

const main = async () => {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
    console.error('DB_NETWORK_CHECK_TIMEOUT_MS must be an integer from 1000 to 60000.');
    process.exitCode = 1;
    return;
  }

  const results = await Promise.all(endpoints.map(checkEndpoint));
  if (results.some(result => !result)) process.exitCode = 1;
};

main().catch(error => {
  console.error(`DIAGNOSTIC_FAILED: ${error.message}`);
  process.exitCode = 1;
});
