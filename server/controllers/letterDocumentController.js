const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../config/prisma');
const { loadState, resolveAccount, getRevision } = require('../services/risDataService');
const { projectState, letterManager } = require('../services/risAccess');
const { saveState } = require('../services/risStateMutation');
const { storeFile, removeStoredFile, getStoredFileBuffer } = require('../services/fileStorage');
const { renderLetterPdf, getTemplateCatalog } = require('../services/letterDocumentService');

const previewSchema = z.object({
  letterId: z.string().max(128).optional(),
  letter: z.record(z.string(), z.unknown()).optional(),
  definition: z.record(z.string(), z.unknown()).optional(),
  values: z.record(z.string(), z.unknown()).optional(),
}).strict();
const publishSchema = z.object({ fileId: z.uuid(), notes: z.string().max(4000).optional() }).strict();

const fail = (message, status = 422) => Object.assign(new Error(message), { status });
const context = async req => {
  const version = await getRevision();
  const state = await loadState();
  const account = resolveAccount(state, req.user);
  if (!account) throw fail('Akun tidak tersedia.', 403);
  const scopes = await prisma.user_admin_scopes.findMany({ where: { user_id: req.user.id }, select: { scope: true } });
  account.adminScopes = scopes.map(item => item.scope);
  const data = projectState(state, account);
  const letter = (data.letterRequests || []).find(item => item.id === req.params.id);
  return {
    version, data, letter, account
  };
};
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
};
const fingerprint = letter => crypto.createHash('sha256').update(JSON.stringify(canonical({
  type: letter.type,
  purpose: letter.purpose,
  applicant: letter.applicant,
  autoFill: letter.autoFill,
  form: letter.form,
  template: letter.template,
  fields: letter.templateFields,
  name: letter.definitionName,
  customName: letter.customName,
}))).digest('hex');
const fileNameFor = letter => `${String((letter.generated || {}).letterNumber || letter.id).replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`;
const pdfResponse = (res, bytes, name, inline) => {
  res.set('Content-Type', 'application/pdf');
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  if (inline) {
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'self'");
  }
  res.set('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`);
  return res.send(bytes);
};
const requireLetter = letter => { if (!letter) throw fail('Surat tidak ditemukan.', 404); };

const preview = async (req, res, next) => {
  try {
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success || (!parsed.data.letterId && !parsed.data.definition)) throw fail('Data pratinjau tidak valid.');
    let letter;
    if (req.body.letterId) {
      req.params.id = req.body.letterId;
      const current = await context(req);
      requireLetter(current.letter);
      letter = { ...current.letter };
      ['applicant', 'autoFill', 'form', 'template', 'templateFields'].forEach(key => {
        if (req.body.letter && req.body.letter[key] !== undefined) letter[key] = req.body.letter[key];
      });
    } else {
      const definition = req.body.definition || {};
      letter = {
        id: 'pratinjau-templat',
        type: definition.type || 'custom',
        purpose: definition.purpose || '',
        definitionName: definition.name,
        template: definition.template,
        templateFields: definition.fields || [],
        form: req.body.values || {},
        applicant: {
          name: 'Nama Dosen', identifier: 'Nomor Identitas Dosen', program: 'Program Studi', faculty: 'Fakultas', applicantRole: 'Dosen'
        },
      };
    }
    if (!Array.isArray(letter.templateFields) || letter.templateFields.length > 100) throw fail('Daftar isian surat tidak valid.');
    return pdfResponse(res, await renderLetterPdf(letter, { preview: true }), 'pratinjau-surat.pdf', true);
  } catch (error) { return next(error); }
};

