/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring */
import {
  ADMIN_SCOPE, ROLE, STATUS, draftOwnerId, draftStatus, getAdminScopes, isEligibleForScheme, normalizeRole
} from './workflow';
import { LETTER_STATUS } from '../../features/letters/workflows/letterWorkflow';
import { EXTERNAL_STATUS } from '../../features/externalResearch/workflows/externalResearchWorkflow';
import { REPORT_TYPE, WINDOW_STATE, getWindowState } from '../../features/research/workflows/reportingWorkflow';
import { PROFILE_STATUS, VERIFICATION_STATUS } from '../../features/profiles/workflows/researcherProfileWorkflow';
import { appendWorkflowEmails } from './emailNotificationWorkflow';

export const NOTIFICATION_PRIORITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low',
};

const PRIORITY_ORDER = {
  [NOTIFICATION_PRIORITY.CRITICAL]: 0,
  [NOTIFICATION_PRIORITY.HIGH]: 1,
  [NOTIFICATION_PRIORITY.NORMAL]: 2,
  [NOTIFICATION_PRIORITY.LOW]: 3,
};

const CENTER_EXCLUDED_TYPES = [
  'draft_created',
  'document_uploaded',
  'proposal_submitted',
  'proposal_reviewer_pending',
  'proposal_reviewed',
  'review_submitted',
  'reviewer_assigned',
  'scheme_open',
  'letter_submitted',
  'external_report_submitted',
  'monev_submitted',
  'internal_report_submitted',
  'profile_pending',
];

const TYPE_META = {
  account_inactive: { title: 'Akun dinonaktifkan', priority: 'critical', tone: 'red', icon: 'warning' },
  account_reactivated: { title: 'Akun diaktifkan kembali', priority: 'high', tone: 'green', icon: 'check' },
  account_access_changed: { title: 'Hak akses diperbarui', priority: 'high', tone: 'blue', icon: 'user' },
  account_updated: { title: 'Data akun diperbarui', priority: 'normal', tone: 'blue', icon: 'user' },
  profile_inactive: { title: 'Akun dinonaktifkan', priority: 'critical', tone: 'red', icon: 'warning' },
  profile_verified: { title: 'Profil terverifikasi', priority: 'normal', tone: 'green', icon: 'check' },
  profile_rejected: { title: 'Profil perlu diperbaiki', priority: 'high', tone: 'orange', icon: 'warning' },
  profile_updated: { title: 'Profil diperbarui', priority: 'normal', tone: 'blue', icon: 'user' },
  profile_pending: { title: 'Profil menunggu verifikasi', priority: 'high', tone: 'yellow', icon: 'user' },
  new_profile_created: { title: 'Akun RIS dibuat', priority: 'high', tone: 'blue', icon: 'user' },
  proposal_submitted: { title: 'Proposal baru masuk', priority: 'high', tone: 'blue', icon: 'document' },
  proposal_reviewer_pending: { title: 'Reviewer perlu ditugaskan', priority: 'high', tone: 'orange', icon: 'user' },
  proposal_reviewed: { title: 'Keputusan final diperlukan', priority: 'high', tone: 'purple', icon: 'check' },
  proposal_revision: { title: 'Proposal perlu revisi', priority: 'high', tone: 'orange', icon: 'warning' },
  proposal_rejected: { title: 'Proposal ditolak', priority: 'high', tone: 'red', icon: 'close' },
  proposal_funded: { title: 'Proposal didanai', priority: 'high', tone: 'green', icon: 'check' },
  funded_research_added: { title: 'Penelitian baru didanai', priority: 'high', tone: 'green', icon: 'report' },
  research_decision: { title: 'Keputusan proposal tersedia', priority: 'high', tone: 'green', icon: 'check' },
  reviewer_assigned: { title: 'Penugasan reviewer baru', priority: 'high', tone: 'purple', icon: 'document' },
  reviewer_manual_reminder: { title: 'Pengingat penilaian proposal', priority: 'high', tone: 'orange', icon: 'bell' },
  reviewer_revoked: { title: 'Penugasan reviewer selesai', priority: 'normal', tone: 'gray', icon: 'check' },
  review_submitted: { title: 'Penilaian reviewer masuk', priority: 'high', tone: 'purple', icon: 'check' },
  reviewer_deadline_7: { title: 'Deadline review H-7', priority: 'normal', tone: 'orange', icon: 'clock' },
  reviewer_deadline_3: { title: 'Deadline review H-3', priority: 'high', tone: 'orange', icon: 'clock' },
  reviewer_deadline_1: { title: 'Deadline review kurang dari 24 jam', priority: 'critical', tone: 'red', icon: 'warning' },
  reviewer_overdue: { title: 'Penilaian melewati deadline', priority: 'high', tone: 'red', icon: 'warning' },
  funded_reviewer_assigned: { title: 'Penugasan review penelitian didanai', priority: 'high', tone: 'purple', icon: 'report' },
  funded_reviewer_revoked: { title: 'Penugasan review selesai', priority: 'normal', tone: 'gray', icon: 'check' },
  funded_reviewer_reminder: { title: 'Pengingat review penelitian didanai', priority: 'high', tone: 'orange', icon: 'bell' },
  funded_review_submitted: { title: 'Hasil review penelitian didanai masuk', priority: 'high', tone: 'purple', icon: 'check' },
  funded_review_available: { title: 'Hasil penilaian tersedia', priority: 'high', tone: 'green', icon: 'check' },
  funded_reviewer_deadline_7: { title: 'Deadline review H-7', priority: 'normal', tone: 'orange', icon: 'clock' },
  funded_reviewer_deadline_3: { title: 'Deadline review H-3', priority: 'high', tone: 'orange', icon: 'clock' },
  funded_reviewer_deadline_1: { title: 'Deadline review kurang dari 24 jam', priority: 'critical', tone: 'red', icon: 'warning' },
  funded_reviewer_overdue: { title: 'Review penelitian didanai terlambat', priority: 'high', tone: 'red', icon: 'warning' },
  contract_pending: { title: 'Kontrak menunggu tanda tangan', priority: 'high', tone: 'orange', icon: 'document' },
  contract_ready: { title: 'Kontrak siap ditandatangani', priority: 'high', tone: 'blue', icon: 'document' },
  contract_signed: { title: 'Kontrak telah ditandatangani', priority: 'normal', tone: 'green', icon: 'check' },
  contract_revision: { title: 'Kontrak perlu diperbaiki', priority: 'high', tone: 'orange', icon: 'warning' },
  contract_accepted: { title: 'Kontrak telah diterima', priority: 'normal', tone: 'green', icon: 'check' },
  scheme_open: { title: 'Skema tersedia untuk Anda', priority: 'low', tone: 'blue', icon: 'layers' },
  scheme_deadline_7: { title: 'Pendaftaran skema H-7', priority: 'low', tone: 'blue', icon: 'clock' },
  scheme_deadline_3: { title: 'Pendaftaran skema H-3', priority: 'normal', tone: 'orange', icon: 'clock' },
  scheme_deadline_1: { title: 'Pendaftaran skema kurang dari 24 jam', priority: 'critical', tone: 'red', icon: 'warning' },
  scheme_registration_reopened: { title: 'Pendaftaran skema dibuka kembali', priority: 'high', tone: 'blue', icon: 'clock' },
  report_period_open: { title: 'Periode pelaporan dibuka', priority: 'normal', tone: 'blue', icon: 'report' },
  report_deadline_7: { title: 'Deadline laporan H-7', priority: 'high', tone: 'orange', icon: 'clock' },
  report_deadline_3: { title: 'Deadline laporan H-3', priority: 'high', tone: 'orange', icon: 'clock' },
  report_deadline_1: { title: 'Deadline laporan kurang dari 24 jam', priority: 'critical', tone: 'red', icon: 'warning' },
  report_overdue: { title: 'Laporan melewati deadline', priority: 'high', tone: 'red', icon: 'warning' },
  report_reopened: { title: 'Periode laporan dibuka kembali', priority: 'high', tone: 'blue', icon: 'clock' },
  monev_submitted: { title: 'Monev baru disubmit', priority: 'normal', tone: 'blue', icon: 'report' },
  monev_published: { title: 'Hasil Monev tersedia', priority: 'high', tone: 'green', icon: 'report' },
  monev_revision: { title: 'Monev perlu diperbaiki', priority: 'high', tone: 'orange', icon: 'warning' },
  monev_accepted: { title: 'Monev telah diterima', priority: 'normal', tone: 'green', icon: 'check' },
  internal_report_submitted: { title: 'Laporan penelitian disubmit', priority: 'normal', tone: 'blue', icon: 'report' },
  internal_report_revision: { title: 'Laporan perlu diperbaiki', priority: 'high', tone: 'orange', icon: 'warning' },
  internal_report_accepted: { title: 'Laporan telah diterima', priority: 'normal', tone: 'green', icon: 'check' },
  internal_report_rejected: { title: 'Laporan ditolak', priority: 'high', tone: 'red', icon: 'close' },
  letter_submitted: { title: 'Pengajuan surat baru', priority: 'high', tone: 'blue', icon: 'mail' },
  letter_request_accepted: { title: 'Permintaan surat diterima', priority: 'normal', tone: 'blue', icon: 'check' },
  letter_form_pending: { title: 'Form surat perlu disusun', priority: 'high', tone: 'blue', icon: 'edit' },
  letter_data_required: { title: 'Data surat perlu dilengkapi', priority: 'high', tone: 'orange', icon: 'edit' },
  letter_data_submitted: { title: 'Data surat siap diverifikasi', priority: 'high', tone: 'purple', icon: 'mail' },
  letter_revision: { title: 'Pengajuan surat perlu revisi', priority: 'high', tone: 'orange', icon: 'warning' },
  letter_approved: { title: 'Surat diterima, menunggu penerbitan', priority: 'normal', tone: 'blue', icon: 'check' },
  letter_rejected: { title: 'Pengajuan surat ditolak', priority: 'high', tone: 'red', icon: 'close' },
  letter_generated: { title: 'Surat final tersedia', priority: 'normal', tone: 'purple', icon: 'download' },
  letter_generation_pending: { title: 'Surat menunggu penerbitan', priority: 'high', tone: 'purple', icon: 'mail' },
  external_report_submitted: { title: 'Laporan eksternal baru', priority: 'high', tone: 'blue', icon: 'report' },
  external_report_revision: { title: 'Laporan eksternal perlu revisi', priority: 'high', tone: 'orange', icon: 'warning' },
  external_report_validated: { title: 'Laporan eksternal tervalidasi', priority: 'normal', tone: 'green', icon: 'check' },
  delivery_failed: { title: 'Pengiriman notifikasi gagal', priority: 'critical', tone: 'red', icon: 'warning' },
  general: { title: 'Pemberitahuan RIS', priority: 'normal', tone: 'gray', icon: 'bell' },
};

