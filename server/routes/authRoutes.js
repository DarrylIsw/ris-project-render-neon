const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../config/prisma');
const { COOKIE_NAME, hash, requireUser } = require('../middlewares/auth');
const { ensureInitialState, loadState, resolveAccount } = require('../services/risDataService');
const { requiredFor, enrollment, verifyCode } = require('../services/mfaService');
const { loginLimit, passwordChangeLimit } = require('../middlewares/security');

const router = express.Router();
const cookie = (token, maxAge, secure) => `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
const secureRequest = req => process.env.NODE_ENV === 'production' || req.secure;
const loginSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(256),
  remember: z.boolean().optional(),
  code: z.string().regex(/^\d{6}$/).optional()
}).strict();
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(256),
  confirmPassword: z.string().min(1).max(256),
}).strict();
const requestError = (message, status = 400, code = 'REQUEST_ERROR') => Object.assign(new Error(message), { status, code });
const getAccount = async user => {
  await ensureInitialState();
  const state = await loadState();
  const account = resolveAccount(state, user);
  if (!account) return null;
  const scopes = await prisma.user_admin_scopes.findMany({ where: { user_id: user.id }, select: { scope: true } });
  return { ...account, adminScopes: scopes.map(scope => scope.scope) };
};

router.get('/session', async (req, res, next) => {
  try {
    return res.json({ user: req.user ? await getAccount(req.user) : null });
  } catch (error) { return next(error); }
});

router.post('/change-password', passwordChangeLimit, requireUser, async (req, res, next) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Format perubahan kata sandi tidak sesuai.', code: 'PASSWORD_VALIDATION' });
    const { currentPassword, newPassword, confirmPassword } = parsed.data;
    if (newPassword !== confirmPassword) throw requestError('Konfirmasi kata sandi baru tidak cocok.', 400, 'PASSWORD_CONFIRMATION');
    if (currentPassword === newPassword) throw requestError('Kata sandi baru harus berbeda dari kata sandi saat ini.', 400, 'PASSWORD_UNCHANGED');
    if (Buffer.byteLength(newPassword, 'utf8') > 72) throw requestError('Kata sandi baru maksimal 72 byte.', 400, 'PASSWORD_TOO_LONG');

    const emailPrefix = String(req.user.email || '').split('@')[0].toLowerCase();
    if (/^(password|password123|123456789012|change_before_deploy)$/i.test(newPassword)
      || newPassword.toLowerCase().includes(emailPrefix)) {
      throw requestError('Kata sandi baru terlalu mudah ditebak atau memuat bagian email.', 400, 'PASSWORD_TOO_WEAK');
    }

    await prisma.$transaction(async tx => {
      const matched = await tx.$queryRaw`SELECT password_hash = crypt(${currentPassword}, password_hash) AS valid FROM users WHERE id = ${req.user.id}::uuid AND is_active = true FOR UPDATE`;
      if (!matched.length || !matched[0].valid) throw requestError('Kata sandi saat ini tidak sesuai.', 400, 'CURRENT_PASSWORD_INVALID');

      const changedAt = new Date();
      await tx.$executeRaw`UPDATE users SET password_hash = crypt(${newPassword}, gen_salt('bf', 12)), password_changed_at = ${changedAt}, updated_at = ${changedAt}, version = version + 1 WHERE id = ${req.user.id}::uuid`;
      await tx.user_sessions.updateMany({
        where: { user_id: req.user.id, id: { not: req.session.id }, revoked_at: null },
        data: { revoked_at: changedAt },
      });
    });

    res.set('Cache-Control', 'no-store');
    return res.json({ message: 'Kata sandi berhasil diperbarui.' });
  } catch (error) { return next(error); }
});

router.post('/login', loginLimit, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Format data masuk tidak sesuai.' });
    const { password, remember, code } = parsed.data;
    const email = parsed.data.email.trim().toLowerCase();
    const user = await prisma.users.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, is_active: true } });
    const match = user && await prisma.$queryRaw`SELECT password_hash = crypt(${password}, password_hash) AS valid FROM users WHERE id = ${user.id}::uuid`;
    if (!user || !match[0].valid) return res.status(401).json({ message: 'Email atau kata sandi tidak sesuai.' });
    if (requiredFor(user.role)) {
      if (!code) return res.status(202).set('Cache-Control', 'no-store').json(await enrollment(user));
      if (!await verifyCode(user, code)) return res.status(401).json({ message: 'Kode autentikator tidak sesuai atau sudah digunakan.', code: 'MFA_INVALID' });
    }
    const account = await getAccount(user);
    if (!account) return res.status(403).json({ message: 'Akun tidak memiliki data profil aplikasi.' });
    const token = crypto.randomBytes(32).toString('hex');
    const lifetime = remember ? 30 * 86400 : 12 * 3600;
    const expires = new Date(Date.now() + lifetime * 1000);
    await prisma.$transaction([
      prisma.user_sessions.create({
        data: {
          user_id: user.id,
          token_hash: hash(token),
          expires_at: expires,
          user_agent: String(req.get('user-agent') || '').slice(0, 500),
          ...(requiredFor(user.role) ? { mfa_verified_at: new Date() } : {}),
        },
        select: { id: true },
      }),
      prisma.users.update({ where: { id: user.id }, data: { last_login_at: new Date() } }),
    ]);
    res.set('Set-Cookie', cookie(token, lifetime, secureRequest(req)));
    res.set('Cache-Control', 'no-store');
    return res.json({ user: account });
  } catch (error) { return next(error); }
});

router.post('/logout', requireUser, async (req, res, next) => {
  try {
    await prisma.user_sessions.update({ where: { id: req.session.id }, data: { revoked_at: new Date() }, select: { id: true } });
    res.set('Set-Cookie', cookie('', 0, secureRequest(req)));
    return res.status(204).end();
  } catch (error) { return next(error); }
});

module.exports = router;
