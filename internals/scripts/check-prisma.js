'use strict';

const safeText = value => String(value || '')
  .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, '<connection-url>')
  .slice(0, 1000);

const main = async () => {
  let prisma;
  try {
    prisma = require('../../server/config/prisma');
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured.');
    }

    const url = new URL(process.env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new Error('DATABASE_URL must use the PostgreSQL URL scheme.');
    }

    const options = {};
    ['sslmode', 'sslaccept', 'channel_binding', 'connect_timeout'].forEach(key => {
      if (url.searchParams.has(key)) options[key] = url.searchParams.get(key);
    });

    console.log(`[prisma] Target: ${url.hostname}:${url.port || 5432}/${decodeURIComponent(url.pathname.slice(1))}`);
    console.log(`[prisma] Connection options: ${JSON.stringify(options)}`);

    const rows = await prisma.$queryRaw`
      SELECT
        current_database() AS database,
        now() AS server_time
    `;
    console.log(`[prisma] PRISMA_OK: ${JSON.stringify(rows[0])}`);
  } catch (error) {
    console.error(`[prisma] PRISMA_FAILED: ${JSON.stringify({
      name: error.name || 'Error',
      code: error.code || null,
      clientVersion: error.clientVersion || null,
      message: safeText(error.message) || 'Unknown Prisma connection error',
      meta: error.meta ? safeText(JSON.stringify(error.meta)) : undefined,
    })}`);
    process.exitCode = 1;
  } finally {
    if (prisma) await prisma.$disconnect().catch(() => {});
  }
};

main().catch(error => {
  console.error(`[prisma] DIAGNOSTIC_FAILED: ${safeText(error.message) || 'Unknown error'}`);
  process.exitCode = 1;
});
