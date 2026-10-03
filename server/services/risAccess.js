const { isDeepStrictEqual } = require('util');
const own = (record, account) => record && record.userId === account.id;
const fullManager = account => ['super_admin', 'manager'].includes(account.role);
const scope = (account, name) => fullManager(account) || (account.role === 'admin' && (account.adminScopes || []).includes(name));
const researchManager = account => scope(account, 'research_management');
const letterManager = account => scope(account, 'letter_management');
const profileManager = account => scope(account, 'researcher_profile_management');
const ownerOfResearch = (state, researchId, account) => (state.drafts || []).some(draft => draft.id === researchId && own(draft, account));
const assignedDraft = (draft, account) => (draft.assignments || []).some(item => item.reviewerUserId === account.id && !['revoked', 'completed'].includes(item.status));
const assignedFundedReview = (state, record, account) => (state.fundedReviewAssignments || []).some(item => item.id === record.assignmentId && item.reviewerUserId === account.id && item.status !== 'revoked');
const same = isDeepStrictEqual;
const unchanged = (before, after, fields) => fields.every(field => same(before && before[field], after && after[field]));
const changedOnly = (before, after, fields) => Object.keys({ ...before, ...after })
  .every(key => fields.includes(key) || same(before && before[key], after && after[key]));
const permitsTransition = (beforeStatus, afterStatus, transitions) => (
  Boolean(transitions[beforeStatus] && transitions[beforeStatus].includes(afterStatus))
);
const isSignedContract = contract => Boolean(contract && (contract.lecturerSignedFile || contract.signedFile || ['signed', 'completed'].includes(contract.status || contract.contractStatus)));
const lecturerContractReturn = (before, after, account) => {
  const oldContract = before && before.contract;
  const nextContract = after && after.contract;
  return Boolean(oldContract && nextContract
    && oldContract.adminSignedFile && oldContract.sentToLecturerAt && !isSignedContract(oldContract)
    && isSignedContract(nextContract) && nextContract.lecturerSignedFile
    && (nextContract.lecturerSignedBy === account.id || nextContract.uploadedBy === account.id)
    && same(oldContract.adminSignedFile, nextContract.adminSignedFile)
    && same(oldContract.sentToLecturerAt, nextContract.sentToLecturerAt));
};
const reviewerDraftChange = (before, after, account) => {
  if (!before || !after || !assignedDraft(before, account)) return false;
  if (!changedOnly(before, after, ['reviews', 'assignments', 'status', 'draftStatus', 'updatedAt'])) return false;
  if (!['under_review', 'reviewed'].includes(before.status) || after.status !== 'reviewed' || after.draftStatus !== 'reviewed') return false;
  const oldAssignments = before.assignments || [];
  const nextAssignments = after.assignments || [];
  if (oldAssignments.length !== nextAssignments.length || !oldAssignments.every((item, index) => (
    item.reviewerUserId === account.id
      ? nextAssignments[index].status === 'submitted' && changedOnly(item, nextAssignments[index], ['status', 'submittedAt'])
      : same(item, nextAssignments[index])
  ))) return false;
  const oldReviews = before.reviews || [];
  const nextReviews = after.reviews || [];
  if (nextReviews.filter(item => item.reviewerUserId === account.id).length !== 1) return false;
  return oldReviews.filter(item => item.reviewerUserId !== account.id).every(item => nextReviews.some(candidate => same(item, candidate)))
    && nextReviews.every(item => item.reviewerUserId === account.id || oldReviews.some(candidate => same(item, candidate)));
};

const publicAccount = (account, includeEmail = false) => ({
  id: account.id,
  name: account.name,
  ...(includeEmail ? { email: account.email } : {}),
  role: account.role,
  profileId: account.profileId,
  isActive: account.isActive,
});
const safeAccount = account => ({
  ...publicAccount(account, true),
  adminScopes: account.adminScopes || [],
  deletedAt: account.deletedAt || null,
  deactivationReason: account.deactivationReason || null,
});
const publicProfile = profile => Object.fromEntries(Object.entries({
  id: profile.id,
  profileId: profile.profileId,
  userId: profile.userId,
  fullName: profile.fullName,
  frontTitle: profile.frontTitle,
  backTitle: profile.backTitle,
  faculty: profile.faculty,
  studyProgram: profile.studyProgram,
  unit: profile.unit,
  position: profile.position,
  functionalPosition: profile.functionalPosition,
  nidn: profile.nidn,
  institutionEmail: profile.institutionEmail,
  profilePhoto: profile.profilePhoto,
  profileStatus: profile.profileStatus,
  verificationStatus: profile.verificationStatus,
}).filter(([, value]) => value !== undefined));

