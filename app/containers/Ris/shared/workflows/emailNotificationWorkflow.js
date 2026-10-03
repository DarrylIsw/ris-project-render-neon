/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define */
import {
  ADMIN_SCOPE,
  ROLE,
  STATUS,
  draftOwnerId,
  draftStatus,
  getAdminScopes,
  isEligibleForScheme,
  normalizeRole,
} from './workflow';
import { REPORT_TYPE, WINDOW_STATE, getWindowState } from '../../features/research/workflows/reportingWorkflow';

export const EMAIL_DELIVERY_MODE = {
  IMMEDIATE: 'immediate',
  DIGEST: 'digest',
};

export const EMAIL_PRIORITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low',
};

const POLICY = {
  new_profile_created: { template: 'account-created', canonical: 'account-created', subject: 'Akun RIS Anda telah dibuat', priority: 'high' },
  account_inactive: { template: 'account-deactivated', canonical: 'account-deactivated', subject: 'Akun RIS Anda dinonaktifkan', priority: 'critical' },
  profile_inactive: { template: 'account-deactivated', canonical: 'account-deactivated', subject: 'Akun RIS Anda dinonaktifkan', priority: 'critical' },
  account_reactivated: { template: 'account-reactivated', subject: 'Akun RIS Anda diaktifkan kembali', priority: 'high' },
  account_access_changed: { template: 'account-access-changed', subject: 'Hak akses RIS Anda diperbarui', priority: 'high' },
  account_updated: { template: 'account-updated', subject: 'Data akun RIS Anda diperbarui', priority: 'normal' },
  profile_verified: { template: 'profile-verified', subject: 'Profil RIS Anda telah diverifikasi', priority: 'normal' },
  profile_rejected: { template: 'profile-revision', subject: 'Profil RIS Anda perlu diperbaiki', priority: 'high' },
  profile_updated: { template: 'profile-updated', subject: 'Profil RIS Anda diperbarui', priority: 'normal' },
  profile_pending: { template: 'profile-pending', subject: 'Profil peneliti menunggu verifikasi', priority: 'normal' },
  document_uploaded: { template: 'profile-document-updated', subject: 'Dokumen profil Anda diperbarui', priority: 'normal' },

  proposal_submitted: { template: 'proposal-submitted-management', subject: 'Proposal penelitian baru masuk', priority: 'normal' },
  proposal_reviewer_pending: { template: 'proposal-reviewer-pending', subject: 'Proposal menunggu penugasan reviewer', priority: 'normal' },
  proposal_verified: { template: 'proposal-verified', subject: 'Proposal penelitian lolos verifikasi', priority: 'normal' },
  proposal_reviewed: { template: 'proposal-ready-for-decision', canonical: 'proposal-ready-for-decision', subject: 'Proposal siap diberi keputusan final', priority: 'high' },
  review_submitted: { template: 'proposal-ready-for-decision', canonical: 'proposal-ready-for-decision', subject: 'Penilaian proposal telah tersedia', priority: 'high' },
  proposal_revision: { template: 'proposal-revision', subject: 'Proposal penelitian perlu direvisi', priority: 'high' },
  proposal_rejected: { template: 'proposal-rejected', subject: 'Keputusan proposal penelitian', priority: 'high' },
  proposal_funded: { template: 'proposal-funded', subject: 'Proposal penelitian Anda didanai', priority: 'high' },
  research_decision: { template: 'research-decision', subject: 'Keputusan proposal penelitian tersedia', priority: 'high' },
  reviewer_assigned: { template: 'reviewer-assigned', subject: 'Penugasan reviewer baru', priority: 'high' },
  reviewer_manual_reminder: { template: 'reviewer-reminder', subject: 'Pengingat penilaian proposal', priority: 'high' },
  reviewer_revoked: { template: 'reviewer-revoked', subject: 'Penugasan reviewer telah selesai', priority: 'normal' },

  contract_signed: { template: 'contract-submitted', subject: 'Kontrak penelitian telah ditandatangani', priority: 'normal' },
  contract_ready: { template: 'contract-ready', subject: 'Kontrak penelitian siap ditandatangani', priority: 'high' },
  contract_revision: { template: 'contract-revision', subject: 'Kontrak penelitian perlu diperbaiki', priority: 'high' },
  contract_accepted: { template: 'contract-accepted', subject: 'Kontrak penelitian telah diterima', priority: 'normal' },

  scheme_open: { template: 'scheme-open', subject: 'Skema penelitian baru tersedia', priority: 'low' },
  scheme_registration_reopened: { template: 'scheme-registration-reopened', subject: 'Pendaftaran skema dibuka kembali', priority: 'high' },
  report_period_open: { template: 'report-period-open', subject: 'Periode pelaporan telah dibuka', priority: 'normal' },
  report_deadline_7: { template: 'report-deadline', subject: 'Pengingat H-7 pelaporan penelitian', priority: 'normal' },
  report_deadline_3: { template: 'report-deadline', subject: 'Pengingat H-3 pelaporan penelitian', priority: 'high' },
  report_deadline_1: { template: 'report-deadline', subject: 'Pelaporan penelitian jatuh tempo dalam 24 jam', priority: 'critical' },
  report_overdue: { template: 'report-overdue', subject: 'Pelaporan penelitian melewati tenggat', priority: 'high' },
  report_reopened: { template: 'report-reopened', subject: 'Periode pelaporan dibuka kembali', priority: 'high' },

  monev_submitted: { template: 'monev-submitted-management', subject: 'Monev penelitian baru disubmit', priority: 'normal' },
  monev_published: { template: 'monev-published', subject: 'Hasil Monev penelitian Anda tersedia', priority: 'high' },
  monev_revision: { template: 'monev-revision', subject: 'Monev penelitian perlu diperbaiki', priority: 'high' },
  monev_accepted: { template: 'monev-accepted', subject: 'Monev penelitian telah diterima', priority: 'normal' },
  internal_report_submitted: { template: 'internal-report-submitted-management', subject: 'Laporan penelitian baru disubmit', priority: 'normal' },
  internal_report_revision: { template: 'internal-report-revision', subject: 'Laporan penelitian perlu diperbaiki', priority: 'high' },
  internal_report_accepted: { template: 'internal-report-accepted', subject: 'Laporan penelitian telah diterima', priority: 'normal' },
  internal_report_rejected: { template: 'internal-report-rejected', subject: 'Laporan penelitian ditolak', priority: 'high' },

  letter_submitted: { template: 'letter-submitted-management', subject: 'Pengajuan surat baru masuk', priority: 'normal' },
  letter_request_accepted: { template: 'letter-request-accepted', subject: 'Permintaan surat Anda diterima', priority: 'normal' },
  letter_data_required: { template: 'letter-data-required', subject: 'Data pengajuan surat perlu dilengkapi', priority: 'high' },
  letter_data_submitted: { template: 'letter-data-submitted-management', subject: 'Data surat siap diverifikasi', priority: 'high' },
  letter_revision: { template: 'letter-revision', subject: 'Pengajuan surat perlu diperbaiki', priority: 'high' },
  letter_approved: { template: 'letter-approved', subject: 'Pengajuan surat diterima dan menunggu penerbitan', priority: 'normal' },
  letter_rejected: { template: 'letter-rejected', subject: 'Pengajuan surat ditolak', priority: 'high' },
  letter_generated: { template: 'letter-generated', subject: 'Surat final Anda telah tersedia', priority: 'high' },
  letter_generation_pending: { template: 'letter-generation-pending', subject: 'Surat menunggu penerbitan', priority: 'normal' },

  external_report_submitted: { template: 'external-report-submitted-management', subject: 'Laporan penelitian eksternal baru masuk', priority: 'normal' },
  external_report_revision: { template: 'external-report-revision', subject: 'Laporan eksternal perlu diperbaiki', priority: 'high' },
  external_report_validated: { template: 'external-report-validated', subject: 'Laporan eksternal telah divalidasi', priority: 'normal' },
  external_report_archived: { template: 'external-report-archived', subject: 'Laporan eksternal telah diarsipkan', priority: 'normal' },

  proposal_submission_confirmation: { template: 'proposal-submission-confirmation', subject: 'Proposal berhasil disubmit', priority: 'normal' },
  review_submission_confirmation: { template: 'review-submission-confirmation', subject: 'Penilaian proposal berhasil dikirim', priority: 'normal' },
  contract_submission_confirmation: { template: 'contract-submission-confirmation', subject: 'Kontrak berhasil dikirim', priority: 'normal' },
  monev_submission_confirmation: { template: 'monev-submission-confirmation', subject: 'Monev berhasil disubmit', priority: 'normal' },
  internal_report_submission_confirmation: { template: 'internal-report-submission-confirmation', subject: 'Laporan penelitian berhasil disubmit', priority: 'normal' },
  letter_submission_confirmation: { template: 'letter-submission-confirmation', subject: 'Pengajuan surat berhasil disubmit', priority: 'normal' },
  external_report_submission_confirmation: { template: 'external-report-submission-confirmation', subject: 'Laporan eksternal berhasil disubmit', priority: 'normal' },
  reviewer_deadline_7: { template: 'reviewer-deadline', subject: 'Pengingat H-7 penilaian proposal', priority: 'normal' },
  reviewer_deadline_3: { template: 'reviewer-deadline', subject: 'Pengingat H-3 penilaian proposal', priority: 'high' },
  reviewer_deadline_1: { template: 'reviewer-deadline', subject: 'Penilaian proposal jatuh tempo dalam 24 jam', priority: 'critical' },
  reviewer_overdue: { template: 'reviewer-overdue', subject: 'Penilaian proposal melewati tenggat', priority: 'high' },
  funded_reviewer_assigned: { template: 'funded-reviewer-assigned', subject: 'Penugasan review penelitian didanai', priority: 'high' },
  funded_reviewer_revoked: { template: 'funded-reviewer-revoked', subject: 'Penugasan review penelitian didanai dicabut', priority: 'normal' },
  funded_reviewer_reminder: { template: 'funded-reviewer-reminder', subject: 'Pengingat review penelitian didanai', priority: 'high' },
  funded_review_submitted: { template: 'funded-review-submitted', subject: 'Hasil review penelitian didanai telah tersedia', priority: 'high' },
  funded_review_available: { template: 'funded-review-available', subject: 'Hasil penilaian penelitian Anda tersedia', priority: 'high' },
  funded_review_submission_confirmation: { template: 'funded-review-submission-confirmation', subject: 'Penilaian penelitian didanai berhasil dikirim', priority: 'normal' },
  funded_reviewer_deadline_7: { template: 'funded-reviewer-deadline', subject: 'Pengingat H-7 review penelitian didanai', priority: 'normal' },
  funded_reviewer_deadline_3: { template: 'funded-reviewer-deadline', subject: 'Pengingat H-3 review penelitian didanai', priority: 'high' },
  funded_reviewer_deadline_1: { template: 'funded-reviewer-deadline', subject: 'Review penelitian didanai jatuh tempo dalam 24 jam', priority: 'critical' },
  funded_reviewer_overdue: { template: 'funded-reviewer-overdue', subject: 'Review penelitian didanai melewati tenggat', priority: 'high' },
  scheme_deadline_7: { template: 'scheme-registration-deadline', subject: 'Pendaftaran skema ditutup dalam 7 hari', priority: 'low' },
  scheme_deadline_3: { template: 'scheme-registration-deadline', subject: 'Pendaftaran skema ditutup dalam 3 hari', priority: 'normal' },
  scheme_deadline_1: { template: 'scheme-registration-deadline', subject: 'Pendaftaran skema ditutup dalam 24 jam', priority: 'critical' },
};

