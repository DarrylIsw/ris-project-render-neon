/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import { canTransition, transitionEntity } from '../../core/domainState';
import { getProposalSubmissionRequirements, isOutputDefinitionComplete } from '../../features/research/workflows/schemeConfiguration';
import { proposalBudgetTotal, validateProposalBudget } from '../../features/research/workflows/proposalBudget';

export const ROLE = {
  SUPER_ADMIN: 'super_admin',
  MANAGER: 'manager',
  ADMIN: 'admin',
  LECTURER: 'lecturer',
};

export const MANAGER_MODE = {
  MANAGEMENT: 'management',
  LECTURER: 'lecturer',
};

export const ADMIN_SCOPE = {
  RESEARCH: 'research_management',
  LETTERS: 'letter_management',
  PROFILES: 'researcher_profile_management',
};

export const ADMIN_SCOPE_OPTIONS = [
  { value: ADMIN_SCOPE.RESEARCH, label: 'Manajemen Penelitian', description: 'Kelola skema, pengajuan penelitian internal, penelitian eksternal, penilai, keputusan, dan pelaporan.' },
  { value: ADMIN_SCOPE.LETTERS, label: 'Pengajuan Surat', description: 'Periksa permintaan, susun formulir, verifikasi data, dan terbitkan surat penelitian.' },
  { value: ADMIN_SCOPE.PROFILES, label: 'Manajemen Informasi Peneliti', description: 'Kelola akun, profil, verifikasi, dan status peneliti.' },
];

export const ALL_ADMIN_SCOPES = ADMIN_SCOPE_OPTIONS.map(option => option.value);

export const LEGACY_ROLE_MAP = {
  researcher: ROLE.LECTURER,
  reviewer: ROLE.LECTURER,
  lppm_admin: ROLE.ADMIN,
  approval_manager: ROLE.MANAGER,
};

export const STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  REVIEWED: 'reviewed',
  REVISION: 'revision',
  FUNDED: 'funded',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
};

export const DRAFT_STATUS_TRANSITIONS = {
  [STATUS.DRAFT]: [STATUS.SUBMITTED],
  [STATUS.REVISION]: [STATUS.SUBMITTED],
  [STATUS.SUBMITTED]: [STATUS.UNDER_REVIEW, STATUS.REVISION, STATUS.REJECTED],
  [STATUS.UNDER_REVIEW]: [STATUS.REVIEWED, STATUS.REVISION, STATUS.REJECTED],
  [STATUS.REVIEWED]: [STATUS.FUNDED, STATUS.REVISION, STATUS.REJECTED],
  [STATUS.FUNDED]: [],
  [STATUS.REJECTED]: [],
  [STATUS.ARCHIVED]: [],
};

export const LEGACY_STATUS_MAP = {
  incomplete_data: STATUS.REVISION,
  assigned: STATUS.UNDER_REVIEW,
  revision_required: STATUS.REVISION,
  approved: STATUS.FUNDED,
};

export const ROLE_LABELS = {
  [ROLE.SUPER_ADMIN]: 'Administrator Utama',
  [ROLE.MANAGER]: 'Manajer',
  [ROLE.ADMIN]: 'Administrator',
  [ROLE.LECTURER]: 'Dosen',
};

export const normalizeRole = role => LEGACY_ROLE_MAP[role] || role;
export const normalizeStatus = status => LEGACY_STATUS_MAP[status] || status;
export const isManagerAccount = user => normalizeRole(user && user.role) === ROLE.MANAGER;
export const isManagerLecturerMode = user => isManagerAccount(user) && user.managerMode === MANAGER_MODE.LECTURER;
export const isResearcher = user => normalizeRole(user && user.role) === ROLE.LECTURER || isManagerLecturerMode(user);
export const isSuperAdmin = user => normalizeRole(user && user.role) === ROLE.SUPER_ADMIN;
export const isManager = user => isManagerAccount(user) && !isManagerLecturerMode(user);
export const isRegularAdmin = user => normalizeRole(user && user.role) === ROLE.ADMIN;
export const hasFullAccess = user => isSuperAdmin(user) || isManager(user);
export const isAdmin = user => hasFullAccess(user) || isRegularAdmin(user);

