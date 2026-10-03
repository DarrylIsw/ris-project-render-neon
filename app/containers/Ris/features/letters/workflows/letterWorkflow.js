/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import {
  canManageLetters, isResearcher
} from '../../../shared/workflows/workflow';
import { canTransition, transitionEntity } from '../../../core/domainState';
import { validateFile } from '../../../shared/workflows/fileValidation';

export const LETTER_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  FORM_DESIGN: 'form_design',
  DATA_REQUIRED: 'data_required',
  DATA_SUBMITTED: 'data_submitted',
  DRAFT_REVISION: 'draft_revision',
  PRECHECKED: 'prechecked',
  REVISION_REQUIRED: 'revision_required',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  GENERATED: 'generated',
};

export const LETTER_STATUS_TRANSITIONS = {
  [LETTER_STATUS.DRAFT]: [LETTER_STATUS.SUBMITTED, LETTER_STATUS.PRECHECKED, LETTER_STATUS.DRAFT_REVISION],
  [LETTER_STATUS.SUBMITTED]: [LETTER_STATUS.FORM_DESIGN, LETTER_STATUS.PRECHECKED, LETTER_STATUS.REVISION_REQUIRED, LETTER_STATUS.APPROVED, LETTER_STATUS.GENERATED, LETTER_STATUS.REJECTED],
  [LETTER_STATUS.FORM_DESIGN]: [LETTER_STATUS.DATA_REQUIRED, LETTER_STATUS.REJECTED],
  [LETTER_STATUS.DATA_REQUIRED]: [LETTER_STATUS.DATA_SUBMITTED],
  [LETTER_STATUS.DATA_SUBMITTED]: [LETTER_STATUS.REVISION_REQUIRED, LETTER_STATUS.APPROVED, LETTER_STATUS.REJECTED, LETTER_STATUS.GENERATED],
  [LETTER_STATUS.DRAFT_REVISION]: [LETTER_STATUS.SUBMITTED, LETTER_STATUS.PRECHECKED],
  [LETTER_STATUS.PRECHECKED]: [LETTER_STATUS.REVISION_REQUIRED, LETTER_STATUS.APPROVED, LETTER_STATUS.REJECTED],
  [LETTER_STATUS.REVISION_REQUIRED]: [LETTER_STATUS.DATA_SUBMITTED, LETTER_STATUS.SUBMITTED, LETTER_STATUS.PRECHECKED, LETTER_STATUS.DRAFT_REVISION],
  [LETTER_STATUS.APPROVED]: [LETTER_STATUS.GENERATED],
  [LETTER_STATUS.REJECTED]: [],
  [LETTER_STATUS.GENERATED]: [],
};

export const LETTER_TYPE = {
  RESEARCH_ASSIGNMENT: 'research_assignment',
  SUPPORT: 'support',
  ETHICS: 'ethics',
  TRAVEL: 'travel',
  CUSTOM: 'custom',
};

export const LETTER_STATUS_META = {
  [LETTER_STATUS.DRAFT]: { label: 'Draft', tone: 'gray' },
  [LETTER_STATUS.SUBMITTED]: { label: 'Menunggu Verifikasi', tone: 'cyan' },
  [LETTER_STATUS.FORM_DESIGN]: { label: 'Penyusunan Form', tone: 'blue' },
  [LETTER_STATUS.DATA_REQUIRED]: { label: 'Perlu Input Data', tone: 'orange' },
  [LETTER_STATUS.DATA_SUBMITTED]: { label: 'Menunggu Verifikasi Data', tone: 'purple' },
  [LETTER_STATUS.DRAFT_REVISION]: { label: 'Perbaikan Draft', tone: 'yellow' },
  [LETTER_STATUS.PRECHECKED]: { label: 'Menunggu Verifikasi Data', tone: 'blue' },
  [LETTER_STATUS.REVISION_REQUIRED]: { label: 'Perlu Perbaikan Data', tone: 'orange' },
  [LETTER_STATUS.APPROVED]: { label: 'Menunggu Penerbitan', tone: 'blue' },
  [LETTER_STATUS.REJECTED]: { label: 'Ditolak', tone: 'red' },
  [LETTER_STATUS.GENERATED]: { label: 'Selesai', tone: 'green' },
};

