/* eslint-disable no-await-in-loop */
const assert = require('assert');
const express = require('express');
const {
  configureSecurity, loginLimit, passwordChangeLimit, privateHost
} = require('../../server/middlewares/security');
const { sameOrigin } = require('../../server/middlewares/auth');
const healthController = require('../../server/controllers/healthController');
const db = require('../../server/config/db');
const logger = require('../../server/logger');

describe('RIS HTTP security', () => {
  let server;
  let base;
  let previous;
  it('accepts only loopback or private production bind addresses', () => {
    ['localhost', '127.0.0.1', '10.0.0.8', '172.16.1.4', '192.168.1.8', '::1'].forEach(host => assert(privateHost(host)));
    ['0.0.0.0', '::', '8.8.8.8', '172.32.0.1', 'ris.example.test'].forEach(host => assert(!privateHost(host)));
  });
  before(async () => {
    previous = Object.fromEntries(['NODE_ENV', 'APP_BASE_URL', 'TRUST_PROXY_HOPS', 'MFA_ENCRYPTION_KEY', 'HOST']
      .map(key => [key, process.env[key]]));
    process.env.NODE_ENV = 'production';
    process.env.APP_BASE_URL = 'https://ris.example.test';
    process.env.TRUST_PROXY_HOPS = '1';
    process.env.MFA_ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.HOST = '127.0.0.1';
    const app = express();
    configureSecurity(app);
    app.use('/api', sameOrigin);
    app.get('/api/ping', (req, res) => res.json({ ok: true }));
    app.get('/api/health', healthController.status);
    app.post('/api/auth/login', loginLimit, (req, res) => res.status(401).json({ message: 'Gagal.' }));
    app.post('/api/auth/change-password', passwordChangeLimit, (req, res) => res.status(204).end());
    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    if (server) await new Promise(resolve => { server.close(resolve); });
    Object.entries(previous).forEach(([key, value]) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  });

  it('redirects plain HTTP to the configured HTTPS origin', async () => {
    const response = await fetch(`${base}/api/ping?source=test`, { redirect: 'manual' });
    assert.strictEqual(response.status, 308);
    assert.strictEqual(response.headers.get('location'), 'https://ris.example.test/api/ping?source=test');
    const externalPath = await fetch(`${base}//evil.example/phish`, { redirect: 'manual' });
    assert.strictEqual(externalPath.status, 308);
    assert.strictEqual(new URL(externalPath.headers.get('location')).origin, 'https://ris.example.test');
  });

  it('sets security headers and rejects untrusted browser origins', async () => {
    const headers = { 'x-forwarded-proto': 'https', Origin: 'https://ris.example.test' };
    const allowed = await fetch(`${base}/api/ping`, { headers });
    assert.strictEqual(allowed.status, 200);
    assert.match(allowed.headers.get('strict-transport-security'), /max-age=31536000/);
    assert.match(allowed.headers.get('content-security-policy'), /script-src 'self'/);
    assert.strictEqual(allowed.headers.get('x-frame-options'), 'DENY');
    assert.strictEqual(allowed.headers.get('x-content-type-options'), 'nosniff');
    assert(allowed.headers.get('ratelimit'));
    const denied = await fetch(`${base}/api/ping`, { headers: { ...headers, Origin: 'https://evil.example' } });
    assert.strictEqual(denied.status, 403);
    const fetchSiteDenied = await fetch(`${base}/api/ping`, { headers: { ...headers, 'sec-fetch-site': 'cross-site' } });
    assert.strictEqual(fetchSiteDenied.status, 403);
  });

  it('stops repeated login attempts', async () => {
    const headers = { 'x-forwarded-proto': 'https', Origin: 'https://ris.example.test' };
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers });
      assert.strictEqual(response.status, 401);
    }
    const limited = await fetch(`${base}/api/auth/login`, { method: 'POST', headers });
    assert.strictEqual(limited.status, 429);
  });

  it('rate limits repeated password change attempts', async () => {
    const headers = { 'x-forwarded-proto': 'https', Origin: 'https://ris.example.test' };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch(`${base}/api/auth/change-password`, { method: 'POST', headers });
      assert.strictEqual(response.status, 204);
    }
    const limited = await fetch(`${base}/api/auth/change-password`, { method: 'POST', headers });
    assert.strictEqual(limited.status, 429);
  });

  it('does not expose database errors through public health checks', async () => {
    const previousConfigured = db.isDatabaseConfigured;
    const previousQuery = db.query;
    db.isDatabaseConfigured = () => true;
    db.query = async () => { throw new Error('postgresql://private-user:private-password@db.internal'); };
    try {
      const response = await fetch(`${base}/api/health`, { headers: { 'x-forwarded-proto': 'https' } });
      assert.strictEqual(response.status, 503);
      const body = await response.text();
      assert(!body.includes('private-user') && !body.includes('private-password'));
    } finally {
      db.isDatabaseConfigured = previousConfigured;
      db.query = previousQuery;
    }
  });

  it('does not write raw exception messages to production logs', () => {
    const original = console.error; // eslint-disable-line no-console
    let output = '';
    console.error = message => { output = message; }; // eslint-disable-line no-console
    try {
      logger.error(new Error('Sensitive person name and bank account 1234567890'), { requestId: 'req-test' });
    } finally {
      console.error = original; // eslint-disable-line no-console
    }
    assert(!output.includes('Sensitive person') && !output.includes('1234567890'));
    assert.strictEqual(JSON.parse(output).error.message, 'Internal error');
  });
});
