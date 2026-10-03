/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import { ROLE, canManageResearcherProfiles, normalizeRole } from '../../../shared/workflows/workflow';
import { fileExtensionOf, validateFile } from '../../../shared/workflows/fileValidation';

export const PROFILE_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
};

export const VERIFICATION_STATUS = {
  UNVERIFIED: 'unverified',
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
};

export const PROFILE_STATUS_META = {
  [PROFILE_STATUS.DRAFT]: { label: 'Draf', tone: 'gray' },
  [PROFILE_STATUS.ACTIVE]: { label: 'Aktif', tone: 'green' },
  [PROFILE_STATUS.INACTIVE]: { label: 'Nonaktif', tone: 'red' },
  [PROFILE_STATUS.SUSPENDED]: { label: 'Ditangguhkan', tone: 'orange' },
};

export const VERIFICATION_STATUS_META = {
  [VERIFICATION_STATUS.UNVERIFIED]: { label: 'Belum diverifikasi', tone: 'gray' },
  [VERIFICATION_STATUS.PENDING]: { label: 'Menunggu Verifikasi', tone: 'yellow' },
  [VERIFICATION_STATUS.VERIFIED]: { label: 'Terverifikasi', tone: 'green' },
  [VERIFICATION_STATUS.REJECTED]: { label: 'Ditolak', tone: 'red' },
};

export const DOCUMENT_TYPES = [
  { value: 'KTP', label: 'KTP', required: true },
  { value: 'NPWP', label: 'NPWP', required: false },
  { value: 'CV', label: 'CV', required: true },
  { value: 'SK_JABATAN', label: 'SK Jabatan', required: false },
  { value: 'SIGNATURE', label: 'Tanda Tangan', required: false },
];

export const REQUIRED_DOCUMENT_TYPES = DOCUMENT_TYPES.filter(item => item.required).map(item => item.value);
export const ALLOWED_PROFILE_DOCUMENT_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg'];
export const MAX_PROFILE_DOCUMENT_SIZE = 5 * 1024 * 1024;

export const MANDATORY_PROFILE_FIELDS = [
  'fullName',
  'institutionEmail',
  'nidn',
  'faculty',
  'studyProgram',
  'position',
  'phoneNumber',
];

export const RESEARCH_IDENTITY_FIELDS = ['orcid', 'googleScholar', 'sintaId'];

export const PROFILE_SECTION_LABELS = {
  basic: 'Informasi Dasar',
  contact: 'Kontak',
  institution: 'Institusi',
  researchIdentity: 'Identitas Penelitian',
  finance: 'Keuangan',
  emergency: 'Kontak Darurat',
};

export const DEFAULT_PROFILE_FORM = {
  profilePhoto: null,
  fullName: '',
  frontTitle: '',
  backTitle: '',
  nidn: '',
  nik: '',
  birthPlace: '',
  birthDate: '',
  gender: '',
  nationality: 'Indonesia',
  institutionEmail: '',
  alternateEmail: '',
  phoneNumber: '',
  domicileAddress: '',
  correspondenceAddress: '',
  faculty: '',
  studyProgram: '',
  unit: '',
  position: '',
  functionalPosition: '',
  nip: '',
  orcid: '',
  googleScholar: '',
  sintaId: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountName: '',
  emergencyContactName: '',
  emergencyContactRelation: '',
  emergencyContactPhone: '',
};

const hasValue = value => value !== null && value !== undefined && String(value).trim() !== '';
const nowIso = () => new Date().toISOString();

export const isProfileAdmin = user => canManageResearcherProfiles(user);
// Every signed-in account owns a profile, even before its first profile record
// is saved. Management rights for other users remain guarded separately.
export const canOpenProfileModule = user => Boolean(user);
export const isOwnProfile = (profile, user) => Boolean(profile && user && profile.userId === user.id);
export const canViewProfile = (profile, user) => Boolean(profile && user) && (isProfileAdmin(user) || isOwnProfile(profile, user));
export const canManageProfile = (profile, user, targetAccount = null) => {
  if (!isProfileAdmin(user) || !profile) return false;
  if (isOwnProfile(profile, user)) return true;
  const actorRole = normalizeRole(user && user.role);
  const targetRole = normalizeRole(targetAccount && targetAccount.role);
  if (actorRole === ROLE.SUPER_ADMIN) return true;
  if (actorRole === ROLE.MANAGER) return targetRole !== ROLE.SUPER_ADMIN;
  if (actorRole === ROLE.ADMIN) return targetRole === ROLE.LECTURER;
  return false;
};