export const LETTER_TYPES = [
  {
    value: LETTER_TYPE.RESEARCH_ASSIGNMENT,
    label: 'Surat Tugas Penelitian dan Inovasi',
    shortLabel: 'Surat Tugas Penelitian',
    description: 'Untuk penelitian mandiri, kerja sama, hibah, publikasi, seminar ilmiah, buku, dan karya seni.',
    icon: 'document',
  },
  {
    value: LETTER_TYPE.SUPPORT,
    label: 'Surat Pendukung Kegiatan',
    shortLabel: 'Surat Pendukung',
    description: 'Untuk izin penelitian, observasi, wawancara, workshop, FGD, dan kegiatan penelitian lainnya.',
    icon: 'mail',
  },
  {
    value: LETTER_TYPE.ETHICS,
    label: 'Klirens Etik Riset',
    shortLabel: 'Klirens Etik',
    description: 'Untuk permohonan klirens etik baru atau perpanjangan klirens etik riset.',
    icon: 'check',
  },
  {
    value: LETTER_TYPE.TRAVEL,
    label: 'Surat Tugas Perjalanan Dinas',
    shortLabel: 'Perjalanan Dinas',
    description: 'Untuk kegiatan penelitian yang memerlukan perjalanan dinas.',
    icon: 'layers',
  },
  {
    value: LETTER_TYPE.CUSTOM,
    label: 'Surat Custom',
    shortLabel: 'Surat Custom',
    description: 'Permintaan surat khusus dengan nama dan kebutuhan yang ditentukan lecturer.',
    icon: 'edit',
  },
];

export const LETTER_PURPOSES = {
  [LETTER_TYPE.RESEARCH_ASSIGNMENT]: [
    { value: 'independent_research', label: 'Penelitian Mandiri' },
    { value: 'domestic_university_collaboration', label: 'Penelitian Kerjasama PT Dalam Negeri' },
    { value: 'international_university_collaboration', label: 'Penelitian Kerjasama PT Luar Negeri' },
    { value: 'internal_grant', label: 'Penelitian Hibah Internal' },
    { value: 'government_grant', label: 'Penelitian Pemerintah' },
    { value: 'industry_research', label: 'Penelitian Industri' },
    { value: 'journal', label: 'Jurnal' },
    { value: 'proceeding', label: 'Prosiding' },
    { value: 'book', label: 'Buku' },
    { value: 'scientific_seminar', label: 'Seminar Ilmiah' },
    { value: 'artwork', label: 'Karya Seni' },
  ],
  [LETTER_TYPE.SUPPORT]: [
    { value: 'research_permission', label: 'Permohonan Izin Penelitian' },
    { value: 'observation', label: 'Observasi' },
    { value: 'interview', label: 'Wawancara' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'fgd', label: 'FGD' },
    { value: 'other_research_activity', label: 'Kegiatan Penelitian Lainnya' },
  ],
  [LETTER_TYPE.ETHICS]: [
    { value: 'new', label: 'Permohonan Baru' },
    { value: 'extension', label: 'Perpanjangan' },
  ],
  [LETTER_TYPE.TRAVEL]: [
    { value: 'research_travel', label: 'Perjalanan Dinas Penelitian' },
  ],
  [LETTER_TYPE.CUSTOM]: [],
};

export const LETTER_FORM_FIELD_TYPES = [
  { value: 'text', label: 'Teks Singkat' },
  { value: 'textarea', label: 'Teks Panjang' },
  { value: 'number', label: 'Angka' },
  { value: 'date', label: 'Tanggal' },
  { value: 'datetime-local', label: 'Tanggal dan Waktu' },
  { value: 'email', label: 'Email' },
  { value: 'select', label: 'Pilihan' },
];

export const FILE_TYPES = [
  { value: 'proposal', label: 'Proposal' },
  { value: 'mou', label: 'MoU / MoA / LoA' },
  { value: 'article', label: 'Artikel / Manuskrip' },
  { value: 'publication_submission_evidence', label: 'Bukti Submit / Acceptance' },
  { value: 'ethics_form', label: 'Form Klirens Etik' },
  { value: 'previous_clearance', label: 'Klirens Etik Sebelumnya' },
  { value: 'invitation', label: 'Undangan / Invitation Letter' },
  { value: 'supporting_document', label: 'Dokumen Pendukung' },
  { value: 'travel_schedule', label: 'Jadwal Perjalanan' },
  { value: 'report', label: 'Laporan / Bukti Kegiatan' },
  { value: 'contract', label: 'Kontrak / Surat Kerja Sama' },
];

const PUBLICATION_PURPOSES = ['journal', 'proceeding', 'book'];
const COLLABORATION_PURPOSES = ['domestic_university_collaboration', 'international_university_collaboration'];
const GRANT_PURPOSES = ['internal_grant', 'government_grant'];
const RESEARCH_PURPOSES = ['independent_research', ...COLLABORATION_PURPOSES, ...GRANT_PURPOSES, 'industry_research'];
const ALLOWED_FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const getLetterTypeMeta = type => LETTER_TYPES.find(item => item.value === type) || LETTER_TYPES[0];
export const getLetterPurposeOptions = type => LETTER_PURPOSES[type] || [];
export const getLetterPurposeMeta = (type, purpose) => getLetterPurposeOptions(type).find(item => item.value === purpose) || { label: '-' };
export const letterStatus = letter => (letter && letter.status) || LETTER_STATUS.DRAFT;
export const canTransitionLetterStatus = (letter, nextStatus) => canTransition(LETTER_STATUS_TRANSITIONS, letterStatus(letter), nextStatus);
export const transitionLetterStatus = (letter, nextStatus, changes = {}) => transitionEntity({
  entity: letter,
  currentStatus: letterStatus(letter),
  nextStatus,
  transitions: LETTER_STATUS_TRANSITIONS,
  statusFields: ['status'],
  changes,
});
export const letterStatusMeta = letter => LETTER_STATUS_META[letterStatus(letter)] || LETTER_STATUS_META[LETTER_STATUS.DRAFT];
export const isPublicationPurpose = purpose => PUBLICATION_PURPOSES.includes(purpose);
export const isResearchPurpose = purpose => RESEARCH_PURPOSES.includes(purpose);
export const isCollaborationPurpose = purpose => COLLABORATION_PURPOSES.includes(purpose);
export const isGrantPurpose = purpose => GRANT_PURPOSES.includes(purpose);

