const escapeHtml = value => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const LOGO_CID = 'ris-umn-email-logo';
const contextLabel = record => {
  const key = String(record.templateKey || record.notificationType || '').toLowerCase();
  if (key.startsWith('account-') || key.startsWith('new-profile')) return 'Akun dan Hak Akses';
  if (key.startsWith('profile-')) return 'Profil Peneliti';
  if (key.startsWith('external-report-')) return 'Penelitian Eksternal';
  if (key.startsWith('funded-')) return 'Penelitian Didanai';
  if (key.startsWith('reviewer-') || key.startsWith('review-')) return 'Penilaian Reviewer';
  if (key.startsWith('proposal-') || key.startsWith('research-decision')) return 'Pengajuan Penelitian Internal';
  if (key.startsWith('contract-')) return 'Kontrak Penelitian';
  if (key.startsWith('scheme-')) return 'Skema Penelitian';
  if (key.startsWith('internal-report-') || key.startsWith('report-')) return 'Laporan Penelitian Internal';
  if (key.startsWith('monev-')) return 'Pemantauan dan Evaluasi';
  if (key.startsWith('letter-')) return 'Pengajuan Surat';
  return 'Pemberitahuan RIS';
};

const cleanMessage = record => String(record.bodyText || record.message || 'Ada pembaruan penting pada sistem RIS.')
  .replace(/\n\nBuka RIS:[\s\S]*$/i, '')
  .trim();

const actionUrlFor = (record, config) => {
  const path = String(record.actionPath || (record.payload && record.payload.actionPath) || '').trim();
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${config.appBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

const itemMarkup = (record, config) => {
  const actionUrl = actionUrlFor(record, config);
  const actionLabel = (record.payload && record.payload.actionLabel) || 'Buka RIS';
  const button = actionUrl
    ? `<p style="margin:20px 0 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#13795b;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:6px;font-weight:600">${escapeHtml(actionLabel)}</a></p>`
    : '';
  return `<div style="padding:18px 0;border-bottom:1px solid #e5e7eb"><p style="font-size:12px;font-weight:700;color:#13795b;margin:0 0 7px">${escapeHtml(contextLabel(record))}</p><h2 style="font-size:17px;line-height:1.4;margin:0 0 8px;color:#17211d">${escapeHtml(record.subject)}</h2><p style="font-size:14px;line-height:1.65;margin:0;color:#46514c;white-space:pre-line">${escapeHtml(cleanMessage(record))}</p>${button}</div>`;
};

const wrapHtml = (content, config, recipientName) => {
  const greeting = recipientName ? `Halo ${escapeHtml(recipientName)},` : 'Halo,';
  const support = config.supportEmail
    ? ` Butuh bantuan? Hubungi <a href="mailto:${escapeHtml(config.supportEmail)}" style="color:#13795b">${escapeHtml(config.supportEmail)}</a>.`
    : '';
  const closing = `<p style="font-size:13px;line-height:1.6;color:#68736e;margin:20px 0">Email ini dikirim otomatis oleh ${escapeHtml(config.brandName)}.${support}</p><div style="border-top:1px solid #e5e7eb;padding-top:20px"><p style="font-size:14px;line-height:1.65;margin:0 0 14px"><strong>Best Regrads,<br>Publications Department<br>Research, Innovation, and Sustainability Division.</strong></p><img src="cid:${LOGO_CID}" alt="Logo UMN" width="156" height="120" style="display:block;width:156px;height:120px;object-fit:contain;margin:0 0 10px"><p style="margin:0 0 6px;font-size:13px"><strong><em>&quot;Excellent Career Begins With Excellent Education&quot;</em></strong></p><p style="margin:0;font-size:13px"><strong><u><a href="https://www.umn.ac.id" style="color:#00529b">www.umn.ac.id</a></u></strong></p></div>`;
  return `<!doctype html><html><body style="margin:0;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#17211d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f5;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dfe6e2;border-radius:8px"><tr><td style="padding:22px 28px;border-bottom:4px solid #13795b"><strong style="font-size:18px">${escapeHtml(config.brandName)}</strong></td></tr><tr><td style="padding:26px 28px"><p style="font-size:15px;margin:0 0 8px">${greeting}</p>${content}${closing}</td></tr></table></td></tr></table></body></html>`;
};

const textItem = (record, config) => {
  const actionUrl = actionUrlFor(record, config);
  return [contextLabel(record), record.subject, cleanMessage(record), actionUrl ? `Buka RIS: ${actionUrl}` : ''].filter(Boolean).join('\n');
};

const textClosing = config => [
  `Email ini dikirim otomatis oleh ${config.brandName}.`,
  '',
  'Best Regrads,',
  'Publications Department',
  'Research, Innovation, and Sustainability Division.',
  '',
  '"Excellent Career Begins With Excellent Education"',
  'www.umn.ac.id',
].join('\n');

const renderImmediate = (record, config) => {
  const name = record.payload && record.payload.recipientName;
  return {
    subject: record.subject,
    text: [`Halo${name ? ` ${name}` : ''},`, '', textItem(record, config), '', textClosing(config)].join('\n'),
    html: wrapHtml(itemMarkup(record, config), config, name),
  };
};

const renderDigest = (records, config) => {
  const first = records[0] || {};
  const name = first.payload && first.payload.recipientName;
  const subject = `Ringkasan aktivitas RIS (${records.length})`;
  const introduction = '<p style="font-size:14px;line-height:1.65;margin:0;color:#46514c">Berikut aktivitas yang memerlukan perhatian Anda.</p>';
  return {
    subject,
    text: [`Halo${name ? ` ${name}` : ''},`, '', 'Berikut aktivitas yang memerlukan perhatian Anda.', '', ...records.map(record => textItem(record, config)), '', textClosing(config)].join('\n\n'),
    html: wrapHtml(`${introduction}${records.map(record => itemMarkup(record, config)).join('')}`, config, name),
  };
};

module.exports = {
  LOGO_CID,
  escapeHtml,
  renderImmediate,
  renderDigest,
};
