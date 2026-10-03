const asBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).trim().toLowerCase() === 'true';
};

const asPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const splitList = value => String(value || '')
  .split(',')
  .map(item => item.trim().toLowerCase())
  .filter(Boolean);

const enabled = asBoolean(process.env.EMAIL_ENABLED, false);
const environment = process.env.NODE_ENV || 'development';
const smtpUser = String(process.env.SMTP_USER || '').trim();
const smtpPassword = String(process.env.SMTP_PASSWORD || '');
const redirectAllTo = String(process.env.EMAIL_REDIRECT_ALL_TO || '').trim().toLowerCase();
const recipientAllowlist = splitList(process.env.EMAIL_RECIPIENT_ALLOWLIST);
const allowDirectDelivery = asBoolean(process.env.EMAIL_ALLOW_DIRECT_DELIVERY, false);
const queueFallbackPollMs = asPositiveInteger(
  process.env.EMAIL_QUEUE_FALLBACK_POLL_MS || process.env.EMAIL_WORKER_POLL_MS,
  5000
);
const queueBatchSize = Math.min(asPositiveInteger(
  process.env.EMAIL_QUEUE_BATCH_SIZE || process.env.EMAIL_WORKER_BATCH_SIZE,
  25
), 100);

const config = {
  enabled,
  environment,
  provider: 'smtp',
  from: String(process.env.EMAIL_FROM || '').trim(),
  replyTo: String(process.env.EMAIL_REPLY_TO || '').trim(),
  appBaseUrl: String(process.env.APP_BASE_URL || 'http://localhost:3001').replace(/\/$/, ''),
  brandName: String(process.env.EMAIL_BRAND_NAME || 'Research Information System').trim(),
  supportEmail: String(process.env.EMAIL_SUPPORT_ADDRESS || process.env.EMAIL_REPLY_TO || '').trim(),
  redirectAllTo,
  recipientAllowlist,
  allowDirectDelivery,
  smtp: {
    host: String(process.env.SMTP_HOST || '').trim(),
    port: asPositiveInteger(process.env.SMTP_PORT, 587),
    secure: asBoolean(process.env.SMTP_SECURE, false),
    requireTls: asBoolean(process.env.SMTP_REQUIRE_TLS, true),
    user: smtpUser,
    password: smtpPassword,
    rejectUnauthorized: asBoolean(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true),
    maxConnections: Math.min(asPositiveInteger(process.env.EMAIL_SMTP_MAX_CONNECTIONS, 5), 20),
    maxMessages: Math.min(asPositiveInteger(process.env.EMAIL_SMTP_MAX_MESSAGES, 100), 1000),
  },
  worker: {
    fallbackPollIntervalMs: queueFallbackPollMs,
    batchSize: queueBatchSize,
    sendConcurrency: Math.min(asPositiveInteger(process.env.EMAIL_SEND_CONCURRENCY, 5), 20),
    maxAttempts: Math.min(asPositiveInteger(process.env.EMAIL_MAX_ATTEMPTS, 5), 20),
    maxAgeHours: Math.min(asPositiveInteger(process.env.EMAIL_MAX_AGE_HOURS, 72), 720),
    retryBaseMs: asPositiveInteger(process.env.EMAIL_RETRY_BASE_MS, 60000),
    processingTimeoutMinutes: Math.min(asPositiveInteger(
      process.env.EMAIL_PROCESSING_TIMEOUT_MINUTES || process.env.EMAIL_STALE_LOCK_MINUTES,
      10
    ), 120),
    workerId: String(process.env.EMAIL_WORKER_ID || `ris-email-${process.pid}`).slice(0, 120),
  },
};

const missingConfiguration = [];
if (!config.from) missingConfiguration.push('EMAIL_FROM');
const smtpConfigured = Boolean(config.smtp.host && config.smtp.user && config.smtp.password);
if (!smtpConfigured) missingConfiguration.push('SMTP_HOST/SMTP_USER/SMTP_PASSWORD');
if (environment !== 'production' && !redirectAllTo && !recipientAllowlist.length && !allowDirectDelivery) {
  missingConfiguration.push('EMAIL_REDIRECT_ALL_TO, EMAIL_RECIPIENT_ALLOWLIST, atau EMAIL_ALLOW_DIRECT_DELIVERY');
}

const active = enabled && missingConfiguration.length === 0;

module.exports = {
  ...config,
  active,
  smtpConfigured,
  missingConfiguration,
};