const withoutRetiredInterimReports = state => {
  const retiredIds = new Set((state.internalReports || [])
    .filter(report => report.reportType === 'interim')
    .map(report => report.id));
  const retiredAssignmentIds = new Set((state.fundedReviewAssignments || [])
    .filter(assignment => assignment.targetType === 'report' && retiredIds.has(assignment.targetId))
    .map(assignment => assignment.id));
  return {
    ...state,
    logbooks: [],
    internalReports: (state.internalReports || []).filter(report => !retiredIds.has(report.id)),
    fundedReviewAssignments: (state.fundedReviewAssignments || []).filter(assignment => !retiredAssignmentIds.has(assignment.id)),
    fundedReviews: (state.fundedReviews || []).filter(review => !retiredAssignmentIds.has(review.assignmentId)),
    temporaryRoleAssignments: (state.temporaryRoleAssignments || []).filter(assignment => (
      assignment.entityType !== 'funded_report' || !retiredIds.has(assignment.entityId)
    )),
  };
};

const projectState = (state, account) => {
  const operationalState = withoutRetiredInterimReports(state);
  // Password material must never be present in a browser state snapshot, even
  // for a role that manages user accounts.
  if (fullManager(account)) {
    return {
      ...operationalState,
      systemUsers: (operationalState.systemUsers || []).map(safeAccount),
    };
  }
  state = operationalState; // eslint-disable-line no-param-reassign
  const research = researchManager(account);
  const letters = letterManager(account);
  const profiles = profileManager(account);
  const selectedDrafts = (state.drafts || []).filter(draft => research || own(draft, account)
    || assignedDraft(draft, account) || (letters && draft.status === 'funded'));
  const visibleReportIds = new Set((state.internalReports || []).filter(report => research || ownerOfResearch(state, report.researchId, account)
    || (state.fundedReviewAssignments || []).some(item => item.targetId === report.id && item.reviewerUserId === account.id)).map(report => report.id));
  const visibleMonevIds = new Set((state.monevRecords || []).filter(record => research || ownerOfResearch(state, record.researchId, account)
    || (state.fundedReviewAssignments || []).some(item => item.targetId === record.id && item.reviewerUserId === account.id)).map(record => record.id));
  return {
    ...state,
    systemUsers: (state.systemUsers || []).map(item => (profiles ? safeAccount(item) : publicAccount(item, item.id === account.id))),
    researcherProfiles: (state.researcherProfiles || []).map(item => (profiles || own(item, account) ? item : publicProfile(item))),
    researcherDocuments: (state.researcherDocuments || []).filter(item => profiles || item.profileId === account.profileId),
    researcherVerifications: (state.researcherVerifications || []).filter(item => profiles || item.profileId === account.profileId),
    researcherStatusHistory: (state.researcherStatusHistory || []).filter(item => profiles || item.profileId === account.profileId),
    researcherExpertiseMap: (state.researcherExpertiseMap || []).filter(item => profiles || item.profileId === account.profileId),
    adminAssignments: profiles ? state.adminAssignments : [],
    applicantProfiles: (state.applicantProfiles || []).filter(item => research || own(item, account)),
    previousEthicsClearances: (state.previousEthicsClearances || []).filter(item => research || own(item, account)),
    drafts: selectedDrafts,
    internalReports: (state.internalReports || []).filter(item => visibleReportIds.has(item.id)),
    monevRecords: (state.monevRecords || []).filter(item => visibleMonevIds.has(item.id)),
    fundedReviewAssignments: (state.fundedReviewAssignments || []).filter(item => research || item.reviewerUserId === account.id || ownerOfResearch(state, item.researchId, account)),
    fundedReviews: (state.fundedReviews || []).filter(item => research || assignedFundedReview(state, item, account) || (state.fundedReviewAssignments || []).some(assignment => assignment.id === item.assignmentId && ownerOfResearch(state, assignment.researchId, account))),
    fundedReviewerReminders: research ? state.fundedReviewerReminders : [],
    reviewerReminders: research ? state.reviewerReminders : [],
    logbooks: (state.logbooks || []).filter(item => research || ownerOfResearch(state, item.researchId, account)),
    letterDefinitions: state.letterDefinitions || [],
    letterRequests: (state.letterRequests || []).filter(item => letters || own(item, account)).map(item => {
      if (letters || !item.generated) return item;
      const generated = Object.fromEntries(Object.entries(item.generated)
        .filter(([key]) => !['draftFileUrl', 'draftFileId', 'content'].includes(key)));
      return { ...item, generated };
    }),
    externalResearchReports: (state.externalResearchReports || []).filter(item => research || own(item, account)),
    notifications: (state.notifications || []).filter(item => item.userId === account.id || item.recipientUserId === account.id),
    notificationReadIds: state.notificationReadIds || [],
    emailOutbox: [],
    // Activity logs can contain before/after snapshots. A domain permission must
    // never turn into permission to read every user's historical profile data.
    systemActivityLogs: (state.systemActivityLogs || []).filter(item => profiles || own(item, account)),
    temporaryRoleAssignments: (state.temporaryRoleAssignments || []).filter(item => research || item.userId === account.id),
  };
};