export const getAdminScopes = user => {
  if (hasFullAccess(user)) return ALL_ADMIN_SCOPES;
  if (!isRegularAdmin(user)) return [];
  return Array.isArray(user.adminScopes)
    ? user.adminScopes.filter(scope => ALL_ADMIN_SCOPES.includes(scope))
    : ALL_ADMIN_SCOPES;
};
export const hasAdminScope = (user, scope) => hasFullAccess(user) || (isRegularAdmin(user) && getAdminScopes(user).includes(scope));
export const canManageResearch = user => Boolean(user) && hasAdminScope(user, ADMIN_SCOPE.RESEARCH);
export const canManageLetters = user => Boolean(user) && hasAdminScope(user, ADMIN_SCOPE.LETTERS);
export const canManageResearcherProfiles = user => Boolean(user) && hasAdminScope(user, ADMIN_SCOPE.PROFILES);

export const canAccessResearchSubmission = user => Boolean(user) && (isResearcher(user) || canManageResearch(user));
export const canAccessSchemeManagement = user => canManageResearch(user);
export const canAccessLetters = user => Boolean(user) && (isResearcher(user) || canManageLetters(user));
export const canAccessExternalResearch = user => Boolean(user) && (isResearcher(user) || canManageResearch(user));
// Every authenticated user can maintain their own profile.  Profile-management
// scope only controls the ability to see and administer other users' records.
export const canAccessResearcherProfiles = user => Boolean(user);
export const canAccessResearchReports = user => Boolean(user) && (isResearcher(user) || canManageResearch(user));
export const canAccessArchive = user => Boolean(user) && hasFullAccess(user);

export const getRoleLabel = user => {
  if (isManagerAccount(user)) return user.managerMode === MANAGER_MODE.LECTURER ? 'Manajer - Mode Dosen' : 'Manajer - Mode Manajemen';
  return (user && user.applicantType) || ROLE_LABELS[normalizeRole(user && user.role)] || 'Pengguna';
};

export const isOpenScheme = scheme => {
  if (!scheme || scheme.deletedAt || !['open', 'published', 'active'].includes(scheme.status || scheme.schemeStatus || scheme.scheme_status)) return false;
  const now = new Date();
  const startsAt = scheme.registrationStartDate || scheme.registration_start_date;
  const endsAt = scheme.registrationEndDate || scheme.registration_end_date;
  if (startsAt && now < new Date(startsAt)) return false;
  if (endsAt && now > new Date(endsAt)) return false;
  return true;
};

const schemeEligibleProfiles = scheme => scheme && (scheme.eligibleProfileIds || scheme.eligibleLecturerIds || []);
const schemeEligibleUsers = scheme => scheme && (scheme.eligibleUserIds || []);

export const isEligibleForScheme = (scheme, user) => {
  if (scheme && scheme.deletedAt) return false;
  if (hasFullAccess(user)) return true;
  if (!scheme || !isResearcher(user)) return false;
  const profileIds = schemeEligibleProfiles(scheme);
  const userIds = schemeEligibleUsers(scheme);
  if (!profileIds.length && !userIds.length) return true;
  return profileIds.includes(user.profileId) || userIds.includes(user.id);
};

export const getSchemeTitle = scheme => (scheme && (scheme.name || scheme.schemeName || scheme.scheme_name)) || '-';
export const getSchemeDescription = scheme => (scheme && (scheme.description || scheme.schemeDescription || scheme.scheme_description)) || '';
export const getSchemeMaximumBudget = scheme => Number(scheme && (scheme.maximumBudget || scheme.maxBudget || scheme.maximum_budget)) || 0;
export const getDraftBudgetTotal = proposalBudgetTotal;
export const isBudgetWithinScheme = (draft, scheme) => {
  const maximumBudget = getSchemeMaximumBudget(scheme);
  return maximumBudget <= 0 || getDraftBudgetTotal(draft) <= maximumBudget;
};

