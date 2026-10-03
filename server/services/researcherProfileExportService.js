const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'export', 'Template_Ekspor_Profil_Dosen_RIS.docx');
const scalar = value => (value == null || value === '' ? '-' : String(value));
const statusLabel = (value, labels) => labels[value] || scalar(value);
const dateValue = value => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(date);
};

const buildProfileValues = (profile, account, state) => {
  const documents = (state.researcherDocuments || [])
    .filter(item => item.profileId === profile.profileId && item.isActive !== false)
    .map(item => ({
      documentType: scalar(item.documentType),
      fileName: scalar(item.fileName || item.name),
      fileFormat: scalar(item.fileFormat || item.type),
      fileSize: item.fileSize ? `${(item.fileSize / 1048576).toFixed(2)} MB` : '-',
      uploadedAt: dateValue(item.uploadedAt),
    }));
  const expertiseIds = new Set((state.researcherExpertiseMap || [])
    .filter(item => item.profileId === profile.profileId).map(item => item.expertiseId));
  const expertise = (state.researcherExpertise || [])
    .filter(item => expertiseIds.has(item.expertiseId) || item.profileId === profile.profileId)
    .map(item => ({ expertiseName: scalar(item.name || item.expertiseName) }));
  const verificationHistory = (state.researcherVerifications || [])
    .filter(item => item.profileId === profile.profileId)
    .map(item => ({
      historyStatus: scalar(item.verificationStatus || item.status),
      historyNotes: scalar(item.verificationNotes || item.notes),
      verifiedAt: dateValue(item.verifiedAt),
    }));
  const adminAssignment = (state.adminAssignments || []).find(item => item.profileId === profile.profileId);
  const admin = adminAssignment && (state.systemUsers || []).find(item => item.id === adminAssignment.adminId);
  const values = {
    frontTitle: scalar(profile.frontTitle === '-' ? '' : profile.frontTitle),
    fullName: scalar(profile.fullName),
    backTitle: scalar(profile.backTitle === '-' ? '' : profile.backTitle),
    profilePhoto: '-',
    nidn: scalar(profile.nidn),
    nik: scalar(profile.nik),
    birthPlace: scalar(profile.birthPlace),
    birthDate: dateValue(profile.birthDate),
    gender: scalar(profile.gender),
    nationality: scalar(profile.nationality),
    institutionEmail: scalar(profile.institutionEmail || account.email),
    alternateEmail: scalar(profile.alternateEmail),
    phoneNumber: scalar(profile.phoneNumber),
    domicileAddress: scalar(profile.domicileAddress),
    correspondenceAddress: scalar(profile.correspondenceAddress),
    faculty: scalar(profile.faculty),
    studyProgram: scalar(profile.studyProgram),
    unit: scalar(profile.unit),
    position: scalar(profile.position),
    functionalPosition: scalar(profile.functionalPosition),
    nip: scalar(profile.nip),
    orcid: scalar(profile.orcid),
    googleScholar: scalar(profile.googleScholar),
    sintaId: scalar(profile.sintaId),
    bankName: scalar(profile.bankName),
    bankAccountNumber: scalar(profile.bankAccountNumber),
    bankAccountName: scalar(profile.bankAccountName),
    emergencyContactName: scalar(profile.emergencyContactName),
    emergencyContactRelation: scalar(profile.emergencyContactRelation),
    emergencyContactPhone: scalar(profile.emergencyContactPhone),
    accountStatus: account.deletedAt ? 'Dihapus' : account.isActive === false ? 'Nonaktif' : 'Aktif',
    profileStatus: statusLabel(profile.profileStatus, {
      active: 'Aktif', inactive: 'Nonaktif', suspended: 'Ditangguhkan', draft: 'Draf'
    }),
    verificationStatus: statusLabel(profile.verificationStatus, {
      unverified: 'Belum diverifikasi', pending: 'Menunggu verifikasi', verified: 'Terverifikasi', rejected: 'Ditolak'
    }),
    profileCompleteness: `${Number(profile.profileCompleteness || 0)}%`,
    createdAt: dateValue(profile.createdAt),
    updatedAt: dateValue(profile.updatedAt || profile.lastUpdatedAt),
    exportedAt: dateValue(new Date()),
    profileAdminName: scalar(admin && admin.name),
    expertise,
    documents,
    verificationHistory,
  };
  return values;
};

const renderProfileDocx = (profile, account, state) => {
  const zip = new PizZip(fs.readFileSync(TEMPLATE_PATH));
  const document = new Docxtemplater(zip, {
    delimiters: { start: '{{', end: '}}' },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '-',
  });
  document.render(buildProfileValues(profile, account, state));
  return document.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};

module.exports = { buildProfileValues, renderProfileDocx };