const nowIso = now => (now instanceof Date ? now : new Date(now || Date.now())).toISOString();
const itemId = item => item && (item.id || item.emailId);
const itemType = item => item && (item.type || item.notificationType);
const entityName = item => (item && item.project && item.project.title)
  || (item && (item.researchTitle || item.activityName || item.name || item.label))
  || 'data RIS';
const array = value => (Array.isArray(value) ? value : []);
const cleanText = value => String(value || 'Ada pembaruan penting pada sistem RIS.')
  .replace(/\s*Password demo:.*$/i, '')
  .replace(/\b(password|kata sandi|token|secret)\s*[:=]\s*\S+/gi, '$1: [disembunyikan]')
  .trim();

const hasScope = (user, scope) => {
  const role = normalizeRole(user && user.role);
  if ([ROLE.SUPER_ADMIN, ROLE.MANAGER].includes(role)) return true;
  return role === ROLE.ADMIN && getAdminScopes(user).includes(scope);
};

const managementUsers = (data, scope) => array(data.systemUsers)
  .filter(user => user.isActive !== false && hasScope(user, scope));

const recipientFor = (data, userId) => {
  const account = array(data.systemUsers).find(user => user.id === userId);
  const profile = array(data.researcherProfiles).find(item => item.userId === userId || item.profileId === (account && account.profileId));
  const email = (account && account.email)
    || (profile && (profile.institutionEmail || profile.alternateEmail || profile.email));
  return email ? { account, profile, email } : null;
};