const nowIso = now => (now instanceof Date ? now : new Date(now || Date.now())).toISOString();
const notificationType = notification => notification.type || notification.notificationType || 'general';
const notificationId = notification => notification.id || notification.notificationId;
const sameId = (left, right) => String(notificationId(left) || '') === String(notificationId(right) || '');
const entityName = item => (item && item.project && item.project.title) || (item && (item.researchTitle || item.activityName || item.name)) || 'data RIS';
const makeId = (prefix, userId, entityId) => `${prefix}:${userId || 'all'}:${entityId || 'general'}`;

const hasScope = (user, scope) => {
  const role = normalizeRole(user && user.role);
  if ([ROLE.SUPER_ADMIN, ROLE.MANAGER].includes(role)) return true;
  return role === ROLE.ADMIN && getAdminScopes(user).includes(scope);
};

const isLecturerAccount = user => [ROLE.LECTURER, ROLE.MANAGER].includes(normalizeRole(user && user.role));
const managementUsers = (data, scope) => (data.systemUsers || []).filter(account => account.isActive !== false && hasScope(account, scope));

const makeNotification = ({
  id, userId, fromUserId, entityType, entityId, type, message, createdAt, actionPath, actionLabel, managerMode, priority
}) => ({
  id: id || makeId(type, userId, entityId),
  userId,
  fromUserId: fromUserId || null,
  entityType: entityType || 'system',
  entityId: entityId || null,
  type,
  message,
  createdAt: createdAt || nowIso(),
  isRead: false,
  actionPath: actionPath || '',
  actionLabel: actionLabel || '',
  managerMode: managerMode || '',
  priority: priority || '',
});

const addedItems = (before, after, key = 'id') => {
  const previousIds = new Set((before || []).map(item => item && item[key]));
  return (after || []).filter(item => !previousIds.has(item && item[key]));
};

const changedItems = (before, after, key = 'id') => (after || []).map(item => {
  const previous = (before || []).find(candidate => candidate && candidate[key] === item[key]);
  return previous ? { previous, current: item } : null;
}).filter(Boolean);

const pushForManagers = (events, data, scope, details) => {
  managementUsers(data, scope).forEach(account => {
    events.push(makeNotification({ ...details, userId: account.id }));
  });
};

const appendDraftEvents = (events, previous, next, actor, createdAt) => {
  const beforeDrafts = previous.drafts || [];
  const afterDrafts = next.drafts || [];
  addedItems(beforeDrafts, afterDrafts).forEach(draft => {
    if (draftStatus(draft) === STATUS.SUBMITTED) {
      pushForManagers(events, next, ADMIN_SCOPE.RESEARCH, {
        fromUserId: actor && actor.id, entityType: 'research_draft', entityId: draft.id, type: 'proposal_submitted', message: `Proposal "${entityName(draft)}" baru disubmit dan menunggu verifikasi.`, createdAt
      });
    }
  });
  changedItems(beforeDrafts, afterDrafts).forEach(({ previous: oldDraft, current: draft }) => {
    const beforeStatus = draftStatus(oldDraft);
    const afterStatus = draftStatus(draft);
    if (beforeStatus !== afterStatus) {
      if (afterStatus === STATUS.SUBMITTED) {
        pushForManagers(events, next, ADMIN_SCOPE.RESEARCH, {
          fromUserId: actor && actor.id, entityType: 'research_draft', entityId: draft.id, type: draft.verification && draft.verification.status === 'verified' ? 'proposal_reviewer_pending' : 'proposal_submitted', message: `Proposal "${entityName(draft)}" menunggu tindak lanjut pengelola penelitian.`, createdAt
        });
      }
      if (afterStatus === STATUS.REVIEWED) {
        pushForManagers(events, next, ADMIN_SCOPE.RESEARCH, {
          fromUserId: actor && actor.id, entityType: 'research_draft', entityId: draft.id, type: 'proposal_reviewed', message: `Penilaian untuk proposal "${entityName(draft)}" tersedia dan menunggu keputusan final.`, createdAt
        });
      }
      const ownerType = { [STATUS.REVISION]: 'proposal_revision', [STATUS.REJECTED]: 'proposal_rejected', [STATUS.FUNDED]: 'proposal_funded' }[afterStatus];
      if (ownerType) {
        events.push(makeNotification({
          userId: draftOwnerId(draft), fromUserId: actor && actor.id, entityType: 'research_draft', entityId: draft.id, type: ownerType, message: afterStatus === STATUS.FUNDED ? `Proposal "${entityName(draft)}" telah disetujui dan didanai. Kontrak penelitian siap ditandatangani.` : `Status proposal "${entityName(draft)}" diperbarui menjadi ${afterStatus === STATUS.REVISION ? 'perlu revisi' : 'ditolak'}.`, createdAt,
          actionPath: afterStatus === STATUS.FUNDED ? `/ris/penelitian-didanai/${draft.id}/pendataan?tab=contract` : '',
          actionLabel: afterStatus === STATUS.FUNDED ? 'Tanda Tangan Kontrak' : '',
        }));
      }
      if (afterStatus === STATUS.FUNDED) {
        managementUsers(next, ADMIN_SCOPE.RESEARCH).filter(account => account.id !== (actor && actor.id)).forEach(account => {
          events.push(makeNotification({
            userId: account.id,
            fromUserId: actor && actor.id,
            entityType: 'research_draft',
            entityId: draft.id,
            type: 'funded_research_added',
            message: `Proposal "${entityName(draft)}" telah disetujui dan masuk ke pemantauan penelitian didanai.`,
            createdAt,
            actionPath: '/ris/pengajuan-penelitian-internal/penelitian-didanai',
            actionLabel: 'Lihat Ringkasan',
            managerMode: 'management',
          }));
        });
      }
    }

    const oldVerificationStatus = oldDraft.verification && oldDraft.verification.status;
    const verificationStatus = draft.verification && draft.verification.status;
    if (oldVerificationStatus !== 'verified' && verificationStatus === 'verified') {
      events.push(makeNotification({
        userId: draftOwnerId(draft), fromUserId: actor && actor.id, entityType: 'research_draft', entityId: draft.id,
        type: 'proposal_verified', message: `Proposal "${entityName(draft)}" telah lolos verifikasi administrasi.`, createdAt
      }));
    }

    const oldAssignments = oldDraft.assignments || [];
    const assignments = draft.assignments || [];
    addedItems(oldAssignments, assignments).filter(item => item.status !== 'revoked').forEach(assignment => {
      events.push(makeNotification({ userId: assignment.reviewerUserId, fromUserId: actor && actor.id, entityType: 'research_draft', entityId: draft.id, type: 'reviewer_assigned', message: `Anda ditugaskan menilai proposal "${entityName(draft)}".`, createdAt }));
    });
    changedItems(oldAssignments, assignments).filter(({ previous: oldAssignment, current: assignment }) => oldAssignment.status !== 'revoked' && assignment.status === 'revoked').forEach(({ current: assignment }) => {
      events.push(makeNotification({ userId: assignment.reviewerUserId, fromUserId: actor && actor.id, entityType: 'research_draft', entityId: draft.id, type: 'reviewer_revoked', message: `Penugasan reviewer untuk proposal "${entityName(draft)}" telah selesai atau dicabut.`, createdAt }));
    });

    const oldContract = oldDraft.contract || {};
    const contract = draft.contract || {};
    const oldContractStatus = oldContract.status || oldContract.contractStatus;
    const contractStatus = contract.status || contract.contractStatus;
    const oldSentToLecturer = oldContract.sentToLecturerAt || oldContractStatus === 'awaiting_lecturer_signature';
    const sentToLecturer = contract.sentToLecturerAt || contractStatus === 'awaiting_lecturer_signature';
    if (!oldSentToLecturer && sentToLecturer) {
      events.push(makeNotification({
        userId: draftOwnerId(draft), fromUserId: actor && actor.id, entityType: 'research_draft', entityId: draft.id, type: 'contract_ready',
        message: `Kontrak penelitian "${entityName(draft)}" sudah ditandatangani pengelola dan siap Anda tanda tangani.`, createdAt,
        actionPath: `/ris/penelitian-didanai/${draft.id}/pendataan?tab=contract`, actionLabel: 'Unduh Kontrak', managerMode: 'lecturer',
      }));
    }
    const oldLecturerSigned = Boolean(oldContract.lecturerSignedFile || oldContract.signedFile || oldContractStatus === 'signed' || oldContractStatus === 'completed');
    const lecturerSigned = Boolean(contract.lecturerSignedFile || contract.signedFile || contractStatus === 'signed' || contractStatus === 'completed');
    if (!oldLecturerSigned && lecturerSigned) {
      pushForManagers(events, next, ADMIN_SCOPE.RESEARCH, {
        fromUserId: actor && actor.id, entityType: 'research_draft', entityId: draft.id, type: 'contract_signed', message: `Kontrak penelitian "${entityName(draft)}" telah ditandatangani.`, createdAt
      });
    }
    if (oldContractStatus !== contractStatus && ['revision', 'revision_required'].includes(contractStatus)) {
      events.push(makeNotification({
        userId: draftOwnerId(draft), fromUserId: actor && actor.id, entityType: 'research_draft', entityId: draft.id, type: 'contract_revision', message: `Kontrak penelitian "${entityName(draft)}" perlu diperbaiki.`, createdAt
      }));
    }
    if (oldContractStatus !== contractStatus && ['accepted', 'verified'].includes(contractStatus)) {
      events.push(makeNotification({
        userId: draftOwnerId(draft), fromUserId: actor && actor.id, entityType: 'research_draft', entityId: draft.id, type: 'contract_accepted', message: `Kontrak penelitian "${entityName(draft)}" telah diterima.`, createdAt
      }));
    }
  });
};