export const canEditProfile = (profile, user, targetAccount = null) => Boolean(profile && user) && (isOwnProfile(profile, user) || canManageProfile(profile, user, targetAccount)) && profile.profileStatus !== PROFILE_STATUS.INACTIVE;
export const canVerifyProfile = (profile, user, targetAccount = null) => isProfileAdmin(user) && Boolean(profile) && !isOwnProfile(profile, user) && canManageProfile(profile, user, targetAccount) && profile.verificationStatus !== VERIFICATION_STATUS.VERIFIED;
export const canDeactivateProfile = (profile, user, targetAccount = null) => {
  if (!profile || profile.profileStatus === PROFILE_STATUS.INACTIVE || isOwnProfile(profile, user)) return false;
  return canManageProfile(profile, user, targetAccount);
};

export const canManageProfileAccount = (profile, user, account) => Boolean(account && !account.deletedAt
  && !isOwnProfile(profile, user) && canManageProfile(profile, user, account));

export const applyProfileAccountAction = (data, profileId, action, reason, actor, uid) => {
  const profile = getProfileById(data, profileId);
  const account = profile && (data.systemUsers || []).find(item => item.id === profile.userId);
  if (!canManageProfileAccount(profile, actor, account)) throw new Error('Anda tidak dapat mengelola akun ini.');
  if (!['activate', 'deactivate', 'delete'].includes(action)) throw new Error('Tindakan akun tidak dikenal.');
  if (action !== 'activate' && !String(reason || '').trim()) throw new Error('Alasan tindakan wajib diisi.');
  if (action === 'activate' && account.isActive !== false) throw new Error('Akun sudah aktif.');
  if (action === 'deactivate' && account.isActive === false) throw new Error('Akun sudah nonaktif.');

  const now = nowIso();
  const activating = action === 'activate';
  const deleting = action === 'delete';
  const nextStatus = activating
    ? (account.previousProfileStatus || (profile.verificationStatus === VERIFICATION_STATUS.VERIFIED ? PROFILE_STATUS.ACTIVE : PROFILE_STATUS.DRAFT))
    : PROFILE_STATUS.INACTIVE;
  const updatedAccount = {
    ...account,
    isActive: activating,
    deactivationReason: activating ? null : String(reason).trim(),
    deactivatedAt: activating ? null : (account.deactivatedAt || now),
    deactivatedBy: activating ? null : actor.id,
    previousProfileStatus: activating ? null : (account.previousProfileStatus || profile.profileStatus),
    deletedAt: deleting ? now : (account.deletedAt || null),
    deletedBy: deleting ? actor.id : (account.deletedBy || null),
    updatedAt: now,
    updatedBy: actor.id,
  };
  const updatedProfile = {
    ...profile,
    profileStatus: nextStatus,
    inactiveReason: activating ? null : String(reason).trim(),
    inactiveAt: activating ? null : (profile.inactiveAt || now),
    inactiveBy: activating ? null : actor.id,
    updatedAt: now,
    lastUpdatedAt: now,
    lastUpdatedBy: actor.id,
  };
  return {
    ...data,
    systemUsers: (data.systemUsers || []).map(item => (item.id === account.id ? updatedAccount : item)),
    researcherProfiles: (data.researcherProfiles || []).map(item => (item.profileId === profileId ? updatedProfile : item)),
    researcherStatusHistory: profile.profileStatus === nextStatus ? (data.researcherStatusHistory || []) : [
      ...(data.researcherStatusHistory || []), createStatusHistory(profile, profile.profileStatus, nextStatus, actor, uid),
    ],
    systemActivityLogs: [...(data.systemActivityLogs || []), createActivityLog(actor, `account_${action}`, 'researcher_profile', profileId, { isActive: account.isActive, profileStatus: profile.profileStatus }, { isActive: updatedAccount.isActive, profileStatus: nextStatus, reason: activating ? null : String(reason).trim(), deletedAt: updatedAccount.deletedAt }, uid)],
  };
};