const actionFor = event => {
  if (event.actionPath) return event.actionPath;
  if (event.entityType === 'research_draft') {
    const type = itemType(event);
    if (['reviewer_assigned', 'reviewer_manual_reminder'].includes(type)) return `/ris/pengajuan-penelitian-internal/${event.entityId}/penilaian`;
    if (type === 'proposal_submitted') return '/ris/skema/pengajuan?stage=verification';
    if (type === 'proposal_reviewer_pending') return '/ris/skema/pengajuan?stage=reviewer';
    if (['proposal_reviewed', 'review_submitted'].includes(type)) return '/ris/skema/pengajuan?stage=decision';
    return `/ris/pengajuan-penelitian-internal/${event.entityId}/preview`;
  }
  if (event.entityType === 'scheme') return '/ris/pengajuan-penelitian-internal/daftar-skema';
  if (event.entityType === 'scheme_data' || event.entityType === 'monev' || event.entityType === 'internal_report') return `/ris/penelitian-didanai/${event.entityId}/pendataan`;
  if (event.entityType === 'letter_request') return `/ris/pengajuan-surat/${event.entityId}/detail`;
  if (event.entityType === 'external_research') return `/ris/penelitian-eksternal/${event.entityId}/detail`;
  if (event.entityType === 'researcher_profile') return '/ris/profil-saya';
  if (event.entityType === 'account') return '/ris/profil-saya';
  return '';
};

