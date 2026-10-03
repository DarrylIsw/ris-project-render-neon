const crypto = require('crypto');
const prisma = require('../config/prisma');
const { requiredFor } = require('../services/mfaService');

const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-ris_session' : 'ris_session';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const readCookie = req => {
  const part = String(req.headers.cookie || '').split(';').map(item => item.trim())
    .find(item => item.startsWith(`${COOKIE_NAME}=`));
  return part ? part.slice(COOKIE_NAME.length + 1) : null;
};

const optionalUser = async (req, res, next) => {
  try {
    const token = readCookie(req);
    req.user = null;
    req.session = null;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return next();
    const session = await prisma.user_sessions.findUnique({
      where: { token_hash: hash(token) },
      select: {
        id: true,
        revoked_at: true,
        expires_at: true,
        users: true,
        ...(process.env.NODE_ENV === 'production' || process.env.MFA_REQUIRED === 'true' ? { mfa_verified_at: true } : {}),
      },
    });
    if (!session || session.revoked_at || session.expires_at <= new Date() || !session.users.is_active) return next();
    if (requiredFor(session.users.role) && !session.mfa_verified_at) return next();
    req.session = session;
    req.user = session.users;
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Sesi tidak berlaku. Silakan masuk kembali.' });
  }
  return next();
};

const requireScope = scope => async (req, res, next) => {
  if (!req.user) return requireUser(req, res, next);
  if (['super_admin', 'manager'].includes(req.user.role)) return next();
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Akses tidak diizinkan.' });
  try {
    const record = await prisma.user_admin_scopes.findFirst({ where: { user_id: req.user.id, scope } });
    if (!record) return res.status(403).json({ message: 'Akses tidak diizinkan.' });
    return next();
  } catch (error) { return next(error); }
};

const sameOrigin = (req, res, next) => {
  const origin = req.get('origin');
  if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ message: 'Asal permintaan tidak diizinkan.' });
  if (!origin) return next();
  try {
    const expected = process.env.NODE_ENV === 'production' ? new URL(process.env.APP_BASE_URL).origin
      : `${req.protocol}://${req.get('host')}`;
    if (new URL(origin).origin === expected) return next();
  } catch (error) {
    // Invalid origins are rejected below.
  }
  return res.status(403).json({ message: 'Asal permintaan tidak diizinkan.' });
};

module.exports = {
  COOKIE_NAME, hash, readCookie, optionalUser, requireUser, requireScope, sameOrigin
};
