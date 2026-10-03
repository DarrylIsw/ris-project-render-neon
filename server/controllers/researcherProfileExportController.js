const { loadState, resolveAccount } = require('../services/risDataService');
const { profileManager } = require('../services/risAccess');
const { renderProfileDocx } = require('../services/researcherProfileExportService');
const prisma = require('../config/prisma');

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

const downloadProfileDocx = async (req, res, next) => {
  try {
    const state = await loadState();
    const account = resolveAccount(state, req.user);
    if (!account) throw fail('Akun tidak tersedia.', 403);
    if (account.role === 'admin') {
      const scopes = await prisma.user_admin_scopes.findMany({ where: { user_id: req.user.id }, select: { scope: true } });
      account.adminScopes = scopes.map(item => item.scope);
    }
    const profile = (state.researcherProfiles || []).find(item => item.profileId === req.params.profileId || item.id === req.params.profileId);
    if (!profile) throw fail('Profil peneliti tidak ditemukan.', 404);
    if (profile.userId !== account.id && !profileManager(account)) throw fail('Akses ekspor profil tidak diizinkan.', 403);
    const profileAccount = (state.systemUsers || []).find(item => item.id === profile.userId);
    if (!profileAccount) throw fail('Akun pemilik profil tidak ditemukan.', 404);
    const document = renderProfileDocx(profile, profileAccount, state);
    const safeName = String(profile.fullName || profile.profileId).normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '')
      .slice(0, 80) || 'profil-peneliti';
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition', `attachment; filename="profil-${safeName}.docx"`);
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    return res.send(document);
  } catch (error) { return next(error); }
};

module.exports = { downloadProfileDocx };