const dedupeKeyFor = (event, policy, recipientUserId, suffix = '') => {
  const accountEvent = ['account-created', 'account-deactivated'].includes(policy.canonical);
  return [
    recipientUserId,
    policy.canonical || itemType(event),
    accountEvent ? 'account' : (event.entityType || 'system'),
    accountEvent ? recipientUserId : (event.entityId || 'general'),
    suffix || (policy.canonical && String(event.createdAt || '').slice(0, 10)) || itemId(event) || event.createdAt || 'event',
  ].join('|');
};

const emailRecord = (data, event, now, suffix = '') => {
  const policy = POLICY[itemType(event)];
  const recipient = policy && recipientFor(data, event.userId);
  if (!policy || !recipient || (recipient.account && recipient.account.isActive === false && !['account_inactive', 'profile_inactive'].includes(itemType(event)))) return null;
  const deliveryMode = EMAIL_DELIVERY_MODE.IMMEDIATE;
  const queuedAt = nowIso(now);
  const actionPath = actionFor(event);
  const message = cleanText(event.message);
  const deduplicationKey = dedupeKeyFor(event, policy, event.userId, suffix);
  const id = `email:${deduplicationKey}`;
  return {
    id,
    emailId: id,
    userId: event.userId,
    recipientUserId: event.userId,
    to: recipient.email,
    recipientEmail: recipient.email,
    subject: policy.subject,
    message,
    bodyText: actionPath ? `${message}\n\nBuka RIS: ${actionPath}` : message,
    bodyHtml: null,
    templateKey: policy.template,
    notificationType: itemType(event),
    entityType: event.entityType || 'system',
    entityId: event.entityId || null,
    actionPath,
    priority: policy.priority || EMAIL_PRIORITY.NORMAL,
    deliveryMode,
    deduplicationKey,
    sourceEventId: itemId(event) || null,
    payload: {
      recipientName: (recipient.account && recipient.account.name) || (recipient.profile && recipient.profile.fullName) || '',
      actionPath,
      actionLabel: event.actionLabel || 'Buka RIS',
      managerMode: event.managerMode || '',
    },
    status: 'queued',
    attempts: 0,
    availableAt: queuedAt,
    queuedAt,
    createdAt: queuedAt,
    sentAt: null,
    errorMessage: null,
  };
};

