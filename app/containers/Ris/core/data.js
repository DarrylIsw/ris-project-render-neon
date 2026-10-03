/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import {
  ADMIN_SCOPE, ALL_ADMIN_SCOPES, ROLE, STATUS, draftReviewerAssignments, draftReviews, isActiveReviewerAssignment, normalizeRole, normalizeStatus
} from '../shared/workflows/workflow';
import { EXTERNAL_STATUS } from '../features/externalResearch/workflows/externalResearchWorkflow';
import { createDefaultLetterDefinitions, createLetterMasterTemplate } from '../features/letters/workflows/letterCatalogWorkflow';
import { proposalBudgetTotal } from '../features/research/workflows/proposalBudget';
import { PROFILE_STATUS, VERIFICATION_STATUS, calculateProfileCompleteness } from '../features/profiles/workflows/researcherProfileWorkflow';
import { normalizeReportingSchedule } from '../features/research/workflows/reportingWorkflow';
import {
  BASE_ATTACHMENT_REQUIREMENTS, normalizeSchemeAttachmentRequirements, normalizeSchemeOutputOptions
} from '../features/research/workflows/schemeConfiguration';

export const DEMO_ACCOUNTS = [
  {
    id: 'user-super-admin', name: 'Super Admin RIS', email: 'superadmin@umn.ac.id', role: ROLE.SUPER_ADMIN, profileId: 'super-admin-1'
  },
  {
    id: 'user-manager', name: 'Manager LPPM', email: 'manager@umn.ac.id', role: ROLE.MANAGER, profileId: 'manager-1'
  },
  {
    id: 'user-admin', name: 'Admin Penelitian', email: 'admin.penelitian@umn.ac.id', role: ROLE.ADMIN, adminScopes: [ADMIN_SCOPE.RESEARCH], profileId: 'admin-1'
  },
  {
    id: 'user-admin-letter', name: 'Admin Pengajuan Surat', email: 'admin.surat@umn.ac.id', role: ROLE.ADMIN, adminScopes: [ADMIN_SCOPE.LETTERS], profileId: 'admin-letter-1'
  },
  {
    id: 'user-admin-profile', name: 'Admin Informasi Peneliti', email: 'admin.profil@umn.ac.id', role: ROLE.ADMIN, adminScopes: [ADMIN_SCOPE.PROFILES], profileId: 'admin-profile-1'
  },
  {
    id: 'user-lecturer', name: 'Dr. Budi Santoso', email: 'lecturer@umn.ac.id', role: ROLE.LECTURER, profileId: 'lecturer-1'
  },
  {
    id: 'user-lecturer-2', name: 'Dr. Andini Prameswari', email: 'reviewer@umn.ac.id', role: ROLE.LECTURER, profileId: 'lecturer-2'
  },
  {
    id: 'user-lecturer-3', name: 'Rizky Kurniawan, M.T.', email: 'rizky@umn.ac.id', role: ROLE.LECTURER, profileId: 'lecturer-3'
  },
  {
    id: 'user-lecturer-4', name: 'Dr. Nadia Kusuma', email: 'nadia@umn.ac.id', role: ROLE.LECTURER, profileId: 'lecturer-4'
  },
];

export const SDGS = [
  'No Poverty', 'Zero Hunger', 'Good Health and Well-being',
  'Quality Education', 'Gender Equality', 'Clean Water and Sanitation',
  'Affordable and Clean Energy', 'Decent Work and Economic Growth',
  'Industry, Innovation and Infrastructure', 'Reduced Inequalities',
  'Sustainable Cities and Communities', 'Responsible Consumption and Production',
  'Climate Action', 'Life Below Water', 'Life on Land',
  'Peace, Justice and Strong Institutions', 'Partnerships for the Goals'
].map((name, index) => ({ id: index + 1, code: index + 1, name }));

export const BUDGET_TABS = [
  { key: 'materials', label: 'Bahan dan Peralatan', components: ['Bahan habis pakai', 'Peralatan penelitian'] },
  { key: 'field', label: 'Pengumpulan Data', components: ['Transportasi', 'Akomodasi', 'Konsumsi'] },
  { key: 'analysis', label: 'Analisis Data', components: ['Pengolahan data', 'Sewa perangkat'] },
  { key: 'reporting', label: 'Pelaporan Hasil Penelitian dan Luaran Wajib', components: ['Publikasi', 'Seminar', 'Penyusunan laporan'] },
];

export const OUTPUT_EMPTY = {
  planValue: '',
  planLabel: '',
  title: '',
  targetYear: '',
  description: '',
  category: '',
  journalTargetLevel: '',
  journalIndexTarget: '',
  publicationType: '',
  targetQuartile: '',
  proceedingType: '',
  indexTarget: '',
  bookType: '',
  publisherTarget: '',
  isbnPlan: '',
  hkiType: '',
  targetRegistrationYear: '',
  productType: '',
  targetTkt: '',
  expectedOutputForm: '',
  otherOutputType: '',
};

export const REVIEW_CRITERIA = [
  {
    code: 'kejelasan_masalah', label: 'Kejelasan masalah (1-100)', group: 'Kualitas Proposal (30%)', weight: 10
  },
  {
    code: 'kebaruan_penelitian', label: 'Kebaruan penelitian (1-100)', group: 'Kualitas Proposal (30%)', weight: 10
  },
  {
    code: 'metodologi', label: 'Metodologi (1-100)', group: 'Kualitas Proposal (30%)', weight: 10
  },
  {
    code: 'kompetensi_ketua', label: 'Kompetensi ketua', group: 'Kelayakan Tim (15%)', weight: 8
  },
  {
    code: 'komposisi_tim', label: 'Komposisi tim', group: 'Kelayakan Tim (15%)', weight: 7
  },
  {
    code: 'kesesuaian_luaran', label: 'Kesesuaian Luaran Wajib', group: 'Luaran Penelitian (20%)', weight: 10
  },
  {
    code: 'realisme_target', label: 'Realisme Target', group: 'Luaran Penelitian (20%)', weight: 10
  },
  {
    code: 'kewajaran_biaya', label: 'Kewajaran Biaya', group: 'Anggaran (20%)', weight: 10
  },
  {
    code: 'kesesuaian_kegiatan', label: 'Kesesuaian dengan Kegiatan', group: 'Anggaran (20%)', weight: 10
  },
  {
    code: 'rip', label: 'RIP', group: 'Kesesuaian Strategis (15%)', weight: 5
  },
  {
    code: 'sdg', label: 'SDG', group: 'Kesesuaian Strategis (15%)', weight: 5
  },
  {
    code: 'research_center', label: 'Research Center', group: 'Kesesuaian Strategis (15%)', weight: 5
  },
];

export const STATUS_META = {
  [STATUS.DRAFT]: { label: 'Draft', tone: 'gray' },
  [STATUS.SUBMITTED]: { label: 'Telah Diajukan', tone: 'cyan' },
  [STATUS.UNDER_REVIEW]: { label: 'Dalam Review', tone: 'blue' },
  [STATUS.REVIEWED]: { label: 'Sudah Direview', tone: 'purple' },
  [STATUS.REVISION]: { label: 'Revisi', tone: 'orange' },
  [STATUS.FUNDED]: { label: 'Sudah Didanai', tone: 'green' },
  [STATUS.REJECTED]: { label: 'Ditolak', tone: 'red' },
  [STATUS.ARCHIVED]: { label: 'Diarsipkan', tone: 'gray' },
  incomplete_data: { label: 'Data Tidak Lengkap', tone: 'yellow' },
  assigned: { label: 'Menunggu Peninjauan', tone: 'blue' },
  revision_required: { label: 'Revisi', tone: 'orange' },
};

const lecturers = [
  {
    id: 'lecturer-1', userId: 'user-lecturer', name: 'Dr. Budi Santoso', nidn: '0312048501', faculty: 'Teknik dan Informatika', program: 'Sistem Informasi', educationLevel: 'S3', functionalPosition: 'lektor', employmentStatus: 'fulltime', sintaScore: 612, researchCount: 14, lastResearchYear: 2026, orcid: '0000000218250097'
  },
  {
    id: 'lecturer-2', userId: 'user-lecturer-2', name: 'Dr. Andini Prameswari', nidn: '0308078602', faculty: 'Teknik dan Informatika', program: 'Informatika', educationLevel: 'S3', functionalPosition: 'lektor_kepala', employmentStatus: 'homebase', sintaScore: 780, researchCount: 20, lastResearchYear: 2026, orcid: '0000000319261188'
  },
  {
    id: 'lecturer-3', userId: 'user-lecturer-3', name: 'Rizky Kurniawan, M.T.', nidn: '0321019003', faculty: 'Teknik dan Informatika', program: 'Teknik Komputer', educationLevel: 'S2', functionalPosition: 'asisten_ahli', employmentStatus: 'fulltime', sintaScore: 388, researchCount: 7, lastResearchYear: 2025, orcid: ''
  },
  {
    id: 'lecturer-4', userId: 'user-lecturer-4', name: 'Dr. Nadia Kusuma', nidn: '0317098804', faculty: 'Bisnis', program: 'Manajemen', educationLevel: 'S3', functionalPosition: 'lektor', employmentStatus: 'homebase', sintaScore: 540, researchCount: 11, lastResearchYear: 2026, orcid: ''
  },
  {
    id: 'manager-1', userId: 'user-manager', name: 'Manager LPPM', nidn: 'MGR-LPPM-001', faculty: 'LPPM', program: 'Manajemen Riset', educationLevel: 'S3', functionalPosition: 'lektor_kepala', employmentStatus: 'fulltime', sintaScore: 0, researchCount: 0, lastResearchYear: 2026, orcid: ''
  },
];

const systemUsers = DEMO_ACCOUNTS.map(account => ({
  id: account.id,
  name: account.name,
  email: account.email,
  role: account.role,
  adminScopes: account.adminScopes || [],
  profileId: account.profileId,
  applicantType: account.applicantType || null,
  identifier: account.identifier || null,
  isActive: true,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
}));

const researcherExpertise = [
  { expertiseId: 'expertise-ai', name: 'Artificial Intelligence' },
  { expertiseId: 'expertise-ml', name: 'Machine Learning' },
  { expertiseId: 'expertise-cv', name: 'Computer Vision' },
  { expertiseId: 'expertise-si', name: 'Sistem Informasi' },
  { expertiseId: 'expertise-ds', name: 'Data Science' },
  { expertiseId: 'expertise-bisnis', name: 'Digital Business' },
];

