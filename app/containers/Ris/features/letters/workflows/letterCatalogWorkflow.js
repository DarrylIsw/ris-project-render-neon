/* eslint-disable object-curly-newline, object-property-newline */
import { canManageLetters } from '../../../shared/workflows/workflow';
import { resolveLetterDocumentTemplate } from '../../../../../../shared/letterDocumentTemplates';
import {
  LETTER_STATUS, LETTER_TYPE, canCreateLetter, canEditLetter, createLetterRequest,
  transitionLetterStatus, updateLetterHistory, validateLetterApplicantData, validateLetterTemplateFields,
} from './letterWorkflow';

const copy = value => JSON.parse(JSON.stringify(value));

export const createLetterMasterTemplate = () => ({
  id: 'letter-master', name: 'Master Template Surat', version: 1,
  template: { name: 'Master Template Surat', content: 'UNIVERSITAS MULTIMEDIA NUSANTARA\n\nNomor: {{letterNumber}}\nPerihal: {{letterPurpose}}\n\nNama: {{applicantName}}\nNIDN/NIP: {{applicantIdentifier}}\nProgram Studi: {{studyProgram}}\nFakultas: {{faculty}}\n\n{{customFields}}\n\nDemikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.' },
  fields: [
    { id: 'master-recipient', key: 'recipientInstitution', label: 'Instansi atau Penerima Tujuan', type: 'text', required: true, options: [] },
    { id: 'master-activity', key: 'activityName', label: 'Nama Kegiatan', type: 'text', required: true, options: [] },
    { id: 'master-purpose', key: 'activityPurpose', label: 'Keperluan Surat', type: 'textarea', required: true, options: [] },
    { id: 'master-date', key: 'activityDate', label: 'Tanggal Kegiatan', type: 'date', required: true, options: [] },
    { id: 'master-location', key: 'activityLocation', label: 'Lokasi Kegiatan', type: 'text', required: false, options: [] },
    { id: 'master-notes', key: 'additionalNotes', label: 'Keterangan Tambahan', type: 'textarea', required: false, options: [] },
  ],
});

export const createLetterDefinitionFromMaster = (data, uid) => {
  const master = data.letterMasterTemplate || createLetterMasterTemplate();
  return {
    id: uid('letter-kind'), name: '', description: '', type: LETTER_TYPE.CUSTOM, purpose: '', active: false, status: 'draft',
    masterVersion: master.version, template: copy(master.template),
    fields: master.fields.map(field => ({ ...copy(field), id: uid('letter-field') })),
  };
};

export const letterDefinitionStatus = definition => {
  if (definition.deletedAt) return 'deleted';
  if (definition.active) return 'published';
  return definition.status === 'draft' ? 'draft' : 'inactive';
};

export const getEditableLetterDefinition = definition => ({ ...copy(definition), ...copy(definition.pendingDraft || {}), version: definition.version });

export const createDefaultLetterDefinitions = () => [
  { id: 'letter-kind-assignment', name: 'Surat Tugas Penelitian', type: LETTER_TYPE.RESEARCH_ASSIGNMENT, purpose: 'independent_research', description: 'Penugasan untuk kegiatan penelitian, termasuk penelitian mandiri.' },
  { id: 'letter-kind-support', name: 'Surat Pendukung Kegiatan', type: LETTER_TYPE.SUPPORT, purpose: 'other_research_activity', description: 'Dukungan kegiatan akademik, kerja sama, observasi, atau kegiatan lainnya.' },
  { id: 'letter-kind-ethics', name: 'Permohonan Klirens Etik', type: LETTER_TYPE.ETHICS, purpose: 'new', description: 'Permohonan pemeriksaan etik untuk kegiatan riset.' },
  { id: 'letter-kind-travel', name: 'Surat Tugas Perjalanan Dinas', type: LETTER_TYPE.TRAVEL, purpose: 'research_travel', description: 'Penugasan perjalanan untuk kegiatan akademik maupun nonpenelitian.' },
  { id: 'letter-kind-general', name: 'Surat Keterangan Kegiatan', type: LETTER_TYPE.CUSTOM, purpose: '', description: 'Keterangan untuk keperluan administrasi atau kegiatan di luar penelitian.' },
].map(item => ({
  ...item,
  active: true,
  version: 1,
  template: { name: item.name, content: `UNIVERSITAS MULTIMEDIA NUSANTARA\n\nNomor: {{letterNumber}}\nPerihal: ${item.name}\n\nNama: {{applicantName}}\nNIDN/NIP: {{applicantIdentifier}}\nProgram Studi: {{studyProgram}}\n\n{{customFields}}\n\nDemikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.` },
  fields: [
    { id: `${item.id}-recipient`, key: 'recipientInstitution', label: 'Instansi atau Penerima Tujuan', type: 'text', required: true, options: [] },
    { id: `${item.id}-purpose`, key: 'activityPurpose', label: 'Keperluan Surat', type: 'textarea', required: true, options: [] },
    { id: `${item.id}-date`, key: 'activityDate', label: 'Tanggal Kegiatan', type: 'date', required: true, options: [] },
  ],
}));