const canChange = (domain, before, after, account, state, options = {}) => {
  if (domain === 'systemUsers' && before) {
    if (before.id === account.id) return false;
    if (!after || before.deletedAt) return false;
    const actorRole = account.role;
    const targetRole = before.role;
    if (actorRole === 'admin' && targetRole !== 'lecturer') return false;
    if (actorRole === 'manager' && targetRole === 'super_admin') return false;
    if (!fullManager(account) && !profileManager(account)) return false;
    if (after.deletedAt && (after.isActive !== false || before.deletedAt)) return false;
  }
  if (fullManager(account)) return true;
  if (['schemes', 'drafts', 'internalReports', 'monevRecords', 'fundedReviewAssignments', 'fundedReviews', 'logbooks', 'reviewerReminders', 'fundedReviewerReminders'].includes(domain) && researchManager(account)) return true;
  if (['letterDefinitions', 'letterMasterTemplate', 'letterRequests', 'letterSequence'].includes(domain) && letterManager(account)) return true;
  if (['systemUsers', 'researcherProfiles', 'researcherDocuments', 'researcherExpertiseMap', 'researcherVerifications', 'researcherStatusHistory', 'adminAssignments', 'profileSequence', 'lecturers'].includes(domain) && profileManager(account)) {
    if (domain === 'systemUsers') {
      return ![before, after].some(value => value && ['manager', 'super_admin'].includes(value.role))
        && (!before || after.role === before.role)
        && (!before || same(after.adminScopes, before.adminScopes))
        && (before || after.role === 'lecturer');
    }
    if (domain === 'researcherProfiles') {
      const target = (state.systemUsers || []).find(value => value.id === ((after || before) && (after || before).userId));
      if (target && ['manager', 'super_admin'].includes(target.role)) return false;
    }
    return true;
  }
  const item = after || before;
  if (domain === 'drafts') {
    if (before && !after) return own(before, account) && ['draft', 'revision'].includes(before.status);
    if (own(item, account) && before && ['funded', 'rejected', 'archived'].includes(before.status)) {
      if (before.status === 'funded') return after && (changedOnly(before, after, ['userName']) || (changedOnly(before, after, ['userName', 'contract']) && lecturerContractReturn(before, after, account)));
      return after && changedOnly(before, after, ['userName']);
    }
    if (own(item, account)) {
      const validStatus = before
        ? permitsTransition(before.status, after && after.status, {
          draft: ['draft', 'submitted'],
          revision: ['revision', 'submitted'],
        })
        : after && after.status === 'draft';
      return (!before || own(before, account))
      && validStatus
      && (!before || unchanged(before, after, ['id', 'userId', 'schemeId', 'createdBy', 'createdAt', 'assignments', 'reviews', 'reviewHistory', 'verification', 'decision', 'decisionHistory', 'contract', 'fundingLetter', 'archivedAt']))
      && (!after.submittedAt || after.status === 'submitted' || same(before && before.submittedAt, after.submittedAt));
    }
    return reviewerDraftChange(before, after, account);
  }
  if (domain === 'letterRequests') {
    if (before && !after) return own(before, account) && ['draft', 'draft_revision'].includes(before.status);
    const validStatus = before
      ? permitsTransition(before.status, after && after.status, {
        draft: ['draft', 'submitted'],
        draft_revision: ['draft_revision', 'submitted'],
        data_required: ['data_required', 'data_submitted'],
        revision_required: ['revision_required', 'data_submitted'],
      })
      : (after && after.status === 'draft') || Boolean(options.trusted && after && ['submitted', 'data_submitted'].includes(after.status));
    return own(item, account) && (!before || own(before, account))
    && validStatus
    && (!before || unchanged(before, after, ['id', 'userId', 'createdBy', 'createdAt', 'applicant', 'generated', 'reviews', 'template', 'templateFields', 'definitionId', 'definitionVersion', 'definitionName', 'researchId', 'type', 'purpose', 'customName', 'approvedAt']));
  }
  if (domain === 'externalResearchReports') {
    if (before && !after) {
      if (researchManager(account)) return true;
      return own(before, account) && ['draft', 'revision_requested'].includes(before.submissionStatus);
    }
    if (researchManager(account)) {
      return Boolean(before && after
        && unchanged(before, after, ['id', 'userId', 'createdBy', 'createdAt']));
    }
    const validStatus = before
      ? permitsTransition(before.submissionStatus, after && after.submissionStatus, {
        draft: ['draft', 'submitted'],
        revision_requested: ['revision_requested', 'submitted'],
      })
      : after && after.submissionStatus === 'draft';
    return own(item, account) && (!before || own(before, account))
    && validStatus
    && (!before || unchanged(before, after, ['id', 'userId', 'createdBy', 'createdAt', 'reviews', 'validatedAt', 'archivedAt']));
  }
  if (domain === 'internalReports') {
    if (before && !after) return ownerOfResearch(state, before.researchId, account) && before.status === 'draft';
    return ownerOfResearch(state, item.researchId, account)
    && (!before ? after && after.status === 'draft' : permitsTransition(before.status, after && after.status, { draft: ['draft', 'submitted'] }))
    && (!before || unchanged(before, after, ['id', 'researchId', 'periodId', 'outputId', 'review', 'reviewerDecision']));
  }
  if (domain === 'monevRecords') {
    if (before && !after) return ownerOfResearch(state, before.researchId, account) && before.status === 'draft';
    return ownerOfResearch(state, item.researchId, account)
    && ['draft', 'submitted'].includes(after && after.status)
    && (!before || before.status === 'draft')
    && (!after.submittedBy || after.submittedBy === account.id)
    && (!after.updatedBy || after.updatedBy === account.id)
    && (!before || unchanged(before, after, ['id', 'researchId', 'schemeId', 'periodId', 'periodLabel']));
  }
  if (domain === 'logbooks') {
    if (before && !after) return ownerOfResearch(state, before.researchId, account);
    return ownerOfResearch(state, item.researchId, account)
    && (!before || unchanged(before, after, ['id', 'researchId', 'createdBy']));
  }
  if (domain === 'fundedReviewAssignments') {
    return before && after && before.reviewerUserId === account.id
    && before.status === 'assigned' && after.status === 'submitted'
    && changedOnly(before, after, ['status', 'submittedAt']);
  }
  if (domain === 'fundedReviews') {
    return after && assignedFundedReview(state, item, account)
    && after.reviewerUserId === account.id && (!before || before.reviewerUserId === account.id)
    && (!before || unchanged(before, after, ['id', 'assignmentId', 'targetType', 'targetId', 'researchId']));
  }
  if (domain === 'researcherProfiles') {
    return own(item, account) && (!before || own(before, account))
    && (after.profileStatus !== 'inactive' || (before && before.profileStatus === 'inactive'))
    && (!['verified', 'rejected'].includes(after.verificationStatus) || (before && before.verificationStatus === after.verificationStatus))
    && (!before || unchanged(before, after, ['id', 'profileId', 'userId', 'verifiedAt', 'verifiedBy', 'isActive']));
  }
  if (domain === 'researcherDocuments' || domain === 'researcherExpertiseMap') return item.profileId === account.profileId;
  if (domain === 'applicantProfiles' || domain === 'previousEthicsClearances') return own(item, account);
  if (domain === 'lecturers') return own(item, account);
  if (domain === 'researcherExpertise') return !before && after && typeof after.name === 'string' && after.name.trim().length > 1;
  if (domain === 'systemActivityLogs') {
    return !before && after && after.userId === account.id
    && ['create_profile', 'update_profile', 'upload_document', 'delete_document'].includes(after.action);
  }
  return false;
};

module.exports = {
  projectState, canChange, fullManager, researchManager, letterManager, profileManager
};