const appendLetterEvents = (events, previous, next, actor, createdAt) => {
  const inspectLetter = (oldLetter, letter) => {
    const beforeStatus = oldLetter.status || oldLetter.submissionStatus;
    const afterStatus = letter.status || letter.submissionStatus;
    if (beforeStatus === afterStatus) return;
    if ([LETTER_STATUS.SUBMITTED, LETTER_STATUS.PRECHECKED, LETTER_STATUS.DATA_SUBMITTED].includes(afterStatus)) {
      pushForManagers(events, next, ADMIN_SCOPE.LETTERS, {
        fromUserId: actor && actor.id, entityType: 'letter_request', entityId: letter.id, type: afterStatus === LETTER_STATUS.DATA_SUBMITTED ? 'letter_data_submitted' : 'letter_submitted', message: afterStatus === LETTER_STATUS.DATA_SUBMITTED ? `Data pengajuan surat ${letter.id} siap diverifikasi dan diterbitkan.` : `Permintaan surat ${letter.id} menunggu pemeriksaan pengelola.`, createdAt
      });
    }
    const ownerType = {
      [LETTER_STATUS.FORM_DESIGN]: 'letter_request_accepted',
      [LETTER_STATUS.DATA_REQUIRED]: 'letter_data_required',
      [LETTER_STATUS.REVISION_REQUIRED]: 'letter_revision',
      [LETTER_STATUS.APPROVED]: 'letter_approved',
      [LETTER_STATUS.REJECTED]: 'letter_rejected',
      [LETTER_STATUS.GENERATED]: 'letter_generated',
    }[afterStatus];
    if (ownerType) {
      const ownerMessage = {
        [LETTER_STATUS.FORM_DESIGN]: `Permintaan surat ${letter.id} diterima dan sedang disiapkan pengelola.`,
        [LETTER_STATUS.DATA_REQUIRED]: `Form surat ${letter.id} siap dilengkapi.`,
        [LETTER_STATUS.REVISION_REQUIRED]: `Data surat ${letter.id} perlu diperbaiki.`,
        [LETTER_STATUS.APPROVED]: `Pengajuan surat ${letter.id} telah diterima dan akan diterbitkan setelah siap.`,
        [LETTER_STATUS.REJECTED]: `Permintaan surat ${letter.id} ditolak.`,
        [LETTER_STATUS.GENERATED]: `Surat final ${letter.id} sudah tersedia untuk diunduh.`,
      }[afterStatus];
      events.push(makeNotification({ userId: letter.userId, fromUserId: actor && actor.id, entityType: 'letter_request', entityId: letter.id, type: ownerType, message: ownerMessage, createdAt }));
    }
  };
  addedItems(previous.letterRequests, next.letterRequests).forEach(letter => inspectLetter({}, letter));
  changedItems(previous.letterRequests, next.letterRequests).forEach(({ previous: oldLetter, current: letter }) => inspectLetter(oldLetter, letter));
};

const appendExternalEvents = (events, previous, next, actor, createdAt) => {
  const inspectReport = (oldReport, report) => {
    const beforeStatus = oldReport.submissionStatus;
    const afterStatus = report.submissionStatus;
    if (beforeStatus === afterStatus) return;
    if (afterStatus === EXTERNAL_STATUS.SUBMITTED) {
      pushForManagers(events, next, ADMIN_SCOPE.RESEARCH, {
        fromUserId: actor && actor.id, entityType: 'external_research', entityId: report.id, type: 'external_report_submitted', message: `Laporan eksternal "${entityName(report)}" menunggu review.`, createdAt
      });
    }
    const ownerType = { [EXTERNAL_STATUS.REVISION_REQUESTED]: 'external_report_revision', [EXTERNAL_STATUS.VALIDATED]: 'external_report_validated', [EXTERNAL_STATUS.ARCHIVED]: 'external_report_archived' }[afterStatus];
    if (ownerType) {
      const message = afterStatus === EXTERNAL_STATUS.VALIDATED
        ? `Laporan eksternal "${entityName(report)}" telah divalidasi.`
        : afterStatus === EXTERNAL_STATUS.ARCHIVED
          ? `Laporan eksternal "${entityName(report)}" telah diarsipkan.`
          : `Laporan eksternal "${entityName(report)}" perlu diperbaiki.`;
      events.push(makeNotification({ userId: report.userId || report.createdBy, fromUserId: actor && actor.id, entityType: 'external_research', entityId: report.id, type: ownerType, message, createdAt }));
    }
  };
  addedItems(previous.externalResearchReports, next.externalResearchReports).forEach(report => inspectReport({}, report));
  changedItems(previous.externalResearchReports, next.externalResearchReports).forEach(({ previous: oldReport, current: report }) => inspectReport(oldReport, report));
};

