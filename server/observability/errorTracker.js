const logger = require('../logger');
const Sentry = process.env.SENTRY_DSN ? require('@sentry/node') : null;

if (Sentry) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    sendDefaultPii: false,
    defaultIntegrations: false,
    integrations: [],
    tracesSampleRate: 0,
    beforeSend: event => {
      const safeEvent = { ...event };
      delete safeEvent.request;
      delete safeEvent.user;
      delete safeEvent.extra;
      delete safeEvent.contexts;
      delete safeEvent.breadcrumbs;
      return safeEvent;
    },
  });
}

const captureException = (error, context = {}) => {
  const eventId = `${context.requestId || 'server'}_${Date.now()}`;
  logger.error(error, { event: 'captured_exception', eventId, ...context });
  if (Sentry) {
    const name = /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name || '') ? error.name : 'ServerError';
    const code = /^[A-Za-z0-9_]{1,64}$/.test(error.code || '') ? error.code : 'UNEXPECTED_ERROR';
    const safeError = new Error(`${name}: ${code}`);
    safeError.name = name;
    Sentry.captureException(safeError, {
      tags: { requestId: context.requestId || 'server', statusCode: String(context.statusCode || 500) },
      fingerprint: [name, code],
    });
  }
  return eventId;
};

module.exports = { captureException };