export const getProfileStatusMeta = status => PROFILE_STATUS_META[status] || PROFILE_STATUS_META[PROFILE_STATUS.DRAFT];
export const getVerificationMeta = status => VERIFICATION_STATUS_META[status] || VERIFICATION_STATUS_META[VERIFICATION_STATUS.UNVERIFIED];
export const getDocumentTypeLabel = type => (DOCUMENT_TYPES.find(item => item.value === type) || {}).label || type || '-';

export const getProfileByUser = (data, user) => (data.researcherProfiles || []).find(item => item.userId === (user && user.id));
export const getProfileById = (data, profileId) => (data.researcherProfiles || []).find(item => item.profileId === profileId || item.id === profileId);
export const getProfileDocuments = (data, profileId) => (data.researcherDocuments || []).filter(item => item.profileId === profileId && item.isActive !== false);
export const getExpertiseForProfile = (data, profileId) => {
  const ids = (data.researcherExpertiseMap || []).filter(item => item.profileId === profileId).map(item => item.expertiseId);
  return (data.researcherExpertise || []).filter(item => ids.includes(item.expertiseId));
};
export const getProfileAdmin = (data, profileId) => {
  const assignment = (data.adminAssignments || []).find(item => item.profileId === profileId);
  if (!assignment) return null;
  return (data.systemUsers || []).find(item => item.id === assignment.adminId) || null;
};

export const calculateProfileCompleteness = (profile, documents = []) => {
  const mandatoryCount = MANDATORY_PROFILE_FIELDS.filter(field => hasValue(profile && profile[field])).length;
  const mandatoryScore = Math.round((mandatoryCount / MANDATORY_PROFILE_FIELDS.length) * 60);

  const activeDocs = documents.filter(item => item && item.isActive !== false);
  const requiredDocCount = REQUIRED_DOCUMENT_TYPES.filter(type => activeDocs.some(doc => doc.documentType === type)).length;
  const documentScore = Math.round((requiredDocCount / REQUIRED_DOCUMENT_TYPES.length) * 25);

  const identityCount = RESEARCH_IDENTITY_FIELDS.filter(field => hasValue(profile && profile[field])).length;
  const identityScore = Math.round((identityCount / RESEARCH_IDENTITY_FIELDS.length) * 15);

  return Math.min(100, mandatoryScore + documentScore + identityScore);
};

export const getCompletenessLabel = (completeness, verificationStatus) => {
  if (completeness >= 100 && verificationStatus === VERIFICATION_STATUS.VERIFIED) return 'Terverifikasi';
  if (completeness >= 80) return 'Lengkap';
  if (completeness >= 50) return 'Sebagian';
  return 'Belum lengkap';
};

export const getCompletenessTone = completeness => {
  if (completeness >= 100) return 'green';
  if (completeness >= 80) return 'blue';
  if (completeness >= 50) return 'yellow';
  return 'red';
};

export const buildProfileFromUser = (user, uid) => {
  const now = nowIso();
  const role = normalizeRole(user && user.role);
  const roleDefaults = role === ROLE.ADMIN ? {
    nidn: user.identifier || 'ADM-LPPM',
    faculty: 'LPPM',
    studyProgram: 'Administrasi Riset',
    unit: 'LPPM',
    position: 'Admin LPPM',
    functionalPosition: 'Administrator',
  } : ([ROLE.MANAGER, ROLE.SUPER_ADMIN].includes(role) ? {
    nidn: user.identifier || 'MGR-LPPM',
    faculty: 'LPPM',
    studyProgram: 'Manajemen Riset',
    unit: 'LPPM',
    position: 'Kepala LPPM',
    functionalPosition: 'Manager',
  } : {});
  return {
    ...DEFAULT_PROFILE_FORM,
    ...roleDefaults,
    profileId: user.profileId || uid('profile'),
    id: user.profileId || uid('profile-ref'),
    userId: user.id,
    fullName: user.name || '',
    institutionEmail: user.email || '',
    nidn: user.identifier || roleDefaults.nidn || '',
    profileStatus: PROFILE_STATUS.DRAFT,
    profileCompleteness: 0,
    verificationStatus: VERIFICATION_STATUS.PENDING,
    lastUpdatedAt: now,
    lastUpdatedBy: user.id,
    createdAt: now,
    updatedAt: now,
  };
};

