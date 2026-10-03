/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import {
  canManageResearch, hasFullAccess, isResearcher
} from '../../../shared/workflows/workflow';
import { canTransition, transitionEntity } from '../../../core/domainState';
import { validateFile } from '../../../shared/workflows/fileValidation';

export const EXTERNAL_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  REVISION_REQUESTED: 'revision_requested',
  VALIDATED: 'validated',
  ARCHIVED: 'archived',
};

export const EXTERNAL_STATUS_TRANSITIONS = {
  [EXTERNAL_STATUS.DRAFT]: [EXTERNAL_STATUS.SUBMITTED],
  [EXTERNAL_STATUS.SUBMITTED]: [EXTERNAL_STATUS.UNDER_REVIEW],
  [EXTERNAL_STATUS.UNDER_REVIEW]: [EXTERNAL_STATUS.REVISION_REQUESTED, EXTERNAL_STATUS.VALIDATED],
  [EXTERNAL_STATUS.REVISION_REQUESTED]: [EXTERNAL_STATUS.SUBMITTED],
  [EXTERNAL_STATUS.VALIDATED]: [EXTERNAL_STATUS.ARCHIVED],
  [EXTERNAL_STATUS.ARCHIVED]: [],
};

export const EXTERNAL_STATUS_META = {
  [EXTERNAL_STATUS.DRAFT]: { label: 'Draf', tone: 'gray' },
  [EXTERNAL_STATUS.SUBMITTED]: { label: 'Diajukan', tone: 'cyan' },
  [EXTERNAL_STATUS.UNDER_REVIEW]: { label: 'Sedang Ditinjau', tone: 'blue' },
  [EXTERNAL_STATUS.REVISION_REQUESTED]: { label: 'Perlu Revisi', tone: 'orange' },
  [EXTERNAL_STATUS.VALIDATED]: { label: 'Tervalidasi', tone: 'green' },
  [EXTERNAL_STATUS.ARCHIVED]: { label: 'Diarsipkan', tone: 'purple' },
};

export const ACTIVITY_STATUS_OPTIONS = [
  { value: 'planned', label: 'Direncanakan' },
  { value: 'ongoing', label: 'Sedang Berjalan' },
  { value: 'completed', label: 'Selesai' },
];

export const ACTIVITY_TYPE_OPTIONS = [
  { value: 'external', label: 'Eksternal' },
  { value: 'mandiri', label: 'Mandiri' },
];

export const RIP_OPTIONS = [
  'ICT-Based',
  'Business, Digital Behavior & Technopreneurship',
  'Digital Content & Digital Media Management',
  'Design, Product & Multimedia for Industry',
].map(item => ({ value: item, label: item }));

export const RESEARCH_CATEGORY_OPTIONS = [
  { value: 'grant', label: 'Hibah', description: 'Hibah penelitian nasional atau internasional.', icon: 'document' },
  { value: 'partner', label: 'Kolaborasi Mitra', description: 'Kerja sama penelitian dengan mitra non-perguruan tinggi.', icon: 'layers' },
  { value: 'university', label: 'Kolaborasi Universitas', description: 'Kerja sama dengan universitas dalam atau luar negeri.', icon: 'dashboard' },
  { value: 'independent', label: 'Penelitian Mandiri', description: 'Penelitian mandiri, PRO-STEP, atau kerja sama mandiri.', icon: 'report' },
];

export const GRANT_TYPE_OPTIONS = [
  { value: 'nasional', label: 'Nasional' },
  { value: 'internasional', label: 'Internasional' },
];

export const INDEPENDENT_TYPE_OPTIONS = [
  { value: 'mandiri', label: 'Mandiri' },
  { value: 'prostep', label: 'PRO-STEP' },
  { value: 'kerjasama_dn', label: 'Kerja Sama Dalam Negeri' },
  { value: 'kerjasama_ln', label: 'Kerja Sama Luar Negeri' },
];

export const OUTPUT_TYPE_OPTIONS = [
  { value: 'journal', label: 'Jurnal' },
  { value: 'prototype', label: 'Prototipe' },
  { value: 'proceeding', label: 'Prosiding' },
  { value: 'hki', label: 'HKI' },
  { value: 'book', label: 'Buku' },
];

export const EXTERNAL_DOCUMENT_TYPES = [
  { value: 'report', label: 'Laporan' },
  { value: 'additional', label: 'Lampiran Tambahan' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'budget_plan', label: 'Rencana Anggaran Biaya (RAB)' },
  { value: 'contract', label: 'Kontrak' },
  { value: 'mou', label: 'MoU / MoA' },
  { value: 'collaboration_proof', label: 'Bukti Kolaborasi' },
  { value: 'student_involvement', label: 'Keterlibatan Mahasiswa' },
  { value: 'final_report', label: 'Laporan Akhir' },
  { value: 'integration_proof', label: 'Bukti Integrasi' },
  { value: 'other', label: 'Dokumen Pendukung Lain' },
];

