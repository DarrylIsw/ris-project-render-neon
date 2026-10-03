const { spawn, spawnSync } = require('child_process');
const prisma = require('../../server/config/prisma');

const expectedEmails = [
  'superadmin@umn.ac.id',
  'manager@umn.ac.id',
  'admin.penelitian@umn.ac.id',
  'admin.surat@umn.ac.id',
  'admin.profil@umn.ac.id',
  'lecturer@umn.ac.id',
  'reviewer@umn.ac.id',
].sort();

const run = (command, args, env) => {
  const result = spawnSync(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}.`);
};

const prepareMigrations = async () => {
  const tables = await prisma.$queryRaw`SELECT to_regclass('public.users')::text AS users_table, to_regclass('public._prisma_migrations')::text AS migrations_table`;
  if (!tables[0].users_table) throw new Error('Render database is empty. Run database.sql on a new disposable Neon database first.');

  const history = tables[0].migrations_table
    ? await prisma.$queryRaw`SELECT migration_name FROM public._prisma_migrations ORDER BY finished_at NULLS FIRST`
    : [];
  const hasBaseline = history.some(row => row.migration_name === '0_init');
  if (!hasBaseline) {
    if (history.length) throw new Error('Prisma migration history is incomplete; refusing to mark the baseline automatically.');
    const users = await prisma.users.findMany({ select: { email: true } });
    const emails = users.map(user => user.email.toLowerCase()).sort();
    const [schemeCount, draftCount] = await Promise.all([prisma.schemes.count(), prisma.research_drafts.count()]);
    if (JSON.stringify(emails) !== JSON.stringify(expectedEmails) || schemeCount !== 0 || draftCount !== 0) {
      throw new Error('Database does not match the seven-account clean testing seed; refusing automatic migration baseline.');
    }
    const migrationEnv = {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
    };
    if (!migrationEnv.DATABASE_URL) throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED is required for Prisma migrations.');
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    run(npx, ['prisma', 'migrate', 'resolve', '--applied', '0_init'], migrationEnv);
  }

  const migrationEnv = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  };
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  run(npx, ['prisma', 'migrate', 'deploy'], migrationEnv);
};

const startApp = () => {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const app = spawn(npm, ['run', 'start:prod'], { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
  ['SIGINT', 'SIGTERM'].forEach(signal => process.on(signal, () => app.kill(signal)));
  app.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code === null ? 1 : code;
  });
};

prepareMigrations()
  .then(() => prisma.$disconnect())
  .then(startApp)
  .catch(async error => {
    console.error(`Render startup blocked: ${error.message}`);
    await prisma.$disconnect().catch(() => {});
    process.exitCode = 1;
  });
