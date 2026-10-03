/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines */
import { uid } from '../../../core/data';
import { reviewerCandidates } from './researchMonitoringWorkflow';
import { canManageResearch, isResearcher } from '../../../shared/workflows/workflow';

export const FUNDED_REVIEW_TARGET = {
  MONEV: 'monev',
  REPORT: 'report',
};

export const FUNDED_REVIEW_CRITERIA = {
  [FUNDED_REVIEW_TARGET.MONEV]: [
    { code: 'milestone', label: 'Ketercapaian milestone', group: 'Kemajuan Penelitian (45%)', weight: 25 },
    { code: 'progress', label: 'Konsistensi progres terhadap rencana', group: 'Kemajuan Penelitian (45%)', weight: 20 },
    { code: 'deviation', label: 'Analisis deviasi dan risiko', group: 'Pengendalian (35%)', weight: 20 },
    { code: 'corrective_action', label: 'Kelayakan tindakan korektif', group: 'Pengendalian (35%)', weight: 15 },
    { code: 'evidence', label: 'Kualitas bukti pendukung', group: 'Dokumentasi (20%)', weight: 20 },
  ],
  [FUNDED_REVIEW_TARGET.REPORT]: [
    { code: 'objective', label: 'Kesesuaian hasil dengan tujuan penelitian', group: 'Substansi Laporan (45%)', weight: 25 },
    { code: 'method', label: 'Ketepatan metode dan analisis', group: 'Substansi Laporan (45%)', weight: 20 },
    { code: 'result', label: 'Kelengkapan dan validitas hasil', group: 'Capaian Penelitian (35%)', weight: 20 },
    { code: 'output', label: 'Ketercapaian luaran yang dijanjikan', group: 'Capaian Penelitian (35%)', weight: 15 },
    { code: 'document', label: 'Kualitas dokumen dan bukti', group: 'Dokumentasi (20%)', weight: 10 },
    { code: 'follow_up', label: 'Kelayakan tindak lanjut', group: 'Dokumentasi (20%)', weight: 10 },
  ],
};

const activeAssignment = assignment => assignment && ['assigned', 'in_progress', 'submitted'].includes(assignment.status);

export const fundedReviewTarget = (data, targetType, targetId) => {
  if (targetType === FUNDED_REVIEW_TARGET.MONEV) return (data.monevRecords || []).find(item => item.id === targetId);
  if (targetType === FUNDED_REVIEW_TARGET.REPORT) return (data.internalReports || []).find(item => item.id === targetId && item.reportType !== 'interim');
  return null;
};

export const fundedReviewDraft = (data, targetType, targetId) => {
  const target = fundedReviewTarget(data, targetType, targetId);
  return target && (data.drafts || []).find(item => item.id === target.researchId);
};

export const fundedReviewTargetLabel = (targetType, target) => {
  if (!target) return 'Data evaluasi';
  if (targetType === FUNDED_REVIEW_TARGET.MONEV) return `Monev ${target.periodLabel || ''}`.trim();
  return target.reportPeriod || (target.payload && target.payload.title) || 'Laporan penelitian';
};

export const fundedAssignmentsFor = (data, targetType, targetId) => (data.fundedReviewAssignments || []).filter(assignment => (
  assignment.targetType === targetType && assignment.targetId === targetId && activeAssignment(assignment)
));

export const fundedReviewsFor = (data, targetType, targetId) => (data.fundedReviews || []).filter(review => (
  review.targetType === targetType && review.targetId === targetId
));

export const fundedAssignmentForUser = (data, targetType, targetId, user) => fundedAssignmentsFor(data, targetType, targetId).find(assignment => (
  assignment.reviewerUserId === (user && user.id) || assignment.reviewerProfileId === (user && user.profileId)
));

export const canAssignFundedReviewer = (data, targetType, targetId, user) => {
  const target = fundedReviewTarget(data, targetType, targetId);
  return canManageResearch(user) && Boolean(target) && ['submitted', 'under_review', 'accepted'].includes(target.status);
};