export const isApplicantUser = user => isResearcher(user) || canManageLetters(user);
export const canCreateLetter = user => isResearcher(user);

export const isLetterOwner = (letter, user) => Boolean(letter && user)
  && (letter.userId === user.id || letter.createdBy === user.id);

export const canViewLetter = (letter, user) => {
  if (!letter || !user) return false;
  if (canManageLetters(user)) return true;
  return letter.userId === user.id || letter.createdBy === user.id;
};

export const canEditLetter = (letter, user) => canViewLetter(letter, user)
  && isResearcher(user)
  && isLetterOwner(letter, user)
  && [LETTER_STATUS.DRAFT, LETTER_STATUS.DRAFT_REVISION, LETTER_STATUS.DATA_REQUIRED, LETTER_STATUS.REVISION_REQUIRED].includes(letterStatus(letter));

export const canSubmitLetter = (letter, user) => canEditLetter(letter, user);
export const canDeleteLetter = (letter, user) => isResearcher(user) && isLetterOwner(letter, user)
  && [LETTER_STATUS.DRAFT, LETTER_STATUS.DRAFT_REVISION].includes(letterStatus(letter));
export const canAdminReviewLetter = (letter, user) => canManageLetters(user)
  && [LETTER_STATUS.SUBMITTED, LETTER_STATUS.PRECHECKED, LETTER_STATUS.DATA_SUBMITTED, LETTER_STATUS.APPROVED].includes(letterStatus(letter));
export const canConfigureLetterForm = (letter, user) => canManageLetters(user) && letterStatus(letter) === LETTER_STATUS.FORM_DESIGN;
export const canGenerateLetter = (letter, user) => canManageLetters(user)
  && ([LETTER_STATUS.DATA_SUBMITTED, LETTER_STATUS.APPROVED].includes(letterStatus(letter))
    || (letterStatus(letter) === LETTER_STATUS.SUBMITTED && Boolean(letter.definitionId)));
export const canDownloadFinalLetter = (letter, user) => canViewLetter(letter, user) && letterStatus(letter) === LETTER_STATUS.GENERATED;
export const canPrepareLetterPdf = (letter, user) => canManageLetters(user) && letterStatus(letter) === LETTER_STATUS.APPROVED;
export const canPublishSignedLetter = (letter, user) => canPrepareLetterPdf(letter, user)
  && Boolean(letter.generated && letter.generated.draftFileUrl);

export const getApplicantProfile = (user, data) => {
  const profiles = data.applicantProfiles || [];
  const profile = profiles.find(item => item.userId === (user && user.id) || item.id === (user && user.profileId));
  if (profile) return profile;
  const lecturer = (data.lecturers || []).find(item => item.userId === (user && user.id) || item.id === (user && user.profileId));
  if (lecturer) {
    return {
      id: lecturer.id,
      userId: lecturer.userId,
      name: lecturer.name,
      identifier: lecturer.nidn,
      applicantRole: 'Dosen',
      applicantKind: 'lecturer',
      status: lecturer.employmentStatus || 'fulltime',
      faculty: lecturer.faculty,
      program: lecturer.program,
      email: user.email,
    };
  }
  return {
    id: user.profileId || user.id,
    userId: user.id,
    name: user.name,
    identifier: user.identifier || '-',
    applicantRole: user.applicantType || 'User',
    applicantKind: user.applicantType || 'guest',
    status: 'active',
    faculty: '-',
    program: '-',
    email: user.email,
  };
};

export const createApplicantRecord = (user, data) => {
  const profile = getApplicantProfile(user, data);
  return {
    id: `${profile.id}-applicant-${Date.now()}`,
    userId: profile.userId,
    name: profile.name,
    identifier: profile.identifier,
    applicantRole: profile.applicantRole,
    applicantKind: profile.applicantKind,
    status: profile.status,
    faculty: profile.faculty,
    program: profile.program,
    email: profile.email,
    isPrimary: true,
  };
};