const baseResearcherProfiles = [
  {
    profileId: 'lecturer-1', id: 'lecturer-1', userId: 'user-lecturer', fullName: 'Budi Santoso', frontTitle: 'Dr.', backTitle: '', nidn: '0312048501', nik: '3671010101850001', birthPlace: 'Jakarta', birthDate: '1985-12-04', gender: 'Laki-laki', nationality: 'Indonesia', institutionEmail: 'lecturer@umn.ac.id', alternateEmail: 'budi.santoso@example.com', phoneNumber: '081234567890', domicileAddress: 'Tangerang', correspondenceAddress: 'Tangerang', faculty: 'Teknik dan Informatika', studyProgram: 'Sistem Informasi', unit: 'LPPM', position: 'Dosen Fulltime', functionalPosition: 'Lektor', nip: '201203001', orcid: '0000000218250097', googleScholar: 'https://scholar.google.com/citations?user=budi', sintaId: '612001', bankName: 'BCA', bankAccountNumber: '1234567890', bankAccountName: 'Budi Santoso', emergencyContactName: 'Dewi Santoso', emergencyContactRelation: 'Istri', emergencyContactPhone: '081299988877', profileStatus: PROFILE_STATUS.ACTIVE, verificationStatus: VERIFICATION_STATUS.VERIFIED, lastUpdatedAt: '2026-06-05T03:00:00.000Z', lastUpdatedBy: 'user-admin', createdAt: '2026-01-10T03:00:00.000Z', updatedAt: '2026-06-05T03:00:00.000Z'
  },
  {
    profileId: 'lecturer-2', id: 'lecturer-2', userId: 'user-lecturer-2', fullName: 'Andini Prameswari', frontTitle: 'Dr.', backTitle: '', nidn: '0308078602', nik: '3671010807860002', birthPlace: 'Bandung', birthDate: '1986-07-08', gender: 'Perempuan', nationality: 'Indonesia', institutionEmail: 'reviewer@umn.ac.id', alternateEmail: '', phoneNumber: '081233344455', domicileAddress: 'Tangerang Selatan', correspondenceAddress: 'Tangerang Selatan', faculty: 'Teknik dan Informatika', studyProgram: 'Informatika', unit: 'Fakultas Teknik dan Informatika', position: 'Dosen Homebase', functionalPosition: 'Lektor Kepala', nip: '201108002', orcid: '0000000319261188', googleScholar: 'https://scholar.google.com/citations?user=andini', sintaId: '780002', bankName: 'Mandiri', bankAccountNumber: '9876543210', bankAccountName: 'Andini Prameswari', emergencyContactName: 'Raka Prameswara', emergencyContactRelation: 'Suami', emergencyContactPhone: '081277766655', profileStatus: PROFILE_STATUS.ACTIVE, verificationStatus: VERIFICATION_STATUS.PENDING, lastUpdatedAt: '2026-06-12T03:00:00.000Z', lastUpdatedBy: 'user-lecturer-2', createdAt: '2026-01-11T03:00:00.000Z', updatedAt: '2026-06-12T03:00:00.000Z'
  },
  {
    profileId: 'lecturer-3', id: 'lecturer-3', userId: 'user-lecturer-3', fullName: 'Rizky Kurniawan', frontTitle: '', backTitle: 'M.T.', nidn: '0321019003', nik: '', birthPlace: '', birthDate: '', gender: 'Laki-laki', nationality: 'Indonesia', institutionEmail: 'rizky@umn.ac.id', alternateEmail: '', phoneNumber: '081211122233', domicileAddress: '', correspondenceAddress: '', faculty: 'Teknik dan Informatika', studyProgram: 'Teknik Komputer', unit: '', position: 'Dosen Fulltime', functionalPosition: 'Asisten Ahli', nip: '', orcid: '', googleScholar: '', sintaId: '', bankName: '', bankAccountNumber: '', bankAccountName: '', emergencyContactName: '', emergencyContactRelation: '', emergencyContactPhone: '', profileStatus: PROFILE_STATUS.DRAFT, verificationStatus: VERIFICATION_STATUS.PENDING, lastUpdatedAt: '2026-06-15T03:00:00.000Z', lastUpdatedBy: 'user-lecturer-3', createdAt: '2026-02-01T03:00:00.000Z', updatedAt: '2026-06-15T03:00:00.000Z'
  },
  {
    profileId: 'lecturer-4', id: 'lecturer-4', userId: 'user-lecturer-4', fullName: 'Nadia Kusuma', frontTitle: 'Dr.', backTitle: '', nidn: '0317098804', nik: '3671011709880004', birthPlace: 'Surabaya', birthDate: '1988-09-17', gender: 'Perempuan', nationality: 'Indonesia', institutionEmail: 'nadia@umn.ac.id', alternateEmail: '', phoneNumber: '081266655544', domicileAddress: 'Jakarta Barat', correspondenceAddress: 'Jakarta Barat', faculty: 'Bisnis', studyProgram: 'Manajemen', unit: 'Fakultas Bisnis', position: 'Dosen Homebase', functionalPosition: 'Lektor', nip: '201407004', orcid: '', googleScholar: 'https://scholar.google.com/citations?user=nadia', sintaId: '540004', bankName: 'BNI', bankAccountNumber: '7654321000', bankAccountName: 'Nadia Kusuma', emergencyContactName: 'Ari Kusuma', emergencyContactRelation: 'Saudara', emergencyContactPhone: '081255544433', profileStatus: PROFILE_STATUS.ACTIVE, verificationStatus: VERIFICATION_STATUS.UNVERIFIED, lastUpdatedAt: '2026-05-10T03:00:00.000Z', lastUpdatedBy: 'user-lecturer-4', createdAt: '2026-01-20T03:00:00.000Z', updatedAt: '2026-05-10T03:00:00.000Z'
  },
  {
    profileId: 'admin-1', id: 'admin-1', userId: 'user-admin', fullName: 'Admin Penelitian', frontTitle: '', backTitle: '', nidn: 'ADM-RIS-001', nik: '3671010101900005', birthPlace: 'Tangerang', birthDate: '1990-01-01', gender: 'Laki-laki', nationality: 'Indonesia', institutionEmail: 'admin.penelitian@umn.ac.id', alternateEmail: '', phoneNumber: '081200000001', domicileAddress: 'Tangerang', correspondenceAddress: 'Universitas Multimedia Nusantara', faculty: 'LPPM', studyProgram: 'Administrasi Riset', unit: 'LPPM', position: 'Admin Penelitian', functionalPosition: 'Administrator', nip: 'ADM001', orcid: '', googleScholar: '', sintaId: '', bankName: '', bankAccountNumber: '', bankAccountName: '', emergencyContactName: '', emergencyContactRelation: '', emergencyContactPhone: '', profileStatus: PROFILE_STATUS.ACTIVE, verificationStatus: VERIFICATION_STATUS.VERIFIED, lastUpdatedAt: '2026-06-01T03:00:00.000Z', lastUpdatedBy: 'user-manager', createdAt: '2026-06-01T03:00:00.000Z', updatedAt: '2026-06-01T03:00:00.000Z'
  },
  {
    profileId: 'admin-letter-1', id: 'admin-letter-1', userId: 'user-admin-letter', fullName: 'Admin Pengajuan Surat', frontTitle: '', backTitle: '', nidn: 'ADM-SRT-001', nik: '', birthPlace: '', birthDate: '', gender: '', nationality: 'Indonesia', institutionEmail: 'admin.surat@umn.ac.id', alternateEmail: '', phoneNumber: '', domicileAddress: '', correspondenceAddress: 'Universitas Multimedia Nusantara', faculty: 'LPPM', studyProgram: 'Administrasi Riset', unit: 'LPPM', position: 'Admin Pengajuan Surat', functionalPosition: 'Administrator', nip: 'ADMSRT001', orcid: '', googleScholar: '', sintaId: '', bankName: '', bankAccountNumber: '', bankAccountName: '', emergencyContactName: '', emergencyContactRelation: '', emergencyContactPhone: '', profileStatus: PROFILE_STATUS.ACTIVE, verificationStatus: VERIFICATION_STATUS.VERIFIED, lastUpdatedAt: '2026-06-01T03:00:00.000Z', lastUpdatedBy: 'user-manager', createdAt: '2026-06-01T03:00:00.000Z', updatedAt: '2026-06-01T03:00:00.000Z'
  },
  {
    profileId: 'admin-profile-1', id: 'admin-profile-1', userId: 'user-admin-profile', fullName: 'Admin Informasi Peneliti', frontTitle: '', backTitle: '', nidn: 'ADM-PRF-001', nik: '', birthPlace: '', birthDate: '', gender: '', nationality: 'Indonesia', institutionEmail: 'admin.profil@umn.ac.id', alternateEmail: '', phoneNumber: '', domicileAddress: '', correspondenceAddress: 'Universitas Multimedia Nusantara', faculty: 'LPPM', studyProgram: 'Administrasi Riset', unit: 'LPPM', position: 'Admin Informasi Peneliti', functionalPosition: 'Administrator', nip: 'ADMPRF001', orcid: '', googleScholar: '', sintaId: '', bankName: '', bankAccountNumber: '', bankAccountName: '', emergencyContactName: '', emergencyContactRelation: '', emergencyContactPhone: '', profileStatus: PROFILE_STATUS.ACTIVE, verificationStatus: VERIFICATION_STATUS.VERIFIED, lastUpdatedAt: '2026-06-01T03:00:00.000Z', lastUpdatedBy: 'user-manager', createdAt: '2026-06-01T03:00:00.000Z', updatedAt: '2026-06-01T03:00:00.000Z'
  },
  {
    profileId: 'manager-1', id: 'manager-1', userId: 'user-manager', fullName: 'Kepala LPPM', frontTitle: '', backTitle: '', nidn: 'MGR-LPPM-001', nik: '3671010101880006', birthPlace: 'Tangerang', birthDate: '1988-01-01', gender: 'Laki-laki', nationality: 'Indonesia', institutionEmail: 'manager@umn.ac.id', alternateEmail: '', phoneNumber: '081200000002', domicileAddress: 'Tangerang', correspondenceAddress: 'Universitas Multimedia Nusantara', faculty: 'LPPM', studyProgram: 'Manajemen Riset', unit: 'LPPM', position: 'Kepala LPPM', functionalPosition: 'Manager', nip: 'MGR001', orcid: '', googleScholar: '', sintaId: '', bankName: '', bankAccountNumber: '', bankAccountName: '', emergencyContactName: '', emergencyContactRelation: '', emergencyContactPhone: '', profileStatus: PROFILE_STATUS.ACTIVE, verificationStatus: VERIFICATION_STATUS.VERIFIED, lastUpdatedAt: '2026-06-01T03:00:00.000Z', lastUpdatedBy: 'user-manager', createdAt: '2026-06-01T03:00:00.000Z', updatedAt: '2026-06-01T03:00:00.000Z'
  },
  {
    profileId: 'super-admin-1', id: 'super-admin-1', userId: 'user-super-admin', fullName: 'Super Admin RIS', frontTitle: '', backTitle: '', nidn: 'SADM-RIS-001', nik: '', birthPlace: '', birthDate: '', gender: '', nationality: 'Indonesia', institutionEmail: 'superadmin@umn.ac.id', alternateEmail: '', phoneNumber: '', domicileAddress: '', correspondenceAddress: 'Universitas Multimedia Nusantara', faculty: 'LPPM', studyProgram: 'Manajemen Sistem Riset', unit: 'LPPM', position: 'Super Admin', functionalPosition: 'Super Administrator', nip: 'SADM001', orcid: '', googleScholar: '', sintaId: '', bankName: '', bankAccountNumber: '', bankAccountName: '', emergencyContactName: '', emergencyContactRelation: '', emergencyContactPhone: '', profileStatus: PROFILE_STATUS.ACTIVE, verificationStatus: VERIFICATION_STATUS.VERIFIED, lastUpdatedAt: '2026-06-01T03:00:00.000Z', lastUpdatedBy: 'user-super-admin', createdAt: '2026-06-01T03:00:00.000Z', updatedAt: '2026-06-01T03:00:00.000Z'
  },
];

