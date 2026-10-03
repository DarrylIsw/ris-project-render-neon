const model = require('../models/internalResearchModel');

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

const listSchemes = async (req, res, next) => {
  try {
    const records = await model.listSchemes();
    return res.json({ records });
  } catch (error) {
    try {
      return dbFallback(res, error);
    } catch (fallbackError) {
      return next(fallbackError);
    }
  }
};

const listDrafts = async (req, res, next) => {
  try {
    const records = await model.listDrafts();
    return res.json({ records });
  } catch (error) {
    try {
      return dbFallback(res, error);
    } catch (fallbackError) {
      return next(fallbackError);
    }
  }
};

module.exports = {
  listSchemes,
  listDrafts,
};
