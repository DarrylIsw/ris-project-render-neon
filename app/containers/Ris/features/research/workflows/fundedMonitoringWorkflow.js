/* eslint-disable object-curly-newline, object-property-newline */
import { getWindowState, REPORT_TYPE, WINDOW_STATE } from './reportingWorkflow';
import {
  getMonevPeriods, getOutputReportPeriods, getProgressReportPeriods,
  internalReportFor, isReportSubmitted, monevForPeriod, SCHEME_DATA_TAB,
} from './schemeDataWorkflow';
import { getSchemeTitle } from '../../../shared/workflows/workflow';

export const MONITORING_STATUS = {
  unconfigured: { label: 'Belum Ada Kebutuhan', tone: 'gray' },
  pending: { label: 'Belum Lengkap', tone: 'yellow' },
  overdue: { label: 'Tenggat Terlewati', tone: 'red' },
  complete: { label: 'Lengkap', tone: 'green' },
};

// Build per-research obligations from the actual scheme periods and selected outputs.
export const fundedMonitoringRow = (data, draft, tab, now = new Date()) => {
  const scheme = (data.schemes || []).find(item => item.id === draft.schemeId) || {};
  const owner = (data.systemUsers || []).find(item => item.id === draft.userId);
  const contract = draft.contract || {};
  const signed = Boolean(contract.lecturerSignedFile || contract.signedFile || ['signed', 'completed'].includes(contract.status || contract.contractStatus));
  const isMonev = tab === SCHEME_DATA_TAB.MONEV;
  const isContract = tab === SCHEME_DATA_TAB.CONTRACT;
  const periods = isMonev ? getMonevPeriods(scheme) : tab === SCHEME_DATA_TAB.OUTPUT_REPORT
    ? getOutputReportPeriods(scheme) : getProgressReportPeriods(scheme).filter(period => period.type === REPORT_TYPE.FINAL);
  const obligations = isContract || isMonev ? [] : periods.flatMap(period => {
    const outputs = tab === SCHEME_DATA_TAB.OUTPUT_REPORT ? (draft.outputs || []) : [null];
    return outputs.map(output => ({
      period,
      report: internalReportFor(data.internalReports, draft.id, period.id, output && output.id),
    }));
  });
  const monev = isMonev ? periods.map(period => ({ period, record: monevForPeriod(data.monevRecords, draft.id, period.id) })) : [];
  const reportsComplete = obligations.filter(item => isReportSubmitted(item.report)).length;
  const monevComplete = monev.filter(item => item.record && item.record.status === 'submitted').length;
  const required = isContract ? 1 : obligations.length + monev.length;
  const completed = isContract ? Number(signed) : reportsComplete + monevComplete;
  const pendingPeriods = [
    ...obligations.filter(item => !isReportSubmitted(item.report)).map(item => item.period),
    ...monev.filter(item => !item.record || item.record.status !== 'submitted').map(item => item.period),
  ];
  const overdue = pendingPeriods.some(period => getWindowState(period, now) === WINDOW_STATE.CLOSED);
  const deadlines = pendingPeriods.map(period => period.dueAt).filter(Boolean).sort((a, b) => new Date(a) - new Date(b));
  const targets = [
    ...obligations.filter(item => isReportSubmitted(item.report)).map(item => ({ type: 'report', id: item.report.id })),
    ...monev.filter(item => item.record && item.record.status === 'submitted').map(item => ({ type: 'monev', id: item.record.id })),
  ];
  const assignments = (data.fundedReviewAssignments || []).filter(item => (
    item.researchId === draft.id && item.status !== 'revoked'
    && targets.some(target => target.id === item.targetId && target.type === item.targetType)
  ));
  return {
    draft, scheme, contract, signed,
    ownerName: (owner && owner.name) || draft.userName || '-',
    schemeTitle: getSchemeTitle(scheme),
    year: String((draft.project && draft.project.year) || scheme.year || (scheme.startDate || '').slice(0, 4) || '-'),
    reportsRequired: obligations.length, reportsComplete,
    monevRequired: monev.length, monevComplete,
    required, completed,
    status: !required ? 'unconfigured' : completed === required ? 'complete' : overdue ? 'overdue' : 'pending',
    deadline: deadlines[0] || '',
    reviewCount: assignments.length,
    pendingReviews: assignments.filter(item => item.status !== 'submitted').length,
  };
};