export const canScoreFundedReview = (data, targetType, targetId, user) => {
  if (!isResearcher(user)) return false;
  const assignment = fundedAssignmentForUser(data, targetType, targetId, user);
  if (!assignment || !['assigned', 'in_progress'].includes(assignment.status)) return false;
  return !fundedReviewsFor(data, targetType, targetId).some(review => review.reviewerUserId === user.id);
};

export const getFundedReviewerTasks = (data, user) => (data.fundedReviewAssignments || []).filter(assignment => (
  activeAssignment(assignment)
  && (assignment.reviewerUserId === (user && user.id) || assignment.reviewerProfileId === (user && user.profileId))
)).map(assignment => ({
  assignment,
  target: fundedReviewTarget(data, assignment.targetType, assignment.targetId),
  draft: fundedReviewDraft(data, assignment.targetType, assignment.targetId),
  reviews: fundedReviewsFor(data, assignment.targetType, assignment.targetId).filter(review => review.reviewerUserId === (user && user.id)),
})).filter(task => task.target && task.draft);

export const fundedReviewerCandidates = (data, targetType, targetId) => {
  const draft = fundedReviewDraft(data, targetType, targetId);
  return draft ? reviewerCandidates(data, draft) : [];
};

export const applyFundedReviewerAssignments = (data, targetType, targetId, selectedIds, dueAt, actor, now = new Date()) => {
  const assignedAt = now.toISOString();
  const selected = [...new Set(selectedIds || [])];
  const existing = data.fundedReviewAssignments || [];
  const targetAssignments = existing.filter(item => item.targetType === targetType && item.targetId === targetId);
  const candidates = fundedReviewerCandidates(data, targetType, targetId);
  const submittedIds = targetAssignments.filter(item => item.status === 'submitted').map(item => item.reviewerUserId);
  const finalIds = [...new Set([...selected, ...submittedIds])];
  const retained = targetAssignments.map(assignment => {
    if (finalIds.includes(assignment.reviewerUserId)) return assignment;
    if (!activeAssignment(assignment)) return assignment;
    return { ...assignment, status: 'revoked', revokedAt: assignedAt, revokedBy: actor.id };
  });
  const additions = finalIds.filter(reviewerId => !targetAssignments.some(item => item.reviewerUserId === reviewerId && activeAssignment(item))).map(reviewerId => {
    const candidate = candidates.find(item => item.userId === reviewerId) || {};
    return {
      id: uid('funded-review-assignment'), targetType, targetId,
      researchId: (fundedReviewTarget(data, targetType, targetId) || {}).researchId,
      reviewerUserId: reviewerId, reviewerProfileId: candidate.id || candidate.profileId,
      status: 'assigned', assignedBy: actor.id, assignedAt, dueAt,
    };
  });
  const newReviewerIds = additions.map(item => item.reviewerUserId);
  const revokedAssignments = retained.filter(item => item.status === 'revoked' && targetAssignments.some(previous => previous.id === item.id && activeAssignment(previous)));
  const target = fundedReviewTarget(data, targetType, targetId);
  const label = fundedReviewTargetLabel(targetType, target);
  const notifications = additions.map(assignment => ({
    id: uid('notif'), userId: assignment.reviewerUserId, fromUserId: actor.id,
    entityType: 'funded_review', entityId: targetId, targetType,
    type: 'funded_reviewer_assigned', message: `Anda ditugaskan menilai ${label}.`,
    actionPath: `/ris/penelitian-didanai/review/${targetType}/${targetId}`, actionLabel: 'Beri Penilaian',
    createdAt: assignedAt, isRead: false,
  }));
  const revokedNotifications = revokedAssignments.map(assignment => ({
    id: uid('notif'), userId: assignment.reviewerUserId, fromUserId: actor.id,
    entityType: 'funded_review', entityId: targetId, targetType,
    type: 'funded_reviewer_revoked', message: `Penugasan penilaian ${label} telah selesai atau dicabut.`,
    actionPath: '/ris', actionLabel: 'Buka Dashboard',
    createdAt: assignedAt, isRead: false,
  }));
  return {
    ...data,
    fundedReviewAssignments: [...existing.filter(item => item.targetType !== targetType || item.targetId !== targetId), ...retained, ...additions],
    notifications: [...(data.notifications || []), ...notifications, ...revokedNotifications],
    lastFundedReviewerAssignment: { targetType, targetId, reviewerIds: finalIds, newReviewerIds },
  };
};

