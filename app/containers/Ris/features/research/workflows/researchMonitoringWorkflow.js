/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines */
import { STATUS_META, uid } from '../../../core/data';
import {
  ROLE,
  STATUS,
  canDecideDraft,
  draftReviewerAssignments,
  draftReviews,
  draftStatus,
  getRoleLabel,
  isActiveReviewerAssignment,
  normalizeRole,
  transitionDraftStatus,
} from '../../../shared/workflows/workflow';

export const VERIFICATION_CHECKS = [
  { key: 'project', label: 'Deskripsi penelitian' },
  { key: 'members', label: 'Data member' },
  { key: 'budget', label: 'Data anggaran' },
  { key: 'outputs', label: 'Luaran hasil' },
  { key: 'attachments', label: 'Data lampiran' },
];

export const createVerificationChecklist = draft => {
  const saved = (draft && draft.verification && (draft.verification.checklist || draft.verification.completeness)) || {};
  return VERIFICATION_CHECKS.reduce((result, item) => ({ ...result, [item.key]: saved[item.key] !== false }), {});
};

export const proposalYear = (draft, scheme) => {
  const explicit = draft && draft.project && (draft.project.researchYear || draft.project.year);
  const schemeYear = scheme && (scheme.year || String(scheme.startDate || '').slice(0, 4));
  const submittedYear = draft && (draft.submittedAt || draft.createdAt) && new Date(draft.submittedAt || draft.createdAt).getFullYear();
  return explicit || schemeYear || submittedYear || '-';
};

export const proposalDisplayMeta = draft => {
  const status = draftStatus(draft);
  const verification = draft && draft.verification && draft.verification.status;
  if (status === STATUS.SUBMITTED && verification !== 'verified') return { label: 'Butuh Verifikasi', tone: 'orange' };
  if (status === STATUS.SUBMITTED && verification === 'verified') return { label: 'Telah Diverifikasi', tone: 'green' };
  return STATUS_META[status] || STATUS_META.draft;
};

export const verificationStage = draft => {
  const verification = draft && draft.verification && draft.verification.status;
  if (verification === 'verified') return 'verified';
  if (verification === 'rejected') return 'rejected';
  return 'pending';
};

export const reviewerStage = draft => {
  if (draftReviews(draft).some(review => review.submittedAt)) return 'reviewed';
  const active = draftReviewerAssignments(draft).filter(isActiveReviewerAssignment);
  if (!active.length) return 'unassigned';
  return 'waiting';
};

export const decisionStage = draft => {
  if (draft && draft.decision) return 'decided';
  if (draftStatus(draft) === STATUS.REVIEWED && draftReviews(draft).some(review => review.submittedAt)) return 'ready';
  return 'waiting';
};

export const reviewerCandidates = (data, draft) => (data.lecturers || []).filter(lecturer => {
  const account = (data.systemUsers || []).find(item => item.id === lecturer.userId);
  return lecturer.userId !== (draft && draft.userId)
    && account
    && account.isActive !== false
    && normalizeRole(account.role) === ROLE.LECTURER;
}).map(lecturer => {
  const account = (data.systemUsers || []).find(item => item.id === lecturer.userId) || {};
  const expertiseIds = (data.researcherExpertiseMap || []).filter(item => item.profileId === lecturer.id).map(item => item.expertiseId);
  const expertise = (data.researcherExpertise || []).filter(item => expertiseIds.includes(item.expertiseId)).map(item => item.name);
  const reviewCount = (data.drafts || []).reduce((count, item) => count + draftReviews(item).filter(review => review.reviewerUserId === lecturer.userId).length, 0);
  return { ...lecturer, email: account.email || '', expertise, reviewCount };
});