export const getPublishedLetterDefinitions = data => (data.letterDefinitions || []).filter(item => letterDefinitionStatus(item) === 'published');

const invalidTemplateTokens = definition => {
  const allowed = new Set(['applicantName', 'applicantIdentifier', 'applicantEmail', 'studyProgram', 'faculty', 'letterNumber', 'letterPurpose', 'letterType', 'requestId', 'customFields', 'researchTitle', 'researchYear', 'researchScheme', 'researchRole', ...(definition.fields || []).map(field => field.key)]);
  return [...new Set((String((definition.template || {}).content || '').match(/{{\s*[a-zA-Z0-9_]+\s*}}/g) || []).map(token => token.replace(/[{}\s]/g, '')).filter(key => !allowed.has(key)))];
};

export const validateLetterDefinition = definition => [
  ...(!String(definition.name || '').trim() ? ['Nama jenis surat wajib diisi.'] : []),
  ...(!String((definition.template || {}).content || '').trim() ? ['Isi templat surat wajib diisi.'] : []),
  ...(!(definition.fields || []).length ? ['Tambahkan minimal satu isian formulir.'] : []),
  ...validateLetterTemplateFields(definition.fields || []),
  ...invalidTemplateTokens(definition).map(key => `Variabel {{${key}}} pada isi surat tidak memiliki isian. Hapus variabel tersebut atau pulihkan isian terkait.`),
  ...(() => { try { resolveLetterDocumentTemplate(definition); return []; } catch (error) { return [error.message]; } })(),
];

const normalizeDefinition = definition => ({
  ...copy(definition), name: String(definition.name || '').trim(),
  fields: (definition.fields || []).map(field => ({ ...field, options: field.type === 'select' ? [...new Set((field.options || []).map(option => (typeof option === 'string' ? option.trim() : option)).filter(Boolean))] : [] })),
});

export const saveLetterDefinition = (data, definition, user, mode = definition.active ? 'publish' : 'inactive') => {
  if (!canManageLetters(user)) throw new Error('Anda tidak memiliki akses untuk mengatur jenis surat.');
  if (!['draft', 'publish', 'inactive'].includes(mode)) throw new Error('Tindakan template tidak valid.');
  const candidate = normalizeDefinition(definition);
  const errors = mode === 'draft' ? [] : validateLetterDefinition(candidate);
  if (errors.length) throw new Error(errors.join(' '));
  const existing = (data.letterDefinitions || []).find(item => item.id === definition.id);
  if (!existing && definition.version !== undefined) throw new Error('Template tidak ditemukan. Buat ulang dari master template.');
  if (existing && existing.deletedAt) throw new Error('Template telah dihapus dan tidak dapat diubah.');
  if (existing && definition.version !== undefined && definition.version !== existing.version) throw new Error('Template telah berubah. Buka kembali versi terbaru.');
  const now = new Date().toISOString();
  const metadata = { updatedAt: now, updatedBy: user.id, createdAt: (existing && existing.createdAt) || now };
  // Draft edits of a published type must never leak into the lecturer catalog.
  const saved = mode === 'draft' && existing && existing.active
    ? { ...existing, ...metadata, pendingDraft: { ...candidate, pendingDraft: null } }
    : { ...candidate, ...metadata, pendingDraft: null, active: mode === 'publish', status: mode === 'publish' ? 'published' : mode, version: existing ? existing.version + (mode === 'draft' ? 0 : 1) : 1 };
  return { ...data, letterDefinitions: existing ? data.letterDefinitions.map(item => (item.id === saved.id ? saved : item)) : [...(data.letterDefinitions || []), saved] };
};