const appendRecords = (data, events, now) => {
  const current = array(data.emailOutbox);
  const keys = new Set(current.map(item => item.deduplicationKey).filter(Boolean));
  const ids = new Set(current.map(itemId));
  const additions = [];
  events.forEach(({ event, suffix }) => {
    const record = emailRecord(data, event, now, suffix);
    if (!record || keys.has(record.deduplicationKey) || ids.has(record.id)) return;
    keys.add(record.deduplicationKey);
    ids.add(record.id);
    additions.push(record);
  });
  if (!additions.length) return data;
  return { ...data, emailOutbox: [...current, ...additions] };
};

const addedItems = (before, after) => {
  const previousIds = new Set(array(before).map(itemId));
  return array(after).filter(item => !previousIds.has(itemId(item)));
};

const changedItems = (before, after) => array(after).map(item => {
  const previous = array(before).find(candidate => itemId(candidate) === itemId(item));
  return previous ? { previous, current: item } : null;
}).filter(Boolean);

const confirmation = ({ type, userId, entityType, entityId, message, createdAt, actionPath }) => ({
  id: `${type}:${userId}:${entityId}:${createdAt}`,
  type,
  userId,
  entityType,
  entityId,
  message,
  createdAt,
  actionPath,
});

const appendConfirmationEvents = (events, previous, next, createdAt) => {
  addedItems(previous.drafts, next.drafts).filter(draft => draftStatus(draft) === STATUS.SUBMITTED).forEach(draft => {
    events.push(confirmation({ type: 'proposal_submission_confirmation', userId: draftOwnerId(draft), entityType: 'research_draft', entityId: draft.id, message: `Proposal "${entityName(draft)}" berhasil disubmit.`, createdAt }));
  });
  changedItems(previous.drafts, next.drafts).forEach(({ previous: before, current: draft }) => {
    if (draftStatus(before) !== STATUS.SUBMITTED && draftStatus(draft) === STATUS.SUBMITTED) {
      events.push(confirmation({ type: 'proposal_submission_confirmation', userId: draftOwnerId(draft), entityType: 'research_draft', entityId: draft.id, message: `Proposal "${entityName(draft)}" berhasil disubmit.`, createdAt }));
    }
    const oldContractData = before.contract || {};
    const contractData = draft.contract || {};
    const oldContract = oldContractData.status || oldContractData.contractStatus;
    const contract = contractData.status || contractData.contractStatus;
    const oldSigned = Boolean(oldContractData.lecturerSignedFile || oldContractData.signedFile || ['signed', 'completed'].includes(oldContract));
    const signed = Boolean(contractData.lecturerSignedFile || contractData.signedFile || ['signed', 'completed'].includes(contract));
    if (!oldSigned && signed) {
      events.push(confirmation({ type: 'contract_submission_confirmation', userId: draftOwnerId(draft), entityType: 'scheme_data', entityId: draft.id, message: `Kontrak penelitian "${entityName(draft)}" berhasil dikirim.`, createdAt, actionPath: `/ris/penelitian-didanai/${draft.id}/pendataan?tab=contract` }));
    }
    addedItems(before.reviews, draft.reviews).forEach(review => {
      const reviewerId = review.reviewerUserId || review.userId || review.createdBy;
      if (reviewerId) events.push(confirmation({ type: 'review_submission_confirmation', userId: reviewerId, entityType: 'research_draft', entityId: draft.id, message: `Penilaian proposal "${entityName(draft)}" berhasil dikirim.`, createdAt, actionPath: `/ris/pengajuan-penelitian-internal/${draft.id}/penilaian` }));
    });
  });

  addedItems(previous.letterRequests, next.letterRequests).filter(letter => ['submitted', 'prechecked', 'data_submitted'].includes(letter.status || letter.submissionStatus)).forEach(letter => {
    events.push(confirmation({ type: 'letter_submission_confirmation', userId: letter.userId, entityType: 'letter_request', entityId: letter.id, message: `Pengajuan surat ${letter.id} berhasil disubmit.`, createdAt }));
  });
  changedItems(previous.letterRequests, next.letterRequests).forEach(({ previous: before, current: letter }) => {
    const oldStatus = before.status || before.submissionStatus;
    const status = letter.status || letter.submissionStatus;
    if (oldStatus !== status && ['submitted', 'prechecked', 'data_submitted'].includes(status)) {
      events.push(confirmation({ type: 'letter_submission_confirmation', userId: letter.userId, entityType: 'letter_request', entityId: letter.id, message: `Pengajuan surat ${letter.id} berhasil disubmit.`, createdAt }));
    }
  });

  addedItems(previous.externalResearchReports, next.externalResearchReports).filter(report => report.submissionStatus === 'submitted').forEach(report => {
    events.push(confirmation({ type: 'external_report_submission_confirmation', userId: report.userId || report.createdBy, entityType: 'external_research', entityId: report.id, message: `Laporan eksternal "${entityName(report)}" berhasil disubmit.`, createdAt }));
  });
  changedItems(previous.externalResearchReports, next.externalResearchReports).forEach(({ previous: before, current: report }) => {
    if (before.submissionStatus !== 'submitted' && report.submissionStatus === 'submitted') {
      events.push(confirmation({ type: 'external_report_submission_confirmation', userId: report.userId || report.createdBy, entityType: 'external_research', entityId: report.id, message: `Laporan eksternal "${entityName(report)}" berhasil disubmit.`, createdAt }));
    }
  });

  const appendReportConfirmation = (beforeItems, afterItems, type, entityType, ownerResolver) => {
    const additions = addedItems(beforeItems, afterItems).filter(item => item.status === 'submitted');
    const transitions = changedItems(beforeItems, afterItems).filter(({ previous: before, current }) => before.status !== 'submitted' && current.status === 'submitted').map(({ current }) => current);
    [...additions, ...transitions].forEach(item => {
      const draft = array(next.drafts).find(candidate => candidate.id === item.researchId);
      const ownerId = ownerResolver(item, draft);
      if (!ownerId) {
        return;
      }
      events.push(confirmation({ type, userId: ownerId, entityType, entityId: item.researchId || item.id, message: `${item.periodLabel || item.reportPeriod || 'Data penelitian'} berhasil disubmit.`, createdAt, actionPath: `/ris/penelitian-didanai/${item.researchId}/pendataan` }));
    });
  };
  appendReportConfirmation(previous.internalReports, next.internalReports, 'internal_report_submission_confirmation', 'internal_report', (item, draft) => item.userId || item.createdBy || draftOwnerId(draft));
  addedItems(previous.fundedReviews, next.fundedReviews).forEach(review => {
    const assignment = array(next.fundedReviewAssignments).find(item => item.id === review.assignmentId);
    const reviewerId = assignment && assignment.reviewerUserId;
    if (reviewerId) {
      events.push(confirmation({
        type: 'funded_review_submission_confirmation', userId: reviewerId, entityType: 'funded_review',
        entityId: assignment.targetId, message: 'Penilaian penelitian didanai berhasil dikirim.', createdAt,
        actionPath: `/ris/penelitian-didanai/review/${assignment.targetType}/${assignment.targetId}`,
      }));
    }
  });
};