const appendReportingEvents = (events, previous, next, actor, createdAt) => {
  const processRecords = (beforeItems, afterItems, entityType, submittedType, labelFor, decisionTypes) => {
    const inspectRecord = (oldRecord, record) => {
      if (oldRecord.status === record.status) return;
      if (record.status === 'submitted') {
        if (entityType === 'monev') {
          pushForManagers(events, next, ADMIN_SCOPE.RESEARCH, {
            fromUserId: actor && actor.id, entityType, entityId: record.researchId, type: submittedType, message: `${labelFor(record)} baru dikirim oleh dosen.`, createdAt,
            actionPath: `/ris/penelitian-didanai/${record.researchId}/pendataan?tab=monev`, actionLabel: 'Periksa Monev', managerMode: 'management',
          });
        } else {
          const reportTab = record.reportType === REPORT_TYPE.OUTPUT ? 'output-report' : record.reportType === REPORT_TYPE.INTERIM ? 'monev' : 'final-report';
          pushForManagers(events, next, ADMIN_SCOPE.RESEARCH, {
            fromUserId: actor && actor.id, entityType, entityId: record.researchId, type: submittedType, message: `${labelFor(record)} baru disubmit.`, createdAt,
            actionPath: `/ris/penelitian-didanai/${record.researchId}/pendataan?tab=${reportTab}`,
            actionLabel: 'Periksa Laporan',
            managerMode: 'management',
          });
        }
      }
      const ownerType = decisionTypes[record.status];
      if (!ownerType) return;
      const draft = (next.drafts || []).find(item => item.id === record.researchId);
      const ownerId = record.userId || record.createdBy || draftOwnerId(draft);
      if (ownerId) {
        events.push(makeNotification({
          userId: ownerId, fromUserId: actor && actor.id, entityType, entityId: record.researchId, type: ownerType, message: `${labelFor(record)} telah diperbarui menjadi ${record.status}.`, createdAt
        }));
      }
    };
    addedItems(beforeItems, afterItems).forEach(record => inspectRecord({}, record));
    changedItems(beforeItems, afterItems).forEach(({ previous: oldRecord, current: record }) => inspectRecord(oldRecord, record));
  };
  processRecords(previous.monevRecords, next.monevRecords, 'monev', 'monev_submitted', record => record.periodLabel || 'Monev penelitian', {
    revision: 'monev_revision', revision_required: 'monev_revision', accepted: 'monev_accepted', validated: 'monev_accepted'
  });
  processRecords(previous.internalReports, next.internalReports, 'internal_report', 'internal_report_submitted', report => report.reportPeriod || report.title || 'Laporan penelitian', {
    revision: 'internal_report_revision', revision_required: 'internal_report_revision', accepted: 'internal_report_accepted', validated: 'internal_report_accepted', rejected: 'internal_report_rejected'
  });
};

const appendAccountEvents = (events, previous, next, actor, createdAt) => {
  addedItems(previous.systemUsers, next.systemUsers).forEach(account => {
    events.push(makeNotification({ userId: account.id, fromUserId: actor && actor.id, entityType: 'account', entityId: account.id, type: 'new_profile_created', message: 'Akun RIS Anda telah dibuat dalam status nonaktif dan belum dapat digunakan. Tunggu pengelola mengaktifkan akun.', createdAt, actionPath: '/ris/login' }));
  });
  changedItems(previous.systemUsers, next.systemUsers).forEach(({ previous: oldAccount, current: account }) => {
    if (oldAccount.isActive !== false && account.isActive === false) events.push(makeNotification({ userId: account.id, fromUserId: actor && actor.id, entityType: 'account', entityId: account.id, type: 'account_inactive', message: 'Akun RIS Anda telah dinonaktifkan. Hubungi pengelola bila memerlukan bantuan.', createdAt }));
    if (oldAccount.isActive === false && account.isActive !== false) events.push(makeNotification({ userId: account.id, fromUserId: actor && actor.id, entityType: 'account', entityId: account.id, type: 'account_reactivated', message: 'Akun RIS Anda telah diaktifkan kembali.', createdAt }));
    const oldScopes = [...(oldAccount.adminScopes || [])].sort().join('|');
    const scopes = [...(account.adminScopes || [])].sort().join('|');
    const accessChanged = oldAccount.role !== account.role || oldScopes !== scopes;
    if (accessChanged) events.push(makeNotification({ userId: account.id, fromUserId: actor && actor.id, entityType: 'account', entityId: account.id, type: 'account_access_changed', message: 'Role atau cakupan tugas akun RIS Anda telah diperbarui.', createdAt }));
    const identityChanged = ['name', 'email', 'identifier', 'profileId'].some(key => oldAccount[key] !== account[key]);
    if (identityChanged && !accessChanged) events.push(makeNotification({ userId: account.id, fromUserId: actor && actor.id, entityType: 'account', entityId: account.id, type: 'account_updated', message: 'Data akun RIS Anda telah diperbarui oleh pengelola.', createdAt }));
  });
};

const appendSchemeEvents = (events, previous, next, actor, createdAt) => {
  addedItems(previous.schemes, next.schemes).filter(scheme => ['open', 'published', 'active'].includes(scheme.status || scheme.schemeStatus)).forEach(scheme => {
    (next.systemUsers || []).filter(account => account.isActive !== false && [ROLE.LECTURER, ROLE.MANAGER].includes(normalizeRole(account.role)) && isEligibleForScheme(scheme, account)).forEach(account => {
      events.push(makeNotification({ userId: account.id, fromUserId: actor && actor.id, entityType: 'scheme', entityId: scheme.id, type: 'scheme_open', message: `Skema "${scheme.name}" telah dibuka dan sesuai dengan profil Anda.`, createdAt }));
    });
  });
  changedItems(previous.schemes, next.schemes).forEach(({ previous: oldScheme, current: scheme }) => {
    const oldReopens = oldScheme.registrationReopenHistory || [];
    const reopens = scheme.registrationReopenHistory || [];
    const registrationReopened = reopens.length > oldReopens.length
      || (oldScheme.registrationEndDate !== scheme.registrationEndDate && reopens.length > 0);
    if (registrationReopened) {
      (next.systemUsers || []).filter(account => account.isActive !== false && [ROLE.LECTURER, ROLE.MANAGER].includes(normalizeRole(account.role)) && isEligibleForScheme(scheme, account)).forEach(account => {
        events.push(makeNotification({
          userId: account.id,
          fromUserId: actor && actor.id,
          entityType: 'scheme',
          entityId: scheme.id,
          type: 'scheme_registration_reopened',
          message: `Pendaftaran skema "${scheme.name}" dibuka atau diperpanjang kembali hingga ${new Date(scheme.registrationEndDate).toLocaleDateString('id-ID')}.`,
          createdAt,
          actionPath: '/ris/pengajuan-penelitian-internal/daftar-skema',
        }));
      });
    }
    const oldPeriods = oldScheme.reportingSchedule || [];
    (scheme.reportingSchedule || []).forEach(period => {
      const oldPeriod = oldPeriods.find(item => item.id === period.id);
      const extended = oldPeriod && (
        oldPeriod.dueAt !== period.dueAt
        || (period.extensions || []).length > (oldPeriod.extensions || []).length
      );
      if (!extended) return;
      (next.drafts || []).filter(draft => draft.schemeId === scheme.id && draftStatus(draft) === STATUS.FUNDED).forEach(draft => {
        events.push(makeNotification({
          userId: draftOwnerId(draft),
          fromUserId: actor && actor.id,
          entityType: 'scheme_data',
          entityId: draft.id,
          type: 'report_reopened',
          message: `${period.label || 'Periode laporan'} untuk "${entityName(draft)}" dibuka atau diperpanjang kembali hingga ${new Date(period.dueAt).toLocaleDateString('id-ID')}.`,
          createdAt,
          actionPath: `/ris/penelitian-didanai/${draft.id}/pendataan`,
        }));
      });
    });
  });
};

const eventSignature = notification => {
  const type = notificationType(notification);
  const canonicalType = ['proposal_funded', 'proposal_revision', 'proposal_rejected'].includes(type) ? 'research_decision' : type;
  return [notification.userId, notification.entityType, notification.entityId, canonicalType].join('|');
};