export const deleteLetterDefinition = (data, definitionId, user) => {
  if (!canManageLetters(user)) throw new Error('Anda tidak memiliki akses untuk menghapus template.');
  const definition = (data.letterDefinitions || []).find(item => item.id === definitionId && !item.deletedAt);
  if (!definition) throw new Error('Template tidak ditemukan.');
  const now = new Date().toISOString();
  return { ...data, letterDefinitions: data.letterDefinitions.map(item => (item.id === definitionId ? { ...item, active: false, status: 'deleted', deletedAt: now, deletedBy: user.id, updatedAt: now, pendingDraft: null } : item)) };
};

export const saveLetterMasterTemplate = (data, master, user) => {
  if (!canManageLetters(user)) throw new Error('Anda tidak memiliki akses untuk mengatur master template.');
  const candidate = normalizeDefinition(master);
  const errors = validateLetterDefinition(candidate);
  if (errors.length) throw new Error(errors.join(' '));
  if (data.letterMasterTemplate && data.letterMasterTemplate.version !== master.version) throw new Error('Master template telah berubah. Buka kembali versi terbaru.');
  return { ...data, letterMasterTemplate: { ...candidate, id: 'letter-master', version: ((data.letterMasterTemplate || {}).version || 1) + 1, updatedAt: new Date().toISOString(), updatedBy: user.id } };
};

export const createCatalogLetterDraft = ({ definitionId, researchId }, user, data, uid) => {
  if (!canCreateLetter(user)) throw new Error('Hanya dosen yang dapat membuat pengajuan surat.');
  const definition = getPublishedLetterDefinitions(data).find(item => item.id === definitionId);
  if (!definition) throw new Error('Jenis surat tidak tersedia. Pilih jenis surat lain.');
  if (researchId && !(data.drafts || []).some(item => item.id === researchId && item.userId === user.id && ['funded', 'approved'].includes(item.status))) throw new Error('Penelitian terkait tidak dapat digunakan.');
  const request = createLetterRequest({ researchId: researchId || null, type: definition.type, purpose: definition.purpose, customName: definition.name }, user, data, uid);
  if (!researchId) {
    ['researchTitle', 'researchYear', 'researchScheme', 'researchRole'].forEach(key => { delete request.autoFill[key]; });
  }
  // Keep the published form on each application so catalog edits never alter existing submissions.
  return {
    ...request, status: LETTER_STATUS.DRAFT, submittedAt: null,
    definitionId: definition.id, definitionVersion: definition.version, definitionName: definition.name,
    template: { ...copy(definition.template), sourceId: resolveLetterDocumentTemplate(definition).id }, templateFields: copy(definition.fields),
    history: [{ status: LETTER_STATUS.DRAFT, note: 'Draft pengajuan surat dibuat.', at: request.createdAt, by: user.id }],
  };
};

export const saveCatalogLetter = (data, candidate, user, submit = false) => {
  const existing = (data.letterRequests || []).find(item => item.id === candidate.id);
  const letter = existing || candidate;
  if (!canEditLetter(letter, user)) throw new Error('Pengajuan ini tidak dapat diubah.');
  if (!existing && !getPublishedLetterDefinitions(data).some(item => item.id === candidate.definitionId)) throw new Error('Jenis surat tidak lagi tersedia.');
  if (!existing && !getPublishedLetterDefinitions(data).some(item => item.id === candidate.definitionId && item.version === candidate.definitionVersion)) throw new Error('Formulir surat telah diperbarui. Pilih kembali jenis surat untuk menggunakan formulir terbaru.');
  const form = Object.fromEntries((letter.templateFields || []).map(field => [field.key, (candidate.form || {})[field.key] === undefined ? '' : candidate.form[field.key]]));
  let saved = { ...letter, form, updatedAt: new Date().toISOString() };
  if (submit) {
    const errors = validateLetterApplicantData(saved);
    if (errors.length) throw new Error(errors.join(' '));
    const nextStatus = [LETTER_STATUS.DATA_REQUIRED, LETTER_STATUS.REVISION_REQUIRED].includes(letter.status) ? LETTER_STATUS.DATA_SUBMITTED : LETTER_STATUS.SUBMITTED;
    saved = transitionLetterStatus(saved, nextStatus, { submittedAt: saved.submittedAt || saved.updatedAt, dataSubmittedAt: saved.updatedAt });
    if (!saved) throw new Error('Status pengajuan telah berubah. Muat kembali halaman.');
    saved = updateLetterHistory(saved, nextStatus, 'Formulir lengkap diajukan untuk verifikasi dan penerbitan surat.', user);
  }
  return { ...data, letterRequests: existing ? data.letterRequests.map(item => (item.id === saved.id ? saved : item)) : [...(data.letterRequests || []), saved] };
};
