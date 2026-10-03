/* eslint-disable no-await-in-loop */
const { createHash } = require('crypto');
const prisma = require('../config/prisma');
const { ACCOUNT_SEED_IDS, id } = require('../../internals/scripts/generate-database-seed');

const VALUE_ID = '__value';
const EMPTY_ARRAYS = [
  'adminAssignments', 'applicantProfiles', 'drafts', 'emailOutbox', 'externalResearchReports',
  'fundedReviewAssignments', 'fundedReviewerReminders', 'fundedReviews', 'internalReports',
  'lecturers', 'letterDefinitions', 'letterRequests', 'logbooks', 'monevRecords',
  'notificationReadIds', 'notifications', 'previousEthicsClearances', 'researcherDocuments',
  'researcherExpertise', 'researcherExpertiseMap', 'researcherProfiles',
  'researcherStatusHistory', 'researcherVerifications', 'reviewerReminders', 'schemes',
  'systemActivityLogs', 'systemUsers', 'temporaryRoleAssignments',
];
const identity = (item, index) => {
  const key = String((item && (item.id || item.profileId || item.expertiseId)) || `index-${index}`);
  return key.length <= 180 ? key : `sha256:${createHash('sha256').update(key).digest('hex')}`;
};
const cleanValue = (domain, value) => (domain === 'systemUsers'
  ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'password' && key !== 'passwordHash'))
  : value);
const entriesFor = data => Object.entries(data).flatMap(([domain, value]) => (
  Array.isArray(value)
    ? value.map((item, index) => ({ domain, entity_id: identity(item, index), payload: { position: index, value: cleanValue(domain, item) } }))
    : [{ domain, entity_id: VALUE_ID, payload: { position: 0, value } }]
));

const cleanInitialData = source => ({
  ...source,
  systemUsers: source.systemUsers.filter(user => ['super_admin', 'manager'].includes(user.role)),
  researcherProfiles: source.researcherProfiles.filter(profile => ['user-super-admin', 'user-manager'].includes(profile.userId)),
  lecturers: source.lecturers.filter(lecturer => lecturer.userId === 'user-manager'),
  researcherDocuments: [],
  researcherExpertiseMap: [],
  researcherVerifications: [],
  researcherStatusHistory: [],
  adminAssignments: [],
  systemActivityLogs: [],
  applicantProfiles: [],
  previousEthicsClearances: [],
  temporaryRoleAssignments: [],
  schemes: [],
  drafts: [],
  logbooks: [],
  internalReports: [],
  monevRecords: [],
  fundedReviewAssignments: [],
  fundedReviews: [],
  letterRequests: [],
  letterDefinitions: [],
  notifications: [],
  notificationReadIds: [],
  reviewerReminders: [],
  fundedReviewerReminders: [],
  emailOutbox: [],
  externalResearchReports: [],
});

const accountOnlyInitialData = source => {
  const state = Object.fromEntries(Object.entries(source).map(([domain, value]) => [domain, Array.isArray(value) ? [] : value]));
  state.systemUsers = source.systemUsers
    .filter(user => ACCOUNT_SEED_IDS.has(user.id))
    .map(user => cleanValue('systemUsers', user));
  state.letterMasterTemplate = null;
  return state;
};

const temporaryAssignmentsFor = state => [
  ...(state.drafts || []).flatMap(draft => (draft.assignments || []).map(assignment => ({
    id: `reviewer-grant-${draft.id}-${assignment.reviewerUserId}`,
    userId: assignment.reviewerUserId,
    profileId: assignment.reviewerProfileId,
    role: 'reviewer',
    entityType: 'research_proposal',
    entityId: draft.id,
    status: ['assigned', 'in_progress', 'submitted'].includes(assignment.status) ? 'active' : 'revoked',
    assignedAt: assignment.assignedAt,
    assignedBy: assignment.assignedBy,
    revokedAt: assignment.revokedAt,
    revokedBy: assignment.revokedBy,
  }))),
  ...(state.fundedReviewAssignments || []).filter(assignment => (
    assignment.targetType !== 'report'
      || (state.internalReports || []).some(report => report.id === assignment.targetId && report.reportType !== 'interim')
  )).map(assignment => ({
    id: `reviewer-grant-${assignment.id}`,
    userId: assignment.reviewerUserId,
    profileId: assignment.reviewerProfileId,
    role: 'reviewer',
    entityType: `funded_${assignment.targetType}`,
    entityId: assignment.targetId,
    status: ['assigned', 'in_progress', 'submitted'].includes(assignment.status) ? 'active' : 'revoked',
    assignedAt: assignment.assignedAt,
    assignedBy: assignment.assignedBy,
    revokedAt: assignment.revokedAt,
    revokedBy: assignment.revokedBy,
  })),
];

