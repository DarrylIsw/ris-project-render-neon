const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const production = () => process.env.NODE_ENV === 'production';
const publicOrigin = () => {
  const configured = process.env.APP_BASE_URL;
  if (!configured) return null;
  let url;
  try {
    url = new URL(configured);
  } catch (error) {
    return null;
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
  return url.origin;
};
const privateHost = host => {
  if (host === 'localhost' || host === '::1') return true;
  if (/^f[cd][0-9a-f:]+$/i.test(host || '')) return true;
  const parts = String(host || '').split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 127 || parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
};

const configureSecurity = app => {
  const hops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(hops) || hops < 0 || hops > 3) throw new Error('TRUST_PROXY_HOPS harus 0 sampai 3.');
  app.set('trust proxy', hops);
  if (production()) {
    if (!publicOrigin() || !publicOrigin().startsWith('https://')) throw new Error('APP_BASE_URL wajib menggunakan HTTPS di produksi.');
    if (process.env.HOST && !privateHost(process.env.HOST)) {
      throw new Error('HOST produksi harus private/loopback jika disetel. Untuk Plesk Passenger, biarkan HOST kosong.');
    }
    if (!hops) throw new Error('TRUST_PROXY_HOPS wajib disetel untuk reverse proxy HTTPS di produksi.');
  }
  if ((production() || process.env.MFA_REQUIRED === 'true') && !/^[a-f0-9]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY || '')) {
    throw new Error('MFA_ENCRYPTION_KEY wajib berisi 32 byte dalam format hex saat MFA aktif.');
  }

  app.use((req, res, next) => {
    if (production() && !req.secure) {
      const incoming = new URL(req.originalUrl, 'https://internal.invalid');
      const target = new URL(publicOrigin());
      target.pathname = incoming.pathname;
      target.search = incoming.search;
      return res.redirect(308, target.toString());
    }
    return next();
  });
  app.use(helmet({
    contentSecurityPolicy: production() ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://unpkg.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://fonts.googleapis.com', 'https://unpkg.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    } : false,
    hsts: production() ? { maxAge: 31536000 } : false,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1200,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Terlalu banyak permintaan. Coba lagi beberapa saat.' }
  }));
};

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.' }
});
const passwordChangeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan mengubah kata sandi. Coba lagi dalam 15 menit.' }
});
const uploadLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak unggahan. Coba lagi sebentar.' }
});
const pdfLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak permintaan PDF. Coba lagi sebentar.' }
});
const exportLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak permintaan ekspor. Coba lagi sebentar.' }
});

module.exports = {
  configureSecurity, loginLimit, passwordChangeLimit, uploadLimit, pdfLimit, exportLimit, publicOrigin, privateHost
};
