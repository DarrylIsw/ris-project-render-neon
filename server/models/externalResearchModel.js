const db = require('../config/db');

const listReports = async () => {
  const result = await db.query('SELECT * FROM external_research ORDER BY created_at DESC NULLS LAST, id DESC');
  return result.rows;
};

module.exports = { listReports };