export const appendWorkflowNotifications = (previous, next, actor, now = new Date()) => {
  if (!previous || !next) return next;
  const createdAt = nowIso(now);
  const events = [];
  appendDraftEvents(events, previous, next, actor, createdAt);
  appendLetterEvents(events, previous, next, actor, createdAt);
  appendExternalEvents(events, previous, next, actor, createdAt);
  appendReportingEvents(events, previous, next, actor, createdAt);
  appendAccountEvents(events, previous, next, actor, createdAt);
  appendSchemeEvents(events, previous, next, actor, createdAt);
  const existing = next.notifications || [];
  const newlyAdded = addedItems(previous.notifications, existing);
  const signatures = new Set(newlyAdded.map(eventSignature));
  const uniqueEvents = events.filter(event => {
    const signature = eventSignature(event);
    if (signatures.has(signature)) return false;
    signatures.add(signature);
    return true;
  }).map((event, index) => ({ ...event, id: `${event.id}:${Date.now()}:${index}` }));
  const enriched = uniqueEvents.length ? { ...next, notifications: [...existing, ...uniqueEvents] } : next;
  return appendWorkflowEmails(previous, enriched, actor, now, [...newlyAdded, ...uniqueEvents]);
};

const daysUntil = (value, now) => Math.ceil((new Date(value).getTime() - now.getTime()) / 86400000);

const reportExists = (data, draftId, periodId, outputId = null) => (data.internalReports || []).some(report => report.researchId === draftId && report.periodId === periodId && String(report.outputId || '') === String(outputId || '') && report.status === 'submitted');

const reportNeedsForPeriod = (data, draft, period) => {
  if (period.type === REPORT_TYPE.INTERIM) return reportExists(data, draft.id, period.id) ? [] : [{ key: 'report', label: period.label }];
  if (period.type === REPORT_TYPE.OUTPUT) return (draft.outputs || []).filter(output => !reportExists(data, draft.id, period.id, output.id)).map(output => ({ key: `output-${output.id}`, label: `Laporan luaran ${output.name || output.category || 'penelitian'}` }));
  return reportExists(data, draft.id, period.id) ? [] : [{ key: 'final', label: period.label }];
};

const deadlineNotification = ({ user, draft, period, need, now, management }) => {
  const state = getWindowState(period, now);
  const remaining = daysUntil(period.dueAt, now);
  const base = { userId: user.id, entityType: 'scheme_data', entityId: draft.id, actionPath: `/ris/penelitian-didanai/${draft.id}/pendataan?tab=${period.type === REPORT_TYPE.OUTPUT ? 'output-report' : period.type === REPORT_TYPE.INTERIM ? 'monev' : 'final-report'}`, actionLabel: management ? 'Periksa Laporan' : 'Buka Pendataan', managerMode: management ? 'management' : 'lecturer' };
  if (state === WINDOW_STATE.CLOSED) return makeNotification({ ...base, id: makeId(`report-overdue-${period.id}-${need.key}`, user.id, draft.id), type: 'report_overdue', message: `${need.label} untuk "${entityName(draft)}" telah melewati deadline.`, priority: management ? 'high' : 'high' });
  if (state !== WINDOW_STATE.OPEN) return null;
  const threshold = remaining <= 1 ? 1 : remaining <= 3 ? 3 : remaining <= 7 ? 7 : null;
  if (threshold) return makeNotification({ ...base, id: makeId(`report-deadline-${threshold}-${period.id}-${need.key}`, user.id, draft.id), type: `report_deadline_${threshold}`, message: `${need.label} untuk "${entityName(draft)}" jatuh tempo dalam ${Math.max(1, remaining)} hari.` });
  return makeNotification({ ...base, id: makeId(`report-open-${period.id}-${need.key}`, user.id, draft.id), type: 'report_period_open', message: `${need.label} untuk "${entityName(draft)}" sudah dapat diisi.` });
};

const buildResearchManagementQueue = (data, user, now) => {
  if (!hasScope(user, ADMIN_SCOPE.RESEARCH)) return [];
  const notifications = [];
  (data.drafts || []).forEach(draft => {
    const status = draftStatus(draft);
    if (status === STATUS.SUBMITTED) {
      const verified = draft.verification && draft.verification.status === 'verified';
      notifications.push(makeNotification({ id: makeId(verified ? 'queue-reviewer' : 'queue-verify', user.id, draft.id), userId: user.id, entityType: 'research_draft', entityId: draft.id, type: verified ? 'proposal_reviewer_pending' : 'proposal_submitted', message: verified ? `Proposal "${entityName(draft)}" belum memiliki reviewer aktif.` : `Proposal "${entityName(draft)}" menunggu verifikasi.`, actionPath: `/ris/skema/pengajuan?stage=${verified ? 'reviewer' : 'verification'}`, actionLabel: verified ? 'Pilih Reviewer' : 'Verifikasi', managerMode: 'management' }));
    }
    if (status === STATUS.REVIEWED) notifications.push(makeNotification({ id: makeId('queue-decision', user.id, draft.id), userId: user.id, entityType: 'research_draft', entityId: draft.id, type: 'proposal_reviewed', message: `Proposal "${entityName(draft)}" menunggu keputusan final.`, actionPath: '/ris/skema/pengajuan?stage=decision', actionLabel: 'Beri Keputusan', managerMode: 'management' }));
    if (status === STATUS.FUNDED) {
      const contract = draft.contract || {};
      const lecturerSigned = Boolean(contract.lecturerSignedFile || contract.signedFile || ['signed', 'completed'].includes(contract.status || contract.contractStatus));
      if (!lecturerSigned) {
        const message = !contract.adminSignedFile
          ? `Kontrak penelitian "${entityName(draft)}" belum diunggah oleh pengelola.`
          : contract.sentToLecturerAt
            ? `Kontrak penelitian "${entityName(draft)}" menunggu tanda tangan dosen.`
            : `Kontrak penelitian "${entityName(draft)}" siap dikirim kepada dosen.`;
        notifications.push(makeNotification({ id: makeId('queue-contract', user.id, draft.id), userId: user.id, entityType: 'research_draft', entityId: draft.id, type: 'contract_pending', message, actionPath: `/ris/penelitian-didanai/${draft.id}/pendataan?tab=contract`, actionLabel: 'Kelola Kontrak', managerMode: 'management', priority: 'normal' }));
      }
    }
    if (status === STATUS.FUNDED) {
      const scheme = (data.schemes || []).find(item => item.id === draft.schemeId);
      ((scheme && scheme.reportingSchedule) || []).forEach(period => {
        reportNeedsForPeriod(data, draft, period).forEach(need => {
          const notification = deadlineNotification({ user, draft, period, need, now, management: true });
          if (notification && notification.type === 'report_overdue') notifications.push(notification);
        });
      });
    }
  });
  (data.externalResearchReports || []).filter(report => report.submissionStatus === EXTERNAL_STATUS.SUBMITTED).forEach(report => {
    const submissionVersion = report.submittedAt || report.createdAt || 'current';
    notifications.push(makeNotification({
      id: makeId(`queue-external-${submissionVersion}`, user.id, report.id),
      userId: user.id,
      entityType: 'external_research',
      entityId: report.id,
      type: 'external_report_submitted',
      message: `Laporan eksternal "${entityName(report)}" menunggu review.`,
      actionPath: `/ris/penelitian-eksternal/${report.id}/admin`,
      actionLabel: 'Review',
      managerMode: 'management',
    }));
  });
  return notifications;
};

const buildLetterQueue = (data, user) => {
  if (!hasScope(user, ADMIN_SCOPE.LETTERS)) return [];
  const notifications = [];
  (data.letterRequests || []).forEach(letter => {
    const status = letter.status || letter.submissionStatus;
    if ([LETTER_STATUS.SUBMITTED, LETTER_STATUS.PRECHECKED].includes(status)) notifications.push(makeNotification({ id: makeId('queue-letter-review', user.id, letter.id), userId: user.id, entityType: 'letter_request', entityId: letter.id, type: 'letter_submitted', message: `Permintaan surat ${letter.id} menunggu pemeriksaan.`, actionPath: `/ris/pengajuan-surat/${letter.id}/admin`, actionLabel: 'Periksa Permintaan', managerMode: 'management' }));
    if (status === LETTER_STATUS.FORM_DESIGN) notifications.push(makeNotification({ id: makeId('queue-letter-builder', user.id, letter.id), userId: user.id, entityType: 'letter_request', entityId: letter.id, type: 'letter_form_pending', message: `Template dan form untuk surat ${letter.id} perlu disiapkan.`, actionPath: `/ris/pengajuan-surat/${letter.id}/admin`, actionLabel: 'Susun Form', managerMode: 'management' }));
    if (status === LETTER_STATUS.DATA_SUBMITTED) notifications.push(makeNotification({ id: makeId('queue-letter-finalize', user.id, letter.id), userId: user.id, entityType: 'letter_request', entityId: letter.id, type: 'letter_data_submitted', message: `Data surat ${letter.id} siap diverifikasi dan diterbitkan.`, actionPath: `/ris/pengajuan-surat/${letter.id}/admin`, actionLabel: 'Finalisasi Surat', managerMode: 'management' }));
    if (status === LETTER_STATUS.APPROVED) notifications.push(makeNotification({ id: makeId('queue-letter-generate', user.id, letter.id), userId: user.id, entityType: 'letter_request', entityId: letter.id, type: 'letter_generation_pending', message: `Pengajuan surat ${letter.id} sudah disetujui dan menunggu penerbitan.`, actionPath: `/ris/pengajuan-surat/${letter.id}/admin`, actionLabel: 'Terbitkan Surat', managerMode: 'management' }));
  });
  return notifications;
};

