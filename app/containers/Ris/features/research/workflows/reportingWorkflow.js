/* eslint-disable object-curly-newline, object-property-newline */
import { STATUS, canManageResearch, draftStatus, isDraftOwner, isResearcher } from '../../../shared/workflows/workflow';

export const REPORT_TYPE = {
  INTERIM: 'interim',
  FINAL: 'final',
  OUTPUT: 'output',
};

export const REPORT_TYPE_LABEL = {
  [REPORT_TYPE.INTERIM]: 'Monev',
  [REPORT_TYPE.FINAL]: 'Laporan Akhir',
  [REPORT_TYPE.OUTPUT]: 'Laporan Luaran',
};

export const REPORT_TYPE_OPTIONS = [
  { value: REPORT_TYPE.INTERIM, label: REPORT_TYPE_LABEL[REPORT_TYPE.INTERIM] },
  { value: REPORT_TYPE.FINAL, label: REPORT_TYPE_LABEL[REPORT_TYPE.FINAL] },
  { value: REPORT_TYPE.OUTPUT, label: REPORT_TYPE_LABEL[REPORT_TYPE.OUTPUT] },
];

export const WINDOW_STATE = {
  UPCOMING: 'upcoming',
  OPEN: 'open',
  CLOSED: 'closed',
};

const parseDate = value => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const pad = value => String(value).padStart(2, '0');

export const toDateTimeInput = value => {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const atStartOfDay = value => parseDate(value && value.length === 10 ? `${value}T00:00` : value);
const atEndOfDay = value => parseDate(value && value.length === 10 ? `${value}T23:59` : value);

const addDays = (date, days) => {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

const interpolateDate = (start, end, ratio) => new Date(start.getTime() + ((end.getTime() - start.getTime()) * ratio));

export const createDefaultReportingSchedule = scheme => {
  const start = atStartOfDay(scheme && scheme.startDate) || new Date();
  const end = atEndOfDay(scheme && scheme.endDate) || addDays(start, 365);
  const firstDue = interpolateDate(start, end, 0.35);
  const secondOpen = addDays(firstDue, 1);
  const secondDue = interpolateDate(start, end, 0.7);
  const finalOpen = addDays(end, -30);
  const outputDue = addDays(end, 90);
  const schemeId = (scheme && scheme.id) || 'scheme';

  return [
    { id: `${schemeId}-interim-1`, type: REPORT_TYPE.INTERIM, label: 'Monev Periode 1', openAt: toDateTimeInput(start), dueAt: toDateTimeInput(firstDue), extensions: [] },
    { id: `${schemeId}-interim-2`, type: REPORT_TYPE.INTERIM, label: 'Monev Periode 2', openAt: toDateTimeInput(secondOpen), dueAt: toDateTimeInput(secondDue), extensions: [] },
    { id: `${schemeId}-final`, type: REPORT_TYPE.FINAL, label: 'Laporan Akhir', openAt: toDateTimeInput(finalOpen), dueAt: toDateTimeInput(end), extensions: [] },
    { id: `${schemeId}-output`, type: REPORT_TYPE.OUTPUT, label: 'Laporan Luaran', openAt: toDateTimeInput(finalOpen), dueAt: toDateTimeInput(outputDue), extensions: [] },
  ];
};

export const normalizeReportingSchedule = scheme => {
  const periods = scheme && Array.isArray(scheme.reportingSchedule) && scheme.reportingSchedule.length
    ? scheme.reportingSchedule
    : createDefaultReportingSchedule(scheme);
  return periods.map((period, index) => ({
    id: period.id || `${scheme.id}-${period.type || REPORT_TYPE.INTERIM}-${index + 1}`,
    type: period.type || REPORT_TYPE.INTERIM,
    label: period.type === REPORT_TYPE.INTERIM && /^Laporan Sementara/i.test(period.label || '')
      ? String(period.label).replace(/^Laporan Sementara/i, 'Monev')
      : period.label || `${REPORT_TYPE_LABEL[period.type] || REPORT_TYPE_LABEL[REPORT_TYPE.INTERIM]} ${index + 1}`,
    openAt: period.openAt || period.open_at || '',
    dueAt: period.dueAt || period.due_at || '',
    extensions: Array.isArray(period.extensions) ? period.extensions : [],
  }));
};

export const validateReportingSchedule = periods => {
  const schedule = Array.isArray(periods) ? periods : [];
  const finalPeriods = schedule.filter(period => period.type === REPORT_TYPE.FINAL);
  if (finalPeriods.length === 0) return 'Tambahkan satu Laporan Akhir sebelum menyimpan skema.';
  if (finalPeriods.length > 1) return 'Laporan Akhir hanya boleh dibuat satu kali.';
  if (schedule.some(period => !REPORT_TYPE_OPTIONS.some(option => option.value === period.type))) return 'Pilih jenis untuk setiap laporan.';
  if (schedule.some(period => !String(period.label || '').trim() || !period.openAt || !period.dueAt)) return 'Setiap laporan wajib memiliki nama, waktu buka, dan tenggat.';
  if (schedule.some(period => new Date(period.dueAt) < new Date(period.openAt))) return 'Tenggat laporan tidak boleh lebih awal dari waktu buka.';
  return '';
};

export const getWindowState = (period, now = new Date()) => {
  const openAt = parseDate(period && period.openAt);
  const dueAt = parseDate(period && period.dueAt);
  if (openAt && now < openAt) return WINDOW_STATE.UPCOMING;
  if (dueAt && now > dueAt) return WINDOW_STATE.CLOSED;
  return WINDOW_STATE.OPEN;
};

export const getRegistrationState = (scheme, now = new Date()) => {
  const status = scheme && (scheme.status || scheme.schemeStatus || scheme.scheme_status);
  if (!['open', 'published', 'active'].includes(status)) return WINDOW_STATE.CLOSED;
  const startsAt = parseDate(scheme.registrationStartDate || scheme.registration_start_date);
  const endsAt = parseDate(scheme.registrationEndDate || scheme.registration_end_date);
  if (startsAt && now < startsAt) return WINDOW_STATE.UPCOMING;
  if (endsAt && now > endsAt) return WINDOW_STATE.CLOSED;
  return WINDOW_STATE.OPEN;
};

export const canViewInternalReports = (draft, user) => draftStatus(draft) === STATUS.FUNDED && (canManageResearch(user) || isDraftOwner(draft, user));

export const canSubmitInternalReport = (draft, period, user, now = new Date()) => Boolean(
  draft
  && period
  && isResearcher(user)
  && isDraftOwner(draft, user)
  && draftStatus(draft) === STATUS.FUNDED
  && getWindowState(period, now) === WINDOW_STATE.OPEN
);

export const reportForPeriod = (reports, researchId, periodId) => (reports || []).find(report => report.researchId === researchId && report.periodId === periodId);

export const sortReportingSchedule = periods => [...(periods || [])].sort((a, b) => {
  const order = { [REPORT_TYPE.INTERIM]: 1, [REPORT_TYPE.FINAL]: 2, [REPORT_TYPE.OUTPUT]: 3 };
  const typeDifference = (order[a.type] || 9) - (order[b.type] || 9);
  if (typeDifference) return typeDifference;
  return String(a.openAt || '').localeCompare(String(b.openAt || ''));
});
