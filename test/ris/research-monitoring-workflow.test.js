/* eslint-disable object-curly-newline */
const assert = require('assert');
const { createInitialData } = require('../../app/containers/Ris/core/data');
const {
  appendReviewerReminders,
  applyProposalDecision,
  applyProposalVerification,
  applyReviewerAssignments,
  proposalDisplayMeta,
  reviewerStage,
  verificationStage,
} = require('../../app/containers/Ris/features/research/workflows/researchMonitoringWorkflow');
const { ROLE, STATUS, draftStatus, hasTemporaryReviewerRole } = require('../../app/containers/Ris/shared/workflows/workflow');
const { appendWorkflowNotifications } = require('../../app/containers/Ris/shared/workflows/notificationWorkflow');

const clone = value => JSON.parse(JSON.stringify(value));
const actor = {
  id: 'user-admin', name: 'Admin Penelitian', role: ROLE.ADMIN, adminScopes: ['research_management']
};

describe('RIS research monitoring workflow', () => {
  it('keeps the reviewer demo login as a lecturer with assignment-derived access', () => {
    const data = createInitialData();
    const andini = data.systemUsers.find(user => user.id === 'user-lecturer-2');
    assert.strictEqual(andini.email, 'reviewer@umn.ac.id');
    assert.strictEqual(andini.role, ROLE.LECTURER);
    assert.strictEqual(hasTemporaryReviewerRole(data, andini), true);
    assert.strictEqual(hasTemporaryReviewerRole({ ...data, temporaryRoleAssignments: [], drafts: [] }, andini), false);
    const revokedDrafts = data.drafts.map(draft => ({ ...draft, assignments: (draft.assignments || []).map(assignment => ({ ...assignment, status: 'revoked' })) }));
    assert.strictEqual(hasTemporaryReviewerRole({ ...data, temporaryRoleAssignments: [], drafts: revokedDrafts }, andini), false);
  });

  it('derives the verification display state without adding a proposal status', () => {
    const data = createInitialData();
    const submitted = data.drafts.find(draft => draft.id === 'draft-submitted');
    assert.strictEqual(proposalDisplayMeta(submitted).label, 'Butuh Verifikasi');
    assert.strictEqual(verificationStage(submitted), 'pending');

    const verifiedData = applyProposalVerification(clone(data), submitted.id, {
      project: true, members: true, budget: true, outputs: true, attachments: true
    }, '', actor, new Date('2026-08-06T08:00:00.000Z'));
    const verified = verifiedData.drafts.find(draft => draft.id === submitted.id);
    assert.strictEqual(draftStatus(verified), STATUS.SUBMITTED);
    assert.strictEqual(verificationStage(verified), 'verified');
    assert.strictEqual(proposalDisplayMeta(verified).label, 'Telah Diverifikasi');
  });

  it('assigns multiple lecturers and grants only temporary reviewer access', () => {
    const data = createInitialData();
    const verifiedData = applyProposalVerification(clone(data), 'draft-submitted', {
      project: true, members: true, budget: true, outputs: true, attachments: true
    }, '', actor, new Date('2026-08-06T08:00:00.000Z'));
    const assignedData = applyReviewerAssignments(verifiedData, 'draft-submitted', ['user-lecturer-2', 'user-lecturer-3'], '2026-08-20T08:00:00.000Z', actor, new Date('2026-08-06T09:00:00.000Z'));
    const assigned = assignedData.drafts.find(draft => draft.id === 'draft-submitted');
    assert.strictEqual(draftStatus(assigned), STATUS.UNDER_REVIEW);
    assert.strictEqual(assigned.assignments.filter(item => item.status === 'assigned').length, 2);
    assert.strictEqual(reviewerStage(assigned), 'waiting');
    assert.strictEqual(assignedData.temporaryRoleAssignments.filter(grant => grant.entityId === assigned.id && grant.status === 'active').length, 2);
  });

  it('records manual reviewer reminders for notification and email processing', () => {
    const data = createInitialData();
    const reminded = appendReviewerReminders(clone(data), 'draft-assigned', actor, new Date('2026-08-06T10:00:00.000Z'));
    assert.strictEqual(reminded.reviewerReminders.length, 1);
    assert.strictEqual(reminded.reviewerReminders[0].channel, 'both');
    assert.strictEqual(reminded.notifications.some(item => item.type === 'reviewer_manual_reminder' && item.userId === 'user-lecturer-2'), true);
    const enriched = appendWorkflowNotifications(data, reminded, actor, new Date('2026-08-06T10:00:00.000Z'));
    assert.strictEqual(enriched.emailOutbox.some(item => item.notificationType === 'reviewer_manual_reminder' && item.recipientUserId === 'user-lecturer-2'), true);
  });

  it('keeps the final decision with management and revokes reviewer access when funded', () => {
    const data = createInitialData();
    const decided = applyProposalDecision(clone(data), 'draft-reviewed', 'funded', 'Layak didanai.', actor, new Date('2026-08-06T11:00:00.000Z'));
    const funded = decided.drafts.find(draft => draft.id === 'draft-reviewed');
    assert.strictEqual(draftStatus(funded), STATUS.FUNDED);
    assert.strictEqual(funded.decision.finalDecision, 'funded');
    assert.ok(funded.fundingLetter);
    assert.strictEqual(funded.assignments.every(assignment => assignment.status === 'revoked'), true);
    assert.strictEqual(decided.temporaryRoleAssignments.filter(grant => grant.entityId === funded.id).every(grant => grant.status === 'revoked'), true);
  });

  it('records revision requests without locking the next review round', () => {
    const data = createInitialData();
    const revisedData = applyProposalDecision(clone(data), 'draft-reviewed', 'revision', 'Perbaiki metodologi.', actor, new Date('2026-08-06T11:00:00.000Z'));
    const revised = revisedData.drafts.find(draft => draft.id === 'draft-reviewed');
    assert.strictEqual(draftStatus(revised), STATUS.REVISION);
    assert.strictEqual(revised.decision, null);
    assert.strictEqual(revised.decisionHistory.length, 1);
    assert.strictEqual(revised.decisionHistory[0].isFinal, false);
    assert.strictEqual(revised.assignments.every(assignment => assignment.status === 'assigned'), true);
    assert.strictEqual(revised.reviews.length, 0);
    assert.strictEqual(revised.reviewHistory.length, 1);
  });
});