export const createLetterDraft = (type, user, data, uid) => {
  const now = new Date().toISOString();
  const letterType = type || LETTER_TYPE.RESEARCH_ASSIGNMENT;
  const firstPurpose = (LETTER_PURPOSES[letterType] || [])[0];
  const id = uid('letter');
  const applicant = createApplicantRecord(user, data);
  return {
    id,
    userId: user.id,
    createdBy: user.id,
    researchId: '',
    type: letterType,
    purpose: firstPurpose ? firstPurpose.value : '',
    status: LETTER_STATUS.DRAFT,
    applicant,
    applicants: [applicant],
    form: {},
    attachments: [],
    prechecks: [],
    reviews: [],
    history: [{ status: LETTER_STATUS.DRAFT, note: 'Draft surat dibuat.', at: now, by: user.id }],
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
  };
};

const findResearch = (data, researchId) => (data.drafts || []).find(item => item.id === researchId);
const findScheme = (data, schemeId) => (data.schemes || []).find(item => item.id === schemeId);

export const getLetterResearch = (letter, data) => findResearch(data, letter && letter.researchId);

export const getLetterResearchTitle = (letter, data) => {
  const research = getLetterResearch(letter, data);
  return (research && research.project && research.project.title) || (letter && letter.autoFill && letter.autoFill.researchTitle) || 'Tidak terkait penelitian';
};

export const buildLetterAutoFill = (research, data, applicant) => {
  const scheme = findScheme(data, research && research.schemeId);
  const leader = ((research && research.members) || []).find(member => member.role === 'ketua') || {};
  return {
    applicantName: applicant.name || '-',
    applicantIdentifier: applicant.identifier || '-',
    applicantEmail: applicant.email || '-',
    studyProgram: applicant.program || '-',
    faculty: applicant.faculty || '-',
    researchTitle: (research && research.project && research.project.title) || '-',
    researchYear: (scheme && scheme.year) || new Date().getFullYear(),
    researchScheme: (scheme && scheme.name) || '-',
    researchRole: research ? (leader.name === applicant.name ? 'Ketua Penelitian' : 'Anggota Penelitian') : '-',
  };
};

export const createLetterRequest = ({ researchId, type, purpose, customName }, user, data, uid) => {
  const now = new Date().toISOString();
  const research = findResearch(data, researchId);
  const applicant = createApplicantRecord(user, data);
  const id = uid('letter');
  return {
    id,
    userId: user.id,
    createdBy: user.id,
    researchId,
    type,
    purpose: type === LETTER_TYPE.CUSTOM ? '' : purpose,
    customName: type === LETTER_TYPE.CUSTOM ? String(customName || '').trim() : '',
    status: LETTER_STATUS.SUBMITTED,
    applicant,
    applicants: [applicant],
    autoFill: buildLetterAutoFill(research, data, applicant),
    template: null,
    templateFields: [],
    form: {},
    attachments: [],
    reviews: [],
    history: [{ status: LETTER_STATUS.SUBMITTED, note: 'Permintaan pembuatan surat dikirim untuk diverifikasi.', at: now, by: user.id }],
    createdAt: now,
    updatedAt: now,
    submittedAt: now,
  };
};

export const getDefaultLetterTemplate = letter => {
  const purpose = getLetterPurposeMeta(letter.type, letter.purpose).label;
  const name = letter.customName || purpose || getLetterTypeMeta(letter.type).label;
  return {
    name: `Template ${name}`,
    content: [
      'RESEARCH INNOVATION AND SUSTAINABILITY',
      'UNIVERSITAS MULTIMEDIA NUSANTARA',
      '',
      'Nomor: {{letterNumber}}',
      `Perihal: ${name}`,
      '',
      'Yang bertanda tangan di bawah ini menerangkan bahwa:',
      'Nama: {{applicantName}}',
      'NIDN/NIP: {{applicantIdentifier}}',
      'Program Studi: {{studyProgram}}',
      '',
      'terkait pelaksanaan penelitian "{{researchTitle}}" pada skema {{researchScheme}} tahun {{researchYear}}.',
      '',
      '{{customFields}}',
      '',
      'Demikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.',
    ].join('\n'),
  };
};

export const createLetterFieldKey = (label, existingFields = []) => {
  const base = String(label || 'field')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'field';
  let key = base;
  let suffix = 2;
  const existingKeys = new Set(existingFields.map(field => field.key));
  while (existingKeys.has(key)) {
    key = `${base}_${suffix}`;
    suffix += 1;
  }
  return key;
};

export const validateLetterTemplateFields = fields => {
  const errors = [];
  const keys = new Set();
  const reserved = ['__proto__', 'constructor', 'prototype', 'letterNumber', 'letterDate', 'letterPlace', 'signerName', 'signerTitle', 'letterType', 'letterPurpose', 'requestId', 'customFields', 'customLetterTitle', 'applicantName', 'applicantIdentifier', 'applicantEmail', 'applicantRole', 'studyProgram', 'faculty'];
  (fields || []).forEach((field, index) => {
    if (!String(field.label || '').trim()) errors.push(`Nama field ke-${index + 1} wajib diisi.`);
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.key || '') || keys.has(field.key) || reserved.includes(field.key)) errors.push(`Kunci isian ke-${index + 1} tidak valid atau berulang.`);
    keys.add(field.key);
    if (!LETTER_FORM_FIELD_TYPES.some(type => type.value === field.type)) errors.push(`Jenis isian ke-${index + 1} tidak didukung.`);
    if (field.type === 'select' && !(field.options || []).filter(Boolean).length) errors.push(`Pilihan untuk field "${field.label || index + 1}" wajib diisi.`);
  });
  return errors;
};

