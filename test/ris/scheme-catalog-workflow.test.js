/* eslint-disable object-curly-newline, object-property-newline */
const assert = require('assert');
const { createInitialData, normalizeRisData } = require('../../app/containers/Ris/core/data');
const {
  canDeleteProposalDraft,
  deleteProposalDraftData,
  getSchemeCatalogMetrics,
  partitionSchemeCatalog,
} = require('../../app/containers/Ris/features/research/workflows/schemeCatalogWorkflow');

describe('RIS lecturer scheme catalog', () => {
  const findLecturer = data => data.systemUsers.find(user => user.id === 'user-lecturer');

  it('partitions shared schemes into draft, application, eligible, and catalog sections', () => {
    const data = createInitialData();
    const user = findLecturer(data);
    const sections = partitionSchemeCatalog(data.schemes, data, user);
    const sectionSchemeIds = key => sections[key].map(item => item.scheme.id);

    assert.ok(sectionSchemeIds('drafts').includes('scheme-demo-draft-2026'));
    assert.ok(sectionSchemeIds('eligible').includes('scheme-demo-output-2026'));
    assert.ok(sectionSchemeIds('eligible').includes('scheme-demo-clean-2026'));
    assert.ok(sectionSchemeIds('catalog').includes('scheme-demo-catalog-2026'));
    assert.ok(!data.drafts.some(item => item.schemeId === 'scheme-demo-clean-2026'));
    assert.ok(!sectionSchemeIds('applications').includes('scheme-1'));

    const allIds = Object.keys(sections).reduce((ids, key) => [...ids, ...sectionSchemeIds(key)], []);
    assert.strictEqual(new Set(allIds).size, data.schemes.length - 1);
  });

  it('counts funded proposals separately from ready schemes', () => {
    const data = createInitialData();
    const metrics = getSchemeCatalogMetrics(data, findLecturer(data));

    assert.strictEqual(metrics.funded, 1);
    assert.ok(metrics.ready >= 1);
    assert.ok(metrics.applications >= 1);
  });

  it('deletes only an owned draft and cleans its dependent working data', () => {
    const data = createInitialData();
    const user = findLecturer(data);
    const draft = data.drafts.find(item => item.id === 'draft-demo-saved');
    const withDependencies = {
      ...data,
      logbooks: [...data.logbooks, { id: 'log-draft', researchId: draft.id }],
      internalReports: [{ id: 'report-draft', researchId: draft.id }],
      monevRecords: [{ id: 'monev-draft', researchId: draft.id }],
      temporaryRoleAssignments: [...data.temporaryRoleAssignments, { id: 'grant-draft', entityId: draft.id }],
      notifications: [{ id: 'notice-draft', entityId: draft.id }],
    };

    assert.strictEqual(canDeleteProposalDraft(draft, user), true);
    assert.strictEqual(canDeleteProposalDraft(data.drafts.find(item => item.id === 'draft-approved'), user), false);

    const next = deleteProposalDraftData(withDependencies, draft);
    assert.ok(!next.drafts.some(item => item.id === draft.id));
    assert.ok(!next.logbooks.some(item => item.researchId === draft.id));
    assert.ok(!next.internalReports.some(item => item.researchId === draft.id));
    assert.ok(!next.monevRecords.some(item => item.researchId === draft.id));
    assert.ok(!next.temporaryRoleAssignments.some(item => item.entityId === draft.id));
    assert.ok(!next.notifications.some(item => item.entityId === draft.id));
  });

  it('does not restore a deleted demo draft after its seed version is recorded', () => {
    const data = createInitialData();
    const withoutDraft = {
      ...data,
      drafts: data.drafts.filter(item => item.id !== 'draft-demo-saved'),
      catalogDemoSeedVersion: 1,
    };
    const normalized = normalizeRisData(withoutDraft);
    assert.ok(!normalized.drafts.some(item => item.id === 'draft-demo-saved'));
  });
});
