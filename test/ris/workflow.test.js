const assert = require('assert');
const {
  ADMIN_SCOPE,
  MANAGER_MODE,
  ROLE,
  STATUS,
  canAccessArchive,
  canAccessExternalResearch,
  canAccessLetters,
  canAccessResearchReports,
  canAccessResearcherProfiles,
  canAccessResearchSubmission,
  canAccessSchemeManagement,
  canAssignReviewer,
  canDecideDraft,
  canEditDraft,
  canReviewerViewDraft,
  canScoreDraft,
  canTransitionDraftStatus,
  draftReviewerAssignments,
  draftReviews,
  getDraftBudgetTotal,
  getSchemeMaximumBudget,
  hasTemporaryReviewerRole,
  hasFullAccess,
  isManagerAccount,
  isBudgetWithinScheme,
  isResearcher,
  transitionDraftStatus,
  validateDraftForSubmit,
} = require('../../app/containers/Ris/shared/workflows/workflow');

const lecturer = { id: 'lecturer-1', profileId: 'profile-1', role: ROLE.LECTURER };
const assignedLecturer = { id: 'lecturer-2', profileId: 'profile-2', role: ROLE.LECTURER };
const admin = { id: 'admin-1', role: ROLE.ADMIN, adminScopes: [ADMIN_SCOPE.RESEARCH] };
const letterAdmin = { id: 'admin-letter', role: ROLE.ADMIN, adminScopes: [ADMIN_SCOPE.LETTERS] };
const profileAdmin = { id: 'admin-profile', role: ROLE.ADMIN, adminScopes: [ADMIN_SCOPE.PROFILES] };
const manager = { id: 'manager-1', role: ROLE.MANAGER };
const managerLecturer = { ...manager, profileId: 'manager-1', managerMode: MANAGER_MODE.LECTURER };
const superAdmin = { id: 'super-admin-1', role: ROLE.SUPER_ADMIN };

const draft = status => ({
  id: 'draft-1',
  userId: lecturer.id,
  status,
  draftStatus: status,
  verification: { status: 'verified' },
  assignments: [{
    id: 'assignment-1', reviewerUserId: assignedLecturer.id, reviewerProfileId: assignedLecturer.profileId, status: 'assigned'
  }],
  reviews: [],
});

