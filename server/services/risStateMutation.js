/* eslint-disable no-await-in-loop, no-restricted-syntax, no-continue */
const { isDeepStrictEqual } = require('util');
const prisma = require('../config/prisma');
const {
  identity, loadState, resolveAccount, temporaryAssignmentsFor, VALUE_ID
} = require('./risDataService');
const { projectState, canChange } = require('./risAccess');
const { synchronize } = require('./relationalMirror');
const { appendServerEvents } = require('./risEventNotifications');
const emailOutboxModel = require('../models/emailOutboxModel');

const equal = isDeepStrictEqual;
const forbidden = message => Object.assign(new Error(message), { status: 403, code: 'FORBIDDEN' });
const conflict = () => Object.assign(new Error('Data telah diubah pengguna lain. Muat ulang halaman lalu coba lagi.'), { status: 409, code: 'DATA_CONFLICT' });
const recordKey = (domain, entityId) => ({ domain_entity_id: { domain, entity_id: entityId } });
const fileIdsIn = value => new Set([...JSON.stringify(value || '').matchAll(/\/api\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi)]
  .map(match => match[1].toLowerCase()));

const saveEntry = async (tx, domain, key, value, position) => tx.ris_records.upsert({
  where: recordKey(domain, key),
  create: { domain, entity_id: key, payload: { position, value } },
  update: { payload: { position, value }, updated_at: new Date() },
});

const persistArray = async (tx, domain, before, after) => {
  const oldMap = new Map((before || []).map((item, index) => [identity(item, index), item]));
  const newMap = new Map((after || []).map((item, index) => [identity(item, index), item]));
  for (const [key] of oldMap) {
    if (!newMap.has(key)) await tx.ris_records.deleteMany({ where: { domain, entity_id: key } });
  }
  for (let index = 0; index < after.length; index += 1) {
    const value = after[index];
    const key = identity(value, index);
    if (!equal(oldMap.get(key), value)) await saveEntry(tx, domain, key, value, index);
  }
};