const buildProfileQueue = (data, user) => {
  if (!hasScope(user, ADMIN_SCOPE.PROFILES)) return [];
  return (data.researcherProfiles || []).filter(profile => profile.userId !== user.id && profile.profileStatus !== PROFILE_STATUS.INACTIVE && profile.verificationStatus === VERIFICATION_STATUS.PENDING).map(profile => makeNotification({ id: makeId('queue-profile', user.id, profile.profileId), userId: user.id, entityType: 'researcher_profile', entityId: profile.profileId, type: 'profile_pending', message: `Profil ${profile.fullName || profile.institutionEmail || 'peneliti'} menunggu verifikasi.`, actionPath: `/ris/profil-peneliti/${profile.profileId}/detail`, actionLabel: 'Verifikasi Profil', managerMode: 'management' }));
};

const buildLecturerQueue = (data, user, now) => {
  if (!isLecturerAccount(user)) return [];
  const notifications = [];
  const lecturerUser = normalizeRole(user && user.role) === ROLE.MANAGER ? { ...user, managerMode: 'lecturer' } : user;
  (data.schemes || []).filter(scheme => isEligibleForScheme(scheme, lecturerUser) && ['open', 'published', 'active'].includes(scheme.status || scheme.schemeStatus)).forEach(scheme => {
    const proposal = (data.drafts || []).find(draft => draft.schemeId === scheme.id && draftOwnerId(draft) === user.id);
    if (proposal && ![STATUS.DRAFT, STATUS.REVISION].includes(draftStatus(proposal))) return;
    const actionPath = '/ris/pengajuan-penelitian-internal/daftar-skema';
    notifications.push(makeNotification({ id: makeId('available-scheme', user.id, scheme.id), userId: user.id, entityType: 'scheme', entityId: scheme.id, type: 'scheme_open', message: `Skema "${scheme.name}" sedang membuka pendaftaran.`, actionPath, actionLabel: proposal ? 'Lanjutkan Draft' : 'Lihat Skema', managerMode: 'lecturer' }));
    if (!scheme.registrationEndDate) return;
    const remaining = daysUntil(scheme.registrationEndDate, now);
    const type = remaining >= 0 && remaining <= 1 ? 'scheme_deadline_1' : remaining <= 3 && remaining >= 0 ? 'scheme_deadline_3' : remaining <= 7 && remaining >= 0 ? 'scheme_deadline_7' : '';
    if (!type) return;
    notifications.push(makeNotification({
      id: makeId(`${type}-${new Date(scheme.registrationEndDate).toISOString().slice(0, 10)}`, user.id, scheme.id),
      userId: user.id,
      entityType: 'scheme',
      entityId: scheme.id,
      type,
      message: `Pendaftaran skema "${scheme.name}" ditutup dalam ${Math.max(1, remaining)} hari.${proposal ? ' Draft Anda belum disubmit.' : ''}`,
      actionPath,
      actionLabel: proposal ? 'Lanjutkan Draft' : 'Lihat Skema',
      managerMode: 'lecturer',
    }));
  });
  (data.drafts || []).filter(draft => draftStatus(draft) === STATUS.FUNDED && draftOwnerId(draft) === user.id).forEach(draft => {
    const contract = draft.contract || {};
    const lecturerSigned = Boolean(contract.lecturerSignedFile || contract.signedFile || ['signed', 'completed'].includes(contract.status || contract.contractStatus));
    if (contract.adminSignedFile && contract.sentToLecturerAt && !lecturerSigned) notifications.push(makeNotification({ id: makeId('contract-owner', user.id, draft.id), userId: user.id, entityType: 'research_draft', entityId: draft.id, type: 'contract_ready', message: `Kontrak penelitian "${entityName(draft)}" siap Anda tanda tangani.`, actionPath: `/ris/penelitian-didanai/${draft.id}/pendataan?tab=contract`, actionLabel: 'Unduh Kontrak', managerMode: 'lecturer' }));
    const scheme = (data.schemes || []).find(item => item.id === draft.schemeId);
    ((scheme && scheme.reportingSchedule) || []).forEach(period => {
      reportNeedsForPeriod(data, draft, period).forEach(need => {
        const notification = deadlineNotification({ user, draft, period, need, now, management: false });
        if (notification) notifications.push(notification);
      });
      const lastExtension = (period.extensions || []).slice(-1)[0];
      if (lastExtension) notifications.push(makeNotification({ id: makeId(`report-reopened-${period.id}-${lastExtension.extendedAt || lastExtension.dueAt}`, user.id, draft.id), userId: user.id, entityType: 'scheme_data', entityId: draft.id, type: 'report_reopened', message: `${period.label} dibuka atau diperpanjang kembali hingga ${new Date(period.dueAt).toLocaleDateString('id-ID')}.`, actionPath: `/ris/penelitian-didanai/${draft.id}/pendataan`, actionLabel: 'Buka Pendataan', managerMode: 'lecturer' }));
    });
  });
  (data.drafts || []).forEach(draft => {
    (draft.assignments || []).filter(assignment => assignment.reviewerUserId === user.id && assignment.status === 'assigned').forEach(assignment => {
      const actionPath = `/ris/pengajuan-penelitian-internal/${draft.id}/penilaian`;
      notifications.push(makeNotification({ id: makeId(`active-review-${assignment.id}`, user.id, draft.id), userId: user.id, entityType: 'research_draft', entityId: draft.id, type: 'reviewer_assigned', message: `Penilaian proposal "${entityName(draft)}" menunggu Anda.`, actionPath, actionLabel: 'Beri Penilaian', managerMode: 'lecturer' }));
      const dueAt = assignment.dueAt || assignment.deadline;
      if (!dueAt) return;
      const remaining = daysUntil(dueAt, now);
      const type = remaining < 0 ? 'reviewer_overdue' : remaining <= 1 ? 'reviewer_deadline_1' : remaining <= 3 ? 'reviewer_deadline_3' : remaining <= 7 ? 'reviewer_deadline_7' : '';
      if (!type) return;
      notifications.push(makeNotification({
        id: makeId(`${type}-${new Date(dueAt).toISOString().slice(0, 10)}`, user.id, draft.id),
        userId: user.id,
        entityType: 'research_draft',
        entityId: draft.id,
        type,
        message: type === 'reviewer_overdue' ? `Penilaian proposal "${entityName(draft)}" telah melewati deadline.` : `Penilaian proposal "${entityName(draft)}" jatuh tempo dalam ${Math.max(1, remaining)} hari.`,
        actionPath,
        actionLabel: 'Beri Penilaian',
        managerMode: 'lecturer',
      }));
    });
  });
  (data.fundedReviewAssignments || []).filter(assignment => assignment.reviewerUserId === user.id && ['assigned', 'in_progress'].includes(assignment.status)).forEach(assignment => {
    const actionPath = `/ris/penelitian-didanai/review/${assignment.targetType}/${assignment.targetId}`;
    const monev = assignment.targetType === 'monev' && (data.monevRecords || []).find(item => item.id === assignment.targetId);
    const report = assignment.targetType === 'report' && (data.internalReports || []).find(item => item.id === assignment.targetId);
    const label = monev ? `Monev ${monev.periodLabel || ''}`.trim() : (report && (report.reportPeriod || (report.payload && report.payload.title))) || 'laporan penelitian';
    notifications.push(makeNotification({ id: makeId(`active-funded-review-${assignment.id}`, user.id, assignment.targetId), userId: user.id, entityType: 'funded_review', entityId: assignment.targetId, type: 'funded_reviewer_assigned', message: `Penilaian ${label} menunggu Anda.`, actionPath, actionLabel: 'Beri Penilaian', managerMode: 'lecturer' }));
    const dueAt = assignment.dueAt || assignment.deadline;
    if (!dueAt) return;
    const remaining = daysUntil(dueAt, now);
    const type = remaining < 0 ? 'funded_reviewer_overdue' : remaining <= 1 ? 'funded_reviewer_deadline_1' : remaining <= 3 ? 'funded_reviewer_deadline_3' : remaining <= 7 ? 'funded_reviewer_deadline_7' : '';
    if (!type) return;
    notifications.push(makeNotification({ id: makeId(`${type}-${new Date(dueAt).toISOString().slice(0, 10)}`, user.id, assignment.targetId), userId: user.id, entityType: 'funded_review', entityId: assignment.targetId, type, message: type === 'funded_reviewer_overdue' ? `Penilaian ${label} telah melewati deadline.` : `Penilaian ${label} jatuh tempo dalam ${Math.max(1, remaining)} hari.`, actionPath, actionLabel: 'Beri Penilaian', managerMode: 'lecturer' }));
  });
  (data.letterRequests || []).filter(letter => letter.userId === user.id).forEach(letter => {
    if ([LETTER_STATUS.DATA_REQUIRED, LETTER_STATUS.REVISION_REQUIRED].includes(letter.status)) notifications.push(makeNotification({ id: makeId(`letter-input-${letter.status}`, user.id, letter.id), userId: user.id, entityType: 'letter_request', entityId: letter.id, type: letter.status === LETTER_STATUS.REVISION_REQUIRED ? 'letter_revision' : 'letter_data_required', message: letter.status === LETTER_STATUS.REVISION_REQUIRED ? `Data surat ${letter.id} perlu diperbaiki.` : `Form surat ${letter.id} siap dilengkapi.`, actionPath: `/ris/pengajuan-surat/${letter.id}/edit`, actionLabel: letter.status === LETTER_STATUS.REVISION_REQUIRED ? 'Perbaiki Data' : 'Input Data', managerMode: 'lecturer' }));
    if (letter.status === LETTER_STATUS.GENERATED) notifications.push(makeNotification({ id: makeId('letter-ready', user.id, letter.id), userId: user.id, entityType: 'letter_request', entityId: letter.id, type: 'letter_generated', message: `Surat final ${letter.id} tersedia untuk diunduh.`, actionPath: `/ris/pengajuan-surat/${letter.id}/detail`, actionLabel: 'Unduh Surat', managerMode: 'lecturer' }));
  });
  return notifications;
};

