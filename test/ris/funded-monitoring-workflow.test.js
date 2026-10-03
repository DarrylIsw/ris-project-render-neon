/* eslint-disable object-curly-newline, object-property-newline */
const assert = require('assert');
const { fundedMonitoringRow } = require('../../app/containers/Ris/features/research/workflows/fundedMonitoringWorkflow');
const { FUNDED_MONITORING_TABS, getSchemeDataTabs, getSchemeDataProgress } = require('../../app/containers/Ris/features/research/workflows/schemeDataWorkflow');
const { ROLE, ADMIN_SCOPE } = require('../../app/containers/Ris/shared/workflows/workflow');

const now = new Date('2026-09-16T12:00:00Z');
const period = (id, type, dueAt = '2026-10-01T12:00:00Z') => ({ id, type, label: id, openAt: '2026-09-01T00:00:00Z', dueAt });
const draft = { id: 'research', userId: 'lecturer', schemeId: 'scheme', project: { title: 'Research', year: 2026 }, outputs: [{ id: 'required' }, { id: 'additional' }] };
const scheme = { id: 'scheme', name: 'Scheme', reportingSchedule: [period('interim-1', 'interim'), period('interim-2', 'interim'), period('final', 'final'), period('output', 'output')] };
const data = { schemes: [scheme], internalReports: [], monevRecords: [], fundedReviewAssignments: [] };
const report = (id, periodId, status = 'submitted', outputId = null) => ({ id, researchId: draft.id, periodId, status, outputId });

describe('Funded research monitoring partitions', () => {
  it('keeps Monev independent from the final-report obligation', () => {
    const state = {
      ...data,
      internalReports: [report('legacy-interim', 'interim-1'), report('r2', 'final')],
      monevRecords: [{ id: 'm1', researchId: 'research', periodId: 'interim-1', status: 'submitted' }],
    };
    const monev = fundedMonitoringRow(state, draft, 'monev', now);
    const final = fundedMonitoringRow(state, draft, 'final-report', now);
    assert.strictEqual(monev.reportsRequired, 0);
    assert.strictEqual(monev.reportsComplete, 0);
    assert.strictEqual(monev.monevRequired, 2);
    assert.strictEqual(monev.monevComplete, 1);
    assert.strictEqual(final.required, 1);
    assert.strictEqual(final.completed, 1);
    assert.strictEqual(final.status, 'complete');
  });

  it('tracks each required and additional output independently', () => {
    const state = { ...data, internalReports: [report('r1', 'output', 'accepted', 'required'), report('r2', 'output', 'draft', 'additional')] };
    const row = fundedMonitoringRow(state, draft, 'output-report', now);
    assert.strictEqual(row.reportsRequired, 2);
    assert.strictEqual(row.reportsComplete, 1);
    assert.strictEqual(row.status, 'pending');
    assert.strictEqual(fundedMonitoringRow(data, { ...draft, outputs: [] }, 'output-report', now).status, 'unconfigured');
  });

  it('counts accepted and under-review submissions without mixing reviewer targets', () => {
    const state = {
      ...data,
      internalReports: [report('final-report', 'final', 'accepted')],
      monevRecords: [{ id: 'monev-result', researchId: 'research', periodId: 'interim-1', status: 'submitted' }],
      fundedReviewAssignments: [
        { researchId: 'research', targetId: 'monev-result', targetType: 'monev', status: 'assigned' },
        { researchId: 'research', targetId: 'monev-result', targetType: 'monev', status: 'revoked' },
        { researchId: 'research', targetId: 'final-report', targetType: 'report', status: 'submitted' },
        { researchId: 'other', targetId: 'monev-result', targetType: 'monev', status: 'assigned' },
      ],
    };
    const monev = fundedMonitoringRow(state, draft, 'monev', now);
    const final = fundedMonitoringRow(state, draft, 'final-report', now);
    assert.strictEqual(monev.pendingReviews, 1);
    assert.strictEqual(monev.reviewCount, 1);
    assert.strictEqual(final.pendingReviews, 0);
    assert.strictEqual(final.reviewCount, 1);
    assert.strictEqual(getSchemeDataProgress(state, draft, scheme).reports.completed, 1);
  });

  it('updates overdue status when an administrator extends a reporting deadline', () => {
    const expired = { ...scheme, reportingSchedule: [period('final', 'final', '2026-09-10T12:00:00Z')] };
    const before = fundedMonitoringRow({ ...data, schemes: [expired] }, draft, 'final-report', now);
    const after = fundedMonitoringRow(data, draft, 'final-report', now);
    assert.strictEqual(before.status, 'overdue');
    assert.strictEqual(after.status, 'pending');
    assert.strictEqual(after.deadline, '2026-10-01T12:00:00Z');
    assert.strictEqual(fundedMonitoringRow({ ...data, schemes: [expired], internalReports: [report('r', 'final')] }, draft, 'final-report', now).status, 'complete');
  });

  it('does not invent obligations for a scheme with no configured periods', () => {
    const row = fundedMonitoringRow({ ...data, schemes: [{ id: 'scheme', reportingSchedule: [] }] }, draft, 'monev', now);
    assert.strictEqual(row.required, 0);
    assert.strictEqual(row.status, 'unconfigured');
    assert.strictEqual(row.deadline, '');
  });

  it('tracks legacy and current contract signatures', () => {
    assert.strictEqual(fundedMonitoringRow(data, draft, 'contract', now).status, 'pending');
    assert.strictEqual(fundedMonitoringRow(data, { ...draft, contract: { contractStatus: 'signed' } }, 'contract', now).status, 'complete');
    assert.strictEqual(fundedMonitoringRow(data, { ...draft, contract: { status: 'signed' } }, 'contract', now).completed, 1);
  });

  it('removes the activity tab for every role', () => {
    assert.deepStrictEqual(FUNDED_MONITORING_TABS.map(tab => tab.value), ['overview', 'contract', 'monev', 'final-report', 'output-report']);
    [
      { role: ROLE.SUPER_ADMIN },
      { role: ROLE.MANAGER },
      { role: ROLE.ADMIN, adminScopes: [ADMIN_SCOPE.RESEARCH] },
    ].forEach(user => assert.strictEqual(getSchemeDataTabs(user).some(tab => tab.value === 'logbook'), false));
    [
      { role: ROLE.LECTURER },
      { role: ROLE.MANAGER, managerMode: 'lecturer' },
    ].forEach(user => assert.strictEqual(getSchemeDataTabs(user).some(tab => tab.value === 'logbook'), false));
  });
});