export const validateLetterApplicantData = letter => (letter.templateFields || []).reduce((errors, field) => {
  const value = (letter.form || {})[field.key];
  if (field.required && !hasValue(value)) errors.push(`${field.label} wajib diisi.`);
  if (hasValue(value)) {
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) errors.push(`${field.label} harus berupa alamat email yang valid.`);
    if (field.type === 'number' && !Number.isFinite(Number(value))) errors.push(`${field.label} harus berupa angka.`);
    if (field.type === 'select' && !(field.options || []).some(option => String(option.value || option) === String(value))) errors.push(`${field.label} harus sesuai pilihan yang tersedia.`);
    if (['date', 'datetime-local'].includes(field.type) && (!/^\d{4}-\d{2}-\d{2}/.test(String(value)) || Number.isNaN(Date.parse(value)))) errors.push(`${field.label} harus berupa tanggal yang valid.`);
  }
  return errors;
}, []);

export const getLetterTitle = letter => {
  if (!letter) return '-';
  const form = letter.form || {};
  const purpose = getLetterPurposeMeta(letter.type, letter.purpose).label;
  return letter.definitionName || letter.customName || form.researchTitle || form.title || form.activityName || form.eventName || form.research_title || (purpose !== '-' ? purpose : getLetterTypeMeta(letter.type).label);
};

export const LETTER_FIELD_LABELS = {
  relatedResearchId: 'Penelitian Terkait',
  researchTitle: 'Judul Penelitian',
  researchYear: 'Tahun Penelitian',
  researchDuration: 'Durasi Penelitian',
  researchStartMonth: 'Bulan Mulai Penelitian',
  researchEndMonth: 'Bulan Selesai Penelitian',
  researchLocation: 'Lokasi Penelitian',
  researchRole: 'Peran dalam Penelitian',
  researchTeam: 'Tim Penelitian',
  partnerName: 'Nama Mitra',
  partnerInstitution: 'Institusi Mitra',
  partnerCountry: 'Negara Mitra',
  partnerOrigin: 'Asal Mitra',
  partnerScale: 'Skala Mitra',
  programName: 'Nama Program Hibah',
  programUrl: 'Tautan Program Hibah',
  researchScheme: 'Skema Penelitian',
  title: 'Judul',
  publicationName: 'Jurnal, Prosiding, atau Penerbit',
  category: 'Kategori',
  indexing: 'Indeks, ISBN, atau ISSN',
  url: 'Tautan Publikasi',
  publicationRole: 'Peran Publikasi',
  authorPosition: 'Posisi Penulis',
  publicationStatus: 'Status Publikasi',
  eventName: 'Nama Seminar',
  eventCategory: 'Kategori Seminar',
  eventLocation: 'Lokasi Seminar',
  eventOrganizer: 'Penyelenggara Seminar',
  role: 'Peran',
  outputType: 'Jenis Karya',
  location: 'Lokasi atau Publikasi Karya',
  organizer: 'Penyelenggara',
  recipientName: 'Nama Penerima Surat',
  recipientPosition: 'Jabatan Penerima',
  eventDatetime: 'Tanggal dan Waktu Kegiatan',
  activityName: 'Nama Kegiatan',
  activityPurpose: 'Tujuan Kegiatan',
  recipientInstitution: 'Instansi Tujuan',
  activityStartDate: 'Tanggal Mulai Kegiatan',
  activityEndDate: 'Tanggal Selesai Kegiatan',
  researchObject: 'Objek Penelitian',
  customContent: 'Isi Surat Kustom',
  travelSchedule: 'Jadwal Perjalanan',
  ethicsCategory: 'Kategori Klirens Etik',
  ethicsResearchType: 'Jenis Penelitian Etik',
  ethicsResearchTitle: 'Judul Penelitian Etik',
  ethicsRiskCategory: 'Kategori Risiko',
  extensionReason: 'Alasan Perpanjangan',
  researchStartDate: 'Tanggal Mulai Riset',
  previousClearanceId: 'Klirens Sebelumnya',
  previousClearanceNumber: 'Nomor Klirens Sebelumnya',
  expiryDate: 'Tanggal Kedaluwarsa',
  travelDestination: 'Tujuan Perjalanan',
  departureDate: 'Tanggal Berangkat',
  returnDate: 'Tanggal Kembali',
  transportMode: 'Moda Transportasi',
  fundingSource: 'Sumber Dana',
};