export const appendFundedReviewerReminders = (data, targetType, targetId, actor, now = new Date()) => {
  const sentAt = now.toISOString();
  const target = fundedReviewTarget(data, targetType, targetId);
  const label = fundedReviewTargetLabel(targetType, target);
  const assignments = fundedAssignmentsFor(data, targetType, targetId).filter(item => item.status !== 'submitted');
  const reminders = assignments.map(assignment => ({
    id: uid('funded-review-reminder'), assignmentId: assignment.id, targetType, targetId,
    sentBy: actor.id, channel: 'both', sentAt,
  }));
  const notifications = assignments.map(assignment => ({
    id: uid('notif'), userId: assignment.reviewerUserId, fromUserId: actor.id,
    entityType: 'funded_review', entityId: targetId, targetType,
    type: 'funded_reviewer_reminder', message: `Pengingat penilaian untuk ${label}.`,
    actionPath: `/ris/penelitian-didanai/review/${targetType}/${targetId}`, actionLabel: 'Beri Penilaian',
    createdAt: sentAt, isRead: false,
  }));
  return {
    ...data,
    fundedReviewerReminders: [...(data.fundedReviewerReminders || []), ...reminders],
    notifications: [...(data.notifications || []), ...notifications],
  };
};

export const submitFundedReview = (data, targetType, targetId, reviewInput, user, now = new Date()) => {
  const submittedAt = now.toISOString();
  const assignment = fundedAssignmentForUser(data, targetType, targetId, user);
  if (!assignment || !canScoreFundedReview(data, targetType, targetId, user)) return data;
  const target = fundedReviewTarget(data, targetType, targetId);
  const draft = fundedReviewDraft(data, targetType, targetId);
  const label = fundedReviewTargetLabel(targetType, target);
  const review = {
    id: uid('funded-review'), assignmentId: assignment.id, targetType, targetId,
    researchId: target.researchId, reviewerUserId: user.id, reviewerProfileId: user.profileId,
    reviewerName: user.name, ...reviewInput, submittedAt,
  };
  const managementNotifications = (data.systemUsers || []).filter(account => canManageResearch(account) && account.isActive !== false && account.id !== draft.userId).map(account => ({
    id: uid('notif'), userId: account.id, fromUserId: user.id,
    entityType: 'funded_review', entityId: targetId, targetType,
    type: 'funded_review_submitted', message: `Hasil penilaian ${label} telah dikirim oleh ${user.name}.`,
    actionPath: `/ris/penelitian-didanai/${draft.id}/pendataan?tab=${targetType === FUNDED_REVIEW_TARGET.MONEV || target.reportType === 'interim' ? 'monev' : target.reportType === 'output' ? 'output-report' : 'final-report'}`,
    actionLabel: 'Lihat Hasil', createdAt: submittedAt, isRead: false,
  }));
  const ownerNotification = {
    id: uid('notif'), userId: draft.userId, fromUserId: user.id,
    entityType: 'funded_review', entityId: targetId, targetType,
    type: 'funded_review_available', message: `Hasil penilaian ${label} telah tersedia.`,
    actionPath: `/ris/penelitian-didanai/${draft.id}/pendataan?tab=${targetType === FUNDED_REVIEW_TARGET.MONEV || target.reportType === 'interim' ? 'monev' : target.reportType === 'output' ? 'output-report' : 'final-report'}`,
    actionLabel: 'Lihat Hasil', createdAt: submittedAt, isRead: false,
  };
  return {
    ...data,
    fundedReviewAssignments: (data.fundedReviewAssignments || []).map(item => (item.id === assignment.id ? { ...item, status: 'submitted', submittedAt } : item)),
    fundedReviews: [...(data.fundedReviews || []).filter(item => item.assignmentId !== assignment.id), review],
    notifications: [...(data.notifications || []), ...managementNotifications, ownerNotification],
  };
};