export const appendWorkflowEmails = (previous, next, actor, now = new Date(), workflowEvents = []) => {
  if (!previous || !next) return next;
  const createdAt = nowIso(now);
  const events = workflowEvents.filter(event => !(
    itemType(event) === 'profile_updated'
    && actor
    && actor.id === event.userId
  ));
  appendConfirmationEvents(events, previous, next, createdAt);
  const queued = appendRecords(next, events.map(event => ({ event })), now);
  return appendScheduledEmailReminders(queued, now);
};

const daysUntil = (value, now) => Math.ceil((new Date(value).getTime() - now.getTime()) / 86400000);
const hasSubmittedReport = (data, draftId, periodId, outputId = null) => array(data.internalReports).some(report => (
  report.researchId === draftId
  && report.periodId === periodId
  && String(report.outputId || '') === String(outputId || '')
  && ['submitted', 'accepted', 'validated'].includes(report.status)
));
const outstandingReports = (data, draft, period) => {
  if (period.type === REPORT_TYPE.INTERIM) return hasSubmittedReport(data, draft.id, period.id) ? [] : [{ key: 'interim', label: period.label || 'Laporan sementara' }];
  if (period.type === REPORT_TYPE.OUTPUT) {
    return array(draft.outputs).filter(output => !hasSubmittedReport(data, draft.id, period.id, output.id))
      .map(output => ({ key: `output-${output.id}`, label: `Laporan luaran ${output.name || output.category || 'penelitian'}` }));
  }
  return hasSubmittedReport(data, draft.id, period.id) ? [] : [{ key: 'final', label: period.label || 'Laporan final' }];
};

