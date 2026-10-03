const model = require('../models/externalResearchModel');

const dbFallback = (res, error) => {
  if (error.code !== 'DB_NOT_CONFIGURED') throw error;
  return res.json({
    records: [],
    meta: {
      databaseConfigured: false,
      message: error.message,
    },
  });
};

const listReports = async (req, res, next) => {
  try {
    const records = await model.listReports();
    return res.json({ records });
  } catch (error) {
    try {
      return dbFallback(res, error);
    } catch (fallbackError) {
      return next(fallbackError);
    }
  }
};

module.exports = { listReports };
