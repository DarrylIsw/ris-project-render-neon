const crypto = require('crypto');
const prisma = require('../config/prisma');

// MFA remains available as an explicit hardening option, but must never be
// enabled implicitly just because the application runs in production.
const requiredFor = role => process.env.MFA_REQUIRED === 'true'
  && ['super_admin', 'manager', 'admin'].includes(role);
const secretKey = () => Buffer.from(process.env.MFA_ENCRYPTION_KEY || '', 'hex');
const encrypt = secret => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
};
const decrypt = value => {
  const [version, iv, tag, ciphertext] = value.split(':');
  if (version !== 'v1') throw new Error('Format rahasia MFA tidak dikenal.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'hex')), decipher.final()]).toString('utf8');
};

const enrollment = async user => {
  let record = await prisma.user_mfa.findUnique({ where: { user_id: user.id } });
  if (record && record.confirmed_at) return { requiresMfa: true };
  if (!record) {
    const { generateSecret } = await import('otplib');
    const secret = generateSecret();
    try {
      record = await prisma.user_mfa.create({ data: { user_id: user.id, secret_ciphertext: encrypt(secret) } });
    } catch (error) {
      if (error.code !== 'P2002') throw error;
      record = await prisma.user_mfa.findUnique({ where: { user_id: user.id } });
    }
  }
  const secret = decrypt(record.secret_ciphertext);
  const uri = new URL(`otpauth://totp/${encodeURIComponent(`RIS UMN:${user.email}`)}`);
  uri.searchParams.set('secret', secret);
  uri.searchParams.set('issuer', 'RIS UMN');
  uri.searchParams.set('algorithm', 'SHA1');
  uri.searchParams.set('digits', '6');
  uri.searchParams.set('period', '30');
  return { requiresMfa: true, setupKey: secret, setupUri: uri.toString() };
};

const verifyCode = async (user, code) => {
  if (!/^\d{6}$/.test(code || '')) return false;
  const record = await prisma.user_mfa.findUnique({ where: { user_id: user.id } });
  if (!record) return false;
  const { verify } = await import('otplib');
  const lastStep = Number(record.last_used_step);
  const result = await verify({
    secret: decrypt(record.secret_ciphertext),
    token: code,
    epochTolerance: 30,
    ...(lastStep >= 0 ? { afterTimeStep: lastStep } : {}),
  });
  if (!result.valid) return false;
  const updated = await prisma.user_mfa.updateMany({
    where: { user_id: user.id, last_used_step: record.last_used_step },
    data: { last_used_step: global.BigInt(result.timeStep), confirmed_at: record.confirmed_at || new Date() },
  });
  return updated.count === 1;
};

module.exports = { requiredFor, enrollment, verifyCode };