export const draftStatus = draft => (draft && draft.archivedAt ? STATUS.ARCHIVED : normalizeStatus(draft && (draft.status || draft.draftStatus || draft.draft_status)));
export const draftOwnerId = draft => draft && (draft.userId || draft.user_id);
export const draftId = draft => draft && (draft.id || draft.draft_id);
export const draftSchemeId = draft => draft && (draft.schemeId || draft.scheme_id);

export const canTransitionDraftStatus = (draft, nextStatus) => canTransition(DRAFT_STATUS_TRANSITIONS, draftStatus(draft), normalizeStatus(nextStatus));
export const transitionDraftStatus = (draft, nextStatus, changes = {}) => transitionEntity({
  entity: draft,
  currentStatus: draftStatus(draft),
  nextStatus: normalizeStatus(nextStatus),
  transitions: DRAFT_STATUS_TRANSITIONS,
  statusFields: ['status', 'draftStatus'],
  changes,
});

export const isDraftOwner = (draft, user) => draftOwnerId(draft) === (user && user.id);
export const canEditDraft = (draft, user) => (hasFullAccess(user) || (isResearcher(user) && isDraftOwner(draft, user))) && [STATUS.DRAFT, STATUS.REVISION].includes(draftStatus(draft));
export const canVerifyDraft = (draft, user) => canManageResearch(user)
  && draftStatus(draft) === STATUS.SUBMITTED
  && (!draft.verification || draft.verification.status !== 'verified');
export const canAssignReviewer = (draft, user) => canManageResearch(user)
  && [STATUS.SUBMITTED, STATUS.UNDER_REVIEW, STATUS.REVIEWED].includes(draftStatus(draft))
  && draft && draft.verification && draft.verification.status === 'verified'
  && !draft.decision;

const normalizeLegacyAssignment = assignment => assignment && ({
  ...assignment,
  id: assignment.id || `assignment-${assignment.reviewerUserId || assignment.reviewerId}`,
  reviewerUserId: assignment.reviewerUserId || assignment.reviewer_user_id || assignment.reviewerId,
  reviewerProfileId: assignment.reviewerProfileId || assignment.reviewer_profile_id || assignment.reviewerId,
});

export const draftReviewerAssignments = draft => {
  if (draft && Array.isArray(draft.assignments)) return draft.assignments;
  const legacy = normalizeLegacyAssignment(draft && draft.assignment);
  return legacy ? [legacy] : [];
};
export const draftReviews = draft => {
  if (draft && Array.isArray(draft.reviews)) return draft.reviews;
  if (!draft || !draft.review) return [];
  const assignment = draftReviewerAssignments(draft)[0] || {};
  return [{ ...draft.review, reviewerUserId: draft.review.reviewerUserId || assignment.reviewerUserId, reviewerProfileId: draft.review.reviewerProfileId || assignment.reviewerProfileId }];
};
export const isActiveReviewerAssignment = assignment => Boolean(assignment) && ['assigned', 'in_progress', 'submitted'].includes(assignment.status);
export const reviewerAssignmentForUser = (draft, user) => draftReviewerAssignments(draft).find(assignment => (
  isActiveReviewerAssignment(assignment)
  && (assignment.reviewerUserId === (user && user.id) || assignment.reviewerProfileId === (user && user.profileId))
));
export const reviewForUser = (draft, user) => draftReviews(draft).find(review => (
  review.reviewerUserId === (user && user.id) || review.reviewerProfileId === (user && user.profileId)
));
export const hasSubmittedReview = draft => draftReviews(draft).some(review => Boolean(review.submittedAt));
export const hasTemporaryReviewerRole = (data, user) => Boolean(user) && (
  ((data && data.temporaryRoleAssignments) || []).some(grant => grant.userId === user.id && grant.role === 'reviewer' && grant.status === 'active')
  || ((data && data.drafts) || []).some(draft => {
    const assignment = reviewerAssignmentForUser(draft, user);
    return isActiveReviewerAssignment(assignment) && [STATUS.UNDER_REVIEW, STATUS.REVIEWED].includes(draftStatus(draft));
  })
);

