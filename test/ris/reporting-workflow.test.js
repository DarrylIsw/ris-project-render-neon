const assert = require('assert');
const {
  REPORT_TYPE,
  WINDOW_STATE,
  canSubmitInternalReport,
  getRegistrationState,
  getWindowState,
  sortReportingSchedule,
  validateReportingSchedule,
} = require('../../app/containers/Ris/features/research/workflows/reportingWorkflow');
const { ROLE, STATUS } = require('../../app/containers/Ris/shared/workflows/workflow');

const owner = { id: 'researcher-1', role: ROLE.LECTURER };
const approvedDraft = { id: 'draft-1', userId: owner.id, status: STATUS.FUNDED };

describe('RIS reporting deadlines', () => {
  const now = new Date('2026-07-16T05:00:00.000Z');

  it('calculates upcoming, open, and closed windows deterministically', () => {
    assert.strictEqual(getWindowState({ openAt: '2026-07-17T00:00:00.000Z', dueAt: '2026-07-18T00:00:00.000Z' }, now), WINDOW_STATE.UPCOMING);
    assert.strictEqual(getWindowState({ openAt: '2026-07-15T00:00:00.000Z', dueAt: '2026-07-17T00:00:00.000Z' }, now), WINDOW_STATE.OPEN);
    assert.strictEqual(getWindowState({ openAt: '2026-07-14T00:00:00.000Z', dueAt: '2026-07-15T00:00:00.000Z' }, now), WINDOW_STATE.CLOSED);
  });

  it('allows only the funded research owner to submit during an open period', () => {
    const period = { openAt: '2026-07-15T00:00:00.000Z', dueAt: '2026-07-17T00:00:00.000Z' };
    assert.strictEqual(canSubmitInternalReport(approvedDraft, period, owner, now), true);
    assert.strictEqual(canSubmitInternalReport({ ...approvedDraft, userId: 'other' }, period, owner, now), false);
    assert.strictEqual(canSubmitInternalReport({ ...approvedDraft, status: STATUS.SUBMITTED }, period, owner, now), false);
  });

  it('uses registration dates in addition to scheme publication status', () => {
    const scheme = { status: 'open', registrationStartDate: '2026-07-15T00:00:00.000Z', registrationEndDate: '2026-07-17T00:00:00.000Z' };
    assert.strictEqual(getRegistrationState(scheme, now), WINDOW_STATE.OPEN);
  });

  it('sorts Monev periods before final and output reports', () => {
    const sorted = sortReportingSchedule([
      { id: 'output', type: REPORT_TYPE.OUTPUT },
      { id: 'final', type: REPORT_TYPE.FINAL },
      { id: 'interim', type: REPORT_TYPE.INTERIM },
    ]);
    assert.deepStrictEqual(sorted.map(item => item.id), ['interim', 'final', 'output']);
  });

  it('requires exactly one final report while allowing flexible Monev and output periods', () => {
    const period = type => ({
      type, label: `Report ${type}`, openAt: '2026-07-15T00:00', dueAt: '2026-07-17T00:00'
    });
    assert.match(validateReportingSchedule([period(REPORT_TYPE.INTERIM)]), /Laporan Akhir/);
    assert.match(validateReportingSchedule([period(REPORT_TYPE.FINAL), period(REPORT_TYPE.FINAL)]), /hanya boleh/);
    assert.strictEqual(validateReportingSchedule([period(REPORT_TYPE.FINAL)]), '');
    assert.strictEqual(validateReportingSchedule([period(REPORT_TYPE.INTERIM), period(REPORT_TYPE.FINAL), period(REPORT_TYPE.OUTPUT)]), '');
  });
});
