export const fileNameOf = file => String((file && (file.name || file.fileName || file.fileUrl)) || '');

export const fileExtensionOf = file => {
  const name = fileNameOf(file);
  if (!name.includes('.')) return '';
  return name.split('.').pop().toLowerCase();
};

export const fileSizeOf = file => Number((file && (file.size || file.fileSize)) || 0);

const megabytes = bytes => Math.round((bytes / (1024 * 1024)) * 10) / 10;

export const validateFile = (file, options = {}) => {
  const allowedExtensions = (options.allowedExtensions || []).map(item => String(item).replace(/^\./, '').toLowerCase());
  const maxSize = Number(options.maxSize || 0);
  if (!file) return options.required === false ? { valid: true, code: '', message: '' } : { valid: false, code: 'required', message: 'File wajib dipilih.' };

  const extension = fileExtensionOf(file);
  if (allowedExtensions.length && !allowedExtensions.includes(extension)) {
    return {
      valid: false,
      code: 'extension',
      message: `Format file .${extension || '-'} tidak sesuai. Format yang diizinkan: ${allowedExtensions.join(', ')}.`,
    };
  }
  if (maxSize && fileSizeOf(file) > maxSize) {
    return { valid: false, code: 'size', message: `Ukuran file maksimal ${megabytes(maxSize)} MB.` };
  }
  return { valid: true, code: '', message: '' };
};