const buildFailureQueue = (data, user) => {
  if (![ROLE.SUPER_ADMIN, ROLE.MANAGER].includes(normalizeRole(user && user.role)) && !hasScope(user, ADMIN_SCOPE.PROFILES)) return [];
  return (data.emailOutbox || []).filter(email => email.status === 'failed').map(email => makeNotification({ id: makeId('failed-email', user.id, email.id || email.emailId), userId: user.id, entityType: 'system', entityId: email.id || email.emailId, type: 'delivery_failed', message: `Email "${email.subject || 'notifikasi RIS'}" gagal dikirim ke ${email.to || 'penerima'}.`, actionPath: '/ris/profil-peneliti', actionLabel: 'Periksa Akun', managerMode: 'management' }));
};

const actionForPersisted = (notification, data, user) => {
  if (notification.actionPath) return { path: notification.actionPath, label: notification.actionLabel || 'Buka', managerMode: notification.managerMode || '' };
  const type = notificationType(notification);
  const role = normalizeRole(user && user.role);
  const management = ['review_submitted', 'proposal_submitted', 'proposal_reviewer_pending', 'proposal_reviewed', 'external_report_submitted', 'letter_submitted', 'letter_data_submitted', 'letter_form_pending', 'profile_pending', 'monev_submitted', 'internal_report_submitted', 'contract_signed'].includes(type);
  const managerMode = role === ROLE.MANAGER ? (management ? 'management' : 'lecturer') : '';
  if (notification.entityType === 'research_draft') {
    const reviewerAction = ['reviewer_assigned', 'reviewer_manual_reminder'].includes(type);
    if (reviewerAction) return { path: `/ris/pengajuan-penelitian-internal/${notification.entityId}/penilaian`, label: 'Beri Penilaian', managerMode };
    const monitoringStage = type === 'proposal_reviewed' || type === 'review_submitted' ? 'decision' : type === 'proposal_reviewer_pending' ? 'reviewer' : type === 'proposal_submitted' ? 'verification' : '';
    if (monitoringStage) return { path: `/ris/skema/pengajuan?stage=${monitoringStage}`, label: 'Lihat Proposal', managerMode };
    return { path: `/ris/pengajuan-penelitian-internal/${notification.entityId}/preview`, label: 'Lihat Proposal', managerMode };
  }
  if (notification.entityType === 'letter_request') return { path: `/ris/pengajuan-surat/${notification.entityId}/${management ? 'admin' : 'detail'}`, label: 'Lihat Surat', managerMode };
  if (notification.entityType === 'external_research') return { path: `/ris/penelitian-eksternal/${notification.entityId}/${management ? 'admin' : 'detail'}`, label: 'Lihat Laporan', managerMode };
  if (notification.entityType === 'researcher_profile') {
    const profile = (data.researcherProfiles || []).find(item => item.profileId === notification.entityId || item.userId === notification.entityId);
    return { path: profile && profile.userId !== user.id ? `/ris/profil-peneliti/${profile.profileId}/detail` : '/ris/profil-saya', label: 'Lihat Profil', managerMode };
  }
  return { path: '', label: '', managerMode };
};

const safeMessage = message => String(message || 'Ada pembaruan pada sistem RIS.').replace(/\s*Password demo:.*$/i, '');

export const normalizeNotification = (notification, data, user) => {
  const type = notificationType(notification);
  const meta = TYPE_META[type] || TYPE_META.general;
  const action = actionForPersisted(notification, data, user);
  return {
    ...notification,
    id: notificationId(notification) || makeId(type, notification.userId, notification.entityId),
    type,
    title: notification.title || meta.title,
    message: safeMessage(notification.message),
    priority: notification.priority || meta.priority,
    tone: notification.tone || meta.tone,
    icon: notification.icon || meta.icon,
    createdAt: notification.createdAt || nowIso(),
    isRead: Boolean(notification.isRead || (data.notificationReadIds || []).includes(notificationId(notification))),
    actionPath: action.path,
    actionLabel: action.label,
    managerMode: action.managerMode,
  };
};