const FIELD_VALUE_LABELS = {
  researchRole: { leader: 'Ketua', member: 'Anggota', speaker: 'Narasumber' },
  publicationRole: { author: 'Author', co_author: 'Co-author', corresponding_author: 'Corresponding Author' },
  publicationStatus: { draft: 'Draft', submitted: 'Submitted', accepted: 'Accepted', published: 'Published' },
  partnerOrigin: { local: 'Lokal', national: 'Nasional', international: 'Internasional' },
  partnerScale: { umkm: 'UMKM', enterprise: 'Enterprise', government: 'Pemerintah' },
  transportMode: { airplane: 'Pesawat', train: 'Kereta', car: 'Mobil', other: 'Lainnya' },
};

export const getLetterFieldLabel = key => LETTER_FIELD_LABELS[key]
  || String(key || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, character => character.toUpperCase());

export const formatLetterFieldValue = (key, value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ');
  const mapped = FIELD_VALUE_LABELS[key] && FIELD_VALUE_LABELS[key][value];
  if (mapped) return mapped;
  if (['eventDatetime', 'researchStartDate', 'expiryDate', 'departureDate', 'returnDate'].includes(key)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString('id-ID', key === 'eventDatetime' ? { dateStyle: 'long', timeStyle: 'short' } : { dateStyle: 'long' });
  }
  return String(value);
};

export const getLetterFormRows = (form = {}, excludedKeys = []) => Object.keys(form)
  .filter(key => form[key] !== null && form[key] !== undefined && form[key] !== '' && !excludedKeys.includes(key))
  .filter(key => !['relatedResearchId', 'previousClearanceId', 'researchStartMonth', 'researchEndMonth'].includes(key))
  .map(key => [getLetterFieldLabel(key), formatLetterFieldValue(key, form[key])]);

export const updateLetterHistory = (letter, status, note, user) => ({
  ...letter,
  status,
  history: [
    ...(letter.history || []),
    {
      status,
      note,
      at: new Date().toISOString(),
      by: user ? user.id : null,
    },
  ],
  updatedAt: new Date().toISOString(),
});

const hasValue = value => value !== null && value !== undefined && String(value).trim() !== '';
const fieldError = (field, message) => ({ field, message });

export const requiredFieldsForLetter = letter => {
  const type = letter.type;
  const purpose = letter.purpose;
  const required = [];

  if (!purpose) required.push(['purpose', 'Kepentingan surat wajib dipilih.']);

  if (type === LETTER_TYPE.RESEARCH_ASSIGNMENT && isResearchPurpose(purpose)) {
    required.push(
      ['researchTitle', 'Judul penelitian wajib diisi.'],
      ['researchYear', 'Tahun penelitian wajib diisi.'],
      ['researchDuration', 'Durasi penelitian wajib diisi.'],
      ['researchLocation', 'Lokasi penelitian wajib diisi.'],
      ['researchRole', 'Peran dalam penelitian wajib diisi.'],
      ['researchTeam', 'Tim penelitian wajib diisi.'],
    );
    if (isCollaborationPurpose(purpose)) required.push(['partnerName', 'Nama mitra wajib diisi.'], ['partnerInstitution', 'Institusi mitra wajib diisi.']);
    if (purpose === 'international_university_collaboration') required.push(['partnerCountry', 'Negara mitra wajib diisi.']);
    if (isGrantPurpose(purpose)) required.push(['programName', 'Nama program hibah wajib diisi.'], ['researchScheme', 'Skema/program penelitian wajib diisi.']);
    if (purpose === 'industry_research') required.push(['partnerName', 'Nama mitra industri wajib diisi.'], ['partnerOrigin', 'Asal mitra wajib diisi.'], ['partnerScale', 'Skala mitra wajib diisi.']);
  }

  if (type === LETTER_TYPE.RESEARCH_ASSIGNMENT && isPublicationPurpose(purpose)) {
    required.push(
      ['title', 'Judul publikasi wajib diisi.'],
      ['publicationName', 'Nama jurnal/prosiding/penerbit wajib diisi.'],
      ['category', 'Kategori publikasi wajib diisi.'],
      ['publicationRole', 'Peran publikasi wajib diisi.'],
      ['publicationStatus', 'Status publikasi wajib diisi.'],
    );
  }

  if (type === LETTER_TYPE.RESEARCH_ASSIGNMENT && purpose === 'scientific_seminar') {
    required.push(['eventName', 'Nama seminar wajib diisi.'], ['eventCategory', 'Kategori seminar wajib diisi.'], ['eventLocation', 'Lokasi seminar wajib diisi.'], ['eventOrganizer', 'Penyelenggara wajib diisi.'], ['role', 'Peran wajib diisi.']);
  }

  if (type === LETTER_TYPE.RESEARCH_ASSIGNMENT && purpose === 'artwork') {
    required.push(['outputType', 'Jenis karya wajib diisi.'], ['title', 'Judul karya wajib diisi.'], ['location', 'Lokasi/publikasi karya wajib diisi.'], ['organizer', 'Penyelenggara wajib diisi.']);
  }

  if (type === LETTER_TYPE.SUPPORT) {
    required.push(['recipientName', 'Nama penerima surat wajib diisi.'], ['recipientPosition', 'Jabatan penerima wajib diisi.'], ['eventDatetime', 'Waktu kegiatan wajib diisi.'], ['activityName', 'Nama kegiatan wajib diisi.'], ['activityPurpose', 'Tujuan kegiatan wajib diisi.']);
  }

  if (type === LETTER_TYPE.ETHICS) {
    required.push(['researchTitle', 'Judul riset wajib diisi.'], ['researchStartDate', 'Tanggal mulai riset wajib diisi.']);
    if (purpose === 'extension') required.push(['previousClearanceId', 'Klirens etik sebelumnya wajib dipilih.'], ['previousClearanceNumber', 'Nomor klirens sebelumnya wajib diisi.'], ['expiryDate', 'Tanggal kedaluwarsa klirens sebelumnya wajib diisi.']);
  }

  if (type === LETTER_TYPE.TRAVEL) {
    required.push(['activityName', 'Nama kegiatan wajib diisi.'], ['travelDestination', 'Tujuan perjalanan wajib diisi.'], ['departureDate', 'Tanggal berangkat wajib diisi.'], ['returnDate', 'Tanggal kembali wajib diisi.'], ['transportMode', 'Moda transportasi wajib diisi.'], ['activityPurpose', 'Tujuan perjalanan wajib diisi.']);
  }

  return required;
};