const loadState = async (tx = prisma) => {
  const rows = await tx.ris_records.findMany();
  const data = Object.fromEntries(EMPTY_ARRAYS.map(domain => [domain, []]));
  rows.sort((a, b) => a.domain.localeCompare(b.domain) || a.payload.position - b.payload.position);
  rows.forEach(row => {
    if (row.entity_id === VALUE_ID) data[row.domain] = row.payload.value;
    else {
      if (!data[row.domain]) data[row.domain] = [];
      data[row.domain].push(row.payload.value);
    }
  });
  if (data.emailOutbox.length) {
    const delivery = await tx.email_outbox.findMany({
      select: {
        deduplication_key: true,
        delivery_mode: true,
        status: true,
        attempts: true,
        sent_at: true,
        error_message: true,
        provider: true,
        provider_message_id: true,
      },
    });
    const byKey = new Map(delivery.map(item => [item.deduplication_key, item]));
    data.emailOutbox = data.emailOutbox.map(item => {
      const row = byKey.get(item.deduplicationKey);
      return row ? {
        ...item,
        deliveryMode: row.delivery_mode,
        status: row.status,
        attempts: row.attempts,
        sentAt: row.sent_at && row.sent_at.toISOString(),
        errorMessage: row.error_message,
        provider: row.provider,
        providerMessageId: row.provider_message_id,
      } : item;
    });
  }
  return data;
};

const ensureInitialState = async () => {
  const revision = await prisma.ris_revision.findUnique({ where: { id: 1 } });
  if (revision) return;
  const counts = await Promise.all([
    prisma.users.count(), prisma.schemes.count(), prisma.research_drafts.count(),
  ]);
  const demo = counts.join(',') === '9,7,5';
  const clean = counts.join(',') === '2,0,0';
  const accountsOnly = counts.join(',') === '7,0,0';
  if (!demo && !clean && !accountsOnly) {
    throw new Error('Database does not match the demo seed. Runtime data import was not performed.');
  }
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  require('@babel/register')({ envName: 'test' });
  const { createInitialData, normalizeRisData } = require('../../app/containers/Ris/core/data');
  const original = normalizeRisData(createInitialData());
  const seed = demo ? original : accountsOnly ? accountOnlyInitialData(original) : cleanInitialData(original);
  const seededUsers = await prisma.users.findMany({ select: { id: true } });
  const userIds = new Set(seededUsers.map(user => user.id));
  if (seed.systemUsers.length !== userIds.size || !seed.systemUsers.every(user => userIds.has(id('user', user.id)))) {
    throw new Error('Database accounts differ from data.js; refusing automatic import.');
  }
  const rows = entriesFor(seed);
  await prisma.$transaction(async tx => {
    const existing = await tx.ris_revision.findUnique({ where: { id: 1 } });
    if (existing) return;
    await tx.ris_records.createMany({ data: rows, skipDuplicates: true });
    await tx.ris_revision.create({ data: { id: 1, version: 1 } });
  });
};

const resolveAccount = (state, databaseUser) => {
  const account = (state.systemUsers || []).find(item => id('user', item.id) === databaseUser.id);
  if (!account) return null;
  return {
    ...account,
    name: databaseUser.name,
    email: databaseUser.email,
    role: databaseUser.role,
    isActive: databaseUser.is_active,
  };
};

const getRevision = async () => (await prisma.ris_revision.findUnique({ where: { id: 1 } })).version;

module.exports = {
  VALUE_ID,
  EMPTY_ARRAYS,
  identity,
  entriesFor,
  cleanInitialData,
  accountOnlyInitialData,
  temporaryAssignmentsFor,
  loadState,
  ensureInitialState,
  resolveAccount,
  getRevision
};