export const ALLOWED_EXTERNAL_FILE_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'pptx'];
export const MAX_EXTERNAL_FILE_SIZE = 15 * 1024 * 1024;

const hasValue = value => value !== null && value !== undefined && String(value).trim() !== '';
const numberValue = value => Number(value || 0);
const fieldError = (field, message) => ({ field, message });

export const isExternalReporter = user => isResearcher(user);
export const externalStatus = report => (report && report.submissionStatus) || EXTERNAL_STATUS.DRAFT;
export const canTransitionExternalStatus = (report, nextStatus) => canTransition(EXTERNAL_STATUS_TRANSITIONS, externalStatus(report), nextStatus);
export const transitionExternalStatus = (report, nextStatus, changes = {}) => transitionEntity({
  entity: report,
  currentStatus: externalStatus(report),
  nextStatus,
  transitions: EXTERNAL_STATUS_TRANSITIONS,
  statusFields: ['submissionStatus'],
  changes,
});
export const externalStatusMeta = report => EXTERNAL_STATUS_META[externalStatus(report)] || EXTERNAL_STATUS_META[EXTERNAL_STATUS.DRAFT];
export const getCategoryMeta = category => RESEARCH_CATEGORY_OPTIONS.find(item => item.value === category) || RESEARCH_CATEGORY_OPTIONS[0];
export const getOutputTypeLabel = value => (OUTPUT_TYPE_OPTIONS.find(item => item.value === value) || {}).label || value || '-';
export const getDocumentTypeLabel = value => (EXTERNAL_DOCUMENT_TYPES.find(item => item.value === value) || {}).label || value || '-';
export const getExternalDocumentLabel = document => (document && document.label) || getDocumentTypeLabel(document && document.fileType);

const EXTERNAL_DETAIL_FIELD_LABELS = {
  grantType: 'Jenis Hibah',
  grantName: 'Nama Hibah',
  grantLink: 'Tautan Hibah',
  researchStatus: 'Status Penelitian',
  partnerName: 'Nama Mitra',
  partnerRepresentative: 'Perwakilan Mitra',
  partnerOrigin: 'Asal Mitra',
  partnerUniversity: 'Universitas Mitra',
  mouStatus: 'Status MoU',
  independentType: 'Jenis Penelitian Mandiri',
};

const EXTERNAL_DETAIL_VALUE_LABELS = {
  researchStatus: { awarded: 'Pendanaan Diberikan', running: 'Sedang Berjalan', completed: 'Selesai' },
  partnerOrigin: { local: 'Lokal', national: 'Nasional', international: 'Internasional' },
  mouStatus: { yes: 'Tersedia', no: 'Belum Tersedia' },
};

export const getExternalTypeDetailRows = detail => Object.entries(detail || {}).filter(([key]) => key !== 'fundingAmount').map(([key, value]) => [
  EXTERNAL_DETAIL_FIELD_LABELS[key] || String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, character => character.toUpperCase()),
  (EXTERNAL_DETAIL_VALUE_LABELS[key] && EXTERNAL_DETAIL_VALUE_LABELS[key][value]) || String(value || '-'),
]);

export const canCreateExternalReport = user => Boolean(user) && isExternalReporter(user);
export const canViewExternalReport = (report, user) => {
  if (!report || !user) return false;
  if (canManageResearch(user)) return true;
  return report.userId === user.id || report.createdBy === user.id;
};
export const canEditExternalReport = (report, user) => canViewExternalReport(report, user)
  && (isExternalReporter(user) || hasFullAccess(user))
  && [EXTERNAL_STATUS.DRAFT, EXTERNAL_STATUS.REVISION_REQUESTED].includes(externalStatus(report));
export const canDeleteExternalReport = (report, user) => canViewExternalReport(report, user)
  && (canManageResearch(user)
    || (isExternalReporter(user)
      && [EXTERNAL_STATUS.DRAFT, EXTERNAL_STATUS.REVISION_REQUESTED].includes(externalStatus(report))));
export const canSubmitExternalReport = (report, user) => canEditExternalReport(report, user);
export const canAdminReviewExternalReport = (report, user) => canManageResearch(user)
  && [EXTERNAL_STATUS.SUBMITTED, EXTERNAL_STATUS.UNDER_REVIEW].includes(externalStatus(report));
