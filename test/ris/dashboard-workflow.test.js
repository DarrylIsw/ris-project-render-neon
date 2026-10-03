/* eslint-disable object-curly-newline */
const assert = require('assert');
const {
  getManagementResearchAction,
  getResearcherProposalAction,
  getReviewerTaskAction,
  managementResearchPriority,
} = require('../../app/containers/Ris/features/dashboard/workflows/dashboardWorkflow');
const { ADMIN_SCOPE, MANAGER_MODE, ROLE, STATUS } = require('../../app/containers/Ris/shared/workflows/workflow');

const lecturer = { id: 'lecturer-1', profileId: 'profile-1', role: ROLE.LECTURER };
const reviewer = { id: 'lecturer-2', profileId: 'profile-2', role: ROLE.LECTURER };
const researchAdmin = { id: 'admin-1', role: ROLE.ADMIN, adminScopes: [ADMIN_SCOPE.RESEARCH] };
const managerLecturer = { id: 'manager-1', profileId: 'manager-profile', role: ROLE.MANAGER, managerMode: MANAGER_MODE.LECTURER };

const proposal = (status, changes = {}) => ({
  id: 'proposal-1',
  schemeId: 'scheme-1',
  userId: lecturer.id,
  status,
  draftStatus: status,
  assignments: [],
  reviews: [],
  ...changes,
});

describe('RIS dashboard workflow directing', () => {
  it('routes every management stage to the current monitoring workspace', () => {
    const pending = proposal(STATUS.SUBMITTED, { verification: { status: 'pending' } });
    const verified = proposal(STATUS.SUBMITTED, { verification: { status: 'verified' } });
    const reviewed = proposal(STATUS.REVIEWED, {
      verification: { status: 'verified' },
      assignments: [{ reviewerUserId: reviewer.id, reviewerProfileId: reviewer.profileId, status: 'submitted' }],
      reviews: [{ reviewerUserId: reviewer.id, submittedAt: '2026-08-01T00:00:00.000Z' }],
    });

    assert.strictEqual(getManagementResearchAction(pending, researchAdmin).path, '/ris/skema/pengajuan?stage=verification&focus=proposal-1');
    assert.strictEqual(getManagementResearchAction(verified, researchAdmin).path, '/ris/skema/pengajuan?stage=reviewer&focus=proposal-1');
    assert.strictEqual(getManagementResearchAction(reviewed, researchAdmin).path, '/ris/skema/pengajuan?stage=decision&focus=proposal-1');
    assert.ok(managementResearchPriority(reviewed, researchAdmin) < managementResearchPriority(pending, researchAdmin));
  });

  it('routes funded research to scheme data instead of proposal preview', () => {
    const funded = proposal(STATUS.FUNDED);
    assert.strictEqual(getManagementResearchAction(funded, researchAdmin).path, '/ris/penelitian-didanai/proposal-1/pendataan');
    assert.strictEqual(getResearcherProposalAction(funded, lecturer).path, '/ris/penelitian-didanai/proposal-1/pendataan?tab=contract');
    assert.strictEqual(getResearcherProposalAction({ ...funded, contract: { status: 'signed' } }, lecturer).path, '/ris/penelitian-didanai/proposal-1/pendataan?tab=monev');
  });

  it('keeps lecturer and manager lecturer-mode draft actions in the proposal wizard', () => {
    const lecturerDraft = proposal(STATUS.DRAFT);
    const managerDraft = { ...proposal(STATUS.DRAFT), userId: managerLecturer.id };
    assert.strictEqual(getResearcherProposalAction(lecturerDraft, lecturer).path, '/ris/pengajuan-penelitian-internal/scheme/scheme-1');
    assert.strictEqual(getResearcherProposalAction(managerDraft, managerLecturer).path, '/ris/pengajuan-penelitian-internal/scheme/scheme-1');
  });

  it('routes an active reviewer directly to scoring and submitted work to preview', () => {
    const assigned = proposal(STATUS.UNDER_REVIEW, {
      verification: { status: 'verified' },
      assignments: [{ reviewerUserId: reviewer.id, reviewerProfileId: reviewer.profileId, status: 'assigned' }],
    });
    const submitted = {
      ...assigned,
      assignments: [{ reviewerUserId: reviewer.id, reviewerProfileId: reviewer.profileId, status: 'submitted' }],
      reviews: [{ reviewerUserId: reviewer.id, submittedAt: '2026-08-01T00:00:00.000Z' }],
    };
    assert.strictEqual(getReviewerTaskAction(assigned, reviewer).path, '/ris/pengajuan-penelitian-internal/proposal-1/penilaian');
    assert.strictEqual(getReviewerTaskAction(submitted, reviewer).path, '/ris/pengajuan-penelitian-internal/proposal-1/preview?reviewer=1');
  });
});