export const validateProfileForm = profile => {
  const errors = [];
  MANDATORY_PROFILE_FIELDS.forEach(field => {
    if (!hasValue(profile[field])) errors.push(`${field} wajib diisi.`);
  });
  if (profile.institutionEmail && !String(profile.institutionEmail).includes('@')) errors.push('Email institusi tidak valid.');
  if (profile.alternateEmail && !String(profile.alternateEmail).includes('@')) errors.push('Email alternatif tidak valid.');
  return errors;
};

export const validateProfileDocument = file => {
  const result = validateFile(file, { allowedExtensions: ALLOWED_PROFILE_DOCUMENT_EXTENSIONS, maxSize: MAX_PROFILE_DOCUMENT_SIZE });
  return result.message;
};

export const createProfileDocumentMeta = (file, documentType, profileId, user, uid) => ({
  id: uid('researcher-doc'),
  profileId,
  documentType,
  fileUrl: `mock://researcher-documents/${profileId}/${file.name}`,
  fileName: file.name,
  fileSize: file.size,
  fileFormat: fileExtensionOf(file).toUpperCase(),
  uploadedAt: nowIso(),
  uploadedBy: user.id,
  isActive: true,
});

export const createActivityLog = (user, action, entityType, entityId, oldData, newData, uid) => ({
  id: uid('activity-log'),
  logId: uid('system-log'),
  userId: user && user.id,
  action,
  entityType,
  entityId,
  oldData: oldData || null,
  newData: newData || null,
  createdAt: nowIso(),
});

export const createStatusHistory = (profile, oldStatus, newStatus, user, uid) => ({
  id: uid('profile-status'),
  profileId: profile.profileId,
  oldStatus,
  newStatus,
  changedBy: user && user.id,
  changedAt: nowIso(),
});

export const createNotification = (userId, senderId, type, message, uid) => ({
  id: uid('notification'),
  notificationId: uid('notif'),
  userId,
  researchId: null,
  senderId: senderId || null,
  entityType: 'researcher_profile',
  entityId: userId,
  notificationType: type,
  message,
  isRead: false,
  createdAt: nowIso(),
});

export const normalizeProfileForSave = (profile, documents, actor) => {
  const completeness = calculateProfileCompleteness(profile, documents);
  const verificationStatus = completeness >= 80 && profile.verificationStatus === VERIFICATION_STATUS.UNVERIFIED
    ? VERIFICATION_STATUS.PENDING
    : (profile.verificationStatus || VERIFICATION_STATUS.PENDING);
  const profileStatus = profile.profileStatus === PROFILE_STATUS.INACTIVE ? PROFILE_STATUS.INACTIVE : (completeness >= 50 ? PROFILE_STATUS.ACTIVE : PROFILE_STATUS.DRAFT);
  return {
    ...profile,
    profileStatus,
    profileCompleteness: completeness,
    verificationStatus,
    lastUpdatedAt: nowIso(),
    lastUpdatedBy: actor && actor.id,
    updatedAt: nowIso(),
  };
};

