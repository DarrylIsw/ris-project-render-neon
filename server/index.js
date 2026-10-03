/* eslint consistent-return:0 import/order:0 */

require('dotenv').config({ quiet: true });
const express = require('express');
const logger = require('./logger');
const favicon = require('serve-favicon');
const path = require('path');
const rawicons = require('./dev/rawicons');
const rawdocs = require('./dev/rawdocs');
const argv = require('./config/argv');
const port = require('./config/port');
const setup = require('./middlewares/frontendMiddleware');
const apiRoutes = require('./routes');
const requestLogger = require('./middlewares/requestLogger');
const requestContext = require('./middlewares/requestContext');
const { configureSecurity } = require('./middlewares/security');
const auditTrail = require('./middlewares/auditTrail');
const { apiNotFound, errorHandler } = require('./middlewares/errorHandler');
const { optionalUser, sameOrigin } = require('./middlewares/auth');
const emailDeliveryService = require('./services/emailDeliveryService');
const prisma = require('./config/prisma');
// Test and staging processes must not accidentally expose development source APIs.
const isDevelopment = process.env.NODE_ENV === 'development';
const ngrok = isDevelopment && (process.env.ENABLE_TUNNEL || argv.tunnel)
  ? require('ngrok')
  : false;
const { resolve } = require('path');
const app = express();

app.disable('x-powered-by');
configureSecurity(app);
app.use('/api', requestContext);
app.use('/api', requestLogger);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '32kb' }));
app.use('/api', optionalUser);
app.use('/api', sameOrigin);
app.use('/api', auditTrail);

// Load material icons
if (isDevelopment) {
  app.use('/api/icons', (req, res) => {
    res.json({
      records: [
        { source: rawicons(req.query) }
      ]
    });
  });
}

// Load code preview
if (isDevelopment) {
  app.use('/api/docs', (req, res) => {
    res.json({
      records: [
        { source: rawdocs(req.query) }
      ]
    });
  });
}

app.use('/api', apiRoutes);
app.use('/api', apiNotFound);
app.use('/api', errorHandler);

app.use('/', express.static('public', { etag: false }));
app.use(favicon(path.join('public', 'favicons', 'favicon.ico')));

// In production we need to pass these values in instead of relying on webpack
setup(app, {
  outputPath: resolve(process.cwd(), 'build'),
  publicPath: '/',
});

// Plesk Passenger injects PORT; local development falls back to port 3001.
const customHost = isDevelopment ? (argv.host || process.env.HOST) : process.env.HOST;
const host = customHost || null; // Let http.Server use its default IPv6/4 host
const prettyHost = customHost || 'localhost';

// use the gzipped bundle
app.get('*.js', (req, res, next) => {
  req.url = req.url + '.gz'; // eslint-disable-line
  res.set('Content-Encoding', 'gzip');
  next();
});

const validateProductionDatabase = async () => {
  if (process.env.NODE_ENV !== 'production') return;
  try {
    await prisma.user_mfa.count();
    await prisma.user_sessions.findFirst({ select: { mfa_verified_at: true } });
  } catch (error) {
    throw new Error('Jalankan migrasi prisma/migrations/20261001_security_mfa/migration.sql sebelum memulai server produksi.');
  }
  const weak = await prisma.$queryRaw`SELECT id FROM users WHERE is_active = true AND password_hash = crypt(${'password'}, password_hash) LIMIT 1`;
  if (weak.length) throw new Error('Akun demo masih memakai kata sandi bawaan. Ganti kata sandi sebelum menjalankan server produksi.');
};

const startServer = async () => {
  await validateProductionDatabase();
  const server = await new Promise((resolveServer, reject) => {
    const listener = app.listen(port, host, () => resolveServer(listener));
    listener.once('error', reject);
  });
  emailDeliveryService.start();
  if (ngrok) {
    try { logger.appStarted(port, prettyHost, await ngrok.connect(port)); } catch (error) { logger.error(error); }
  } else logger.appStarted(port, prettyHost);
  return server;
};

if (require.main === module) startServer().catch(error => { logger.error(error); process.exitCode = 1; });

module.exports = {
  app,
  startServer,
};