describe('RIS proposal workflow', () => {
  it('exposes only the four permanent account roles', () => {
    assert.deepStrictEqual(Object.values(ROLE).sort(), ['admin', 'lecturer', 'manager', 'super_admin']);
    assert.strictEqual(isResearcher(lecturer), true);
    assert.strictEqual(canAccessResearchSubmission(lecturer), true);
  });

  it('limits regular admins to the task scopes assigned to their account', () => {
    assert.strictEqual(canAccessResearchSubmission(admin), true);
    assert.strictEqual(canAccessExternalResearch(admin), true);
    assert.strictEqual(canAccessResearchReports(admin), true);
    assert.strictEqual(canAccessLetters(admin), false);
    assert.strictEqual(canAccessResearcherProfiles(admin), true);

    assert.strictEqual(canAccessLetters(letterAdmin), true);
    assert.strictEqual(canAccessResearchSubmission(letterAdmin), false);
    assert.strictEqual(canAccessResearcherProfiles(letterAdmin), true);

    assert.strictEqual(canAccessResearcherProfiles(profileAdmin), true);
    assert.strictEqual(canAccessLetters(profileAdmin), false);
    assert.strictEqual(canAccessResearchSubmission(profileAdmin), false);
    assert.strictEqual(canAccessLetters(manager), true);
    assert.strictEqual(canAccessResearcherProfiles(superAdmin), true);
  });

  it('lets managers switch between full management and lecturer behavior', () => {
    assert.strictEqual(isManagerAccount(manager), true);
    assert.strictEqual(hasFullAccess(manager), true);
    assert.strictEqual(canAccessSchemeManagement(manager), true);

    assert.strictEqual(isManagerAccount(managerLecturer), true);
    assert.strictEqual(isResearcher(managerLecturer), true);
    assert.strictEqual(hasFullAccess(managerLecturer), false);
    assert.strictEqual(canAccessSchemeManagement(managerLecturer), false);
    assert.strictEqual(canAccessResearchSubmission(managerLecturer), true);
    assert.strictEqual(canAccessLetters(managerLecturer), true);
    assert.strictEqual(canAccessResearcherProfiles(managerLecturer), true);
    assert.strictEqual(canDecideDraft({ ...draft(STATUS.REVIEWED), reviews: [{ submittedAt: '2026-07-17T00:00:00.000Z' }] }, managerLecturer), false);
  });

  it('limits the archive workspace to super admin and management-mode manager accounts', () => {
    assert.strictEqual(canAccessArchive(superAdmin), true);
    assert.strictEqual(canAccessArchive(manager), true);
    assert.strictEqual(canAccessArchive(managerLecturer), false);
    assert.strictEqual(canAccessArchive(admin), false);
    assert.strictEqual(canAccessArchive(lecturer), false);
  });

  it('limits draft editing to the owner or a full-access administrator', () => {
    assert.strictEqual(canEditDraft(draft(STATUS.DRAFT), lecturer), true);
    assert.strictEqual(canEditDraft({ ...draft(STATUS.DRAFT), userId: 'other' }, lecturer), false);
    assert.strictEqual(canEditDraft(draft(STATUS.SUBMITTED), lecturer), false);
    assert.strictEqual(canEditDraft(draft(STATUS.REVISION), manager), true);
  });

  it('enforces the maximum scheme budget for proposal submission', () => {
    const scheme = { maximumBudget: 10000000 };
    const proposal = {
      project: {
        title: 'Research', mandatoryOutputPlan: 'sinta_1', targetTkt: 'none', ripRelation: 'none', researchCenterRelation: 'none', sdgs: [1], integrated: false
      },
      members: [
        {
          role: 'ketua', name: 'Lead', nidn: '1', program: 'IS', faculty: 'FTI'
        },
        {
          role: 'member', name: 'Member', nidn: '2', program: 'IS', faculty: 'FTI'
        },
      ],
      budgets: [{
        component: 'Material', name: 'Item', volume: 2, unit: 'unit', unitPrice: 6000000
      }],
    };
    assert.strictEqual(getSchemeMaximumBudget(scheme), 10000000);
    assert.strictEqual(getDraftBudgetTotal(proposal), 12000000);
    assert.strictEqual(isBudgetWithinScheme(proposal, scheme), false);
    assert.match(validateDraftForSubmit(proposal, scheme), /maksimum skema/);
    assert.strictEqual(isBudgetWithinScheme({
      ...proposal,
      budgets: [{
        component: 'Material', name: 'Item', volume: 2, unit: 'unit', unitPrice: 5000000
      }],
    }, scheme), true);
  });

  it('derives temporary reviewer access from a proposal assignment', () => {
    const assigned = draft(STATUS.UNDER_REVIEW);
    const data = { drafts: [assigned], temporaryRoleAssignments: [{ userId: assignedLecturer.id, role: 'reviewer', status: 'active' }] };
    assert.strictEqual(canReviewerViewDraft(assigned, assignedLecturer), true);
    assert.strictEqual(canScoreDraft(assigned, assignedLecturer), true);
    assert.strictEqual(hasTemporaryReviewerRole(data, assignedLecturer), true);
    assert.strictEqual(canReviewerViewDraft(assigned, { ...assignedLecturer, id: 'other', profileId: 'other' }), false);
  });

  it('supports multiple reviewer assignments and reviews', () => {
    const proposal = {
      ...draft(STATUS.REVIEWED),
      assignments: [
        ...draft(STATUS.REVIEWED).assignments,
        {
          id: 'assignment-2', reviewerUserId: 'lecturer-3', reviewerProfileId: 'profile-3', status: 'submitted'
        },
      ],
      reviews: [
        {
          id: 'review-1', reviewerUserId: assignedLecturer.id, totalScore: 80, submittedAt: '2026-07-17T00:00:00.000Z'
        },
        {
          id: 'review-2', reviewerUserId: 'lecturer-3', totalScore: 90, submittedAt: '2026-07-17T01:00:00.000Z'
        },
      ],
    };
    assert.strictEqual(draftReviewerAssignments(proposal).length, 2);
    assert.strictEqual(draftReviews(proposal).length, 2);
  });

  it('keeps final funding decisions with super admin, manager, or admin', () => {
    const reviewed = { ...draft(STATUS.REVIEWED), reviews: [{ id: 'review-1', reviewerUserId: assignedLecturer.id, submittedAt: '2026-07-17T00:00:00.000Z' }] };
    assert.strictEqual(canDecideDraft(reviewed, admin), true);
    assert.strictEqual(canDecideDraft(reviewed, manager), true);
    assert.strictEqual(canDecideDraft(reviewed, superAdmin), true);
    assert.strictEqual(canAssignReviewer(draft(STATUS.SUBMITTED), admin), true);
    assert.strictEqual(canDecideDraft(reviewed, letterAdmin), false);
    assert.strictEqual(canAssignReviewer(draft(STATUS.SUBMITTED), profileAdmin), false);
  });

  it('requires review status before a proposal can become funded', () => {
    const submitted = draft(STATUS.SUBMITTED);
    assert.strictEqual(canTransitionDraftStatus(submitted, STATUS.UNDER_REVIEW), true);
    assert.strictEqual(canTransitionDraftStatus(submitted, STATUS.FUNDED), false);

    const underReview = transitionDraftStatus(submitted, STATUS.UNDER_REVIEW, { marker: 'kept' });
    const reviewed = transitionDraftStatus(underReview, STATUS.REVIEWED);
    const funded = transitionDraftStatus(reviewed, STATUS.FUNDED);
    assert.strictEqual(funded.status, STATUS.FUNDED);
    assert.strictEqual(funded.marker, 'kept');
  });
});