const researcherDocuments = [
  { id: 'doc-ktp-1', profileId: 'lecturer-1', documentType: 'KTP', fileUrl: 'mock://researcher-documents/lecturer-1/ktp.pdf', fileName: 'ktp-budi.pdf', fileSize: 1024000, fileFormat: 'PDF', uploadedAt: '2026-01-12T03:00:00.000Z', uploadedBy: 'user-lecturer', isActive: true },
  { id: 'doc-cv-1', profileId: 'lecturer-1', documentType: 'CV', fileUrl: 'mock://researcher-documents/lecturer-1/cv.pdf', fileName: 'cv-budi.pdf', fileSize: 2048000, fileFormat: 'PDF', uploadedAt: '2026-01-12T04:00:00.000Z', uploadedBy: 'user-lecturer', isActive: true },
  { id: 'doc-ktp-2', profileId: 'lecturer-2', documentType: 'KTP', fileUrl: 'mock://researcher-documents/lecturer-2/ktp.pdf', fileName: 'ktp-andini.pdf', fileSize: 1124000, fileFormat: 'PDF', uploadedAt: '2026-02-01T03:00:00.000Z', uploadedBy: 'user-lecturer-2', isActive: true },
  { id: 'doc-cv-2', profileId: 'lecturer-2', documentType: 'CV', fileUrl: 'mock://researcher-documents/lecturer-2/cv.pdf', fileName: 'cv-andini.pdf', fileSize: 1848000, fileFormat: 'PDF', uploadedAt: '2026-02-01T04:00:00.000Z', uploadedBy: 'user-lecturer-2', isActive: true },
  { id: 'doc-cv-3', profileId: 'lecturer-3', documentType: 'CV', fileUrl: 'mock://researcher-documents/lecturer-3/cv.pdf', fileName: 'cv-rizky.pdf', fileSize: 1948000, fileFormat: 'PDF', uploadedAt: '2026-03-01T04:00:00.000Z', uploadedBy: 'user-lecturer-3', isActive: true },
  { id: 'doc-ktp-admin', profileId: 'admin-1', documentType: 'KTP', fileUrl: 'mock://researcher-documents/admin-1/ktp.pdf', fileName: 'ktp-admin-lppm.pdf', fileSize: 824000, fileFormat: 'PDF', uploadedAt: '2026-06-01T03:00:00.000Z', uploadedBy: 'user-admin', isActive: true },
  { id: 'doc-cv-admin', profileId: 'admin-1', documentType: 'CV', fileUrl: 'mock://researcher-documents/admin-1/cv.pdf', fileName: 'cv-admin-lppm.pdf', fileSize: 1284000, fileFormat: 'PDF', uploadedAt: '2026-06-01T03:10:00.000Z', uploadedBy: 'user-admin', isActive: true },
  { id: 'doc-ktp-manager', profileId: 'manager-1', documentType: 'KTP', fileUrl: 'mock://researcher-documents/manager-1/ktp.pdf', fileName: 'ktp-kepala-lppm.pdf', fileSize: 826000, fileFormat: 'PDF', uploadedAt: '2026-06-01T03:00:00.000Z', uploadedBy: 'user-manager', isActive: true },
  { id: 'doc-cv-manager', profileId: 'manager-1', documentType: 'CV', fileUrl: 'mock://researcher-documents/manager-1/cv.pdf', fileName: 'cv-kepala-lppm.pdf', fileSize: 1334000, fileFormat: 'PDF', uploadedAt: '2026-06-01T03:10:00.000Z', uploadedBy: 'user-manager', isActive: true },
];

const researcherExpertiseMap = [
  { id: 'map-1', profileId: 'lecturer-1', expertiseId: 'expertise-ai' },
  { id: 'map-2', profileId: 'lecturer-1', expertiseId: 'expertise-ml' },
  { id: 'map-3', profileId: 'lecturer-1', expertiseId: 'expertise-si' },
  { id: 'map-4', profileId: 'lecturer-2', expertiseId: 'expertise-ai' },
  { id: 'map-5', profileId: 'lecturer-2', expertiseId: 'expertise-cv' },
  { id: 'map-6', profileId: 'lecturer-4', expertiseId: 'expertise-bisnis' },
];

const researcherVerifications = [
  { id: 'verification-1', profileId: 'lecturer-1', adminId: 'user-admin', verificationStatus: VERIFICATION_STATUS.VERIFIED, verificationNotes: 'Profil dan dokumen utama lengkap.', verifiedBy: 'user-admin', verifiedAt: '2026-06-05T03:00:00.000Z' },
];

const researcherStatusHistory = [
  { id: 'status-history-1', profileId: 'lecturer-1', oldStatus: PROFILE_STATUS.DRAFT, newStatus: PROFILE_STATUS.ACTIVE, changedBy: 'user-admin', changedAt: '2026-06-05T03:00:00.000Z' },
];

const adminAssignments = [
  { id: 'admin-assignment-1', profileId: 'lecturer-1', adminId: 'user-admin-profile', assignedAt: '2026-06-05T03:00:00.000Z', assignedBy: 'user-manager' },
  { id: 'admin-assignment-2', profileId: 'lecturer-2', adminId: 'user-admin-profile', assignedAt: '2026-06-12T03:00:00.000Z', assignedBy: 'user-manager' },
];

const systemActivityLogs = [
  { id: 'activity-log-1', logId: 'system-log-1', userId: 'user-admin-profile', action: 'verify_profile', entityType: 'researcher_profile', entityId: 'lecturer-1', oldData: { verificationStatus: VERIFICATION_STATUS.PENDING }, newData: { verificationStatus: VERIFICATION_STATUS.VERIFIED }, createdAt: '2026-06-05T03:00:00.000Z' },
];

const researcherProfiles = baseResearcherProfiles.map(profile => ({
  ...profile,
  profileCompleteness: calculateProfileCompleteness(profile, researcherDocuments.filter(doc => doc.profileId === profile.profileId)),
}));

const applicantProfiles = [
  ...lecturers.map(item => ({
    id: item.id,
    userId: item.userId,
    name: item.name,
    identifier: item.nidn,
    applicantRole: item.employmentStatus === 'homebase' ? 'Dosen Homebase' : 'Dosen Fulltime',
    applicantKind: 'lecturer',
    status: item.employmentStatus,
    faculty: item.faculty,
    program: item.program,
    email: `${item.userId.replace('user-', '')}@umn.ac.id`,
  })),
  {
    id: 'student-1', userId: 'user-student', name: 'Ayu Larasati', identifier: '00000078910', applicantRole: 'Mahasiswa S1', applicantKind: 'student_s1', status: 'active', faculty: 'Teknik dan Informatika', program: 'Informatika', email: 'student@umn.ac.id'
  },
  {
    id: 'student-2', userId: 'user-student-2', name: 'Michael Tan', identifier: '00000081234', applicantRole: 'Mahasiswa S2', applicantKind: 'student_s2', status: 'active', faculty: 'Teknik dan Informatika', program: 'Magister Teknologi Informasi', email: 'michael.tan@student.umn.ac.id'
  },
];

const previousEthicsClearances = [
  {
    id: 'clearance-1', userId: 'user-lecturer', number: '001/KE-RIS/LPPM/01/2026', researchTitle: 'Studi Interaksi Pengguna pada Sistem Pembelajaran Digital', issuedAt: '2026-01-20', expiryDate: '2026-07-20'
  },
  {
    id: 'clearance-2', userId: 'user-student', number: '014/KE-RIS/LPPM/03/2026', researchTitle: 'Analisis Pengalaman Mahasiswa dalam Pembelajaran Hybrid', issuedAt: '2026-03-12', expiryDate: '2026-09-12'
  },
];