const saveState = async ({
  databaseUser, submitted, expectedVersion, trustedDomains = []
}) => prisma.$transaction(async tx => {
  const revision = await tx.ris_revision.findUnique({ where: { id: 1 } });
  if (revision.version !== expectedVersion) throw conflict();
  const previous = await loadState(tx);
  const account = resolveAccount(previous, databaseUser);
  if (!account || account.isActive === false) throw forbidden('Akun tidak aktif.');
  const scopes = await tx.user_admin_scopes.findMany({ where: { user_id: databaseUser.id }, select: { scope: true } });
  account.adminScopes = scopes.map(item => item.scope);
  const visible = projectState(previous, account);
  const next = { ...previous };
  const trustedDomainSet = new Set(trustedDomains);
  const changedDomains = [];
  let requestedNotifications = null;

  for (const domain of Object.keys(visible)) {
    if (!Object.prototype.hasOwnProperty.call(submitted, domain)) continue;
    if (['emailOutbox', 'systemActivityLogs', 'temporaryRoleAssignments'].includes(domain)) continue;
    const oldVisible = visible[domain];
    const desired = submitted[domain];
    if (equal(oldVisible, desired)) continue;
    if (domain === 'notifications') {
      if (!Array.isArray(desired)) throw forbidden('Format notifikasi tidak sesuai.');
      requestedNotifications = desired;
      continue;
    }
    if (domain === 'notificationReadIds') {
      if (!Array.isArray(desired) || desired.some(id => typeof id !== 'string')
        || new Set(desired).size !== desired.length
        || (oldVisible || []).some(id => !desired.includes(id))) {
        throw forbidden('Penanda notifikasi tidak sesuai.');
      }
      require('@babel/register')({ envName: 'test' });
      const { getNotificationsForUser } = require('../../app/containers/Ris/shared/workflows/notificationWorkflow');
      const ownNotificationIds = new Set(getNotificationsForUser(visible, account).map(item => item.id));
      if (desired.some(id => !(oldVisible || []).includes(id) && !ownNotificationIds.has(id))) {
        throw forbidden('Notifikasi bukan milik akun ini.');
      }
      next.notificationReadIds = desired;
      changedDomains.push(domain);
      continue;
    }
    if (Array.isArray(oldVisible)) {
      if (!Array.isArray(desired)) throw forbidden('Format data tidak sesuai.');
      const prior = new Map(oldVisible.map((item, index) => [identity(item, index), item]));
      const proposed = new Map(desired.map((item, index) => [identity(item, index), item]));
      if (proposed.size !== desired.length) throw forbidden('ID data duplikat.');
      for (const [key, item] of prior) {
        const newItem = proposed.get(key);
        if (!equal(item, newItem) && !canChange(domain, item, newItem, account, previous, { trusted: trustedDomainSet.has(domain) })) throw forbidden(`Tidak dapat mengubah ${domain}.`);
      }
      for (const [key, item] of proposed) {
        if (!prior.has(key) && !canChange(domain, null, item, account, previous, { trusted: trustedDomainSet.has(domain) })) throw forbidden(`Tidak dapat menambah ${domain}.`);
      }
      const proposedIds = new Set(proposed.keys());
      const merged = (previous[domain] || []).filter((item, index) => !prior.has(identity(item, index)) || proposedIds.has(identity(item, index)))
        .map((item, index) => {
          const key = identity(item, index);
          const candidate = proposed.get(key);
          return prior.has(key) && equal(prior.get(key), candidate) ? item : (candidate || item);
        });
      desired.forEach((item, index) => { if (!prior.has(identity(item, index))) merged.push(item); });
      next[domain] = merged;
    } else {
      if (!canChange(domain, oldVisible, desired, account, previous, { trusted: trustedDomainSet.has(domain) })) throw forbidden(`Tidak dapat mengubah ${domain}.`);
      next[domain] = desired;
    }
    changedDomains.push(domain);
  }

  if (requestedNotifications) {
    const oldById = new Map((visible.notifications || []).map(item => [item.id, item]));
    const requestedById = new Map(requestedNotifications.map(item => [item.id, item]));
    if (requestedById.size !== requestedNotifications.length) throw forbidden('ID notifikasi duplikat.');
    const updated = (previous.notifications || []).map(item => {
      const old = oldById.get(item.id);
      const requested = requestedById.get(item.id);
      if (!old || !requested || equal(old, requested)) return item;
      if (item.userId !== account.id || !equal({ ...old, isRead: requested.isRead, readAt: requested.readAt }, requested)) throw forbidden('Notifikasi tidak dapat diubah.');
      return { ...item, isRead: requested.isRead, readAt: requested.readAt };
    });
    next.notifications = updated;
    changedDomains.push('notifications');
  }

  if (changedDomains.includes('drafts') || changedDomains.includes('fundedReviewAssignments')) {
    next.temporaryRoleAssignments = temporaryAssignmentsFor(next);
    changedDomains.push('temporaryRoleAssignments');
  }
  const deletedSchemes = (next.schemes || []).filter(scheme => scheme.deletedAt
    && !(previous.schemes || []).find(item => item.id === scheme.id && item.deletedAt));
  if (deletedSchemes.length) {
    const schemeIds = new Set(deletedSchemes.map(item => item.id));
    const draftIds = new Set((next.drafts || []).filter(item => schemeIds.has(item.schemeId)).map(item => item.id));
    const belongs = item => (item.entityType === 'scheme' && schemeIds.has(item.entityId))
      || draftIds.has(item.entityId) || draftIds.has(item.researchId);
    next.notifications = (next.notifications || []).filter(item => !belongs(item));
    next.emailOutbox = (next.emailOutbox || []).map(item => (belongs(item) && item.status === 'queued'
      ? {
        ...item, status: 'cancelled', updatedAt: new Date().toISOString(), errorMessage: null
      } : item));
    if (!changedDomains.includes('notifications')) changedDomains.push('notifications');
    changedDomains.push('emailOutbox');
  }
  const deletedExternalReportIds = new Set((previous.externalResearchReports || [])
    .filter(report => !(next.externalResearchReports || []).some(item => item.id === report.id))
    .map(report => report.id));
  if (deletedExternalReportIds.size) {
    const removedNotificationIds = new Set((next.notifications || [])
      .filter(item => item.entityType === 'external_research' && deletedExternalReportIds.has(item.entityId))
      .map(item => item.id));
    next.notifications = (next.notifications || []).filter(item => !(item.entityType === 'external_research' && deletedExternalReportIds.has(item.entityId)));
    next.notificationReadIds = (next.notificationReadIds || []).filter(id => !removedNotificationIds.has(id));
    next.emailOutbox = (next.emailOutbox || []).map(item => (
      item.entityType === 'external_research'
        && deletedExternalReportIds.has(item.entityId)
        && ['queued', 'failed'].includes(item.status)
        ? {
          ...item,
          status: 'cancelled',
          lockedAt: null,
          updatedAt: new Date().toISOString(),
        }
        : item
    ));
    if (!changedDomains.includes('notifications')) changedDomains.push('notifications');
    if (!changedDomains.includes('notificationReadIds')) changedDomains.push('notificationReadIds');
    if (!changedDomains.includes('emailOutbox')) changedDomains.push('emailOutbox');
  }
  if (changedDomains.includes('systemUsers')) {
    const existingIds = new Set((previous.systemUsers || []).map(item => item.id));
    (next.systemUsers || []).filter(item => !existingIds.has(item.id)).forEach(item => {
      if (typeof item.password !== 'string' || item.password.length < 12 || Buffer.byteLength(item.password) > 72
        || /^(password|password123|123456789012|change_before_deploy)$/i.test(item.password)
        || item.password.toLowerCase().includes(String(item.email || '').split('@')[0].toLowerCase())) {
        throw forbidden('Kata sandi awal harus 12-72 byte dan tidak boleh mudah ditebak.');
      }
    });
  }

  const submittedFileDomains = changedDomains.filter(domain => Object.prototype.hasOwnProperty.call(submitted, domain));
  const referencedFiles = new Set(submittedFileDomains.flatMap(domain => [...fileIdsIn(submitted[domain])]));
  if (referencedFiles.size && !['super_admin', 'manager'].includes(account.role)) {
    const previouslyVisible = fileIdsIn(visible);
    const introduced = [...referencedFiles].filter(id => !previouslyVisible.has(id));
    if (introduced.length) {
      const owned = await tx.stored_files.findMany({
        where: { id: { in: introduced }, owner_user_id: databaseUser.id, status: 'ready' },
        select: { id: true },
      });
      if (owned.length !== introduced.length) throw forbidden('Berkas yang ditautkan bukan milik akun ini.');
    }
  }

  if (!changedDomains.length) return { data: visible, version: revision.version };
  if (changedDomains.includes('systemUsers')) {
    const now = new Date().toISOString();
    const accountActions = (next.systemUsers || []).flatMap((item, index) => {
      const before = (previous.systemUsers || []).find(prior => prior.id === item.id);
      if (!before) return [];
      const action = !before.deletedAt && item.deletedAt ? 'account_delete'
        : before.isActive !== false && item.isActive === false ? 'account_deactivate'
          : before.isActive === false && item.isActive !== false ? 'account_activate' : null;
      if (!action) return [];
      const profile = (next.researcherProfiles || []).find(value => value.userId === item.id);
      return [{
        id: `account-action-${Date.now()}-${index}`,
        userId: account.id,
        action,
        entityType: 'researcher_profile',
        entityId: profile && profile.profileId,
        oldData: { isActive: before.isActive, deletedAt: before.deletedAt || null },
        newData: { isActive: item.isActive, deletedAt: item.deletedAt || null, reason: item.deactivationReason || null },
        createdAt: now,
      }];
    });
    if (accountActions.length) {
      next.systemActivityLogs = [...(previous.systemActivityLogs || []), ...accountActions];
      changedDomains.push('systemActivityLogs');
    }
  }
  const advanced = await tx.ris_revision.updateMany({ where: { id: 1, version: expectedVersion }, data: { version: { increment: 1 }, updated_at: new Date() } });
  if (advanced.count !== 1) throw conflict();
  if (changedDomains.some(domain => ['drafts', 'schemes', 'letterRequests', 'externalResearchReports', 'researcherProfiles', 'researcherDocuments', 'systemUsers', 'internalReports', 'monevRecords', 'reviewerReminders', 'fundedReviewerReminders', 'fundedReviewAssignments', 'fundedReviews'].includes(domain))) {
    require('@babel/register')({ envName: 'test' });
    const { appendWorkflowNotifications } = require('../../app/containers/Ris/shared/workflows/notificationWorkflow');
    const generated = appendWorkflowNotifications(previous, appendServerEvents(previous, next, account), account);
    next.notifications = generated.notifications;
    next.emailOutbox = generated.emailOutbox;
    if (!changedDomains.includes('notifications')) changedDomains.push('notifications');
    changedDomains.push('emailOutbox');
  }
  await synchronize(tx, previous, next, databaseUser);
  if (changedDomains.includes('systemUsers')) {
    next.systemUsers = next.systemUsers.map(item => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'password' && key !== 'passwordHash')));
  }
  for (const domain of changedDomains) {
    if (Array.isArray(next[domain])) await persistArray(tx, domain, previous[domain], next[domain]);
    else await saveEntry(tx, domain, VALUE_ID, next[domain], 0);
  }
  // New events enter the durable outbox inside this same business transaction.
  // The PostgreSQL wake signal is emitted only when this transaction commits.
  const previousKeys = new Set((previous.emailOutbox || []).map(item => item.deduplicationKey).filter(Boolean));
  const additions = (next.emailOutbox || []).filter(item => item.status === 'queued'
    && item.deduplicationKey && !previousKeys.has(item.deduplicationKey));
  if (additions.length) await emailOutboxModel.enqueueInPrismaTransaction(tx, additions);
  return { data: JSON.parse(JSON.stringify(projectState(next, account))), version: expectedVersion + 1 };
}, { timeout: 30000 });

module.exports = { saveState };
