const model = require('../models/researcherProfileModel');

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

const listProfiles = async (req, res, next) => {
  try {
    const records = await model.listProfiles();
    return res.json({ records });
  } catch (error) {
    try {
      return dbFallback(res, error);
    } catch (fallbackError) {
      return next(fallbackError);
    }
  }
};

module.exports = { listProfiles };