export const applyProposalVerification = (data, draftId, checklist, notes, actor, now = new Date()) => {
  const checkedAt = now.toISOString();
  const complete = VERIFICATION_CHECKS.every(item => checklist[item.key]);
  return {
    ...data,
    drafts: (data.drafts || []).map(draft => {
      if (draft.id !== draftId) return draft;
      const verification = {
        status: complete ? 'verified' : 'rejected',
        checklist: { ...checklist },
        completeness: { ...checklist },
        notes: String(notes || '').trim(),
        checkedAt,
        verifiedAt: checkedAt,
        verifiedBy: actor.id,
      };
      if (complete) return { ...draft, verification, updatedAt: checkedAt };
      return transitionDraftStatus(draft, STATUS.REVISION, {
        verification,
        completeness: { ...checklist },
        updatedAt: checkedAt,
      }) || draft;
    }),
  };
};

export const applyReviewerAssignments = (data, draftId, selectedIds, dueAt, actor, now = new Date()) => {
  const assignedAt = now.toISOString();
  const candidates = reviewerCandidates(data, (data.drafts || []).find(item => item.id === draftId));
  let finalAssignments = [];
  const drafts = (data.drafts || []).map(draft => {
    if (draft.id !== draftId) {
      return draft;
    }
    const currentAssignments = draftReviewerAssignments(draft);
    const assignments = [
      ...currentAssignments.map(assignment => {
        if (selectedIds.includes(assignment.reviewerUserId)) {
          return {
            ...assignment,
            status: isActiveReviewerAssignment(assignment) ? assignment.status : 'assigned',
            dueAt: assignment.status === 'submitted' ? assignment.dueAt : dueAt,
            revokedAt: null,
            revokedBy: null,
          };
        }
        if (assignment.status === 'submitted') return assignment;
        return { ...assignment, status: 'revoked', revokedAt: assignedAt, revokedBy: actor.id };
      }),
      ...selectedIds.filter(reviewerUserId => !currentAssignments.some(assignment => assignment.reviewerUserId === reviewerUserId)).map(reviewerUserId => {
        const lecturer = candidates.find(item => item.userId === reviewerUserId) || {};
        return { id: uid('reviewer-assignment'), reviewerUserId, reviewerProfileId: lecturer.id, status: 'assigned', assignedAt, assignedBy: actor.id, dueAt };
      }),
    ];
    finalAssignments = assignments;
    const changes = { assignments, updatedAt: assignedAt };
    return draftStatus(draft) === STATUS.SUBMITTED
      ? (transitionDraftStatus(draft, STATUS.UNDER_REVIEW, changes) || draft)
      : { ...draft, ...changes };
  });
  return {
    ...data,
    drafts,
    temporaryRoleAssignments: [
      ...(data.temporaryRoleAssignments || []).filter(grant => grant.entityId !== draftId || grant.role !== 'reviewer'),
      ...finalAssignments.map(assignment => ({
        id: `reviewer-grant-${draftId}-${assignment.reviewerUserId}`,
        userId: assignment.reviewerUserId,
        profileId: assignment.reviewerProfileId,
        role: 'reviewer',
        entityType: 'research_proposal',
        entityId: draftId,
        status: isActiveReviewerAssignment(assignment) ? 'active' : 'revoked',
        assignedAt: assignment.assignedAt,
        assignedBy: assignment.assignedBy,
        dueAt: assignment.dueAt,
        revokedAt: assignment.revokedAt || null,
        revokedBy: assignment.revokedBy || null,
      })),
    ],
  };
};

export const appendReviewerReminders = (data, draftId, actor, now = new Date()) => {
  const draft = (data.drafts || []).find(item => item.id === draftId);
  if (!draft) return data;
  const sentAt = now.toISOString();
  const pending = draftReviewerAssignments(draft).filter(assignment => !['submitted', 'revoked'].includes(assignment.status));
  if (!pending.length) return data;
  const reminders = pending.map(assignment => ({
    id: uid('reviewer-reminder'),
    assignmentId: assignment.id,
    draftId,
    reviewerUserId: assignment.reviewerUserId,
    sentBy: actor.id,
    channel: 'both',
    sentAt,
  }));
  const notifications = reminders.map(reminder => ({
    id: uid('notif-reviewer-reminder'),
    userId: reminder.reviewerUserId,
    fromUserId: actor.id,
    entityType: 'research_draft',
    entityId: draftId,
    type: 'reviewer_manual_reminder',
    message: `Pengingat untuk menyelesaikan penilaian proposal "${(draft.project && draft.project.title) || 'Tanpa judul'}".`,
    actionPath: `/ris/pengajuan-penelitian-internal/${draftId}/penilaian`,
    actionLabel: 'Beri Penilaian',
    managerMode: 'lecturer',
    createdAt: sentAt,
    isRead: false,
  }));
  return {
    ...data,
    reviewerReminders: [...(data.reviewerReminders || []), ...reminders],
    notifications: [...(data.notifications || []), ...notifications],
  };
};

