/* eslint-disable object-curly-newline, object-property-newline */
const assert = require('assert');
const { createInitialData, normalizeRisData } = require('../../app/containers/Ris/core/data');
const {
  canAccessSchemeData,
  getFundedResearches,
  getMonevPeriods,
  getOutputReportPeriods,
  getProgressReportPeriods,
  getSchemeDataProgress,
  hasFundedResearch,
  internalReportFor,
  monevForPeriod,
} = require('../../app/containers/Ris/features/research/workflows/schemeDataWorkflow');

describe('RIS funded research data workspace', () => {
  it('uses the existing funded proposal as shared demo data with role-aware visibility', () => {
    const data = createInitialData();
    const lecturer = data.systemUsers.find(user => user.id === 'user-lecturer');
    const otherLecturer = data.systemUsers.find(user => user.id === 'user-lecturer-2');
    const manager = data.systemUsers.find(user => user.id === 'user-manager');
    const funded = data.drafts.find(draft => draft.id === 'draft-approved');

    assert.deepStrictEqual(getFundedResearches(data, lecturer).map(draft => draft.id), ['draft-approved']);
    assert.strictEqual(hasFundedResearch(data, lecturer), true);
    assert.strictEqual(getFundedResearches(data, otherLecturer).length, 0);
    assert.strictEqual(canAccessSchemeData(funded, lecturer), true);
    assert.strictEqual(canAccessSchemeData(funded, otherLecturer), false);
    assert.strictEqual(canAccessSchemeData(funded, manager), true);
    assert.deepStrictEqual(funded.outputs.map(output => output.type), ['wajib', 'tambahan']);
  });

  it('derives Monev, final, and output work from the administrator schedule', () => {
    const data = createInitialData();
    const scheme = data.schemes.find(item => item.id === 'scheme-1');
    const monev = getMonevPeriods(scheme);
    const progress = getProgressReportPeriods(scheme);
    const outputs = getOutputReportPeriods(scheme);

    assert.strictEqual(monev.length, 2);
    assert.strictEqual(progress.filter(period => period.type === 'interim').length, 0);
    assert.strictEqual(progress.filter(period => period.type === 'final').length, 1);
    assert.strictEqual(outputs.length, 1);
  });

  it('tracks reports per output and Monev per reporting period', () => {
    const reports = [
      { id: 'report-a', researchId: 'research-1', periodId: 'output-period', outputId: 'output-a' },
      { id: 'report-b', researchId: 'research-1', periodId: 'output-period', outputId: 'output-b' },
    ];
    const monev = [{ id: 'monev-a', researchId: 'research-1', periodId: 'interim-1' }];

    assert.strictEqual(internalReportFor(reports, 'research-1', 'output-period', 'output-b').id, 'report-b');
    assert.strictEqual(monevForPeriod(monev, 'research-1', 'interim-1').id, 'monev-a');
  });

  it('preserves Monev records through prototype data normalization', () => {
    const initial = createInitialData();
    const normalized = normalizeRisData({
      ...initial,
      monevRecords: [{ id: 'monev-demo', researchId: 'draft-approved', periodId: 'scheme-1-interim-1' }],
    });
    assert.strictEqual(normalized.monevRecords[0].id, 'monev-demo');
  });

  it('summarizes monitoring completeness across contract, Monev, reports, and outputs', () => {
    const data = createInitialData();
    const draft = data.drafts.find(item => item.id === 'draft-approved');
    const scheme = data.schemes.find(item => item.id === draft.schemeId);
    const emptyData = { ...data, internalReports: [], monevRecords: [] };
    const empty = getSchemeDataProgress(emptyData, draft, scheme);
    assert.strictEqual(empty.required, 6);
    assert.strictEqual(empty.completed, 0);
    assert.strictEqual(empty.status, 'not_started');

    const firstMonev = getMonevPeriods(scheme)[0];
    const firstReport = getProgressReportPeriods(scheme)[0];
    const progressed = getSchemeDataProgress({
      ...data,
      drafts: data.drafts.map(item => (item.id === draft.id ? { ...item, contract: { status: 'signed' } } : item)),
      monevRecords: [{ researchId: draft.id, periodId: firstMonev.id, status: 'submitted' }],
      internalReports: [{ researchId: draft.id, periodId: firstReport.id, outputId: null, status: 'submitted' }],
    }, { ...draft, contract: { status: 'signed' } }, scheme);
    assert.strictEqual(progressed.completed, 3);
    assert.strictEqual(progressed.status, 'in_progress');
    assert.strictEqual(progressed.percentage, 50);
  });
});
