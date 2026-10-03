const db = require('../config/db');
const logger = require('../logger');

const uuidOrNull = value => (value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null);

const redact = value => {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).reduce((result, key) => {
    const hidden = ['password', 'token', 'authorization', 'secret'].some(word => key.toLowerCase().includes(word));
    return { ...result, [key]: hidden ? '[REDACTED]' : redact(value[key]) };
  }, {});
};

const record = async event => {
  const payload = {
    requestId: event.requestId,
    method: event.method,
    path: event.path,
    statusCode: event.statusCode,
  };

  try {
    await db.query(
      `INSERT INTO system_activity_logs
        (user_id, action, entity_type, entity_id, old_data, new_data, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [uuidOrNull(event.userId), event.action, event.entityType, uuidOrNull(event.entityId), event.oldData || null, payload]
    );
  } catch (error) {
    if (error.code !== 'DB_NOT_CONFIGURED') {
      logger.warn('audit_trail_persistence_failed', { requestId: event.requestId, error });
    }
  }

  logger.audit('audit_trail_recorded', {
    requestId: event.requestId,
    userId: event.userId || null,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId || null,
    statusCode: event.statusCode,
  });
};

module.exports = { record, redact };