const scheduledEvent = ({ type, userId, entityType, entityId, message, actionPath, occurrence }) => ({
  id: `scheduled:${type}:${userId}:${entityId}:${occurrence}`,
  type,
  userId,
  entityType,
  entityId,
  message,
  actionPath,
  createdAt: occurrence,
});

const deadlineType = (prefix, remaining, state) => {
  if (state === WINDOW_STATE.CLOSED) return remaining < -1 ? '' : `${prefix}_overdue`;
  if (state !== WINDOW_STATE.OPEN) return '';
  if (remaining <= 1) return `${prefix}_deadline_1`;
  if (remaining <= 3) return `${prefix}_deadline_3`;
  if (remaining <= 7) return `${prefix}_deadline_7`;
  return `${prefix}_period_open`;
};

const reportReminderEvents = (data, now) => {
  const events = [];
  array(data.drafts).filter(draft => draftStatus(draft) === STATUS.FUNDED).forEach(draft => {
    const scheme = array(data.schemes).find(item => item.id === draft.schemeId);
    array(scheme && scheme.reportingSchedule).forEach(period => {
      if (!period.openAt || !period.dueAt) return;
      const state = getWindowState(period, now);
      const remaining = daysUntil(period.dueAt, now);
      const type = deadlineType('report', remaining, state);
      if (!POLICY[type]) return;
      outstandingReports(data, draft, period).forEach(need => {
        const occurrence = `${new Date(period.dueAt).toISOString().slice(0, 10)}:${need.key}`;
        const actionPath = `/ris/penelitian-didanai/${draft.id}/pendataan?tab=${period.type === REPORT_TYPE.OUTPUT ? 'output-report' : period.type === REPORT_TYPE.INTERIM ? 'monev' : 'final-report'}`;
        let message = `${need.label} untuk "${entityName(draft)}" jatuh tempo dalam ${Math.max(1, remaining)} hari.`;
        if (type === 'report_overdue') message = `${need.label} untuk "${entityName(draft)}" melewati tenggat.`;
        if (type === 'report_period_open') message = `${need.label} untuk "${entityName(draft)}" sudah dapat diisi.`;
        events.push(scheduledEvent({ type, userId: draftOwnerId(draft), entityType: 'scheme_data', entityId: draft.id, message, actionPath, occurrence }));
        if (type === 'report_overdue') {
          managementUsers(data, ADMIN_SCOPE.RESEARCH).forEach(user => events.push(scheduledEvent({ type, userId: user.id, entityType: 'scheme_data', entityId: draft.id, message: `${need.label} untuk "${entityName(draft)}" belum disubmit dan telah melewati tenggat.`, actionPath, occurrence: `${occurrence}:management` })));
        }
      });
    });
  });
  return events;
};

const schemeReminderEvents = (data, now) => {
  const events = [];
  array(data.schemes).filter(scheme => ['open', 'published', 'active'].includes(scheme.status || scheme.schemeStatus) && scheme.registrationEndDate).forEach(scheme => {
    const remaining = daysUntil(scheme.registrationEndDate, now);
    const threshold = remaining <= 1 && remaining >= 0 ? 1 : remaining <= 3 && remaining >= 0 ? 3 : remaining <= 7 && remaining >= 0 ? 7 : null;
    if (!threshold) return;
    array(data.systemUsers).filter(user => {
      const role = normalizeRole(user.role);
      const proposal = array(data.drafts).find(draft => draft.schemeId === scheme.id && draftOwnerId(draft) === user.id);
      const stillNeedsSubmission = !proposal || [STATUS.DRAFT, STATUS.REVISION].includes(draftStatus(proposal));
      return user.isActive !== false && [ROLE.LECTURER, ROLE.MANAGER].includes(role) && isEligibleForScheme(scheme, user) && stillNeedsSubmission;
    }).forEach(user => events.push(scheduledEvent({
      type: `scheme_deadline_${threshold}`,
      userId: user.id,
      entityType: 'scheme',
      entityId: scheme.id,
      message: `Pendaftaran skema "${entityName(scheme)}" ditutup dalam ${Math.max(1, remaining)} hari.`,
      actionPath: '/ris/pengajuan-penelitian-internal/daftar-skema',
      occurrence: new Date(scheme.registrationEndDate).toISOString().slice(0, 10),
    })));
  });
  return events;
};

