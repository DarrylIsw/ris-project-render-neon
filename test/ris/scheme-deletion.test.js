/* eslint-disable object-curly-newline, object-property-newline */
const assert = require('assert');
const { createInitialData, normalizeRisData } = require('../../app/containers/Ris/core/data');
const { buildResearchArchiveRecords } = require('../../app/containers/Ris/features/archive/workflows/archiveWorkflow');
const {
  deleteResearchSchemeData, getSchemeDeletionError, getSchemeCatalogMetrics, getUserDrafts, partitionSchemeCatalog,
} = require('../../app/containers/Ris/features/research/workflows/schemeCatalogWorkflow');
const {
  STATUS, canAssignReviewer, canDecideDraft, canEditDraft, canScoreDraft, canVerifyDraft,
  draftStatus, isEligibleForScheme, isOpenScheme, transitionDraftStatus,
} = require('../../app/containers/Ris/shared/workflows/workflow');

const uid = prefix => `${prefix}-delete-test`;
const actor = data => data.systemUsers.find(user => user.id === 'user-super-admin');
const remove = (data, id, user = actor(data)) => deleteResearchSchemeData(data, id, user, uid);
const emptySchemeId = 'scheme-demo-clean-2026';

describe('RIS scheme deletion and proposal archival', () => {
  it('allows authorized management roles, but rejects lecturers and other admin scopes', () => {
    const data = createInitialData();
    ['user-super-admin', 'user-admin', 'user-manager'].forEach(id => {
      const user = data.systemUsers.find(item => item.id === id);
      assert.ok(remove(data, emptySchemeId, user).schemes.find(item => item.id === emptySchemeId).deletedAt);
    });
    const denied = [
      data.systemUsers.find(item => item.id === 'user-lecturer'),
      { ...data.systemUsers.find(item => item.id === 'user-manager'), managerMode: 'lecturer' },
      { id: 'admin-letter', role: 'admin', adminScopes: ['letter_management'] },
      { id: 'admin-profile', role: 'admin', adminScopes: ['researcher_profile_management'] },
    ];
    denied.forEach(user => assert.throws(() => remove(data, emptySchemeId, user), /akses/));
    assert.throws(() => remove(data, 'missing'), /tidak ditemukan/);
  });

  it('removes an unused scheme from active catalogs and keeps it deleted after reload', () => {
    const data = createInitialData();
    const user = data.systemUsers.find(item => item.id === 'user-lecturer');
    const original = JSON.stringify(data);
    const deleted = remove(data, emptySchemeId);
    assert.strictEqual(JSON.stringify(data), original);
    const normalized = normalizeRisData(JSON.parse(JSON.stringify(deleted)));
    const scheme = normalized.schemes.find(item => item.id === emptySchemeId);
    assert.ok(scheme.deletedAt);
    assert.strictEqual(scheme.deletedBy, actor(data).id);
    assert.strictEqual(isOpenScheme(scheme), false);
    assert.strictEqual(isEligibleForScheme(scheme, actor(data)), false);
    const sections = partitionSchemeCatalog(normalized.schemes, normalized, user);
    assert.ok(Object.values(sections).every(items => items.every(item => item.scheme.id !== emptySchemeId)));
    assert.strictEqual(getSchemeCatalogMetrics(deleted, user).opened, getSchemeCatalogMetrics(data, user).opened - 1);
    assert.throws(() => remove(normalized, emptySchemeId), /sudah dihapus/);
    assert.strictEqual(deleted.systemActivityLogs.slice(-1)[0].action, 'delete_research_scheme');
  });

  it('archives every unfunded proposal state without losing content or archive references', () => {
    const data = createInitialData();
    const template = data.drafts.find(item => item.id === 'draft-demo-saved');
    const states = [STATUS.DRAFT, STATUS.SUBMITTED, STATUS.UNDER_REVIEW, STATUS.REVIEWED, STATUS.REVISION, STATUS.REJECTED];
    data.drafts = states.map((status, index) => ({ ...template, id: `proposal-${index}`, status, schemeId: emptySchemeId, archiveMetadata: { notes: 'Keep this note' } }));
    const deleted = remove(data, emptySchemeId);
    const archive = buildResearchArchiveRecords(deleted);
    deleted.drafts.forEach((draft, index) => {
      const before = data.drafts[index];
      assert.strictEqual(draftStatus(draft), STATUS.ARCHIVED);
      assert.strictEqual(draft.archiveMetadata.previousStatus, before.status);
      assert.strictEqual(draft.archiveMetadata.notes, 'Keep this note');
      assert.strictEqual(draft.archiveMetadata.reason, 'scheme_deleted');
      ['project', 'members', 'budgets', 'outputs', 'files', 'reviews'].forEach(key => assert.deepStrictEqual(draft[key], before[key]));
      const record = archive.find(item => item.id === draft.id);
      assert.strictEqual(record.statusMeta.label, 'Diarsipkan');
      assert.strictEqual(record.scheme.id, emptySchemeId);
      assert.strictEqual(canVerifyDraft(draft, actor(data)), false);
      assert.strictEqual(Boolean(canAssignReviewer(draft, actor(data))), false);
      assert.strictEqual(canDecideDraft(draft, actor(data)), false);
      assert.strictEqual(canEditDraft(draft, actor(data)), false);
      assert.strictEqual(transitionDraftStatus(draft, STATUS.SUBMITTED), null);
    });
    assert.deepStrictEqual(getUserDrafts(deleted, data.systemUsers.find(user => user.id === template.userId)), []);
  });

  it('revokes proposal reviewer assignments and preserves historical scoring after reload', () => {
    const data = createInitialData();
    const draft = data.drafts.find(item => item.id === 'draft-assigned');
    const deleted = remove(data, draft.schemeId);
    const normalized = normalizeRisData(deleted);
    const archived = normalized.drafts.find(item => item.id === draft.id);
    assert.ok(archived.assignments.length > 0);
    assert.ok(archived.assignments.every(item => item.status === 'revoked' && item.revokedAt));
    assert.ok(normalized.temporaryRoleAssignments.filter(item => item.entityId === draft.id).every(item => item.status === 'revoked'));
    assert.strictEqual(canScoreDraft(archived, data.systemUsers.find(user => user.id === 'user-lecturer-2')), false);
    assert.deepStrictEqual(archived.reviews, normalizeRisData(data).drafts.find(item => item.id === draft.id).reviews);
    assert.strictEqual(draftStatus({ ...archived, status: STATUS.FUNDED }), STATUS.ARCHIVED);
  });

  it('blocks deletion if any proposal has been funded, including funding evidence and legacy states', () => {
    const data = createInitialData();
    const original = JSON.stringify(data);
    assert.throws(() => remove(data, 'scheme-1'), /didanai/);
    assert.strictEqual(JSON.stringify(data), original);
    const indicators = [
      { status: 'approved' }, { status: STATUS.FUNDED },
      { status: STATUS.REVISION, fundedAt: '2026-09-17T00:00:00.000Z' },
      { status: STATUS.REVISION, fundingLetter: { number: '001' } },
      { status: STATUS.REVISION, decision: { finalDecision: 'funded' } },
      { status: STATUS.REVISION, decisionHistory: [{ finalDecision: 'funded' }] },
    ];
    indicators.forEach(indicator => {
      const updated = { ...data, drafts: [...data.drafts, { id: 'new-funding', schemeId: emptySchemeId, ...indicator }] };
      assert.ok(getSchemeDeletionError(updated, emptySchemeId));
      assert.throws(() => remove(updated, emptySchemeId), /didanai/);
    });
    assert.throws(() => remove({ ...data, fundedResearch: [{ schemeId: emptySchemeId }] }, emptySchemeId), /didanai/);
  });

  it('cancels obsolete queued mail and removes stale notifications without touching unrelated data', () => {
    const data = createInitialData();
    const draft = data.drafts.find(item => item.id === 'draft-demo-saved');
    data.notifications = [{ id: 'related', entityId: draft.id }, { id: 'keep', entityId: 'other' }];
    data.emailOutbox = [
      { id: 'pending', entityId: draft.id, status: 'queued' },
      { id: 'scheme', entityType: 'scheme', entityId: draft.schemeId, status: 'queued' },
      { id: 'sent', entityId: draft.id, status: 'sent' },
      { id: 'other', entityId: 'other', status: 'queued' },
    ];
    const deleted = remove(data, draft.schemeId);
    assert.deepStrictEqual(deleted.notifications.map(item => item.id), ['keep']);
    assert.deepStrictEqual(deleted.emailOutbox.map(item => item.status), ['cancelled', 'cancelled', 'sent', 'queued']);
    assert.deepStrictEqual(deleted.internalReports, data.internalReports);
    assert.deepStrictEqual(deleted.logbooks, data.logbooks);
    assert.strictEqual(deleted.drafts.find(item => item.id === 'draft-approved'), data.drafts.find(item => item.id === 'draft-approved'));
  });
});
