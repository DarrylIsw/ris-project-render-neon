/* eslint-disable no-await-in-loop */
require('@babel/register')({ envName: 'test' });
const prisma = require('../server/config/prisma');
const { buildSeedRows, loadFrontend } = require('../internals/scripts/generate-database-seed');
const { entriesFor, cleanInitialData } = require('../server/services/risDataService');
const { insertSeedRows } = require('../server/services/relationalMirror');

const mode = process.argv.includes('--clean') ? 'production' : 'demo';
const source = loadFrontend();
const demo = mode === 'demo';
const state = demo ? source : cleanInitialData(source);

const main = async () => {
  if (!demo) {
    const superPassword = process.env.RIS_BOOTSTRAP_SUPERADMIN_PASSWORD || '';
    const managerPassword = process.env.RIS_BOOTSTRAP_MANAGER_PASSWORD || '';
    if (superPassword.length < 12 || managerPassword.length < 12) {
      throw new Error('Set RIS_BOOTSTRAP_SUPERADMIN_PASSWORD and RIS_BOOTSTRAP_MANAGER_PASSWORD (at least 12 characters each).');
    }
  }
  const existing = await Promise.all([prisma.users.count(), prisma.ris_records.count()]);
  if (existing.some(count => count > 0)) throw new Error('Prisma seed runs only on a new empty database. Existing data was not changed.');
  const { tables } = buildSeedRows(mode);
  if (!demo) {
    tables.get('users').forEach(row => {
      row.password_hash.seedPassword = row.role === 'super_admin' // eslint-disable-line no-param-reassign
        ? process.env.RIS_BOOTSTRAP_SUPERADMIN_PASSWORD : process.env.RIS_BOOTSTRAP_MANAGER_PASSWORD;
    });
  }
  await prisma.$transaction(async tx => {
    await insertSeedRows(tx, tables);
    await tx.ris_records.createMany({ data: entriesFor(state) });
    await tx.ris_revision.create({ data: { id: 1, version: 1 } });
  }, { timeout: 180000 });
  console.log(`Seeded ${mode} accounts and RIS records through Prisma.`);
};

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