export const canArchiveExternalReport = (report, user) => canManageResearch(user) && externalStatus(report) === EXTERNAL_STATUS.VALIDATED;

export const createExternalReportDraft = (user, uid) => {
  const now = new Date().toISOString();
  return {
    id: uid('external-report'),
    userId: user.id,
    createdBy: user.id,
    activityName: '',
    researchTitle: '',
    activityYear: new Date().getFullYear(),
    activityStatus: 'planned',
    activityType: 'external',
    roleInResearch: 'ketua',
    teamMembers: [],
    organizerOrigin: '',
    fundingSource: '',
    fundingAmount: '',
    currency: 'IDR',
    submissionStatus: EXTERNAL_STATUS.DRAFT,
    category: 'grant',
    metadata: {
      ripRelation: '',
      tktTarget: 1,
      sdgInvolvement: false,
      sdgs: [],
      integrationToTeaching: false,
      courseName: '',
      academicYear: '',
      integrationProofFile: null,
    },
    typeDetail: {},
    documents: [],
    outputs: [],
    reviews: [],
    history: [{ status: EXTERNAL_STATUS.DRAFT, note: 'Draft laporan penelitian eksternal/mandiri dibuat.', at: now, by: user.id }],
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    validatedAt: null,
    archivedAt: null,
  };
};

export const addExternalHistory = (report, status, note, user) => ({
  ...report,
  submissionStatus: status,
  history: [
    ...(report.history || []),
    { status, note, at: new Date().toISOString(), by: user ? user.id : null },
  ],
  updatedAt: new Date().toISOString(),
});

export const externalReportTitle = report => (report && (report.researchTitle || report.activityName)) || 'Laporan Penelitian Eksternal';

export const getRequiredDocumentTypes = () => ['report'];

export const makeExternalTeamMember = (uid, role = 'anggota') => ({
  id: uid('external-member'), role, type: 'external_lecturer', profileId: '', name: '', nidn: '', nim: '', program: '', faculty: '', orcid: '',
});

export const resizeExternalTeam = (members, count, uid) => {
  const size = Number(count);
  if (!Number.isInteger(size) || size < 0 || size > 30) return members || [];
  const current = members || [];
  const resized = size <= current.length ? current.slice(0, size) : [...current, ...Array.from({ length: size - current.length }, (_, index) => makeExternalTeamMember(uid, current.length === 0 && index === 0 ? 'ketua' : 'anggota'))];
  return resized.map((member, index) => ({ ...member, role: member.role || (index === 0 ? 'ketua' : 'anggota') }));
};