export const requiredAttachmentTypes = letter => {
  const type = letter.type;
  const purpose = letter.purpose;
  const form = letter.form || {};
  const files = [];

  if (type === LETTER_TYPE.RESEARCH_ASSIGNMENT && isResearchPurpose(purpose)) files.push('proposal');
  if (type === LETTER_TYPE.RESEARCH_ASSIGNMENT && isCollaborationPurpose(purpose)) files.push('mou');
  if (type === LETTER_TYPE.RESEARCH_ASSIGNMENT && purpose === 'industry_research') files.push('contract');
  if (type === LETTER_TYPE.RESEARCH_ASSIGNMENT && isPublicationPurpose(purpose)) files.push('article');
  if (type === LETTER_TYPE.RESEARCH_ASSIGNMENT && isPublicationPurpose(purpose) && ['submitted', 'accepted', 'published'].includes(form.publicationStatus)) files.push('publication_submission_evidence');
  if (type === LETTER_TYPE.RESEARCH_ASSIGNMENT && purpose === 'scientific_seminar') files.push('invitation');
  if (type === LETTER_TYPE.RESEARCH_ASSIGNMENT && purpose === 'artwork') files.push('supporting_document');
  if (type === LETTER_TYPE.SUPPORT) files.push('supporting_document');
  if (type === LETTER_TYPE.ETHICS) files.push('ethics_form');
  if (type === LETTER_TYPE.ETHICS && purpose === 'extension') files.push('previous_clearance');
  if (type === LETTER_TYPE.TRAVEL) files.push('invitation', 'travel_schedule');

  return [...new Set(files)];
};

const attachmentFor = (letter, type) => (letter.attachments || []).find(item => item.fileType === type || item.category === type);

export const validateLetterStructure = letter => {
  const errors = [];
  const form = letter.form || {};
  requiredFieldsForLetter(letter).forEach(([field, message]) => {
    if (field === 'purpose') {
      if (!hasValue(letter.purpose)) errors.push(fieldError(field, message));
      return;
    }
    if (!hasValue(form[field])) errors.push(fieldError(field, message));
  });

  requiredAttachmentTypes(letter).forEach(type => {
    if (!attachmentFor(letter, type)) errors.push(fieldError(`file:${type}`, `${fileTypeLabel(type)} wajib diupload.`));
  });

  return errors;
};

export const validateLetterConsistency = (letter, data) => {
  const errors = [];
  const form = letter.form || {};
  if (form.researchStartMonth && form.researchEndMonth && form.researchEndMonth < form.researchStartMonth) {
    errors.push(fieldError('researchEndMonth', 'Bulan selesai penelitian tidak boleh lebih awal dari bulan mulai.'));
  }
  if (letter.type === LETTER_TYPE.TRAVEL && form.departureDate && form.returnDate && new Date(form.returnDate) < new Date(form.departureDate)) {
    errors.push(fieldError('returnDate', 'Tanggal kembali tidak boleh lebih awal dari tanggal berangkat.'));
  }
  if (letter.type === LETTER_TYPE.ETHICS && letter.purpose === 'extension') {
    const clearances = data.previousEthicsClearances || [];
    if (form.previousClearanceId && !clearances.some(item => item.id === form.previousClearanceId && item.userId === letter.userId)) {
      errors.push(fieldError('previousClearanceId', 'Klirens etik sebelumnya tidak ditemukan atau bukan milik pengguna aktif.'));
    }
  }
  return errors;
};