export const applyProposalDecision = (data, draftId, decision, notes, actor, now = new Date()) => {
  const draft = (data.drafts || []).find(item => item.id === draftId);
  if (!draft || !canDecideDraft(draft, actor)) throw new Error('Proposal tidak lagi siap diputuskan. Muat ulang halaman.');
  if (!['funded', 'revision', 'rejected'].includes(decision)) throw new Error('Pilihan keputusan tidak valid.');
  const decidedAt = now.toISOString();
  const nextStatus = decision === 'funded' ? STATUS.FUNDED : decision === 'revision' ? STATUS.REVISION : STATUS.REJECTED;
  const closeAssignment = [STATUS.FUNDED, STATUS.REJECTED].includes(nextStatus);
  const currentReviews = draftReviews(draft);
  const assignments = draftReviewerAssignments(draft).map(assignment => {
    if (closeAssignment) return { ...assignment, status: 'revoked', revokedAt: decidedAt, revokedBy: actor.id };
    return {
      ...assignment,
      status: 'assigned',
      submittedAt: null,
      reopenedAt: decidedAt,
      reopenedBy: actor.id,
    };
  });
  const decisionRecord = {
    id: uid('decision'),
    finalDecision: decision,
    notes: String(notes || '').trim(),
    decidedAt,
    decidedBy: actor.id,
    signerName: actor.name,
    signerRole: getRoleLabel(actor),
    isFinal: closeAssignment,
  };
  const extras = {
    assignments,
    decisionHistory: [...(draft.decisionHistory || []), decisionRecord],
    decision: closeAssignment ? decisionRecord : null,
    reviews: closeAssignment ? currentReviews : [],
    reviewHistory: closeAssignment ? (draft.reviewHistory || []) : [
      ...(draft.reviewHistory || []),
      ...currentReviews.map(review => ({ ...review, archivedAt: decidedAt, archivedBy: actor.id })),
    ],
    updatedAt: decidedAt,
  };
  if (nextStatus === STATUS.FUNDED) {
    const researchId = uid('research');
    const sequence = (data.drafts || []).filter(item => draftStatus(item) === STATUS.FUNDED).length + 1;
    extras.fundedAt = decidedAt;
    extras.research = { id: researchId, sourceDraftId: draft.id, title: draft.project.title, year: new Date(decidedAt).getFullYear(), createdBy: draft.userId, status: 'ongoing' };
    extras.contract = { id: uid('contract'), researchId, status: 'awaiting_admin_contract', contractStatus: 'awaiting_admin_contract' };
    extras.fundingLetter = {
      number: `${String(sequence).padStart(3, '0')}/SPP-RIS/LPPM/${new Date(decidedAt).getFullYear()}`,
      issuedAt: decidedAt,
      signedAt: decidedAt,
      signedBy: actor.id,
      signerName: actor.name,
      signerRole: getRoleLabel(actor),
      fileName: `surat-penetapan-pendanaan-${draft.id}.pdf`,
    };
  }
  const updated = transitionDraftStatus(draft, nextStatus, extras);
  if (!updated) throw new Error('Status proposal telah berubah. Muat ulang halaman.');
  return {
    ...data,
    drafts: (data.drafts || []).map(item => (item.id === draftId ? updated : item)),
    temporaryRoleAssignments: (data.temporaryRoleAssignments || []).map(grant => (
      closeAssignment && grant.entityId === draftId && grant.role === 'reviewer'
        ? { ...grant, status: 'revoked', revokedAt: decidedAt, revokedBy: actor.id }
        : grant
    )),
  };
};