const numberFor = (letter, sequence) => {
  const codes = {
    research_assignment: 'ST-RIS', support: 'SP-RIS', ethics: 'KE-RIS', travel: 'SPD-RIS', custom: 'SK-RIS'
  };
  const date = new Date();
  return `${String(sequence).padStart(4, '0')}/${codes[letter.type] || 'RIS'}/LPPM/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};
const generate = async (req, res, next) => {
  let stored;
  try {
    const current = await context(req);
    requireLetter(current.letter);
    if (!letterManager(current.account) || current.letter.status !== 'approved') throw fail('Terima pengajuan sebelum membuat PDF surat.', 403);
    const original = current.letter;
    let sequence = current.data.letterSequence || 1;
    let { letterNumber } = original.generated || {};
    if (!letterNumber) {
      const usedNumbers = new Set(current.data.letterRequests.map(item => (item.generated || {}).letterNumber));
      while (usedNumbers.has(numberFor(original, sequence))) sequence += 1;
      letterNumber = numberFor(original, sequence);
    }
    const letter = { ...original, generated: { ...original.generated, letterNumber } };
    const bytes = await renderLetterPdf(letter);
    // Reload after conversion, which can take seconds, and reject stale form data.
    const latest = await context(req);
    requireLetter(latest.letter);
    if (latest.letter.status !== 'approved' || fingerprint(latest.letter) !== fingerprint(original)
      || latest.data.letterSequence !== current.data.letterSequence) throw fail('Data surat berubah selama pembuatan PDF. Muat ulang dan coba lagi.', 409);
    stored = await storeFile({
      bytes, name: fileNameFor(letter), mimeType: 'application/pdf', ownerId: req.user.id, purpose: 'letters',
    });
    const now = new Date().toISOString();
    const generated = {
      ...original.generated,
      letterNumber,
      fileName: stored.name,
      draftFileUrl: stored.fileUrl,
      draftFileId: stored.id,
      generatedAt: now,
      generatedBy: latest.account.id,
      sourceFingerprint: fingerprint(original),
    };
    const saved = await saveState({
      databaseUser: req.user,
      expectedVersion: latest.version,
      submitted: {
        ...latest.data,
        letterSequence: (original.generated || {}).letterNumber ? latest.data.letterSequence : sequence + 1,
        letterRequests: latest.data.letterRequests.map(item => (item.id === original.id ? { ...item, generated, updatedAt: now } : item)),
      },
    });
    return res.json(saved);
  } catch (error) {
    if (stored) await removeStoredFile(stored.id).catch(() => {});
    return next(error);
  }
};

const publish = async (req, res, next) => {
  try {
    const parsed = publishSchema.safeParse(req.body);
    if (!parsed.success) throw fail('Data PDF bertanda tangan tidak valid.');
    const current = await context(req);
    const {
      letter, account, data, version
    } = current;
    requireLetter(letter);
    if (!letterManager(account) || letter.status !== 'approved' || !(letter.generated || {}).draftFileId) throw fail('Buat PDF draf sebelum menerbitkan surat bertanda tangan.', 403);
    if (letter.generated.sourceFingerprint !== fingerprint(letter)) throw fail('Data surat berubah. Buat kembali PDF sebelum mengunggah hasil tanda tangan.', 409);
    const file = await prisma.stored_files.findUnique({ where: { id: parsed.data.fileId } });
    if (!file || file.owner_user_id !== req.user.id || file.extension !== 'pdf' || file.status !== 'ready' || !['local', 's3'].includes(file.storage_provider)) throw fail('PDF bertanda tangan tidak valid.', 403);
    if (file.id === letter.generated.draftFileId) throw fail('Unggah PDF hasil tanda tangan, bukan berkas draf yang dihasilkan sistem.');
    const bytes = await getStoredFileBuffer(file);
    if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw fail('Berkas PDF tidak valid.');
    const now = new Date().toISOString();
    const updated = {
      ...letter,
      status: 'generated',
      updatedAt: now,
      generated: {
        ...letter.generated, fileId: file.id, fileUrl: file.file_url, fileName: file.original_name, signedAt: now, signedBy: account.id
      },
      history: [...(letter.history || []), {
        status: 'generated', note: 'Surat PDF bertanda tangan diterbitkan untuk dosen.', at: now, by: account.id
      }],
      reviews: [...(letter.reviews || []), {
        id: crypto.randomUUID(), letterId: letter.id, reviewerId: account.id, decision: 'generated', notes: parsed.data.notes || 'Surat bertanda tangan diterbitkan.', reviewedAt: now
      }],
    };
    const saved = await saveState({ databaseUser: req.user, expectedVersion: version, submitted: { ...data, letterRequests: data.letterRequests.map(item => (item.id === letter.id ? updated : item)) } });
    return res.json(saved);
  } catch (error) { return next(error); }
};

const download = async (req, res, next) => {
  try {
    const { letter, account } = await context(req);
    requireLetter(letter);
    const draft = req.query.draft === '1';
    if (draft && !letterManager(account)) throw fail('Akses PDF draf tidak diizinkan.', 403);
    if (!draft && letter.status !== 'generated') throw fail('Surat final belum diterbitkan.', 403);
    const url = (letter.generated || {})[draft ? 'draftFileUrl' : 'fileUrl'];
    if (/^\/api\/files\/[0-9a-f-]{36}$/.test(url || '')) return res.redirect(`${url}${req.query.inline === '1' ? '?inline=1' : ''}`);
    // Old demo records have no physical file. Render their Word source, never a TXT fallback.
    if (!draft && /^archive:\/\/letter-/.test(url || '')) {
      return pdfResponse(res, await renderLetterPdf(letter, { preview: true }), fileNameFor(letter), req.query.inline === '1');
    }
    throw fail('Berkas PDF belum tersedia. Pengelola perlu membuat dan mengunggah surat bertanda tangan.', 404);
  } catch (error) { return next(error); }
};

const templates = (req, res) => res.json({ templates: getTemplateCatalog() });
module.exports = {
  templates, preview, generate, publish, download, fingerprint
};
