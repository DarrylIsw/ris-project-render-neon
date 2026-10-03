const assert = require('assert');
const { createInitialData } = require('../../app/containers/Ris/core/data');
const {
  NOTIFICATION_PRIORITY,
  appendWorkflowNotifications,
  getNotificationsForUser,
  inferMutationToast,
} = require('../../app/containers/Ris/shared/workflows/notificationWorkflow');
const {
  EMAIL_DELIVERY_MODE,
  appendScheduledEmailReminders,
  getEmailOutboxSummary,
} = require('../../app/containers/Ris/shared/workflows/emailNotificationWorkflow');
const { ADMIN_SCOPE, ROLE, STATUS } = require('../../app/containers/Ris/shared/workflows/workflow');

const account = (data, id, extras = {}) => ({
  ...data.systemUsers.find(item => item.id === id),
  ...extras,
});

describe('RIS in-app notifications', () => {
  it('shows research queues only to accounts with the research scope', () => {
    const data = createInitialData();
    const researchAdmin = data.systemUsers.find(item => item.role === ROLE.ADMIN && (item.adminScopes || []).includes(ADMIN_SCOPE.RESEARCH));
    const letterAdmin = data.systemUsers.find(item => item.role === ROLE.ADMIN && (item.adminScopes || []).includes(ADMIN_SCOPE.LETTERS));
    const researchTypes = getNotificationsForUser(data, researchAdmin, new Date('2026-07-28T08:00:00+07:00')).map(item => item.type);
    const letterTypes = getNotificationsForUser(data, letterAdmin, new Date('2026-07-28T08:00:00+07:00')).map(item => item.type);
    assert.strictEqual(researchTypes.includes('proposal_submitted'), true);
    assert.strictEqual(researchTypes.includes('proposal_reviewed'), true);
    assert.strictEqual(letterTypes.includes('proposal_submitted'), false);
    assert.strictEqual(letterTypes.includes('proposal_reviewed'), false);
  });

  it('gives lecturers scheme notifications and a contract action only after management sends it', () => {
    const data = createInitialData();
    const lecturer = account(data, 'user-lecturer');
    const notifications = getNotificationsForUser(data, lecturer, new Date('2026-07-28T08:00:00+07:00'));
    assert.strictEqual(notifications.some(item => item.type === 'scheme_open' && item.actionPath.includes('daftar-skema')), true);
    assert.strictEqual(notifications.some(item => item.type === 'contract_pending'), false);
    const sentData = {
      ...data,
      drafts: data.drafts.map(draft => (draft.id === 'draft-approved' ? {
        ...draft,
        contract: {
          ...draft.contract,
          adminSignedFile: { id: 'file-admin-signed-contract', name: 'kontrak-bertanda-tangan.pdf' },
          sentToLecturerAt: '2026-07-27T08:00:00+07:00',
        },
      } : draft)),
    };
    const sentNotifications = getNotificationsForUser(sentData, lecturer, new Date('2026-07-28T08:00:00+07:00'));
    assert.strictEqual(sentNotifications.some(item => item.type === 'contract_ready' && item.actionPath.includes('tab=contract')), true);
  });

  it('keeps manager management and lecturer notifications in one deduplicated center', () => {
    const data = createInitialData();
    const manager = account(data, 'user-manager', { managerMode: 'management' });
    const notifications = getNotificationsForUser(data, manager, new Date('2026-07-28T08:00:00+07:00'));
    assert.strictEqual(notifications.some(item => item.managerMode === 'management' && item.type === 'proposal_submitted'), true);
    assert.strictEqual(notifications.some(item => item.managerMode === 'lecturer' && item.type === 'scheme_open'), true);
    assert.strictEqual(new Set(notifications.map(item => item.id)).size, notifications.length);
  });

  it('does not duplicate a stored queue event that is already computed from current state', () => {
    const data = createInitialData();
    const researchAdmin = data.systemUsers.find(item => item.id === 'user-admin');
    const withStoredQueueEvent = {
      ...data,
      notifications: [{
        id: 'stored-submission',
        userId: researchAdmin.id,
        entityType: 'research_draft',
        entityId: 'draft-submitted',
        type: 'proposal_submitted',
        message: 'Proposal baru masuk.',
        createdAt: '2026-07-28T07:00:00+07:00',
        isRead: false,
      }],
    };
    const notifications = getNotificationsForUser(withStoredQueueEvent, researchAdmin, new Date('2026-07-28T08:00:00+07:00'));
    assert.strictEqual(notifications.filter(item => item.entityId === 'draft-submitted' && item.type === 'proposal_submitted').length, 1);
  });

  it('promotes reporting deadlines under 24 hours to a critical popup', () => {
    const data = createInitialData();
    const lecturer = account(data, 'user-lecturer');
    const deadlineData = {
      ...data,
      drafts: [{
        id: 'deadline-draft',
        userId: lecturer.id,
        status: STATUS.FUNDED,
        draftStatus: STATUS.FUNDED,
        schemeId: 'deadline-scheme',
        project: { title: 'Penelitian Deadline' },
        outputs: [],
        contract: { status: 'signed' },
      }],
      schemes: [{
        id: 'deadline-scheme',
        name: 'Skema Deadline',
        status: 'closed',
        reportingSchedule: [{
          id: 'deadline-final',
          type: 'final',
          label: 'Laporan Final',
          openAt: '2026-07-20T00:00:00+07:00',
          dueAt: '2026-07-28T20:00:00+07:00',
          extensions: [],
        }],
      }],
      internalReports: [],
      monevRecords: [],
    };
    const notification = getNotificationsForUser(deadlineData, lecturer, new Date('2026-07-28T08:00:00+07:00')).find(item => item.type === 'report_deadline_1');
    assert.ok(notification);
    assert.strictEqual(notification.priority, NOTIFICATION_PRIORITY.CRITICAL);
  });

  it('promotes reviewer deadlines under 24 hours to a critical direct action', () => {
    const data = createInitialData();
    const reviewer = account(data, 'user-lecturer-2');
    const deadlineData = {
      ...data,
      drafts: [{
        id: 'review-deadline-draft',
        userId: 'user-lecturer',
        status: STATUS.UNDER_REVIEW,
        draftStatus: STATUS.UNDER_REVIEW,
        project: { title: 'Proposal Deadline Review' },
        assignments: [{
          id: 'review-deadline-assignment',
          reviewerUserId: reviewer.id,
          status: 'assigned',
          dueAt: '2026-07-28T20:00:00+07:00',
        }],
      }],
    };
    const notification = getNotificationsForUser(deadlineData, reviewer, new Date('2026-07-28T08:00:00+07:00')).find(item => item.type === 'reviewer_deadline_1');
    assert.ok(notification);
    assert.strictEqual(notification.priority, NOTIFICATION_PRIORITY.CRITICAL);
    assert.strictEqual(notification.actionPath.includes('/penilaian'), true);
  });

  it('persists read state for computed queue notifications', () => {
    const data = createInitialData();
    const manager = account(data, 'user-manager', { managerMode: 'management' });
    const first = getNotificationsForUser(data, manager, new Date('2026-07-28T08:00:00+07:00')).find(item => item.type === 'contract_pending');
    const readData = { ...data, notificationReadIds: [first.id] };
    const matching = getNotificationsForUser(readData, manager, new Date('2026-07-28T08:00:00+07:00')).find(item => item.id === first.id);
    assert.strictEqual(matching.isRead, true);
  });

  it('creates scoped events when a proposal is submitted', () => {
    const data = createInitialData();
    const draft = data.drafts.find(item => item.id === 'draft-demo-saved');
    const previous = { ...data, notifications: [], drafts: [{ ...draft, status: STATUS.DRAFT, draftStatus: STATUS.DRAFT }] };
    const next = { ...previous, drafts: [{ ...draft, status: STATUS.SUBMITTED, draftStatus: STATUS.SUBMITTED }] };
    const enriched = appendWorkflowNotifications(previous, next, account(data, 'user-lecturer'), new Date('2026-07-28T08:00:00+07:00'));
    const recipients = enriched.notifications.filter(item => item.type === 'proposal_submitted').map(item => item.userId);
    const researchAdmin = data.systemUsers.find(item => item.role === ROLE.ADMIN && (item.adminScopes || []).includes(ADMIN_SCOPE.RESEARCH));
    const letterAdmin = data.systemUsers.find(item => item.role === ROLE.ADMIN && (item.adminScopes || []).includes(ADMIN_SCOPE.LETTERS));
    assert.strictEqual(recipients.includes(researchAdmin.id), true);
    assert.strictEqual(recipients.includes('user-manager'), true);
    assert.strictEqual(recipients.includes('user-super-admin'), true);
    assert.strictEqual(recipients.includes(letterAdmin.id), false);
  });

  it('infers concise success toasts from important mutations', () => {
    const data = createInitialData();
    const next = { ...data, schemes: [{ id: 'new-scheme' }, ...data.schemes] };
    assert.deepStrictEqual(inferMutationToast(data, next), { tone: 'success', title: 'Skema dibuat', message: 'Skema penelitian baru berhasil disimpan.' });
  });

  it('does not create repetitive toasts for field edits or automatic draft creation', () => {
    const data = createInitialData();
    const letter = data.letterRequests[0];
    const draft = data.drafts[0];
    const external = data.externalResearchReports[0];
    const editedLetter = {
      ...data,
      letterRequests: data.letterRequests.map(item => (item.id === letter.id ? {
        ...item,
        form: { ...(item.form || {}), researchTitle: 'Judul berubah satu huruf' },
        updatedAt: '2026-08-06T08:00:00.000Z',
      } : item)),
    };
    const autosavedProposal = {
      ...data,
      drafts: data.drafts.map(item => (item.id === draft.id ? {
        ...item,
        project: { ...(item.project || {}), title: 'Judul proposal berubah' },
        updatedAt: '2026-08-06T08:00:00.000Z',
      } : item)),
    };
    const editedExternal = {
      ...data,
      externalResearchReports: data.externalResearchReports.map(item => (item.id === external.id ? {
        ...item,
        researchTitle: 'Judul laporan berubah',
        updatedAt: '2026-08-06T08:00:00.000Z',
      } : item)),
    };
    const automaticDraft = {
      ...data,
      drafts: [...data.drafts, {
        id: 'automatic-draft',
        userId: 'user-lecturer',
        status: STATUS.DRAFT,
        draftStatus: STATUS.DRAFT,
      }],
    };

    assert.strictEqual(inferMutationToast(data, editedLetter), null);
    assert.strictEqual(inferMutationToast(data, autosavedProposal), null);
    assert.strictEqual(inferMutationToast(data, editedExternal), null);
    assert.strictEqual(inferMutationToast(data, automaticDraft), null);
  });

  it('still creates a toast when a workflow is explicitly submitted', () => {
    const data = createInitialData();
    const draft = data.drafts.find(item => item.id === 'draft-demo-saved');
    const previous = {
      ...data,
      drafts: data.drafts.map(item => (item.id === draft.id ? { ...item, status: STATUS.DRAFT, draftStatus: STATUS.DRAFT } : item)),
    };
    const submitted = {
      ...previous,
      drafts: previous.drafts.map(item => (item.id === draft.id ? { ...item, status: STATUS.SUBMITTED, draftStatus: STATUS.SUBMITTED } : item)),
    };
    assert.deepStrictEqual(inferMutationToast(previous, submitted), {
      tone: 'success',
      title: 'Proposal diperbarui',
      message: 'Proposal berhasil disubmit.',
    });
  });
});

