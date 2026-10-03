/* eslint-disable no-await-in-loop, no-restricted-syntax, object-curly-newline, object-property-newline */
// Sequential database operations keep transaction checks and cleanup deterministic.
process.env.NODE_ENV = 'test';
process.env.TZ = 'Asia/Jakarta';
require('@babel/register')();
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client, types } = require('pg');
const { buildSeedRows, id, renderRows } = require('./generate-database-seed');

types.setTypeParser(1082, value => value);
const sql = fs.readFileSync(path.resolve(__dirname, '../../database.sql'), 'utf8');
const allTables = [...sql.matchAll(/^CREATE TABLE (\w+) \(/gm)].map(match => match[1]);
const normalize = (value, oid) => {
  if (value === null || value === undefined) return null;
  if ([20, 21, 23, 700, 701, 1700].includes(oid)) return Number(value);
  if ([1114, 1184].includes(oid)) {
    if (value instanceof Date) return value.toISOString();
    return new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}+07:00`).toISOString();
  }
  if (oid === 1083) return String(value).length === 5 ? `${value}:00` : value;
  if ([25, 1043].includes(oid)) return String(value);
  return value;
};

const verifyRows = async (client, mode) => {
  const { tables, source } = buildSeedRows(mode);
  let checked = 0;
  for (const table of allTables) {
    const actual = await client.query(`SELECT * FROM ${table}`);
    const expected = tables.get(table) || [];
    assert.strictEqual(actual.rowCount, expected.length, `${mode}: ${table} row count`);
    for (const row of expected) {
      const columns = Object.keys(row).filter(key => key !== 'password_hash');
      const compare = (candidate, expectedRow) => columns.every(column => {
        const oid = actual.fields.find(field => field.name === column).dataTypeID;
        try { assert.deepStrictEqual(normalize(candidate[column], oid), normalize(expectedRow[column], oid)); return true; } catch (_) { return false; }
      });
      assert.ok(actual.rows.some(candidate => compare(candidate, row)), `${mode}: ${table} does not match frontend record ${row.id || JSON.stringify(row)}`);
      checked += 1;
      if (table === 'users') {
        const result = await client.query('SELECT password_hash = crypt($1, password_hash) AS valid FROM users WHERE id = $2', [row.password_hash.seedPassword, row.id]);
        assert.strictEqual(result.rows[0].valid, true);
      }
    }
  }
  if (mode === 'demo') {
    const archive = await client.query('SELECT * FROM research_archive_view');
    assert.strictEqual(archive.rowCount, source.drafts.length + source.externalResearchReports.length);
    const roles = await client.query('SELECT * FROM temporary_role_assignments');
    assert.strictEqual(roles.rowCount, source.temporaryRoleAssignments.filter(grant => grant.status === 'active').length);
  }
  console.log(`PASS ${mode}: ${checked} relational records, all explicit fields, passwords, and archive/reviewer views`);
};

const transactionTest = async (client, fn) => {
  await client.query('BEGIN');
  try { await fn(); } finally { await client.query('ROLLBACK'); }
};
const mustReject = async (client, statement, args, message) => {
  await client.query('SAVEPOINT rejected_operation');
  await assert.rejects(client.query(statement, args), message);
  await client.query('ROLLBACK TO SAVEPOINT rejected_operation');
};
const verifyRules = async client => {
  const superAdmin = id('user', 'user-super-admin');
  await transactionTest(client, async () => {
    await mustReject(client, 'SELECT delete_research_scheme($1, $2)', [id('scheme', 'scheme-1'), superAdmin], /funded/);
    await mustReject(client, 'SELECT delete_research_scheme($1, $2)', [id('scheme', 'scheme-2'), id('user', 'user-admin-letter')], /permission/);
    await client.query('SELECT delete_research_scheme($1, $2)', [id('scheme', 'scheme-2'), id('user', 'user-admin')]);
    const draft = (await client.query('SELECT * FROM research_drafts WHERE id = $1', [id('draft', 'draft-assigned')])).rows[0];
    assert.strictEqual(draft.status, 'archived');
    assert.strictEqual(draft.archive_metadata.previousStatus, 'under_review');
    assert.strictEqual((await client.query('SELECT * FROM temporary_role_assignments WHERE entity_id = $1', [draft.id])).rowCount, 0);
    assert.strictEqual((await client.query('SELECT * FROM research_archive_view WHERE id = $1', [draft.id])).rows[0].status, 'archived');
    assert.strictEqual((await client.query('SELECT * FROM draft_files WHERE draft_id = $1', [draft.id])).rowCount, 2);
    await mustReject(client, "UPDATE research_drafts SET status = 'funded' WHERE id = $1", [draft.id], /Deleted schemes/);
  });
  await transactionTest(client, async () => {
    await client.query('DELETE FROM scheme_reporting_periods WHERE id = $1', [id('period', 'scheme-demo-clean-2026-final')]);
    await mustReject(client, 'SET CONSTRAINTS ALL IMMEDIATE', [], /exactly one/);
  });
  await transactionTest(client, async () => {
    const period = id('period', 'scheme-demo-clean-2026-final');
    await client.query('DELETE FROM scheme_reporting_periods WHERE id = $1', [period]);
    await client.query("INSERT INTO scheme_reporting_periods(scheme_id, report_type, label, open_at, due_at, position) VALUES($1, 'final', 'Replacement', '2027-01-01', '2027-02-01', 3)", [id('scheme', 'scheme-demo-clean-2026')]);
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  });
  await transactionTest(client, async () => {
    const finalReport = id('report', 'constraint-test-final');
    await client.query("INSERT INTO research_reports(id, research_id, period_id, report_type, report_period) VALUES($1, $2, $3, 'final', 'Laporan Akhir')", [finalReport, id('draft', 'draft-approved'), id('period', 'scheme-1-final')]);
    await mustReject(client, 'UPDATE research_reports SET period_id = $1 WHERE id = $2', [id('period', 'scheme-2-interim-1'), finalReport], /belong/);
    await mustReject(client, 'UPDATE research_monev SET period_id = $1 WHERE id = $2', [id('period', 'scheme-1-final'), id('monev', 'monev-demo-interim-1')], /interim/);
    await mustReject(client, 'UPDATE research_reports SET output_id = $1 WHERE id = $2', [id('output', 'draft-approved/output-1'), finalReport], /Only output/);
    await client.query("INSERT INTO research_reports(research_id, period_id, output_id, report_type, report_period) VALUES($1, $2, $3, 'output', 'Luaran')", [id('draft', 'draft-approved'), id('period', 'scheme-1-output'), id('output', 'draft-approved/output-1')]);
    await mustReject(client, "INSERT INTO research_reports(research_id, period_id, output_id, report_type, report_period) VALUES($1, $2, $3, 'output', 'Invalid')", [id('draft', 'draft-approved'), id('period', 'scheme-1-output'), id('output', 'draft-assigned/output-1')], /same research/);
  });
  await transactionTest(client, async () => {
    const draft = (await client.query('INSERT INTO research_drafts(user_id, scheme_id, created_by, payload) VALUES($1, $2, $1, $3) RETURNING id', [id('user', 'user-lecturer-3'), id('scheme', 'scheme-demo-clean-2026'), { project: { title: '' }, budgets: [{ volume: '' }] }])).rows[0];
    assert.strictEqual((await client.query('SELECT * FROM research_archive_view WHERE id = $1', [draft.id])).rowCount, 1);
    await mustReject(client, 'INSERT INTO research_drafts(user_id, scheme_id, created_by) VALUES($1, $2, $1)', [id('user', 'user-lecturer-3'), id('scheme', 'scheme-demo-clean-2026')], /unique/);
  });
  console.log('PASS deletion permissions/funding/archive safety, deferred final periods, report ownership, and partial draft persistence');
};

const main = async () => {
  if (!process.env.RIS_TEST_POSTGRES_URL) throw new Error('Set RIS_TEST_POSTGRES_URL to a LOCAL disposable PostgreSQL server with CREATEDB permission. No existing database is modified.');
  const url = new URL(process.env.RIS_TEST_POSTGRES_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Database integration tests require a local test server.');
  const maintenance = new Client({ connectionString: url.toString() });
  await maintenance.connect();
  const created = [];
  try {
    for (const mode of ['demo', 'production']) {
      const name = `ris_seed_test_${crypto.randomBytes(8).toString('hex')}`;
      await maintenance.query(`CREATE DATABASE "${name}"`);
      created.push(name);
      const connection = new URL(url);
      connection.pathname = `/${name}`;
      const client = new Client({ connectionString: connection.toString() });
      await client.connect();
      try {
        const schema = sql.slice(0, sql.indexOf('-- BEGIN GENERATED FRONTEND SEEDS'));
        const bootstrap = `${schema}${renderRows(buildSeedRows(mode).tables)}\nCOMMIT;`;
        await client.query(bootstrap);
        await verifyRows(client, mode);
        if (mode === 'demo') {
          await verifyRules(client);
          await client.query(bootstrap);
          await verifyRows(client, mode);
          console.log('PASS full demo bootstrap rerun');
        }
      } finally { await client.end(); }
    }
  } finally {
    for (const name of created) {
      assert.match(name, /^ris_seed_test_[a-f0-9]{16}$/, 'Unexpected test database cleanup target');
      await maintenance.query(`DROP DATABASE "${name}"`);
    }
    await maintenance.end();
  }
};
main().catch(error => { console.error(error.message); process.exitCode = 1; });