export const canReviewerViewDraft = (draft, user) => {
  if (!isResearcher(user) || ![STATUS.UNDER_REVIEW, STATUS.REVIEWED].includes(draftStatus(draft))) return false;
  const assignment = reviewerAssignmentForUser(draft, user);
  return Boolean(isActiveReviewerAssignment(assignment));
};

export const canScoreDraft = (draft, user) => canReviewerViewDraft(draft, user)
  && reviewerAssignmentForUser(draft, user).status !== 'submitted'
  && !reviewForUser(draft, user);
export const canDecideDraft = (draft, user) => canManageResearch(user) && draftStatus(draft) === STATUS.REVIEWED && hasSubmittedReview(draft) && !draft.decision;
export const canSignContract = (draft, user) => (hasFullAccess(user) || (isResearcher(user) && isDraftOwner(draft, user))) && draftStatus(draft) === STATUS.FUNDED;
export const canReportResearch = (draft, user) => draftStatus(draft) === STATUS.FUNDED && (!isResearcher(user) || isDraftOwner(draft, user));

export const hasActiveDraftForScheme = (data, user, schemeId, excludeDraftId) => (data.drafts || []).some(draft => {
  const sameOwner = isDraftOwner(draft, user);
  const sameScheme = draftSchemeId(draft) === schemeId;
  const notExcluded = draftId(draft) !== excludeDraftId;
  const active = [STATUS.DRAFT, STATUS.SUBMITTED, STATUS.UNDER_REVIEW, STATUS.REVIEWED, STATUS.REVISION, STATUS.FUNDED].includes(draftStatus(draft));
  return sameOwner && sameScheme && notExcluded && active;
});

export const validateOutputDetails = output => {
  if (!output || !String(output.description || '').trim()) return false;
  if (output.category === 'product' || output.category === 'prototype') return isOutputDefinitionComplete({ ...output, category: 'produk_prototipe' });
  return isOutputDefinitionComplete(output);
};
export const requiredAttachmentCategories = scheme => getProposalSubmissionRequirements(scheme).map(item => item.category);

export const validateDraftSections = (draft, scheme) => {
  const project = draft.project || {};
  const members = draft.members || [];
  const outputs = draft.outputs || [];
  const files = draft.files || [];
  const projectOk = Boolean(project.title && project.targetTkt && project.ripRelation && project.researchCenterRelation && (project.researchCenterRelation !== 'other' || project.researchCenterOther) && (project.sdgs || []).length && project.integrated !== null && (!project.integrated || (project.courseName && project.academicYear)));
  const membersOk = members.length >= 2 && members.some(item => item.role === 'ketua') && members.every(item => item.name && (item.nidn || item.nim) && item.program && item.faculty);
  const budgetOk = !validateProposalBudget(draft, getSchemeMaximumBudget(scheme));
  const outputsOk = outputs.length > 0 && outputs.some(item => item.type === 'wajib') && outputs.every(validateOutputDetails);
  const attachmentsOk = requiredAttachmentCategories(scheme, members).every(category => files.some(file => file.category === category && file.name));
  return {
    project: projectOk,
    members: membersOk,
    budget: budgetOk,
    outputs: outputsOk,
    attachments: attachmentsOk,
  };
};

export const validateDraftForSubmit = (draft, scheme) => {
  const checks = validateDraftSections(draft, scheme);
  if (!checks.project) return 'Lengkapi seluruh data proyek yang wajib diisi.';
  if (!checks.members) return 'Lengkapi data ketua dan minimal satu anggota.';
  if (!checks.budget) return validateProposalBudget(draft, getSchemeMaximumBudget(scheme));
  if (!checks.outputs) return 'Lengkapi data luaran wajib dan tambahan.';
  if (!checks.attachments) return 'Unggah dokumen Proposal Penelitian pada bagian Lampiran.';
  return '';
};
