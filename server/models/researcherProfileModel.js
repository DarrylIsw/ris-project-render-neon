const db = require('../config/db');

const listProfiles = async () => {
  const result = await db.query('SELECT * FROM researcher_profiles ORDER BY updated_at DESC NULLS LAST, id DESC');
  return result.rows;
};

module.exports = { listProfiles };