export const validateExternalReport = (report, data, user, options = {}) => {
  const errors = [];
  const basic = [
    ['activityName', 'Nama aktivitas wajib diisi.'],
    ['researchTitle', 'Judul penelitian wajib diisi.'],
    ['activityYear', 'Tahun aktivitas wajib diisi.'],
    ['activityStatus', 'Status penelitian wajib dipilih.'],
    ['activityType', 'Tipe aktivitas wajib dipilih.'],
    ['organizerOrigin', 'Asal penyelenggara/mitra wajib diisi.'],
    ['fundingSource', 'Sumber pendanaan wajib diisi.'],
    ['currency', 'Mata uang wajib diisi.'],
  ];

  basic.forEach(([field, message]) => {
    if (!hasValue(report[field])) errors.push(fieldError(field, message));
  });

  const year = Number(report.activityYear);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.push(fieldError('activityYear', 'Tahun aktivitas harus angka valid.'));
  if (numberValue(report.fundingAmount) < 0) errors.push(fieldError('fundingAmount', 'Nominal pendanaan tidak boleh negatif.'));
  if (!['planned', 'ongoing', 'completed'].includes(report.activityStatus)) errors.push(fieldError('activityStatus', 'Status aktivitas hanya dapat berupa direncanakan, sedang berjalan, atau selesai.'));
  if (!['external', 'mandiri'].includes(report.activityType)) errors.push(fieldError('activityType', 'Tipe aktivitas hanya external atau mandiri.'));

  (report.teamMembers || []).forEach((member, index) => {
    if (!['ketua', 'anggota'].includes(member.role)) errors.push(fieldError(`teamMembers.${index}.role`, `Peran anggota ${index + 1} wajib dipilih.`));
    if (!hasValue(member.name)) errors.push(fieldError(`teamMembers.${index}.name`, `Nama anggota ${index + 1} wajib diisi.`));
    if (!hasValue(member.type) || !['internal_lecturer', 'external_lecturer', 'student'].includes(member.type)) errors.push(fieldError(`teamMembers.${index}.type`, `Tipe anggota ${index + 1} tidak valid.`));
    if (!hasValue(member.type === 'student' ? member.nim : member.nidn)) errors.push(fieldError(`teamMembers.${index}.identifier`, `NIDN/NIM anggota ${index + 1} wajib diisi.`));
    if (!hasValue(member.program)) errors.push(fieldError(`teamMembers.${index}.program`, `Program studi anggota ${index + 1} wajib diisi.`));
    if (!hasValue(member.faculty)) errors.push(fieldError(`teamMembers.${index}.faculty`, `Fakultas anggota ${index + 1} wajib diisi.`));
  });

  const metadata = report.metadata || {};
  if (!hasValue(metadata.ripRelation)) errors.push(fieldError('metadata.ripRelation', 'Relasi RIP wajib dipilih.'));
  const tkt = Number(metadata.tktTarget);
  if (!Number.isInteger(tkt) || tkt < 1 || tkt > 9) errors.push(fieldError('metadata.tktTarget', 'TKT harus berada pada rentang 1 sampai 9.'));
  if (metadata.sdgInvolvement) {
    if (!Array.isArray(metadata.sdgs) || metadata.sdgs.length === 0) errors.push(fieldError('metadata.sdgs', 'Pilih minimal satu SDG.'));
    (metadata.sdgs || []).forEach(sdg => {
      const code = Number(sdg);
      if (!Number.isInteger(code) || code < 1 || code > 17) errors.push(fieldError('metadata.sdgs', 'Kode SDG harus berada pada rentang 1 sampai 17.'));
    });
  }
  if (metadata.integrationToTeaching) {
    if (!hasValue(metadata.courseName)) errors.push(fieldError('metadata.courseName', 'Nama mata kuliah wajib diisi jika integrasi pembelajaran aktif.'));
    if (!hasValue(metadata.academicYear)) errors.push(fieldError('metadata.academicYear', 'Tahun akademik wajib diisi jika integrasi pembelajaran aktif.'));
    if (!metadata.integrationProofFile) errors.push(fieldError('metadata.integrationProofFile', 'Bukti integrasi pembelajaran wajib diunggah.'));
  }

  const detail = report.typeDetail || {};
  if (!['grant', 'partner', 'university', 'independent'].includes(report.category)) errors.push(fieldError('category', 'Kategori penelitian wajib dipilih.'));
  if (report.category === 'grant') {
    if (!hasValue(detail.grantType)) errors.push(fieldError('typeDetail.grantType', 'Jenis hibah wajib dipilih.'));
    if (!hasValue(detail.grantName)) errors.push(fieldError('typeDetail.grantName', 'Nama hibah wajib diisi.'));
    if (!hasValue(detail.researchStatus)) errors.push(fieldError('typeDetail.researchStatus', 'Status hibah wajib diisi.'));
    if (detail.fundingAmount !== undefined && numberValue(detail.fundingAmount) < 0) errors.push(fieldError('typeDetail.fundingAmount', 'Pendanaan hibah tidak boleh negatif.'));
  }
  if (report.category === 'partner') {
    if (!hasValue(detail.partnerName)) errors.push(fieldError('typeDetail.partnerName', 'Nama mitra wajib diisi.'));
    if (!hasValue(detail.partnerRepresentative)) errors.push(fieldError('typeDetail.partnerRepresentative', 'Perwakilan mitra wajib diisi.'));
    if (!hasValue(detail.partnerOrigin)) errors.push(fieldError('typeDetail.partnerOrigin', 'Asal mitra wajib diisi.'));
  }
  if (report.category === 'university') {
    if (!hasValue(detail.partnerUniversity)) errors.push(fieldError('typeDetail.partnerUniversity', 'Nama universitas mitra wajib diisi.'));
    if (!hasValue(detail.partnerOrigin)) errors.push(fieldError('typeDetail.partnerOrigin', 'Asal universitas wajib diisi.'));
    if (!hasValue(detail.mouStatus)) errors.push(fieldError('typeDetail.mouStatus', 'Status MoU wajib dipilih.'));
  }
  if (report.category === 'independent') {
    if (!hasValue(detail.independentType)) errors.push(fieldError('typeDetail.independentType', 'Jenis penelitian mandiri wajib dipilih.'));
  }

  const documents = report.documents || [];
  const requiredDocs = getRequiredDocumentTypes(report);
  requiredDocs.forEach(type => {
    if (!documents.some(item => item.fileType === type && hasValue(item.fileUrl) && hasValue(item.name || item.fileName))) {
      errors.push(fieldError(`documents.${type}`, `${getDocumentTypeLabel(type)} wajib diunggah.`));
    }
  });
  documents.forEach(item => {
    if (item.fileType === 'additional' && !hasValue(item.label)) errors.push(fieldError(`documents.${item.id}.label`, 'Nama lampiran tambahan wajib diisi.'));
    if (item.fileType === 'additional' && (!hasValue(item.fileUrl) || !hasValue(item.name || item.fileName))) errors.push(fieldError(`documents.${item.id}.file`, `Unggah berkas untuk ${item.label || 'lampiran tambahan'}.`));
    if (!hasValue(item.name || item.fileName)) return;
    const validation = validateFile(item, { allowedExtensions: ALLOWED_EXTERNAL_FILE_EXTENSIONS, maxSize: MAX_EXTERNAL_FILE_SIZE });
    if (!validation.valid) errors.push(fieldError('documents', `${item.name || item.fileName}: ${validation.message}`));
  });

  (report.outputs || []).forEach((output, index) => {
    if (!hasValue(output.outputType)) errors.push(fieldError(`outputs.${index}.outputType`, 'Jenis luaran wajib dipilih.'));
    if (!hasValue(output.title)) errors.push(fieldError(`outputs.${index}.title`, 'Judul luaran wajib diisi.'));
    const outputYear = Number(output.year);
    if (!Number.isInteger(outputYear) || outputYear < 2000 || outputYear > 2100) errors.push(fieldError(`outputs.${index}.year`, 'Tahun luaran harus angka valid.'));
  });

  const duplicate = !options.skipDuplicate && (data.externalResearchReports || []).some(item => item.id !== report.id
    && item.userId === (report.userId || (user && user.id))
    && String(item.researchTitle || '').trim().toLowerCase() === String(report.researchTitle || '').trim().toLowerCase()
    && Number(item.activityYear) === Number(report.activityYear));
  if (duplicate) errors.push(fieldError('duplicate', 'Laporan dengan user, judul penelitian, dan tahun yang sama sudah ada.'));

  return { valid: errors.length === 0, errors };
};