describe('RIS email notification workflow', () => {
  it('emails the applicant after proposal verification succeeds', () => {
    const data = createInitialData();
    const draft = data.drafts.find(item => item.id === 'draft-submitted');
    const previous = {
      ...data,
      notifications: [],
      emailOutbox: [],
      drafts: [{ ...draft, verification: { status: 'pending' } }],
    };
    const next = {
      ...previous,
      drafts: [{ ...draft, verification: { status: 'verified', verifiedAt: '2026-07-28T08:00:00.000Z' } }],
    };
    const enriched = appendWorkflowNotifications(previous, next, account(data, 'user-admin'), new Date('2026-07-28T08:00:00+07:00'));
    const email = enriched.emailOutbox.find(item => item.notificationType === 'proposal_verified');

    assert.ok(email);
    assert.strictEqual(email.recipientUserId, draft.userId);
  });

  it('queues immediate email for the applicant and research management', () => {
    const data = createInitialData();
    const draft = data.drafts.find(item => item.id === 'draft-demo-saved');
    const previous = {
      ...data,
      notifications: [],
      emailOutbox: [],
      drafts: [{ ...draft, status: STATUS.DRAFT, draftStatus: STATUS.DRAFT }],
    };
    const next = {
      ...previous,
      drafts: [{ ...draft, status: STATUS.SUBMITTED, draftStatus: STATUS.SUBMITTED }],
    };
    const enriched = appendWorkflowNotifications(previous, next, account(data, 'user-lecturer'), new Date('2026-07-28T08:00:00+07:00'));
    const confirmation = enriched.emailOutbox.find(email => email.notificationType === 'proposal_submission_confirmation');
    const managementEmails = enriched.emailOutbox.filter(email => email.notificationType === 'proposal_submitted');
    const researchAdmin = data.systemUsers.find(item => item.role === ROLE.ADMIN && (item.adminScopes || []).includes(ADMIN_SCOPE.RESEARCH));
    const letterAdmin = data.systemUsers.find(item => item.role === ROLE.ADMIN && (item.adminScopes || []).includes(ADMIN_SCOPE.LETTERS));

    assert.ok(confirmation);
    assert.strictEqual(confirmation.recipientUserId, draft.userId);
    assert.strictEqual(confirmation.deliveryMode, EMAIL_DELIVERY_MODE.IMMEDIATE);
    assert.strictEqual(managementEmails.some(email => email.recipientUserId === researchAdmin.id), true);
    assert.strictEqual(managementEmails.some(email => email.recipientUserId === 'user-manager'), true);
    assert.strictEqual(managementEmails.some(email => email.recipientUserId === 'user-super-admin'), true);
    assert.strictEqual(managementEmails.some(email => email.recipientUserId === letterAdmin.id), false);
    assert.strictEqual(managementEmails.every(email => email.deliveryMode === EMAIL_DELIVERY_MODE.IMMEDIATE), true);
  });

  it('does not duplicate outbox records when the same workflow event is processed again', () => {
    const data = createInitialData();
    const draft = data.drafts.find(item => item.id === 'draft-demo-saved');
    const previous = {
      ...data,
      notifications: [],
      emailOutbox: [],
      drafts: [{ ...draft, status: STATUS.DRAFT, draftStatus: STATUS.DRAFT }],
    };
    const next = {
      ...previous,
      drafts: [{ ...draft, status: STATUS.SUBMITTED, draftStatus: STATUS.SUBMITTED }],
    };
    const first = appendWorkflowNotifications(previous, next, account(data, 'user-lecturer'), new Date('2026-07-28T08:00:00+07:00'));
    const second = appendWorkflowNotifications(previous, first, account(data, 'user-lecturer'), new Date('2026-07-28T08:00:00+07:00'));
    assert.strictEqual(second.emailOutbox.length, first.emailOutbox.length);
    assert.strictEqual(new Set(second.emailOutbox.map(email => email.deduplicationKey)).size, second.emailOutbox.length);
  });

  it('queues account creation email without exposing a password or token', () => {
    const data = createInitialData();
    const newAccount = {
      id: 'user-new-account',
      name: 'Lecturer Baru',
      email: 'lecturer.baru@umn.ac.id',
      password: 'password123',
      role: ROLE.LECTURER,
      isActive: true,
    };
    const previous = { ...data, notifications: [], emailOutbox: [] };
    const next = { ...previous, systemUsers: [...previous.systemUsers, newAccount] };
    const enriched = appendWorkflowNotifications(previous, next, account(data, 'user-super-admin'), new Date('2026-07-28T08:00:00+07:00'));
    const email = enriched.emailOutbox.find(item => item.recipientUserId === newAccount.id);
    assert.ok(email);
    assert.strictEqual(/password123|token\s*[:=]/i.test(`${email.message} ${email.bodyText}`), false);
  });

  it('does not email a user for their own routine profile edit', () => {
    const data = createInitialData();
    const lecturer = account(data, 'user-lecturer');
    const event = {
      id: 'profile-self-update',
      userId: lecturer.id,
      notificationType: 'profile_updated',
      entityType: 'researcher_profile',
      entityId: lecturer.profileId,
      message: 'Profil peneliti berhasil diperbarui.',
      createdAt: '2026-07-28T08:00:00+07:00',
    };
    const previous = { ...data, notifications: [], emailOutbox: [] };
    const next = { ...previous, notifications: [event] };
    const enriched = appendWorkflowNotifications(previous, next, lecturer, new Date('2026-07-28T08:00:00+07:00'));
    assert.strictEqual(enriched.emailOutbox.some(email => email.notificationType === 'profile_updated'), false);
  });

  it('queues H-1 report reminders once and preserves a useful direct action', () => {
    const data = createInitialData();
    const deadlineData = {
      ...data,
      emailOutbox: [],
      drafts: [{
        id: 'email-deadline-draft',
        userId: 'user-lecturer',
        status: STATUS.FUNDED,
        draftStatus: STATUS.FUNDED,
        schemeId: 'email-deadline-scheme',
        project: { title: 'Penelitian Deadline Email' },
        outputs: [],
        contract: { status: 'signed' },
      }],
      schemes: [{
        id: 'email-deadline-scheme',
        name: 'Skema Deadline Email',
        status: 'closed',
        reportingSchedule: [{
          id: 'email-deadline-final',
          type: 'final',
          label: 'Laporan Final',
          openAt: '2026-07-20T00:00:00+07:00',
          dueAt: '2026-07-28T20:00:00+07:00',
          extensions: [],
        }],
      }],
      internalReports: [],
      monevRecords: [],
    };
    const first = appendScheduledEmailReminders(deadlineData, new Date('2026-07-28T08:00:00+07:00'));
    const second = appendScheduledEmailReminders(first, new Date('2026-07-28T09:00:00+07:00'));
    const reminders = second.emailOutbox.filter(email => email.notificationType === 'report_deadline_1' && email.recipientUserId === 'user-lecturer');
    assert.strictEqual(reminders.length, 1);
    assert.strictEqual(reminders[0].priority, NOTIFICATION_PRIORITY.CRITICAL);
    assert.strictEqual(reminders[0].actionPath.includes('/pendataan'), true);
  });

  it('cancels a queued reminder when the required report has been submitted', () => {
    const data = createInitialData();
    const deadlineData = {
      ...data,
      emailOutbox: [],
      drafts: [{
        id: 'resolved-deadline-draft',
        userId: 'user-lecturer',
        status: STATUS.FUNDED,
        draftStatus: STATUS.FUNDED,
        schemeId: 'resolved-deadline-scheme',
        project: { title: 'Penelitian Reminder Selesai' },
        outputs: [],
      }],
      schemes: [{
        id: 'resolved-deadline-scheme',
        name: 'Skema Reminder Selesai',
        status: 'closed',
        reportingSchedule: [{
          id: 'resolved-deadline-final',
          type: 'final',
          label: 'Laporan Final',
          openAt: '2026-07-20T00:00:00+07:00',
          dueAt: '2026-07-28T20:00:00+07:00',
          extensions: [],
        }],
      }],
      internalReports: [],
      monevRecords: [],
    };
    const queued = appendScheduledEmailReminders(deadlineData, new Date('2026-07-28T08:00:00+07:00'));
    const submitted = {
      ...queued,
      internalReports: [{
        id: 'resolved-report',
        researchId: 'resolved-deadline-draft',
        periodId: 'resolved-deadline-final',
        outputId: null,
        status: 'submitted',
      }],
    };
    const reconciled = appendScheduledEmailReminders(submitted, new Date('2026-07-28T09:00:00+07:00'));
    const reminder = reconciled.emailOutbox.find(email => email.notificationType === 'report_deadline_1');
    assert.strictEqual(reminder.status, 'cancelled');
  });

  it('queues reviewer deadline email only for the assigned lecturer', () => {
    const data = createInitialData();
    const deadlineData = {
      ...data,
      emailOutbox: [],
      drafts: [{
        id: 'email-review-deadline-draft',
        userId: 'user-lecturer',
        status: STATUS.UNDER_REVIEW,
        draftStatus: STATUS.UNDER_REVIEW,
        project: { title: 'Proposal Deadline Reviewer' },
        assignments: [{
          id: 'email-review-deadline-assignment',
          reviewerUserId: 'user-lecturer-2',
          status: 'assigned',
          dueAt: '2026-07-28T20:00:00+07:00',
        }],
      }],
    };
    const enriched = appendScheduledEmailReminders(deadlineData, new Date('2026-07-28T08:00:00+07:00'));
    const reminders = enriched.emailOutbox.filter(email => email.notificationType === 'reviewer_deadline_1');
    assert.strictEqual(reminders.length, 1);
    assert.strictEqual(reminders[0].recipientUserId, 'user-lecturer-2');
    assert.strictEqual(reminders[0].actionPath.includes('/penilaian'), true);
  });

  it('summarizes queued delivery modes for operational monitoring', () => {
    const summary = getEmailOutboxSummary({
      emailOutbox: [
        { status: 'queued', deliveryMode: EMAIL_DELIVERY_MODE.IMMEDIATE },
        { status: 'queued', deliveryMode: EMAIL_DELIVERY_MODE.DIGEST },
        { status: 'failed', deliveryMode: EMAIL_DELIVERY_MODE.IMMEDIATE },
      ],
    });
    assert.deepStrictEqual(summary, {
      total: 3,
      queued: 2,
      sent: 0,
      failed: 1,
      immediate: 2,
      digest: 1,
    });
  });
});
