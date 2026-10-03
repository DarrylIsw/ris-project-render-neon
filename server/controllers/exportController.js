const { z } = require('zod');
const { loadState, resolveAccount } = require('../services/risDataService');
const { fullManager, profileManager } = require('../services/risAccess');
const { getCsvTemplate, renderCsv } = require('../services/exportTemplateService');
const prisma = require('../config/prisma');

const csvRequest = z.object({
  templateId: z.enum(['researcher-profiles', 'archive-users', 'archive-research']),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(10000),
}).strict();
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

const getAccountAndState = async req => {
  const state = await loadState();
  const account = resolveAccount(state, req.user);
  if (!account) throw fail('Akun tidak tersedia.', 403);
  if (account.role === 'admin') {
    const scopes = await prisma.user_admin_scopes.findMany({ where: { user_id: req.user.id }, select: { scope: true } });
    account.adminScopes = scopes.map(item => item.scope);
  }
  return { state, account };
};

const template = async (req, res, next) => {
  try {
    const source = getCsvTemplate(req.params.templateId);
    if (!source) throw fail('Templat ekspor tidak ditemukan.', 404);
    const { account } = await getAccountAndState(req);
    const permitted = req.params.templateId === 'researcher-profiles'
      ? profileManager(account)
      : fullManager(account);
    if (!permitted) throw fail('Akses ekspor tidak diizinkan.', 403);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Cache-Control', 'private, no-store');
    return res.send(source);
  } catch (error) { return next(error); }
};

const csv = async (req, res, next) => {
  try {
    const parsed = csvRequest.safeParse(req.body);
    if (!parsed.success) throw fail('Data ekspor CSV tidak valid.');
    const { account } = await getAccountAndState(req);
    const permitted = parsed.data.templateId === 'researcher-profiles'
      ? profileManager(account)
      : fullManager(account);
    if (!permitted) throw fail('Akses ekspor tidak diizinkan.', 403);
    const output = renderCsv(parsed.data.templateId, parsed.data.rows);
    if (output == null) throw fail('Templat ekspor tidak ditemukan.', 404);
    const date = new Date().toISOString().slice(0, 10);
    const names = {
      'researcher-profiles': 'profil-peneliti',
      'archive-users': 'arsip-pengguna',
      'archive-research': 'arsip-penelitian',
    };
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${names[parsed.data.templateId]}-${date}.csv"`);
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    return res.send(output);
  } catch (error) { return next(error); }
};

module.exports = { template, csv };