export const syncProfileToDomainData = (data, savedProfile) => {
  const displayName = `${savedProfile.frontTitle ? `${savedProfile.frontTitle} ` : ''}${savedProfile.fullName || ''}${savedProfile.backTitle ? `, ${savedProfile.backTitle}` : ''}`.trim() || savedProfile.fullName;
  const identifier = savedProfile.nidn || savedProfile.nik || '';
  return {
    ...data,
    lecturers: (data.lecturers || []).map(item => (item.userId === savedProfile.userId ? {
      ...item,
      id: savedProfile.profileId,
      name: displayName,
      nidn: savedProfile.nidn,
      faculty: savedProfile.faculty,
      program: savedProfile.studyProgram,
      functionalPosition: savedProfile.functionalPosition,
      orcid: savedProfile.orcid,
    } : item)),
    applicantProfiles: (data.applicantProfiles || []).map(item => (item.userId === savedProfile.userId ? {
      ...item,
      id: savedProfile.profileId,
      name: displayName,
      identifier,
      faculty: savedProfile.faculty,
      program: savedProfile.studyProgram,
      email: savedProfile.institutionEmail,
      status: savedProfile.profileStatus,
    } : item)),
    drafts: (data.drafts || []).map(item => (item.userId === savedProfile.userId ? { ...item, userName: displayName } : item)),
    letterRequests: (data.letterRequests || []).map(letter => {
      if (letter.userId !== savedProfile.userId) return letter;
      const applicant = {
        ...(letter.applicant || {}),
        id: savedProfile.profileId,
        userId: savedProfile.userId,
        name: displayName,
        identifier,
        faculty: savedProfile.faculty,
        program: savedProfile.studyProgram,
        email: savedProfile.institutionEmail,
      };
      return { ...letter, applicant, applicants: (letter.applicants || []).map(item => (item.userId === savedProfile.userId ? { ...item, ...applicant } : item)) };
    }),
    externalResearchReports: (data.externalResearchReports || []).map(report => (report.userId === savedProfile.userId ? { ...report, userName: displayName } : report)),
  };
};

export const getProfileMetrics = data => {
  const removedUsers = new Set((data.systemUsers || []).filter(item => item.deletedAt).map(item => item.id));
  const profiles = (data.researcherProfiles || []).filter(item => !removedUsers.has(item.userId));
  return {
    totalProfiles: profiles.length,
    activeProfiles: profiles.filter(item => item.profileStatus === PROFILE_STATUS.ACTIVE).length,
    inactiveProfiles: profiles.filter(item => item.profileStatus === PROFILE_STATUS.INACTIVE).length,
    pendingProfiles: profiles.filter(item => item.verificationStatus === VERIFICATION_STATUS.PENDING).length,
    verifiedProfiles: profiles.filter(item => item.verificationStatus === VERIFICATION_STATUS.VERIFIED).length,
    incompleteProfiles: profiles.filter(item => Number(item.profileCompleteness || 0) < 50).length,
    completeProfiles: profiles.filter(item => Number(item.profileCompleteness || 0) >= 80).length,
  };
};

export const filterProfiles = (profiles, data, filters) => profiles.filter(profile => {
  if ((data.systemUsers || []).some(item => item.id === profile.userId && item.deletedAt)) return false;
  const q = String(filters.search || '').toLowerCase();
  const expertises = getExpertiseForProfile(data, profile.profileId).map(item => item.name.toLowerCase());
  const searchable = [profile.fullName, profile.institutionEmail, profile.nidn, profile.faculty, profile.studyProgram].join(' ').toLowerCase();
  if (q && !searchable.includes(q)) return false;
  if (filters.faculty && profile.faculty !== filters.faculty) return false;
  if (filters.studyProgram && profile.studyProgram !== filters.studyProgram) return false;
  if (filters.unit && profile.unit !== filters.unit) return false;
  if (filters.position && profile.position !== filters.position) return false;
  if (filters.verificationStatus && profile.verificationStatus !== filters.verificationStatus) return false;
  if (filters.profileStatus && profile.profileStatus !== filters.profileStatus) return false;
  if (filters.expertise && !expertises.includes(String(filters.expertise).toLowerCase())) return false;
  if (filters.activeStatus === 'active' && profile.profileStatus === PROFILE_STATUS.INACTIVE) return false;
  if (filters.activeStatus === 'inactive' && profile.profileStatus !== PROFILE_STATUS.INACTIVE) return false;
  return true;
});

export const exportProfilesCsv = (profiles, data) => profiles.map(profile => ({
  Nama: profile.fullName || '',
  'Email Institusi': profile.institutionEmail || '',
  NIDN: profile.nidn || '',
  Fakultas: profile.faculty || '',
  'Program Studi': profile.studyProgram || '',
  Posisi: profile.position || '',
  Kelengkapan: `${profile.profileCompleteness || 0}%`,
  Verifikasi: getVerificationMeta(profile.verificationStatus).label,
  'Bidang Minat': getExpertiseForProfile(data, profile.profileId).map(item => item.name).join('; '),
}));