export const getVisibleExternalReports = (data, user) => {
  const reports = data.externalResearchReports || [];
  if (canManageResearch(user)) return reports;
  return reports.filter(item => item.userId === (user && user.id) || item.createdBy === (user && user.id));
};

export const getAdminExternalQueue = data => (data.externalResearchReports || [])
  .filter(item => [EXTERNAL_STATUS.SUBMITTED, EXTERNAL_STATUS.UNDER_REVIEW, EXTERNAL_STATUS.REVISION_REQUESTED, EXTERNAL_STATUS.VALIDATED].includes(externalStatus(item)));

export const getExternalMetrics = reports => {
  const list = reports || [];
  const byStatus = status => list.filter(item => externalStatus(item) === status).length;
  const byType = type => list.filter(item => item.activityType === type).length;
  const byCategory = category => list.filter(item => item.category === category).length;
  const outputs = list.flatMap(item => item.outputs || []);
  const byOutput = outputType => outputs.filter(item => item.outputType === outputType).length;
  return {
    totalReports: list.length,
    draftReports: byStatus(EXTERNAL_STATUS.DRAFT),
    submittedReports: byStatus(EXTERNAL_STATUS.SUBMITTED),
    underReviewReports: byStatus(EXTERNAL_STATUS.UNDER_REVIEW),
    revisionReports: byStatus(EXTERNAL_STATUS.REVISION_REQUESTED),
    validatedReports: byStatus(EXTERNAL_STATUS.VALIDATED),
    archivedReports: byStatus(EXTERNAL_STATUS.ARCHIVED),
    externalReports: byType('external'),
    independentReports: byType('mandiri'),
    grantReports: byCategory('grant'),
    partnerReports: byCategory('partner'),
    universityReports: byCategory('university'),
    totalJournals: byOutput('journal'),
    totalBooks: byOutput('book'),
    totalHki: byOutput('hki'),
    totalPrototypes: byOutput('prototype'),
    totalProceedings: byOutput('proceeding'),
  };
};

export const makeExternalOutput = uid => ({
  id: uid('external-output'),
  outputType: 'journal',
  title: '',
  year: new Date().getFullYear(),
  description: '',
  link: '',
  file: null,
});

export const makeExternalDocument = (uid, fileType, file, user) => ({
  id: uid('external-file'),
  fileType,
  name: file.name,
  fileName: file.name,
  fileUrl: file.risFileUrl || file.name,
  size: file.size,
  type: file.type || '',
  uploadedBy: user ? user.id : null,
  uploadedAt: new Date().toISOString(),
});