export const validateLetterFiles = letter => {
  const errors = [];
  (letter.attachments || []).forEach(file => {
    const name = file.name || file.fileName || '';
    const validation = validateFile(file, { allowedExtensions: ALLOWED_FILE_EXTENSIONS, maxSize: MAX_FILE_SIZE });
    if (!validation.valid) errors.push(fieldError(`file:${file.fileType}`, `${name}: ${validation.message}`));
  });
  return errors;
};

export const runLetterPrecheck = (letter, data) => {
  const errors = [
    ...validateLetterStructure(letter),
    ...validateLetterConsistency(letter, data),
    ...validateLetterFiles(letter),
  ];
  return {
    passed: errors.length === 0,
    errors,
    checkedAt: new Date().toISOString(),
  };
};

export const fileTypeLabel = type => {
  const found = FILE_TYPES.find(item => item.value === type);
  return found ? found.label : type;
};

export const getRequiredAttachmentSummary = letter => requiredAttachmentTypes(letter).map(fileTypeLabel).join(', ') || '-';

export const getLettersOwnedByUser = (data, user) => (data.letterRequests || []).filter(letter => isLetterOwner(letter, user));

export const getActiveLettersForUser = (data, user) => (data.letterRequests || []).filter(letter => {
  if (canManageLetters(user)) return true;
  return letter.userId === user.id || letter.createdBy === user.id;
});

export const getAdminLetterQueue = data => (data.letterRequests || []).filter(letter => [
  LETTER_STATUS.SUBMITTED,
  LETTER_STATUS.FORM_DESIGN,
  LETTER_STATUS.PRECHECKED,
  LETTER_STATUS.DATA_SUBMITTED,
  LETTER_STATUS.APPROVED,
].includes(letterStatus(letter)));

export const getRelatedResearchOptions = (data, user) => (data.drafts || [])
  .filter(draft => ['funded', 'approved'].includes(draft.status) && (!user || draft.userId === user.id))
  .map(draft => ({ value: draft.research && draft.research.researchId ? draft.research.researchId : draft.id, label: draft.project ? draft.project.title : draft.id }));

export const generateLetterNumber = (letter, sequence) => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const typeCode = {
    [LETTER_TYPE.RESEARCH_ASSIGNMENT]: 'ST-RIS',
    [LETTER_TYPE.SUPPORT]: 'SP-RIS',
    [LETTER_TYPE.ETHICS]: 'KE-RIS',
    [LETTER_TYPE.TRAVEL]: 'SPD-RIS',
    [LETTER_TYPE.CUSTOM]: 'SK-RIS',
  }[letter.type] || 'RIS';
  return `${String(sequence || 1).padStart(4, '0')}/${typeCode}/LPPM/${month}/${year}`;
};

export const renderLetterPlainText = letter => {
  if (letter.template && letter.template.content) {
    const letterNumber = letter.generated && letter.generated.letterNumber ? letter.generated.letterNumber : '(belum diterbitkan)';
    const values = {
      ...(letter.autoFill || {}),
      ...(letter.form || {}),
      letterNumber,
      letterType: getLetterTypeMeta(letter.type).label,
      letterPurpose: letter.definitionName || letter.customName || getLetterPurposeMeta(letter.type, letter.purpose).label,
      requestId: letter.id,
    };
    const customFields = (letter.templateFields || [])
      .map(field => `${field.label}: ${formatLetterFieldValue(field.key, values[field.key])}`)
      .join('\n');
    return String(letter.template.content)
      .replace(/{{\s*customFields\s*}}/g, customFields || '-')
      .replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => formatLetterFieldValue(key, values[key]));
  }
  const type = getLetterTypeMeta(letter.type).label;
  const purpose = getLetterPurposeMeta(letter.type, letter.purpose).label;
  const applicant = letter.applicant || {};
  const form = letter.form || {};
  return [
    'RESEARCH INNOVATION AND SUSTAINABILITY',
    'UNIVERSITAS MULTIMEDIA NUSANTARA',
    '',
    `Nomor: ${letter.generated && letter.generated.letterNumber ? letter.generated.letterNumber : '(belum diterbitkan)'}`,
    `Jenis Surat: ${type}`,
    `Kepentingan: ${purpose}`,
    '',
    'Identitas Pemohon',
    `Nama: ${applicant.name || '-'}`,
    `NIK/NIDN/NIM: ${applicant.identifier || '-'}`,
    `Status: ${applicant.applicantRole || '-'}`,
    `Program Studi: ${applicant.program || '-'}`,
    `Fakultas: ${applicant.faculty || '-'}`,
    '',
    'Isi Surat',
    `Judul/Kegiatan: ${getLetterTitle(letter)}`,
    `Tujuan: ${form.activityPurpose || form.researchPurpose || form.researchRole || '-'}`,
    `Mitra/Penerima: ${form.partnerName || form.recipientName || form.eventOrganizer || '-'}`,
    '',
    'Catatan',
    'Dokumen ini merupakan pratinjau surat yang dihasilkan oleh RIS.',
  ].join('\n');
};