const letterDemoApplicant = { id: 'letter-demo-applicant', userId: 'user-lecturer', name: 'Dr. Budi Santoso', identifier: '0312048501', applicantRole: 'Dosen Fulltime', applicantKind: 'lecturer', status: 'fulltime', faculty: 'Teknik dan Informatika', program: 'Sistem Informasi', email: 'lecturer@umn.ac.id', isPrimary: true };
const letterDemoAutoFill = { applicantName: 'Dr. Budi Santoso', applicantIdentifier: '0312048501', applicantEmail: 'lecturer@umn.ac.id', studyProgram: 'Sistem Informasi', faculty: 'Teknik dan Informatika', researchTitle: 'Pengembangan Repositori Riset Terintegrasi', researchYear: 2026, researchScheme: 'Penelitian Dosen Pemula 2026', researchRole: 'Ketua Penelitian' };
const letterDemoTemplate = {
  name: 'Template Surat Pendukung Penelitian',
  content: 'RESEARCH INNOVATION AND SUSTAINABILITY\nUNIVERSITAS MULTIMEDIA NUSANTARA\n\nNomor: {{letterNumber}}\n\nDengan ini menerangkan bahwa {{applicantName}} ({{applicantIdentifier}}) dari {{studyProgram}} sedang melaksanakan penelitian "{{researchTitle}}" pada skema {{researchScheme}}.\n\n{{customFields}}\n\nDemikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.',
};
const letterDemoFields = [
  { id: 'letter-field-recipient', key: 'recipientInstitution', label: 'Instansi Tujuan', type: 'text', required: true, placeholder: 'Nama instansi tujuan', helpText: '', options: [] },
  { id: 'letter-field-purpose', key: 'activityPurpose', label: 'Tujuan Kegiatan', type: 'textarea', required: true, placeholder: 'Jelaskan tujuan penggunaan surat', helpText: '', options: [] },
  { id: 'letter-field-date', key: 'activityDate', label: 'Tanggal Kegiatan', type: 'date', required: true, placeholder: '', helpText: '', options: [] },
];
const baseLetterDemo = {
  userId: 'user-lecturer', createdBy: 'user-lecturer', researchId: 'draft-approved', applicant: letterDemoApplicant, applicants: [letterDemoApplicant], autoFill: letterDemoAutoFill, attachments: [], reviews: [], createdAt: '2026-07-20T02:00:00.000Z', submittedAt: '2026-07-20T02:05:00.000Z'
};
const letterRequests = [
  {
    ...baseLetterDemo, id: 'letter-prechecked-1', type: 'support', purpose: 'interview', status: 'submitted', template: null, templateFields: [], form: {}, updatedAt: '2026-07-20T02:05:00.000Z', history: [{ status: 'submitted', note: 'Permintaan surat wawancara dikirim untuk diverifikasi.', at: '2026-07-20T02:05:00.000Z', by: 'user-lecturer' }]
  },
  {
    ...baseLetterDemo, id: 'letter-form-design-1', type: 'travel', purpose: 'research_travel', status: 'form_design', template: { ...letterDemoTemplate, name: 'Template Surat Tugas Perjalanan Penelitian' }, templateFields: [], form: {}, updatedAt: '2026-07-22T03:00:00.000Z', history: [{ status: 'submitted', note: 'Permintaan surat perjalanan dikirim.', at: '2026-07-21T02:00:00.000Z', by: 'user-lecturer' }, { status: 'form_design', note: 'Permintaan diterima. Admin sedang menyusun form.', at: '2026-07-22T03:00:00.000Z', by: 'user-admin-letter' }]
  },
  {
    ...baseLetterDemo, id: 'letter-data-required-1', type: 'ethics', purpose: 'new', status: 'data_required', template: { ...letterDemoTemplate, name: 'Template Permohonan Klirens Etik' }, templateFields: letterDemoFields, form: {}, updatedAt: '2026-07-24T04:00:00.000Z', history: [{ status: 'submitted', note: 'Permintaan klirens etik dikirim.', at: '2026-07-23T02:00:00.000Z', by: 'user-lecturer' }, { status: 'form_design', note: 'Permintaan diterima.', at: '2026-07-23T06:00:00.000Z', by: 'user-admin-letter' }, { status: 'data_required', note: 'Form telah disiapkan dan menunggu data lecturer.', at: '2026-07-24T04:00:00.000Z', by: 'user-admin-letter' }]
  },
  {
    ...baseLetterDemo, id: 'letter-data-submitted-1', type: 'support', purpose: 'research_permission', status: 'data_submitted', template: letterDemoTemplate, templateFields: letterDemoFields, form: { recipientInstitution: 'Dinas Komunikasi dan Informatika Kota Tangerang', activityPurpose: 'Permohonan akses data terbatas untuk validasi metadata repositori penelitian.', activityDate: '2026-09-10' }, dataSubmittedAt: '2026-07-27T04:00:00.000Z', updatedAt: '2026-07-27T04:00:00.000Z', history: [{ status: 'submitted', note: 'Permintaan surat izin penelitian dikirim.', at: '2026-07-25T02:00:00.000Z', by: 'user-lecturer' }, { status: 'form_design', note: 'Permintaan diterima.', at: '2026-07-25T06:00:00.000Z', by: 'user-admin-letter' }, { status: 'data_required', note: 'Form dikirim ke lecturer.', at: '2026-07-26T03:00:00.000Z', by: 'user-admin-letter' }, { status: 'data_submitted', note: 'Data dilengkapi dan menunggu verifikasi final.', at: '2026-07-27T04:00:00.000Z', by: 'user-lecturer' }]
  },
  {
    ...baseLetterDemo, id: 'letter-revision-1', type: 'custom', purpose: '', customName: 'Surat Keterangan Pelaksanaan Uji Lapangan', status: 'revision_required', template: { ...letterDemoTemplate, name: 'Template Surat Keterangan Uji Lapangan' }, templateFields: letterDemoFields, form: { recipientInstitution: 'PT Data Nusantara', activityPurpose: '', activityDate: '2026-09-18' }, updatedAt: '2026-07-29T05:00:00.000Z', history: [{ status: 'submitted', note: 'Permintaan surat custom dikirim.', at: '2026-07-27T02:00:00.000Z', by: 'user-lecturer' }, { status: 'form_design', note: 'Permintaan diterima.', at: '2026-07-27T06:00:00.000Z', by: 'user-admin-letter' }, { status: 'data_required', note: 'Form dikirim ke lecturer.', at: '2026-07-28T03:00:00.000Z', by: 'user-admin-letter' }, { status: 'data_submitted', note: 'Data dikirim untuk verifikasi.', at: '2026-07-29T03:00:00.000Z', by: 'user-lecturer' }, { status: 'revision_required', note: 'Tujuan kegiatan perlu dilengkapi.', at: '2026-07-29T05:00:00.000Z', by: 'user-admin-letter' }]
  },
  {
    ...baseLetterDemo, id: 'letter-rejected-1', type: 'support', purpose: 'other_research_activity', status: 'rejected', template: null, templateFields: [], form: {}, updatedAt: '2026-07-30T05:00:00.000Z', history: [{ status: 'submitted', note: 'Permintaan surat kegiatan lain dikirim.', at: '2026-07-30T02:00:00.000Z', by: 'user-lecturer' }, { status: 'rejected', note: 'Kebutuhan surat berada di luar lingkup penelitian yang didanai.', at: '2026-07-30T05:00:00.000Z', by: 'user-admin-letter' }]
  },
  {
    ...baseLetterDemo, id: 'letter-generated-1', type: 'research_assignment', purpose: 'internal_grant', status: 'generated', template: letterDemoTemplate, templateFields: letterDemoFields, form: { recipientInstitution: 'LPPM Universitas Multimedia Nusantara', activityPurpose: 'Pelaksanaan penelitian internal tahun 2026.', activityDate: '2026-08-15' }, generated: { letterNumber: '0001/ST-RIS/LPPM/08/2026', fileName: '0001-ST-RIS-LPPM-08-2026.pdf', fileUrl: 'archive://letter-generated-1', generatedAt: '2026-08-01T04:00:00.000Z', content: 'RESEARCH INNOVATION AND SUSTAINABILITY\nUNIVERSITAS MULTIMEDIA NUSANTARA\n\nNomor: 0001/ST-RIS/LPPM/08/2026\n\nDr. Budi Santoso ditugaskan melaksanakan penelitian Pengembangan Repositori Riset Terintegrasi.\n\nSurat final demo.' }, updatedAt: '2026-08-01T04:00:00.000Z', history: [{ status: 'submitted', note: 'Permintaan surat tugas dikirim.', at: '2026-07-28T02:00:00.000Z', by: 'user-lecturer' }, { status: 'form_design', note: 'Permintaan diterima.', at: '2026-07-28T06:00:00.000Z', by: 'user-admin-letter' }, { status: 'data_required', note: 'Form dikirim ke lecturer.', at: '2026-07-29T03:00:00.000Z', by: 'user-admin-letter' }, { status: 'data_submitted', note: 'Data dikirim untuk verifikasi.', at: '2026-07-30T03:00:00.000Z', by: 'user-lecturer' }, { status: 'generated', note: 'Surat final diterbitkan.', at: '2026-08-01T04:00:00.000Z', by: 'user-admin-letter' }]
  },
];


