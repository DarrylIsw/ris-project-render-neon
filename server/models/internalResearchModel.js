const db = require('../config/db');

const listSchemes = async () => {
  const result = await db.query('SELECT * FROM schemes ORDER BY created_at DESC NULLS LAST, id DESC');
  return result.rows;
};

const listDrafts = async () => {
  const result = await db.query('SELECT * FROM research_drafts ORDER BY created_at DESC NULLS LAST, id DESC');
  return result.rows;
};

module.exports = {
  listSchemes,
  listDrafts,
};
