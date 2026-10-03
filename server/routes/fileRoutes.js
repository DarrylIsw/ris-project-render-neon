/* eslint-disable no-restricted-syntax */
const express = require('express');
const path = require('path');
const { pipeline } = require('stream/promises');
const prisma = require('../config/prisma');
const { requireUser } = require('../middlewares/auth');
const { loadState, resolveAccount } = require('../services/risDataService');
const { projectState } = require('../services/risAccess');
const { storeFile, getStoredFileStream } = require('../services/fileStorage');
const { uploadLimit } = require('../middlewares/security');

const router = express.Router();
const maxBytes = 20 * 1024 * 1024;
const allowed = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'txt']);
const purposes = new Set(['proposals', 'rab', 'profiles', 'contracts', 'reports', 'letters', 'external-research', 'proposals/templates', 'misc']);
const mimeTypes = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  txt: 'text/plain; charset=utf-8',
};
const startsWith = (bytes, signature) => bytes.subarray(0, signature.length).equals(Buffer.from(signature));
const validSignature = (extension, bytes) => {
  if (extension === 'pdf') return startsWith(bytes, '%PDF-');
  if (['docx', 'xlsx', 'pptx'].includes(extension)) return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
  if (['doc', 'xls', 'ppt'].includes(extension)) return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (extension === 'png') return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (['jpg', 'jpeg'].includes(extension)) return startsWith(bytes, [0xff, 0xd8, 0xff]);
  return extension !== 'txt' || !bytes.includes(0);
};
router.use(requireUser);

router.post('/', uploadLimit, async (req, res, next) => {
  try {
    let decodedName;
    try { decodedName = decodeURIComponent(String(req.get('x-file-name') || '')); } catch (error) { return res.status(400).json({ message: 'Nama berkas tidak valid.' }); }
    const originalName = path.basename(decodedName).slice(0, 255);
    const extension = originalName.split('.').pop().toLowerCase();
    if (!originalName || !allowed.has(extension)) return res.status(400).json({ message: 'Format berkas tidak diizinkan.' });
    const purpose = String(req.get('x-file-purpose') || 'misc').trim();
    if (!purposes.has(purpose)) return res.status(400).json({ message: 'Kategori penyimpanan berkas tidak valid.' });
    const sizeHeader = Number(req.get('content-length') || 0);
    if (sizeHeader > maxBytes) return res.status(413).json({ message: 'Ukuran berkas maksimal 20 MB.' });
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxBytes) return res.status(413).json({ message: 'Ukuran berkas maksimal 20 MB.' });
      chunks.push(chunk);
    }
    if (!size) return res.status(400).json({ message: 'Berkas kosong.' });
    const bytes = Buffer.concat(chunks);
    if (!validSignature(extension, bytes)) return res.status(400).json({ message: 'Isi berkas tidak sesuai dengan formatnya.' });
    const stored = await storeFile({
      bytes, name: originalName, mimeType: mimeTypes[extension], ownerId: req.user.id, purpose,
    });
    return res.status(201).json(stored);
  } catch (error) { return next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return res.status(404).end();
    const file = await prisma.stored_files.findUnique({ where: { id: req.params.id } });
    if (!file || file.status !== 'ready' || !['local', 's3'].includes(file.storage_provider)) return res.status(404).end();
    let permitted = file.owner_user_id === req.user.id || ['super_admin', 'manager'].includes(req.user.role);
    if (!permitted) {
      const state = await loadState();
      const account = resolveAccount(state, req.user);
      if (account) {
        const scopes = await prisma.user_admin_scopes.findMany({ where: { user_id: req.user.id }, select: { scope: true } });
        account.adminScopes = scopes.map(item => item.scope);
        permitted = JSON.stringify(projectState(state, account)).includes(`/api/files/${file.id}`);
      }
    }
    if (!permitted) return res.status(403).json({ message: 'Tidak dapat membuka berkas ini.' });
    res.set('Content-Type', mimeTypes[file.extension] || 'application/octet-stream');
    res.set('Content-Length', String(file.size_bytes));
    const disposition = req.query.inline === '1' && file.extension === 'pdf' ? 'inline' : 'attachment';
    res.set('X-Content-Type-Options', 'nosniff');
    if (disposition === 'inline') {
      res.set('X-Frame-Options', 'SAMEORIGIN');
      res.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'self'");
    }
    res.set('Cache-Control', 'private, no-store');
    res.set('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
    const stream = await getStoredFileStream(file);
    try {
      await pipeline(stream, res);
    } catch (error) {
      if (res.headersSent) return res.destroy(error);
      return next(error);
    }
    return undefined;
  } catch (error) { return next(error); }
});

module.exports = router;