const reviewerReminderEvents = (data, now) => {
  const events = [];
  array(data.drafts).forEach(draft => {
    array(draft.assignments).filter(assignment => assignment.status === 'assigned' && (assignment.dueAt || assignment.deadline)).forEach(assignment => {
      const dueAt = assignment.dueAt || assignment.deadline;
      const remaining = daysUntil(dueAt, now);
      const state = remaining < 0 ? WINDOW_STATE.CLOSED : WINDOW_STATE.OPEN;
      const type = deadlineType('reviewer', remaining, state);
      if (!POLICY[type]) return;
      events.push(scheduledEvent({
        type,
        userId: assignment.reviewerUserId,
        entityType: 'research_draft',
        entityId: draft.id,
        message: type === 'reviewer_overdue' ? `Penilaian proposal "${entityName(draft)}" melewati tenggat.` : `Penilaian proposal "${entityName(draft)}" jatuh tempo dalam ${Math.max(1, remaining)} hari.`,
        actionPath: `/ris/pengajuan-penelitian-internal/${draft.id}/penilaian`,
        occurrence: new Date(dueAt).toISOString().slice(0, 10),
      }));
    });
  });
  return events;
};

const fundedReviewerReminderEvents = (data, now) => {
  const events = [];
  array(data.fundedReviewAssignments).filter(assignment => ['assigned', 'in_progress'].includes(assignment.status) && (assignment.dueAt || assignment.deadline)).forEach(assignment => {
    const dueAt = assignment.dueAt || assignment.deadline;
    const remaining = daysUntil(dueAt, now);
    const state = remaining < 0 ? WINDOW_STATE.CLOSED : WINDOW_STATE.OPEN;
    const type = deadlineType('funded_reviewer', remaining, state);
    if (!POLICY[type]) return;
    const monev = assignment.targetType === 'monev' && array(data.monevRecords).find(item => item.id === assignment.targetId);
    const report = assignment.targetType === 'report' && array(data.internalReports).find(item => item.id === assignment.targetId);
    const label = monev ? `Monev ${monev.periodLabel || ''}`.trim() : (report && (report.reportPeriod || (report.payload && report.payload.title))) || 'laporan penelitian';
    events.push(scheduledEvent({
      type, userId: assignment.reviewerUserId, entityType: 'funded_review', entityId: assignment.targetId,
      message: type === 'funded_reviewer_overdue' ? `Penilaian ${label} melewati tenggat.` : `Penilaian ${label} jatuh tempo dalam ${Math.max(1, remaining)} hari.`,
      actionPath: `/ris/penelitian-didanai/review/${assignment.targetType}/${assignment.targetId}`,
      occurrence: new Date(dueAt).toISOString().slice(0, 10),
    }));
  });
  return events;
};

export const appendScheduledEmailReminders = (data, now = new Date()) => {
  if (!data) return data;
  const events = [
    ...reportReminderEvents(data, now),
    ...schemeReminderEvents(data, now),
    ...reviewerReminderEvents(data, now),
    ...fundedReviewerReminderEvents(data, now),
  ];
  const activeKeys = new Set(events.map(event => {
    const record = emailRecord(data, event, now, event.createdAt);
    return record && record.deduplicationKey;
  }).filter(Boolean));
  let changed = false;
  const reconciledOutbox = array(data.emailOutbox).map(email => {
    const scheduled = String(email.sourceEventId || '').startsWith('scheduled:');
    if (!scheduled || email.status !== 'queued' || activeKeys.has(email.deduplicationKey)) return email;
    changed = true;
    return {
      ...email,
      status: 'cancelled',
      errorMessage: null,
      updatedAt: nowIso(now),
    };
  });
  const reconciled = changed ? { ...data, emailOutbox: reconciledOutbox } : data;
  return appendRecords(reconciled, events.map(event => ({ event, suffix: event.createdAt })), now);
};

export const getEmailOutboxSummary = data => array(data && data.emailOutbox).reduce((summary, email) => ({
  ...summary,
  total: summary.total + 1,
  [email.status || 'queued']: (summary[email.status || 'queued'] || 0) + 1,
  immediate: summary.immediate + (email.deliveryMode === EMAIL_DELIVERY_MODE.IMMEDIATE ? 1 : 0),
  digest: summary.digest + (email.deliveryMode === EMAIL_DELIVERY_MODE.DIGEST ? 1 : 0),
}), { total: 0, queued: 0, sent: 0, failed: 0, immediate: 0, digest: 0 });