const externalResearchReports = [
  {
    id: 'external-report-1',
    userId: 'user-lecturer',
    createdBy: 'user-lecturer',
    userName: 'Dr. Budi Santoso',
    activityName: 'Hibah Riset Terapan Kemdikbud 2026',
    researchTitle: 'Model Analitik Prediksi Keberhasilan Studi Mahasiswa',
    activityYear: 2026,
    activityStatus: 'ongoing',
    activityType: 'external',
    roleInResearch: 'ketua',
    organizerOrigin: 'Kemdikbudristek',
    fundingSource: 'DRTPM',
    fundingAmount: 150000000,
    currency: 'IDR',
    submissionStatus: EXTERNAL_STATUS.SUBMITTED,
    category: 'grant',
    metadata: {
      ripRelation: 'ICT-Based',
      tktTarget: 5,
      sdgInvolvement: true,
      sdgs: [4, 9],
      integrationToTeaching: true,
      courseName: 'Data Mining',
      academicYear: '2026/2027',
      integrationProofFile: { id: 'external-teach-proof-1', category: 'integration_proof', name: 'rps-data-mining.pdf', size: 280000, type: 'application/pdf', fileUrl: 'rps-data-mining.pdf' },
    },
    typeDetail: {
      grantType: 'nasional',
      grantName: 'Hibah Riset Terapan',
      grantLink: 'https://example.test/hibah',
      researchStatus: 'ongoing',
      fundingAmount: 150000000,
    },
    documents: [
      { id: 'external-file-1', fileType: 'proposal', name: 'proposal-hibah.pdf', fileName: 'proposal-hibah.pdf', fileUrl: 'proposal-hibah.pdf', size: 1200000, type: 'application/pdf', uploadedBy: 'user-lecturer', uploadedAt: '2026-06-03T02:00:00.000Z' },
      { id: 'external-file-2', fileType: 'budget_plan', name: 'rab-hibah.xlsx', fileName: 'rab-hibah.xlsx', fileUrl: 'rab-hibah.xlsx', size: 350000, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', uploadedBy: 'user-lecturer', uploadedAt: '2026-06-03T02:00:00.000Z' },
      { id: 'external-file-3', fileType: 'contract', name: 'kontrak-hibah.pdf', fileName: 'kontrak-hibah.pdf', fileUrl: 'kontrak-hibah.pdf', size: 500000, type: 'application/pdf', uploadedBy: 'user-lecturer', uploadedAt: '2026-06-03T02:00:00.000Z' },
    ],
    outputs: [
      { id: 'external-output-1', outputType: 'journal', title: 'Predictive Analytics for Student Success', year: 2026, description: 'Artikel jurnal terkait model prediksi.', link: '', file: null },
      { id: 'external-output-2', outputType: 'prototype', title: 'Dashboard Prediksi Akademik', year: 2026, description: 'Prototype dashboard analitik.', link: '', file: null },
    ],
    reviews: [],
    history: [
      { status: EXTERNAL_STATUS.DRAFT, note: 'Draft laporan dibuat.', at: '2026-06-02T02:00:00.000Z', by: 'user-lecturer' },
      { status: EXTERNAL_STATUS.SUBMITTED, note: 'Laporan disubmit ke LPPM.', at: '2026-06-03T02:10:00.000Z', by: 'user-lecturer' },
    ],
    createdAt: '2026-06-02T02:00:00.000Z',
    updatedAt: '2026-06-03T02:10:00.000Z',
    submittedAt: '2026-06-03T02:10:00.000Z',
    validatedAt: null,
    archivedAt: null,
  },
  {
    id: 'external-report-2',
    userId: 'user-lecturer',
    createdBy: 'user-lecturer',
    userName: 'Dr. Budi Santoso',
    activityName: 'Penelitian Mandiri PRO-STEP',
    researchTitle: 'Pengembangan Prototipe Sistem Informasi Riset Terintegrasi',
    activityYear: 2025,
    activityStatus: 'completed',
    activityType: 'mandiri',
    roleInResearch: 'ketua',
    organizerOrigin: 'Mandiri',
    fundingSource: 'Mandiri',
    fundingAmount: 25000000,
    currency: 'IDR',
    submissionStatus: EXTERNAL_STATUS.VALIDATED,
    category: 'independent',
    metadata: { ripRelation: 'ICT-Based', tktTarget: 6, sdgInvolvement: true, sdgs: [4, 9], integrationToTeaching: false, courseName: '', academicYear: '', integrationProofFile: null },
    typeDetail: { independentType: 'prostep' },
    documents: [
      { id: 'external-file-4', fileType: 'proposal', name: 'proposal-prostep.pdf', fileName: 'proposal-prostep.pdf', fileUrl: 'proposal-prostep.pdf', size: 920000, type: 'application/pdf', uploadedBy: 'user-lecturer', uploadedAt: '2025-11-03T02:00:00.000Z' },
      { id: 'external-file-5', fileType: 'budget_plan', name: 'rab-prostep.xlsx', fileName: 'rab-prostep.xlsx', fileUrl: 'rab-prostep.xlsx', size: 210000, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', uploadedBy: 'user-lecturer', uploadedAt: '2025-11-03T02:00:00.000Z' },
      { id: 'external-file-6', fileType: 'contract', name: 'surat-tugas-prostep.pdf', fileName: 'surat-tugas-prostep.pdf', fileUrl: 'surat-tugas-prostep.pdf', size: 320000, type: 'application/pdf', uploadedBy: 'user-lecturer', uploadedAt: '2025-11-03T02:00:00.000Z' },
      { id: 'external-file-7', fileType: 'final_report', name: 'laporan-akhir-prostep.pdf', fileName: 'laporan-akhir-prostep.pdf', fileUrl: 'laporan-akhir-prostep.pdf', size: 1800000, type: 'application/pdf', uploadedBy: 'user-lecturer', uploadedAt: '2025-12-12T02:00:00.000Z' },
    ],
    outputs: [{ id: 'external-output-3', outputType: 'prototype', title: 'Prototype RIS', year: 2025, description: 'Prototype dashboard RIS.', link: 'https://example.test/prototype', file: null }],
    reviews: [{ id: 'external-review-1', reportId: 'external-report-2', reviewerId: 'user-admin', decision: EXTERNAL_STATUS.VALIDATED, notes: 'Laporan dan dokumen lengkap.', checklist: { fieldComplete: true, documentsComplete: true, documentsValid: true, notDuplicate: true, statusConsistent: true }, reviewedAt: '2025-12-15T02:00:00.000Z' }],
    history: [
      { status: EXTERNAL_STATUS.DRAFT, note: 'Draft laporan dibuat.', at: '2025-11-03T02:00:00.000Z', by: 'user-lecturer' },
      { status: EXTERNAL_STATUS.SUBMITTED, note: 'Laporan disubmit ke LPPM.', at: '2025-12-12T02:00:00.000Z', by: 'user-lecturer' },
      { status: EXTERNAL_STATUS.VALIDATED, note: 'Laporan divalidasi LPPM.', at: '2025-12-15T02:00:00.000Z', by: 'user-admin' },
    ],
    createdAt: '2025-11-03T02:00:00.000Z', updatedAt: '2025-12-15T02:00:00.000Z', submittedAt: '2025-12-12T02:00:00.000Z', validatedAt: '2025-12-15T02:00:00.000Z', archivedAt: null,
  },
];

const project = {
  title: 'Pengembangan Sistem Analitik Penelitian Berbasis Kecerdasan Buatan',
  mandatoryOutputPlan: 'scopus_q2',
  additionalOutputPlan: 'prototype',
  additionalOutputPlans: ['prototype'],
  targetTkt: 5,
  ripRelation: 'ict_based',
  researchCenterRelation: 'ict_based',
  sdgs: [4, 9],
  integrated: true,
  courseName: 'machine_learning',
  academicYear: '2025/2026',
};

const members = [
  {
    id: 'member-1', role: 'ketua', type: 'internal_lecturer', profileId: 'lecturer-1', name: 'Dr. Budi Santoso', nidn: '0312048501', program: 'Sistem Informasi', faculty: 'Teknik dan Informatika', orcid: '0000000218250097'
  },
  {
    id: 'member-2', role: 'member', type: 'internal_lecturer', profileId: 'lecturer-2', name: 'Dr. Andini Prameswari', nidn: '0308078602', program: 'Informatika', faculty: 'Teknik dan Informatika', orcid: '0000000319261188'
  },
];

const budgets = [
  {
    id: 'budget-1', tab: 'materials', component: 'Bahan habis pakai', name: 'Perangkat sensor', volume: 4, unit: 'unit', unitPrice: 1250000, notes: 'Perangkat prototipe'
  },
  {
    id: 'budget-2', tab: 'analysis', component: 'Pengolahan data', name: 'Cloud computing', volume: 6, unit: 'bulan', unitPrice: 750000, notes: ''
  },
];

const outputs = [
  {
    ...OUTPUT_EMPTY, id: 'output-1', type: 'wajib', title: 'Artikel Analitik Penelitian', targetYear: 2026, description: 'Artikel pada jurnal internasional bereputasi.', category: 'jurnal', journalTargetLevel: 'scopus', journalIndexTarget: 'Scopus Q2', publicationType: 'internasional', targetQuartile: 'Q2'
  },
];

const files = [
  {
    id: 'file-1', category: 'proposal', name: 'proposal-penelitian.pdf', size: 1843200, type: 'application/pdf'
  },
  {
    id: 'file-2', category: 'rab', name: 'rab-penelitian.xlsx', size: 245760, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  },
];

const demoSchemeOutputOptions = [
  {
    id: 'demo-output-journal',
    name: 'Artikel Jurnal Scopus Q2',
    category: 'jurnal',
    journalTargetLevel: 'scopus',
    journalIndexTarget: 'Scopus Q2',
    publicationType: 'internasional',
    targetQuartile: 'Q2',
  },
  {
    id: 'demo-output-proceeding',
    name: 'Prosiding Internasional Terindeks Scopus',
    category: 'prosiding',
    proceedingType: 'internasional',
    indexTarget: 'Scopus',
  },
  {
    id: 'demo-output-hki',
    name: 'Paten Sederhana (terdaftar)',
    category: 'hki',
    hkiType: 'paten_sederhana',
    targetRegistrationYear: '2027',
  },
];

const demoDocumentTemplate = (id, name, title) => ({
  id,
  name,
  size: 24576,
  type: 'application/msword',
  dataUrl: `data:application/msword;charset=utf-8,${encodeURIComponent(`<html><body><h1>${title}</h1><p>Template demo RIS UMN. Lengkapi dokumen ini sesuai data penelitian.</p></body></html>`)}`,
});

const demoSpreadsheetTemplate = {
  id: 'template-demo-rab',
  name: 'template-rab-penelitian.xls',
  size: 18432,
  type: 'application/vnd.ms-excel',
  dataUrl: `data:application/vnd.ms-excel;charset=utf-8,${encodeURIComponent('<table><tr><th>Komponen</th><th>Volume</th><th>Harga Satuan</th><th>Total</th></tr></table>')}`,
};

const demoSchemeAttachmentRequirements = [
  {
    ...BASE_ATTACHMENT_REQUIREMENTS[0],
    template: demoDocumentTemplate('template-demo-proposal', 'template-proposal-penelitian.doc', 'Template Proposal Penelitian'),
  },
  {
    ...BASE_ATTACHMENT_REQUIREMENTS[1],
    template: demoSpreadsheetTemplate,
  },
  {
    id: 'lead-researcher-statement',
    category: 'scheme_attachment_lead_statement',
    name: 'Surat Pernyataan Ketua Peneliti',
    accept: '.pdf',
    templateAccept: '.pdf,.doc,.docx',
    required: true,
    custom: true,
    template: demoDocumentTemplate('template-demo-lead-statement', 'template-surat-pernyataan-ketua.doc', 'Surat Pernyataan Ketua Peneliti'),
  },
  {
    id: 'partner-willingness-statement',
    category: 'scheme_attachment_partner_statement',
    name: 'Surat Kesediaan Mitra',
    accept: '.pdf',
    templateAccept: '.pdf,.doc,.docx',
    required: true,
    custom: true,
    template: demoDocumentTemplate('template-demo-partner-statement', 'template-surat-kesediaan-mitra.doc', 'Surat Kesediaan Mitra'),
  },
  {
    id: 'research-integrity-pact',
    category: 'scheme_attachment_integrity_pact',
    name: 'Pakta Integritas Tim Peneliti',
    accept: '.pdf',
    templateAccept: '.pdf,.doc,.docx',
    required: true,
    custom: true,
    template: demoDocumentTemplate('template-demo-integrity-pact', 'template-pakta-integritas.doc', 'Pakta Integritas Tim Peneliti'),
  },
  {
    id: 'research-team-cv',
    category: 'scheme_attachment_team_cv',
    name: 'Biodata Tim Peneliti',
    accept: '.pdf',
    templateAccept: '.pdf,.doc,.docx',
    required: true,
    custom: true,
    template: demoDocumentTemplate('template-demo-team-cv', 'template-biodata-tim-peneliti.doc', 'Biodata Tim Peneliti'),
  },
];

const draftBase = {
  userId: 'user-lecturer', userName: 'Dr. Budi Santoso', schemeId: 'scheme-1', project, members, budgets, outputs, files, createdAt: '2026-05-04T08:30:00.000Z', submittedAt: '2026-05-06T03:15:00.000Z'
};

export const createInitialData = () => ({
  catalogDemoSeedVersion: 1,
  attachmentDemoSeedVersion: 1,
  schemeDataDemoSeedVersion: 1,
  schemeMonitoringDemoSeedVersion: 1,
  fundedReviewSeedVersion: 1,
  letterWorkflowSeedVersion: 1,
  systemUsers,
  researcherProfiles,
  researcherDocuments,
  researcherExpertise,
  researcherExpertiseMap,
  researcherVerifications,
  researcherStatusHistory,
  adminAssignments,
  systemActivityLogs,
  profileSequence: 7,
  lecturers,
  temporaryRoleAssignments: [
    { id: 'reviewer-grant-assigned-1', userId: 'user-lecturer-2', profileId: 'lecturer-2', role: 'reviewer', entityType: 'research_proposal', entityId: 'draft-assigned', status: 'active', assignedAt: '2026-05-08T07:00:00.000Z', assignedBy: 'user-admin' },
    { id: 'reviewer-grant-reviewed-1', userId: 'user-lecturer-2', profileId: 'lecturer-2', role: 'reviewer', entityType: 'research_proposal', entityId: 'draft-reviewed', status: 'active', assignedAt: '2026-05-08T07:00:00.000Z', assignedBy: 'user-admin' },
    { id: 'reviewer-grant-reviewed-2', userId: 'user-lecturer-3', profileId: 'lecturer-3', role: 'reviewer', entityType: 'research_proposal', entityId: 'draft-reviewed', status: 'active', assignedAt: '2026-05-08T07:00:00.000Z', assignedBy: 'user-admin' },
  ],
  applicantProfiles,
  previousEthicsClearances,
  letterRequests,
  letterDefinitions: createDefaultLetterDefinitions(),
  letterMasterTemplate: createLetterMasterTemplate(),
  letterSequence: 2,
  notifications: [],
  notificationReadIds: [],
  reviewerReminders: [],
  emailOutbox: [],
  externalResearchReports,
  externalResearchSequence: 2,
  schemes: [
    {
      id: 'scheme-1', name: 'Penelitian Dosen Pemula 2026', description: 'Pendanaan penelitian internal bagi dosen yang sedang membangun rekam jejak penelitian.', startDate: '2026-07-01', endDate: '2027-06-30', registrationStartDate: '2026-01-01T08:00', registrationEndDate: '2026-12-31T23:59', year: 2026, maximumBudget: 25000000, status: 'open', schemeStatus: 'open', eligibleProfileIds: lecturers.map(item => item.id), eligibleUserIds: lecturers.map(item => item.userId), eligibleLecturerIds: lecturers.map(item => item.id), filters: {}
    },
    {
      id: 'scheme-2', name: 'Hibah Penelitian Kompetitif Internal', description: 'Skema penelitian kompetitif untuk menghasilkan publikasi dan inovasi unggulan.', startDate: '2026-08-01', endDate: '2027-07-31', registrationStartDate: '2026-02-01T08:00', registrationEndDate: '2026-11-30T23:59', year: 2026, maximumBudget: 75000000, status: 'open', schemeStatus: 'open', eligibleProfileIds: ['lecturer-1', 'lecturer-2'], eligibleUserIds: ['user-lecturer', 'user-lecturer-2'], eligibleLecturerIds: ['lecturer-1', 'lecturer-2'], filters: {}
    },
    {
      id: 'scheme-3', name: 'Penelitian Kerjasama Industri', description: 'Penelitian kolaboratif bersama mitra industri strategis.', startDate: '2026-09-01', endDate: '2027-08-31', registrationStartDate: '2026-03-01T08:00', registrationEndDate: '2026-10-31T23:59', year: 2026, maximumBudget: 150000000, status: 'open', schemeStatus: 'open', eligibleProfileIds: ['lecturer-1', 'lecturer-4'], eligibleUserIds: ['user-lecturer', 'user-lecturer-4'], eligibleLecturerIds: ['lecturer-1', 'lecturer-4'], filters: {}
    },
    {
      id: 'scheme-demo-output-2026', name: 'Skema Demo Luaran Fleksibel 2026', description: 'Skema terbuka untuk mencoba pemilihan beberapa luaran wajib dan luaran tambahan pada proposal.', startDate: '2026-09-01', endDate: '2027-08-31', registrationStartDate: '2026-07-01T08:00', registrationEndDate: '2026-12-31T23:59', year: 2026, maximumBudget: 50000000, status: 'open', schemeStatus: 'open', eligibleProfileIds: lecturers.map(item => item.id), eligibleUserIds: lecturers.map(item => item.userId), eligibleLecturerIds: lecturers.map(item => item.id), filters: {}, outputOptions: demoSchemeOutputOptions
    },
    {
      id: 'scheme-demo-draft-2026', name: 'Hibah Transformasi Pembelajaran Digital 2026', description: 'Pendanaan riset terapan untuk meningkatkan kualitas pembelajaran melalui teknologi digital yang terukur.', startDate: '2026-10-01', endDate: '2027-09-30', registrationStartDate: '2026-07-01T08:00', registrationEndDate: '2026-12-31T23:59', year: 2026, maximumBudget: 65000000, status: 'open', schemeStatus: 'open', eligibleProfileIds: ['lecturer-1', 'lecturer-3'], eligibleUserIds: ['user-lecturer', 'user-lecturer-3'], eligibleLecturerIds: ['lecturer-1', 'lecturer-3'], filters: {}, outputOptions: demoSchemeOutputOptions, attachmentRequirements: demoSchemeAttachmentRequirements
    },
    {
      id: 'scheme-demo-clean-2026', name: 'Hibah Inovasi Pembelajaran Berkelanjutan 2026', description: 'Pendanaan penelitian kolaboratif untuk menghasilkan inovasi pembelajaran yang terukur, inklusif, dan dapat diterapkan secara berkelanjutan.', startDate: '2026-11-01', endDate: '2027-10-31', registrationStartDate: '2026-08-01T08:00', registrationEndDate: '2026-12-31T23:59', year: 2026, maximumBudget: 80000000, status: 'open', schemeStatus: 'open', eligibleProfileIds: lecturers.map(item => item.id), eligibleUserIds: lecturers.map(item => item.userId), eligibleLecturerIds: lecturers.map(item => item.id), filters: {}, outputOptions: demoSchemeOutputOptions, attachmentRequirements: demoSchemeAttachmentRequirements
    },
    {
      id: 'scheme-demo-catalog-2026', name: 'Hibah Strategis Bisnis Berkelanjutan 2026', description: 'Skema kolaboratif bagi peneliti bidang bisnis untuk menghasilkan model keberlanjutan dan rekomendasi industri.', startDate: '2026-11-01', endDate: '2027-10-31', registrationStartDate: '2026-07-01T08:00', registrationEndDate: '2026-12-31T23:59', year: 2026, maximumBudget: 90000000, status: 'open', schemeStatus: 'open', eligibleProfileIds: ['lecturer-2', 'lecturer-4'], eligibleUserIds: ['user-lecturer-2', 'user-lecturer-4'], eligibleLecturerIds: ['lecturer-2', 'lecturer-4'], filters: {}, outputOptions: demoSchemeOutputOptions
    },
  ].map(scheme => ({
    ...scheme,
    reportingSchedule: normalizeReportingSchedule(scheme),
    outputOptions: normalizeSchemeOutputOptions(scheme),
    attachmentRequirements: normalizeSchemeAttachmentRequirements(scheme),
  })),
  drafts: [
    {
      ...draftBase, id: 'draft-submitted', status: STATUS.SUBMITTED, schemeId: 'scheme-1'
    },
    {
      ...draftBase, id: 'draft-assigned', status: STATUS.UNDER_REVIEW, schemeId: 'scheme-2', project: { ...project, title: 'Model Prediksi Keberhasilan Studi Mahasiswa Menggunakan Machine Learning' }, verification: { status: 'verified', checklist: { project: true, members: true, budget: true, outputs: true, attachments: true }, verifiedAt: '2026-05-08T06:30:00.000Z', verifiedBy: 'user-admin' }, assignments: [{ id: 'assignment-draft-assigned-1', reviewerUserId: 'user-lecturer-2', reviewerProfileId: 'lecturer-2', status: 'assigned', assignedAt: '2026-05-08T07:00:00.000Z', assignedBy: 'user-admin', dueAt: '2026-08-04T16:59:00.000Z' }], reviews: []
    },
    {
      ...draftBase,
      id: 'draft-reviewed',
      status: STATUS.REVIEWED,
      schemeId: 'scheme-3',
      project: { ...project, title: 'Platform Kolaborasi Riset Universitas dan Industri Kreatif' },
      verification: { status: 'verified', checklist: { project: true, members: true, budget: true, outputs: true, attachments: true }, verifiedAt: '2026-05-08T06:30:00.000Z', verifiedBy: 'user-admin' },
      assignments: [
        { id: 'assignment-draft-reviewed-1', reviewerUserId: 'user-lecturer-2', reviewerProfileId: 'lecturer-2', status: 'submitted', assignedAt: '2026-05-08T07:00:00.000Z', assignedBy: 'user-admin', dueAt: '2026-05-20T16:59:00.000Z', submittedAt: '2026-05-10T04:00:00.000Z' },
        { id: 'assignment-draft-reviewed-2', reviewerUserId: 'user-lecturer-3', reviewerProfileId: 'lecturer-3', status: 'assigned', assignedAt: '2026-05-08T07:00:00.000Z', assignedBy: 'user-admin', dueAt: '2026-07-31T16:59:00.000Z' },
      ],
      reviews: [{
        id: 'review-draft-reviewed-1', reviewerUserId: 'user-lecturer-2', reviewerProfileId: 'lecturer-2', scores: Object.fromEntries(REVIEW_CRITERIA.map(item => [item.code, 82])), totalScore: 82, recommendation: 'approve', strengths: 'Topik relevan dan metodologi jelas.', weaknesses: 'Rencana diseminasi perlu dirinci.', budgetNotes: 'Anggaran wajar.', outputNotes: 'Target luaran realistis.', revisionNotes: '', submittedAt: '2026-05-10T04:00:00.000Z'
      }]
    },
    {
      ...draftBase, id: 'draft-approved', status: STATUS.FUNDED, schemeId: 'scheme-1', project: { ...project, title: 'Pengembangan Repositori Riset Terintegrasi' }, verification: { status: 'verified', checklist: { project: true, members: true, budget: true, outputs: true, attachments: true }, verifiedAt: '2026-05-08T06:30:00.000Z', verifiedBy: 'user-admin' }, outputs: [...outputs, { ...OUTPUT_EMPTY, id: 'output-funded-additional', name: 'Prototype Dashboard Analitik Penelitian', type: 'tambahan', description: 'Prototype dashboard sebagai luaran tambahan penelitian.', category: 'produk_prototipe', productType: 'prototype', targetTkt: 'TKT 6', expectedOutputForm: 'prototype' }], assignments: [{ id: 'assignment-draft-approved-1', reviewerUserId: 'user-lecturer-2', reviewerProfileId: 'lecturer-2', status: 'revoked', assignedAt: '2026-05-08T07:00:00.000Z', assignedBy: 'user-admin', dueAt: '2026-05-20T16:59:00.000Z', submittedAt: '2026-05-10T04:00:00.000Z', revokedAt: '2026-05-12T04:00:00.000Z', revokedBy: 'user-manager' }], reviews: [{ id: 'review-draft-approved-1', reviewerUserId: 'user-lecturer-2', reviewerProfileId: 'lecturer-2', scores: Object.fromEntries(REVIEW_CRITERIA.map(item => [item.code, 88])), totalScore: 88, recommendation: 'approve', strengths: 'Rancangan integrasi dan dampak institusional sangat kuat.', weaknesses: 'Rencana mitigasi migrasi data perlu diperdalam.', budgetNotes: 'Anggaran proporsional.', outputNotes: 'Luaran terukur dan relevan.', revisionNotes: '', submittedAt: '2026-05-10T04:00:00.000Z' }], decision: { finalDecision: 'funded', notes: 'Proposal disetujui untuk didanai.', decidedAt: '2026-05-12T04:00:00.000Z', decidedBy: 'user-manager', signerName: 'Manager LPPM', signerRole: 'Manager', isFinal: true }, fundingLetter: { number: '001/SPP-RIS/LPPM/V/2026', issuedAt: '2026-05-12T04:00:00.000Z', signedAt: '2026-05-12T04:00:00.000Z', signedBy: 'user-manager', signerName: 'Manager LPPM', signerRole: 'Manager', fileName: 'surat-penetapan-pendanaan-draft-approved.pdf' }, contract: { status: 'unsigned', templateName: 'template-kontrak.pdf' }
    },
    {
      ...draftBase, id: 'draft-demo-saved', status: STATUS.DRAFT, schemeId: 'scheme-demo-draft-2026', currentStep: 3, submittedAt: null, updatedAt: '2026-07-22T09:30:00.000Z', lastSavedAt: '2026-07-22T09:30:00.000Z', project: { ...project, title: 'Adaptive Learning untuk Peningkatan Retensi Mahasiswa' }, assignments: [], reviews: []
    },
  ],
  logbooks: [],
  internalReports: [],
  monevRecords: [
    {
      id: 'monev-demo-interim-1', researchId: 'draft-approved', schemeId: 'scheme-1', periodId: 'scheme-1-interim-1', periodLabel: 'Monev Periode 1', status: 'submitted', payload: { progress: 35, milestone: 'Arsitektur sistem dan rancangan metadata selesai', achievements: 'Arsitektur repositori, skema metadata, dan prototipe awal berhasil disusun.', deviations: 'Validasi metadata mundur satu minggu karena penyesuaian sumber data.', risks: 'Perbedaan kualitas metadata dari sistem lama.', correctiveAction: 'Menambahkan tahap normalisasi dan validasi metadata otomatis.', evidence: { id: 'file-monev-demo-1', category: 'monev', name: 'bukti-monev-periode-1.pdf', size: 786432, type: 'application/pdf' } }, submittedAt: '2026-07-18T08:00:00.000Z', publishedAt: '2026-07-18T08:00:00.000Z', evaluatedBy: 'user-admin', updatedAt: '2026-07-18T08:00:00.000Z', updatedBy: 'user-admin'
    },
  ],
  fundedReviewAssignments: [
    { id: 'funded-review-assignment-monev-1', targetType: 'monev', targetId: 'monev-demo-interim-1', researchId: 'draft-approved', reviewerUserId: 'user-lecturer-2', reviewerProfileId: 'lecturer-2', status: 'assigned', assignedBy: 'user-admin', assignedAt: '2026-08-01T08:00:00.000Z', dueAt: '2026-08-20T16:59:00.000Z' },
  ],
  fundedReviews: [],
  fundedReviewerReminders: [],
});

const removeLegacyDbMetadata = value => {
  if (Array.isArray(value)) return value.map(removeLegacyDbMetadata);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).reduce((result, key) => (key === 'db' ? result : { ...result, [key]: removeLegacyDbMetadata(value[key]) }), {});
};

const legacyReviewerUsers = {
  'user-reviewer': 'user-lecturer-2',
  'user-reviewer-2': 'user-lecturer-3',
  'user-reviewer-3': 'user-lecturer-4',
};
const legacyReviewerProfiles = {
  'reviewer-1': 'lecturer-2',
  'reviewer-2': 'lecturer-3',
  'reviewer-3': 'lecturer-4',
};

const isRemovedLegacyAccount = account => {
  const role = String((account && account.role) || '').toLowerCase();
  const applicantType = String((account && (account.applicantType || account.applicantKind)) || '').toLowerCase();
  return role === 'reviewer' || role === 'student' || applicantType.includes('student') || applicantType.includes('mahasiswa');
};

const normalizeSystemUser = account => {
  const role = account.id === 'user-manager' ? ROLE.MANAGER : normalizeRole(account.role);
  const researchAdmin = account.id === 'user-admin';
  let adminScopes = [];
  if (role === ROLE.ADMIN) {
    if (Array.isArray(account.adminScopes)) adminScopes = account.adminScopes.filter(scope => ALL_ADMIN_SCOPES.includes(scope));
    else if (account.id === 'user-admin') adminScopes = [ADMIN_SCOPE.RESEARCH];
    else adminScopes = [...ALL_ADMIN_SCOPES];
  }
  return {
    ...account,
    name: researchAdmin ? 'Admin Penelitian' : account.name,
    email: researchAdmin ? 'admin.penelitian@umn.ac.id' : account.id === 'user-lecturer-2' ? 'reviewer@umn.ac.id' : account.email,
    role,
    adminScopes,
    applicantType: null,
  };
};

const normalizeResearcherProfile = profile => {
  if (profile.userId === 'user-admin') {
    return {
      ...profile,
      fullName: 'Admin Penelitian',
      institutionEmail: 'admin.penelitian@umn.ac.id',
      position: 'Admin Penelitian',
    };
  }
  if (profile.userId === 'user-lecturer-2') {
    return { ...profile, institutionEmail: 'reviewer@umn.ac.id' };
  }
  return profile;
};

const normalizeResearchDraft = draft => {
  const assignments = draftReviewerAssignments(draft).map((assignment, index) => ({
    ...assignment,
    id: assignment.id || `assignment-${draft.id}-${index + 1}`,
    reviewerUserId: legacyReviewerUsers[assignment.reviewerUserId] || assignment.reviewerUserId,
    reviewerProfileId: legacyReviewerProfiles[assignment.reviewerProfileId] || assignment.reviewerProfileId,
  }));
  const reviews = draftReviews(draft).map((review, index) => ({
    ...review,
    id: review.id || `review-${draft.id}-${index + 1}`,
    reviewerUserId: legacyReviewerUsers[review.reviewerUserId] || review.reviewerUserId,
    reviewerProfileId: legacyReviewerProfiles[review.reviewerProfileId] || review.reviewerProfileId,
  }));
  const normalized = draft.archivedAt ? STATUS.ARCHIVED : normalizeStatus(draft.status || draft.draftStatus || draft.draft_status);
  const status = normalized === STATUS.UNDER_REVIEW && reviews.some(review => review.submittedAt) ? STATUS.REVIEWED : normalized;
  const finalAssignments = assignments.map(assignment => ([STATUS.FUNDED, STATUS.REJECTED, STATUS.ARCHIVED].includes(status) ? {
    ...assignment,
    status: 'revoked',
    revokedAt: assignment.revokedAt || draft.archivedAt || (draft.decision && draft.decision.decidedAt) || draft.approvedAt,
    revokedBy: assignment.revokedBy || (draft.decision && (draft.decision.decidedBy || draft.decision.managerId)),
  } : assignment));
  const legacyFundingLetter = status === STATUS.FUNDED && !draft.fundingLetter ? {
    number: `SPP-${String(draft.id || '').toUpperCase()}`,
    issuedAt: (draft.decision && draft.decision.decidedAt) || draft.approvedAt,
    signedAt: (draft.decision && draft.decision.decidedAt) || draft.approvedAt,
    signedBy: draft.decision && (draft.decision.decidedBy || draft.decision.managerId),
    signerName: draft.decision && draft.decision.signerName,
    signerRole: draft.decision && draft.decision.signerRole,
    fileName: `surat-penetapan-pendanaan-${draft.id}.pdf`,
  } : draft.fundingLetter;
  const verification = draft.verification || ([STATUS.UNDER_REVIEW, STATUS.REVIEWED, STATUS.FUNDED].includes(status) ? {
    status: 'verified',
    checklist: { project: true, members: true, budget: true, outputs: true, attachments: true },
    notes: 'Status verifikasi dimigrasikan dari workflow proposal yang sudah berjalan.',
    verifiedAt: draft.submittedAt || draft.updatedAt || draft.createdAt,
    verifiedBy: (draft.assignment && draft.assignment.assignedBy) || (assignments[0] && assignments[0].assignedBy) || null,
  } : null);
  const decisionHistory = draft.decisionHistory || (draft.decision ? [{ ...draft.decision, isFinal: draft.decision.finalDecision !== 'revision' }] : []);
  const decision = draft.decision && draft.decision.finalDecision !== 'revision' ? draft.decision : null;
  const rest = { ...draft };
  delete rest.assignment;
  delete rest.review;
  delete rest.draft_status;
  return {
    ...rest,
    status,
    draftStatus: status,
    assignments: finalAssignments,
    reviews,
    verification,
    decision,
    decisionHistory,
    fundingLetter: legacyFundingLetter,
  };
};

const normalizeEmailOutbox = emails => (Array.isArray(emails) ? emails : []).map((email, index) => {
  const id = email.id || email.emailId || `legacy-email-${index + 1}`;
  const recipientUserId = email.recipientUserId || email.userId || null;
  const recipientEmail = email.recipientEmail || email.to || '';
  const notificationType = email.notificationType || email.type || 'general';
  const entityType = email.entityType || 'system';
  const entityId = email.entityId || null;
  const createdAt = email.createdAt || email.queuedAt || new Date().toISOString();
  const message = String(email.message || email.bodyText || '')
    .replace(/\s*Password demo:.*$/i, '')
    .replace(/\b(password|kata sandi|token|secret)\s*[:=]\s*\S+/gi, '$1: [disembunyikan]')
    .trim();
  const deliveryMode = email.deliveryMode === 'digest' ? 'digest' : 'immediate';
  return {
    ...email,
    id,
    emailId: email.emailId || id,
    userId: recipientUserId,
    recipientUserId,
    to: recipientEmail,
    recipientEmail,
    notificationType,
    entityType,
    entityId,
    message,
    bodyText: message,
    templateKey: email.templateKey || notificationType.replace(/_/g, '-'),
    priority: email.priority === 'urgent' ? 'critical' : (email.priority || 'normal'),
    deliveryMode,
    deduplicationKey: email.deduplicationKey || ['legacy', recipientUserId || recipientEmail, notificationType, entityType, entityId || 'general', id].join('|'),
    sourceEventId: email.sourceEventId || null,
    payload: email.payload || {},
    status: email.status || 'queued',
    attempts: Number(email.attempts) || 0,
    availableAt: email.availableAt || createdAt,
    queuedAt: email.queuedAt || createdAt,
    createdAt,
    sentAt: email.sentAt || null,
    errorMessage: email.errorMessage || null,
  };
});

export const normalizeRisData = current => {
  const initial = createInitialData();
  const source = removeLegacyDbMetadata(current || {});
  delete source.reviewers;
  const sourceUsers = (source.systemUsers || []).filter(account => !isRemovedLegacyAccount(account)).map(normalizeSystemUser);
  const normalizedUsers = [...sourceUsers, ...initial.systemUsers.filter(account => !sourceUsers.some(existing => existing.id === account.id))];
  const sourceProfiles = (source.researcherProfiles || []).map(normalizeResearcherProfile);
  const normalizedProfiles = [...sourceProfiles, ...initial.researcherProfiles.filter(profile => !sourceProfiles.some(existing => existing.profileId === profile.profileId))];
  const sourceLecturers = source.lecturers || [];
  const normalizedLecturers = [...sourceLecturers, ...initial.lecturers.filter(lecturer => !sourceLecturers.some(existing => existing.id === lecturer.id))];
  const sourceApplicantProfiles = source.applicantProfiles || [];
  const normalizedApplicantProfiles = [...sourceApplicantProfiles, ...initial.applicantProfiles.filter(profile => !sourceApplicantProfiles.some(existing => existing.id === profile.id))];
  const sourceDrafts = source.drafts || [];
  const shouldSeedCatalogDemo = Number(source.catalogDemoSeedVersion || 0) < 1;
  const shouldSeedAttachmentDemo = Number(source.attachmentDemoSeedVersion || 0) < 1;
  const shouldSeedSchemeDataDemo = Number(source.schemeDataDemoSeedVersion || 0) < 1;
  const shouldSeedMonitoringDemo = Number(source.schemeMonitoringDemoSeedVersion || 0) < 1;
  const shouldSeedFundedReviewDemo = Number(source.fundedReviewSeedVersion || 0) < 1;
  const shouldSeedLetterWorkflowDemo = Number(source.letterWorkflowSeedVersion || 0) < 1;
  const fundedDemo = initial.drafts.find(draft => draft.id === 'draft-approved');
  const fundedDemoAdditionalOutput = fundedDemo && fundedDemo.outputs.find(output => output.id === 'output-funded-additional');
  const draftSource = source.drafts
    ? [...sourceDrafts, ...(shouldSeedCatalogDemo ? initial.drafts.filter(draft => draft.id === 'draft-demo-saved') : [])]
    : initial.drafts;
  const drafts = draftSource
    .filter((draft, index, allDrafts) => allDrafts.findIndex(item => item.id === draft.id) === index)
    .map(normalizeResearchDraft)
    .map(draft => (shouldSeedSchemeDataDemo && draft.id === 'draft-approved' && fundedDemoAdditionalOutput && !(draft.outputs || []).some(output => output.id === fundedDemoAdditionalOutput.id) ? {
      ...draft,
      outputs: [...(draft.outputs || []), fundedDemoAdditionalOutput],
    } : draft));
  const sourceFundedReviewAssignments = source.fundedReviewAssignments || [];
  const fundedReviewAssignments = source.fundedReviewAssignments
    ? [...sourceFundedReviewAssignments, ...(shouldSeedFundedReviewDemo ? initial.fundedReviewAssignments.filter(assignment => !sourceFundedReviewAssignments.some(item => item.id === assignment.id)) : [])]
    : initial.fundedReviewAssignments;
  const proposalTemporaryRoleAssignments = drafts.reduce((result, draft) => [
    ...result,
    ...draft.assignments.map(assignment => ({
      id: `reviewer-grant-${draft.id}-${assignment.reviewerUserId}`,
      userId: assignment.reviewerUserId,
      profileId: assignment.reviewerProfileId,
      role: 'reviewer',
      entityType: 'research_proposal',
      entityId: draft.id,
      status: isActiveReviewerAssignment(assignment) ? 'active' : 'revoked',
      assignedAt: assignment.assignedAt,
      assignedBy: assignment.assignedBy,
      revokedAt: assignment.revokedAt,
      revokedBy: assignment.revokedBy,
    })),
  ], []);
  const fundedTemporaryRoleAssignments = fundedReviewAssignments.map(assignment => ({
    id: `reviewer-grant-${assignment.id}`,
    userId: assignment.reviewerUserId,
    profileId: assignment.reviewerProfileId,
    role: 'reviewer',
    entityType: `funded_${assignment.targetType}`,
    entityId: assignment.targetId,
    status: isActiveReviewerAssignment(assignment) ? 'active' : 'revoked',
    assignedAt: assignment.assignedAt,
    assignedBy: assignment.assignedBy,
    revokedAt: assignment.revokedAt,
    revokedBy: assignment.revokedBy,
  }));
  const temporaryRoleAssignments = [...proposalTemporaryRoleAssignments, ...fundedTemporaryRoleAssignments];
  const sourceSchemes = source.schemes || [];
  const schemeSource = sourceSchemes.length ? [...sourceSchemes, ...initial.schemes.filter(initialScheme => !sourceSchemes.some(scheme => scheme.id === initialScheme.id))] : initial.schemes;
  const schemes = schemeSource.map(scheme => {
    const seededScheme = initial.schemes.find(item => item.id === scheme.id);
    const managerEligibleByDefault = seededScheme && (seededScheme.eligibleUserIds || []).includes('user-manager');
    const appendManager = (values, managerValue) => {
      if (managerEligibleByDefault && !(values || []).includes(managerValue)) return [...(values || []), managerValue];
      return values || [];
    };
    return {
      ...scheme,
      maximumBudget: Number(scheme.maximumBudget || scheme.maxBudget || scheme.maximum_budget || (seededScheme && seededScheme.maximumBudget)) || 0,
      eligibleProfileIds: appendManager(scheme.eligibleProfileIds, 'manager-1'),
      eligibleUserIds: appendManager(scheme.eligibleUserIds, 'user-manager'),
      eligibleLecturerIds: appendManager(scheme.eligibleLecturerIds, 'manager-1'),
      reportingSchedule: normalizeReportingSchedule(scheme),
      outputOptions: normalizeSchemeOutputOptions(scheme),
      attachmentRequirements: normalizeSchemeAttachmentRequirements(shouldSeedAttachmentDemo && seededScheme && seededScheme.id === 'scheme-demo-draft-2026' ? seededScheme : scheme),
    };
  });
  const sourceInternalReports = source.internalReports || [];
  const internalReports = source.internalReports
    ? [...sourceInternalReports, ...(shouldSeedMonitoringDemo ? initial.internalReports.filter(report => !sourceInternalReports.some(item => item.id === report.id)) : [])]
    : initial.internalReports;
  const sourceMonevRecords = source.monevRecords || [];
  const monevRecords = (source.monevRecords
    ? [...sourceMonevRecords, ...(shouldSeedMonitoringDemo ? initial.monevRecords.filter(record => !sourceMonevRecords.some(item => item.id === record.id)) : [])]
    : initial.monevRecords).map(record => (record.id === 'monev-demo-interim-1' ? { ...record, evaluatedBy: record.evaluatedBy || 'user-admin', updatedBy: record.evaluatedBy || 'user-admin', publishedAt: record.publishedAt || record.submittedAt } : record));
  const sourceFundedReviews = source.fundedReviews || [];
  const fundedReviews = source.fundedReviews
    ? [...sourceFundedReviews, ...(shouldSeedFundedReviewDemo ? initial.fundedReviews.filter(review => !sourceFundedReviews.some(item => item.id === review.id)) : [])]
    : initial.fundedReviews;
  const initialLetterIds = initial.letterRequests.map(letter => letter.id);
  const sourceLetters = source.letterRequests || [];
  const normalizedLetters = source.letterRequests
    ? (shouldSeedLetterWorkflowDemo
      ? [...sourceLetters.filter(letter => !initialLetterIds.includes(letter.id)), ...initial.letterRequests]
      : sourceLetters)
    : initial.letterRequests;
  return {
    ...initial,
    ...source,
    catalogDemoSeedVersion: 1,
    attachmentDemoSeedVersion: 1,
    schemeDataDemoSeedVersion: 1,
    schemeMonitoringDemoSeedVersion: 1,
    fundedReviewSeedVersion: 1,
    letterWorkflowSeedVersion: 1,
    systemUsers: normalizedUsers,
    researcherProfiles: normalizedProfiles,
    researcherDocuments: source.researcherDocuments || initial.researcherDocuments,
    researcherExpertise: source.researcherExpertise || initial.researcherExpertise,
    researcherExpertiseMap: source.researcherExpertiseMap || initial.researcherExpertiseMap,
    researcherVerifications: source.researcherVerifications || initial.researcherVerifications,
    researcherStatusHistory: source.researcherStatusHistory || initial.researcherStatusHistory,
    adminAssignments: source.adminAssignments || initial.adminAssignments,
    systemActivityLogs: source.systemActivityLogs || initial.systemActivityLogs,
    profileSequence: source.profileSequence || initial.profileSequence,
    lecturers: normalizedLecturers,
    temporaryRoleAssignments,
    schemes,
    drafts,
    logbooks: source.logbooks || initial.logbooks,
    internalReports,
    monevRecords,
    fundedReviewAssignments,
    fundedReviews,
    fundedReviewerReminders: source.fundedReviewerReminders || initial.fundedReviewerReminders,
    applicantProfiles: normalizedApplicantProfiles,
    previousEthicsClearances: source.previousEthicsClearances || initial.previousEthicsClearances,
    letterRequests: normalizedLetters,
    letterDefinitions: Array.isArray(source.letterDefinitions) ? source.letterDefinitions : initial.letterDefinitions,
    letterMasterTemplate: source.letterMasterTemplate || initial.letterMasterTemplate,
    letterSequence: source.letterSequence || initial.letterSequence,
    notifications: source.notifications || initial.notifications,
    notificationReadIds: source.notificationReadIds || initial.notificationReadIds,
    reviewerReminders: source.reviewerReminders || initial.reviewerReminders,
    emailOutbox: normalizeEmailOutbox(source.emailOutbox || initial.emailOutbox),
    externalResearchReports: source.externalResearchReports || initial.externalResearchReports,
    externalResearchSequence: source.externalResearchSequence || initial.externalResearchSequence,
  };
};

export const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const totalBudget = proposalBudgetTotal;

export const formatCurrency = value => `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value || 0)}`;

export const formatDate = value => (value ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value)) : '-');

export const fileMeta = file => (file ? ({
  id: uid('file'), category: '', name: file.name, size: file.size, type: file.type || '', lastModified: file.lastModified,
  fileUrl: file.risFileUrl || '', storedFileId: file.risFileId || null
}) : null);
