const crypto = require('crypto');
const path = require('path');
const prisma = require('../../config/prisma');
const local = require('./localStorage');
const s3 = require('./s3Storage');

const storageProvider = () => {
  const configured = String(process.env.FILE_STORAGE_BACKEND || 'local').trim().toLowerCase();
  if (!['local', 's3'].includes(configured)) throw new Error('FILE_STORAGE_BACKEND must be either local or s3.');
  return configured;
};

const adapterFor = provider => {
  if (provider === 'local') return local;
  if (provider === 's3') return s3;
  throw new Error('Unsupported file storage provider.');
};

const objectKey = (provider, purpose, id, extension) => (provider === 's3'
  ? `${purpose}/${id}.${extension}`
  : `${id}.${extension}`);
const allowedPurposes = new Set(['proposals', 'rab', 'profiles', 'contracts', 'reports', 'letters', 'external-research', 'proposals/templates', 'misc']);

const storeFile = async ({
  bytes, name, mimeType, ownerId, purpose = 'misc',
}) => {
  if (!allowedPurposes.has(purpose)) throw new Error('Invalid file storage purpose.');
  const id = crypto.randomUUID();
  const originalName = path.basename(String(name || '')).slice(0, 255);
  const extension = path.extname(originalName).slice(1).toLowerCase();
  if (!originalName || !/^[a-z0-9]{1,20}$/.test(extension)) throw new Error('Invalid file name or extension.');
  const provider = storageProvider();
  const storageKey = objectKey(provider, purpose, id, extension);
  const adapter = adapterFor(provider);
  await adapter.putObject({ key: storageKey, bytes, mimeType });
  try {
    await prisma.stored_files.create({
      data: {
        id,
        owner_user_id: ownerId,
        storage_provider: provider,
        storage_key: storageKey,
        file_url: `/api/files/${id}`,
        original_name: originalName,
        mime_type: mimeType,
        extension,
        size_bytes: global.BigInt(bytes.length),
        checksum_sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        metadata: { purpose },
        status: 'ready',
      }
    });
  } catch (error) {
    await adapter.deleteObject(storageKey).catch(() => {});
    throw error;
  }
  return {
    id, name: originalName, size: bytes.length, fileUrl: `/api/files/${id}`,
  };
};

const getStoredFileStream = file => adapterFor(file.storage_provider).getObjectStream(file.storage_key);
const getStoredFileBuffer = file => adapterFor(file.storage_provider).getObjectBuffer(file.storage_key);

const removeStoredFile = async id => {
  const file = await prisma.stored_files.findUnique({ where: { id } });
  if (!file) return;
  await prisma.stored_files.delete({ where: { id } });
  await adapterFor(file.storage_provider).deleteObject(file.storage_key);
};

module.exports = {
  storageProvider,
  storeFile,
  getStoredFileStream,
  getStoredFileBuffer,
  removeStoredFile,
};
