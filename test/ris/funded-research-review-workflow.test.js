/* eslint-disable object-curly-newline */
const assert = require('assert');
const { createInitialData, normalizeRisData } = require('../../app/containers/Ris/core/data');
const {
  FUNDED_REVIEW_CRITERIA,
  FUNDED_REVIEW_TARGET,
  appendFundedReviewerReminders,
  applyFundedReviewerAssignments,
  canAssignFundedReviewer,
  canScoreFundedReview,
  fundedAssignmentsFor,
  fundedReviewsFor,
  getFundedReviewerTasks,
  submitFundedReview,
} = require('../../app/containers/Ris/features/research/workflows/fundedResearchReviewWorkflow');

const clone = value => JSON.parse(JSON.stringify(value));
const withFinalReport = data => ({
  ...data,
  internalReports: [...(data.internalReports || []), {
    id: 'internal-report-demo-final',
    researchId: 'draft-approved',
    schemeId: 'scheme-1',
    periodId: 'scheme-1-final',
    reportType: 'final',
    reportPeriod: 'Laporan Akhir',
    status: 'submitted',
  }],
});

describe('RIS funded research review workflow', () => {
  it('uses distinct scoring templates for Monev and research reports', () => {
    assert.notDeepStrictEqual(FUNDED_REVIEW_CRITERIA.monev.map(item => item.code), FUNDED_REVIEW_CRITERIA.report.map(item => item.code));
    assert.strictEqual(FUNDED_REVIEW_CRITERIA.monev.reduce((sum, item) => sum + item.weight, 0), 100);
    assert.strictEqual(FUNDED_REVIEW_CRITERIA.report.reduce((sum, item) => sum + item.weight, 0), 100);
  });

  it('allows management to assign reviewers only after a target is published or submitted', () => {
    const data = createInitialData();
    const admin = data.systemUsers.find(user => user.id === 'user-admin');
    const lecturer = data.systemUsers.find(user => user.id === 'user-lecturer');
    assert.strictEqual(canAssignFundedReviewer(data, FUNDED_REVIEW_TARGET.MONEV, 'monev-demo-interim-1', admin), true);
    assert.strictEqual(canAssignFundedReviewer(data, FUNDED_REVIEW_TARGET.MONEV, 'monev-demo-interim-1', lecturer), false);
    const draftTarget = { ...data, monevRecords: data.monevRecords.map(item => ({ ...item, status: 'draft' })) };
    assert.strictEqual(canAssignFundedReviewer(draftTarget, FUNDED_REVIEW_TARGET.MONEV, 'monev-demo-interim-1', admin), false);
  });

  it('assigns multiple reviewers and derives temporary reviewer grants during normalization', () => {
    const data = withFinalReport(createInitialData());
    const admin = data.systemUsers.find(user => user.id === 'user-admin');
    const assigned = applyFundedReviewerAssignments(clone(data), FUNDED_REVIEW_TARGET.REPORT, 'internal-report-demo-final', ['user-lecturer-2', 'user-lecturer-3'], '2026-08-25T16:59:00.000Z', admin, new Date('2026-08-09T08:00:00.000Z'));
    assert.strictEqual(fundedAssignmentsFor(assigned, FUNDED_REVIEW_TARGET.REPORT, 'internal-report-demo-final').length, 2);
    const normalized = normalizeRisData(assigned);
    assert.strictEqual(normalized.temporaryRoleAssignments.filter(grant => grant.entityType === 'funded_report' && grant.status === 'active').length, 2);
  });

  it('notifies a temporary reviewer when a funded review assignment is revoked', () => {
    const data = withFinalReport(createInitialData());
    const admin = data.systemUsers.find(user => user.id === 'user-admin');
    const assigned = applyFundedReviewerAssignments(clone(data), FUNDED_REVIEW_TARGET.REPORT, 'internal-report-demo-final', ['user-lecturer-2'], '2026-08-25T16:59:00.000Z', admin, new Date('2026-08-09T08:00:00.000Z'));
    const revised = applyFundedReviewerAssignments(assigned, FUNDED_REVIEW_TARGET.REPORT, 'internal-report-demo-final', [], '2026-08-25T16:59:00.000Z', admin, new Date('2026-08-09T09:00:00.000Z'));

    assert.strictEqual(revised.notifications.some(item => item.type === 'funded_reviewer_revoked' && item.userId === 'user-lecturer-2'), true);
  });

  it('lets an assigned lecturer submit once and exposes the result to management and the research owner', () => {
    const data = createInitialData();
    const reviewer = data.systemUsers.find(user => user.id === 'user-lecturer-2');
    assert.strictEqual(canScoreFundedReview(data, FUNDED_REVIEW_TARGET.MONEV, 'monev-demo-interim-1', reviewer), true);
    const reviewed = submitFundedReview(clone(data), FUNDED_REVIEW_TARGET.MONEV, 'monev-demo-interim-1', {
      scores: { milestone: 85, progress: 82, deviation: 80, corrective_action: 84, evidence: 86 },
      totalScore: 83.5,
      recommendation: 'approve',
      substanceNotes: 'Kemajuan baik.',
      technicalNotes: 'Risiko terkendali.',
      followUpNotes: 'Lanjutkan validasi.',
    }, reviewer, new Date('2026-08-09T09:00:00.000Z'));
    assert.strictEqual(fundedReviewsFor(reviewed, FUNDED_REVIEW_TARGET.MONEV, 'monev-demo-interim-1').length, 1);
    assert.strictEqual(fundedAssignmentsFor(reviewed, FUNDED_REVIEW_TARGET.MONEV, 'monev-demo-interim-1')[0].status, 'submitted');
    assert.strictEqual(canScoreFundedReview(reviewed, FUNDED_REVIEW_TARGET.MONEV, 'monev-demo-interim-1', reviewer), false);
    assert.strictEqual(reviewed.notifications.some(item => item.userId === 'user-lecturer' && item.type === 'funded_review_available'), true);
    assert.strictEqual(reviewed.notifications.some(item => item.userId === 'user-admin' && item.type === 'funded_review_submitted'), true);
  });

  it('creates manual reminders only for reviewers who have not submitted', () => {
    const data = createInitialData();
    const admin = data.systemUsers.find(user => user.id === 'user-admin');
    const reminded = appendFundedReviewerReminders(clone(data), FUNDED_REVIEW_TARGET.MONEV, 'monev-demo-interim-1', admin, new Date('2026-08-09T10:00:00.000Z'));
    assert.strictEqual(reminded.fundedReviewerReminders.length, 1);
    assert.strictEqual(reminded.notifications.some(item => item.type === 'funded_reviewer_reminder' && item.userId === 'user-lecturer-2'), true);
    assert.strictEqual(getFundedReviewerTasks(reminded, data.systemUsers.find(user => user.id === 'user-lecturer-2')).length > 0, true);
  });

  it('directs final-report review results to the final-report workspace', () => {
    const data = withFinalReport(createInitialData());
    const admin = data.systemUsers.find(user => user.id === 'user-admin');
    const reviewer = data.systemUsers.find(user => user.id === 'user-lecturer-3');
    const assigned = applyFundedReviewerAssignments({ ...data, notifications: [], fundedReviewAssignments: [], fundedReviews: [] }, FUNDED_REVIEW_TARGET.REPORT, 'internal-report-demo-final', [reviewer.id], '2026-10-01T16:59:00.000Z', admin);
    const reviewed = submitFundedReview(assigned, FUNDED_REVIEW_TARGET.REPORT, 'internal-report-demo-final', { totalScore: 85, recommendation: 'approve' }, reviewer);
    const notifications = reviewed.notifications.filter(item => ['funded_review_submitted', 'funded_review_available'].includes(item.type));
    assert.ok(notifications.some(item => item.userId === 'user-lecturer'));
    assert.ok(notifications.some(item => item.userId === 'user-admin'));
    assert.ok(notifications.every(item => item.actionPath.endsWith('?tab=final-report')));
  });

  it('does not duplicate a review notification when the research owner is also management', () => {
    const data = createInitialData();
    const reviewer = data.systemUsers.find(user => user.id === 'user-lecturer-2');
    const managerOwned = {
      ...clone(data),
      drafts: data.drafts.map(draft => (draft.id === 'draft-approved' ? { ...draft, userId: 'user-manager' } : draft)),
    };
    const reviewed = submitFundedReview(managerOwned, FUNDED_REVIEW_TARGET.MONEV, 'monev-demo-interim-1', {
      scores: { milestone: 85, progress: 82, deviation: 80, corrective_action: 84, evidence: 86 },
      totalScore: 83.5,
      recommendation: 'approve',
      substanceNotes: 'Kemajuan baik.',
      technicalNotes: 'Risiko terkendali.',
      followUpNotes: 'Lanjutkan validasi.',
    }, reviewer, new Date('2026-08-09T11:00:00.000Z'));
    const managerNotifications = reviewed.notifications.filter(item => item.userId === 'user-manager' && item.createdAt === '2026-08-09T11:00:00.000Z');
    assert.strictEqual(managerNotifications.length, 1);
    assert.strictEqual(managerNotifications[0].type, 'funded_review_available');
  });
});