export const getNotificationsForUser = (data, user, now = new Date()) => {
  if (!data || !user) return [];
  const account = (data.systemUsers || []).find(item => item.id === user.id);
  const persisted = (data.notifications || []).filter(notification => notification.userId === user.id && !CENTER_EXCLUDED_TYPES.includes(notificationType(notification)));
  const dynamic = [
    ...buildResearchManagementQueue(data, user, now),
    ...buildLetterQueue(data, user),
    ...buildProfileQueue(data, user),
    ...buildLecturerQueue(data, user, now),
    ...buildFailureQueue(data, user),
  ];
  if (account && account.isActive === false) dynamic.push(makeNotification({ id: makeId('inactive-session', user.id, user.id), userId: user.id, entityType: 'account', entityId: user.id, type: 'account_inactive', message: 'Akun RIS Anda sudah dinonaktifkan. Simpan pekerjaan dan hubungi pengelola.' }));
  const merged = [...persisted, ...dynamic].reduce((result, notification) => {
    const normalized = normalizeNotification(notification, data, user);
    const existingIndex = result.findIndex(item => sameId(item, normalized));
    if (existingIndex < 0) return [...result, normalized];
    if (!normalized.isRead) return result.map((item, index) => (index === existingIndex ? normalized : item));
    return result;
  }, []);
  return merged.sort((left, right) => {
    if (left.isRead !== right.isRead) return left.isRead ? 1 : -1;
    const leftPriority = PRIORITY_ORDER[left.priority] === undefined ? 9 : PRIORITY_ORDER[left.priority];
    const rightPriority = PRIORITY_ORDER[right.priority] === undefined ? 9 : PRIORITY_ORDER[right.priority];
    const priorityDifference = leftPriority - rightPriority;
    if (priorityDifference) return priorityDifference;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
};

const notificationTargets = (notification, user, data) => {
  const path = new URL(notification.actionPath || '/', 'https://ris.invalid').pathname;
  const query = new URLSearchParams(String(notification.actionPath || '').split('?')[1] || '');
  const role = normalizeRole(user && user.role);
  const management = role === ROLE.MANAGER
    ? (notification.managerMode ? notification.managerMode === 'management' : user.managerMode !== 'lecturer')
    : [ROLE.SUPER_ADMIN, ROLE.ADMIN].includes(role);
  const targets = [];
  const add = (...keys) => targets.push(...keys);

  if (path.startsWith('/ris/skema/pengajuan')) {
    const stage = query.get('stage');
    add('menu:research', 'research:monitoring');
    if (stage) add(`research:monitoring:${stage}`);
    return targets;
  }
  if (path.startsWith('/ris/skema')) {
    add('menu:research', 'research:schemes');
    return targets;
  }
  if (path.startsWith('/ris/pengajuan-penelitian-internal/penelitian-didanai')) {
    add(management ? 'menu:research' : 'menu:submission', management ? 'research:funded' : 'submission:funded');
    if (management) add('research:funded:overview');
    return targets;
  }
  if (path.includes('/ttd-kontrak')) {
    add('menu:submission', 'submission:funded', 'submission:funded:contract');
    return targets;
  }
  if (path.startsWith('/ris/penelitian-didanai')) {
    const parent = management ? 'research' : 'submission';
    add(`menu:${parent}`, `${parent}:funded`);
    if (path.includes('/pendataan')) {
      const tab = query.get('tab') || (notification.type === 'report_reopened'
        ? (/luaran/i.test(notification.message || '') ? 'output-report' : /monev|evaluasi/i.test(notification.message || '') ? 'monev' : 'final-report')
        : '');
      if (tab) add(`${parent}:funded:${tab}`);
    } else if (path.includes('/review/')) {
      const pathParts = path.split('/').filter(Boolean);
      const reviewType = pathParts[3];
      const reportId = pathParts[4];
      if (reviewType === 'monev') add(`${parent}:funded:monev`);
      else if (reviewType === 'report') {
        const report = (data.internalReports || []).find(item => item.id === reportId);
        add(`${parent}:funded:${report && report.reportType === 'output' ? 'output-report' : 'final-report'}`);
      }
    } else if (management) {
      add('research:funded:overview');
    }
    return targets;
  }
  if (path.startsWith('/ris/pengajuan-penelitian-internal')) {
    if (management) add('menu:research', 'research:monitoring');
    else add('menu:submission', 'submission:catalog');
    return targets;
  }
  if (path.startsWith('/ris/pengajuan-surat')) return ['menu:letters', 'letters:tracking'];
  if (path.startsWith('/ris/profil-peneliti') || path === '/ris/profil-saya') return ['menu:profiles', 'profiles:tracking'];
  if (path.startsWith('/ris/penelitian-eksternal')) return ['menu:external', 'external:tracking'];
  if (path.startsWith('/ris/arsip')) return ['menu:archive', 'archive:records'];

  const type = notification.type || notification.notificationType || '';
  if (notification.entityType === 'research_draft') {
    const stage = {
      proposal_submitted: 'verification',
      proposal_reviewer_pending: 'reviewer',
      proposal_reviewed: 'decision',
      review_submitted: 'decision',
    }[type];
    if (management && stage) return ['menu:research', 'research:monitoring', `research:monitoring:${stage}`];
    if (type.startsWith('contract_')) return [management ? 'menu:research' : 'menu:submission', management ? 'research:funded' : 'submission:funded', `${management ? 'research' : 'submission'}:funded:contract`];
    return [management ? 'menu:research' : 'menu:submission', management ? 'research:monitoring' : 'submission:catalog'];
  }
  if (notification.entityType === 'scheme') return ['menu:submission', 'submission:catalog'];
  if (notification.entityType === 'letter_request') return ['menu:letters', 'letters:tracking'];
  if (notification.entityType === 'external_research') return ['menu:external', 'external:tracking'];
  if (notification.entityType === 'researcher_profile' || notification.entityType === 'account') return ['menu:profiles', 'profiles:tracking'];
  if (notification.entityType === 'monev' || type.startsWith('monev_')) return [management ? 'menu:research' : 'menu:submission', `${management ? 'research' : 'submission'}:funded`, `${management ? 'research' : 'submission'}:funded:monev`];
  if (notification.entityType === 'internal_report' || type.startsWith('internal_report_')) return [management ? 'menu:research' : 'menu:submission', `${management ? 'research' : 'submission'}:funded`, `${management ? 'research' : 'submission'}:funded:final-report`];
  if (notification.entityType === 'funded_review' || type.startsWith('funded_review')) return [management ? 'menu:research' : 'menu:submission', `${management ? 'research' : 'submission'}:funded`, `${management ? 'research' : 'submission'}:funded:review`];
  return [];
};

export const getNotificationIndicatorMap = (data, user, now = new Date()) => getNotificationsForUser(data, user, now)
  .filter(notification => !notification.isRead)
  .reduce((indicators, notification) => notificationTargets(notification, user, data).reduce((result, target) => {
    const ids = result[target] || [];
    return ids.includes(notification.id) ? result : { ...result, [target]: [...ids, notification.id] };
  }, indicators), {});

const changedRecord = (before, after, statusField) => (after || []).find(item => {
  const oldItem = (before || []).find(candidate => candidate.id === item.id);
  if (!oldItem) return false;
  if (statusField) return oldItem[statusField] !== item[statusField];
  return oldItem.updatedAt && item.updatedAt && oldItem.updatedAt !== item.updatedAt;
});

export const inferMutationToast = (previous, next) => {
  if (!previous || !next) return null;
  if ((next.externalResearchReports || []).length < (previous.externalResearchReports || []).length) return { tone: 'success', title: 'Laporan dihapus', message: 'Laporan penelitian eksternal berhasil dihapus.' };
  if ((next.schemes || []).length > (previous.schemes || []).length) return { tone: 'success', title: 'Skema dibuat', message: 'Skema penelitian baru berhasil disimpan.' };
  if ((next.systemUsers || []).length > (previous.systemUsers || []).length) return { tone: 'success', title: 'Akun dibuat', message: 'Akun RIS baru ditambahkan dalam status nonaktif.' };
  if (changedRecord(previous.systemUsers, next.systemUsers)) return { tone: 'success', title: 'Akun diperbarui', message: 'Perubahan akun dan hak akses berhasil disimpan.' };
  const draftChange = changedRecord(previous.drafts, next.drafts, 'status');
  if (draftChange && draftStatus(draftChange) !== STATUS.ARCHIVED) return { tone: 'success', title: 'Proposal diperbarui', message: draftStatus(draftChange) === STATUS.SUBMITTED ? 'Proposal berhasil disubmit.' : 'Perubahan proposal berhasil disimpan.' };
  if (changedRecord(previous.letterRequests, next.letterRequests, 'status')) return { tone: 'success', title: 'Pengajuan surat diperbarui', message: 'Perubahan pengajuan surat berhasil disimpan.' };
  if (changedRecord(previous.externalResearchReports, next.externalResearchReports, 'submissionStatus')) return { tone: 'success', title: 'Laporan diperbarui', message: 'Perubahan laporan penelitian eksternal berhasil disimpan.' };
  if ((next.monevRecords || []).length > (previous.monevRecords || []).length) return { tone: 'success', title: 'Monev disimpan', message: 'Data Monev berhasil disubmit.' };
  if ((next.internalReports || []).length > (previous.internalReports || []).length) return { tone: 'success', title: 'Laporan disimpan', message: 'Laporan penelitian berhasil disubmit.' };
  if ((next.logbooks || []).length > (previous.logbooks || []).length) return { tone: 'success', title: 'Logbook ditambahkan', message: 'Aktivitas penelitian berhasil dicatat.' };
  if ((next.researcherDocuments || []).length > (previous.researcherDocuments || []).length) return { tone: 'success', title: 'Dokumen diunggah', message: 'Dokumen profil berhasil disimpan.' };
  if (changedRecord(previous.researcherProfiles, next.researcherProfiles)) return { tone: 'success', title: 'Profil diperbarui', message: 'Perubahan profil berhasil disimpan.' };
  return null;
};

export const formatNotificationTime = (value, now = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const differenceMinutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60000));
  if (differenceMinutes < 1) return 'Baru saja';
  if (differenceMinutes < 60) return `${differenceMinutes} menit lalu`;
  const hours = Math.floor(differenceMinutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};
