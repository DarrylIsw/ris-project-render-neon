const db = require('../config/db');
const logger = require('../logger');

const status = async (req, res) => {
  const payload = {
    status: 'ok',
    service: 'ris-website',
    database: {
      configured: db.isDatabaseConfigured(),
      connected: false,
    },
    timestamp: new Date().toISOString(),
  };

  if (!db.isDatabaseConfigured()) {
    return res.json(payload);
  }

  try {
    await db.query('SELECT 1');
    return res.json({ ...payload, database: { ...payload.database, connected: true } });
  } catch (error) {
    logger.error(error, { event: 'health_database_unavailable', requestId: req.requestId });
    return res.status(503).json({
      ...payload,
      status: 'degraded',
      database: { ...payload.database, connected: false },
    });
  }
};

module.exports = { status };
