/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, react/prop-types */
import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useHistory } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import NotificationDot from '../../../shared/components/NotificationDot';
import { getNotificationIndicatorMap } from '../../../shared/workflows/notificationWorkflow';
import { Button, Field, FileDrop, FloatingError, Modal, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import { fileMeta, uid } from '../../../core/data';
import { canManageResearch, getSchemeTitle } from '../../../shared/workflows/workflow';
import {
  canSubmitInternalReport,
  canViewInternalReports,
  getWindowState,
  REPORT_TYPE,
  REPORT_TYPE_LABEL,
  reportForPeriod,
  sortReportingSchedule,
  WINDOW_STATE,
} from '../workflows/reportingWorkflow';
import { outputDefinitionLabel } from '../workflows/schemeConfiguration';

const windowMeta = {
  [WINDOW_STATE.OPEN]: { label: 'Sedang dibuka', tone: 'green' },
  [WINDOW_STATE.UPCOMING]: { label: 'Belum dibuka', tone: 'blue' },
  [WINDOW_STATE.CLOSED]: { label: 'Deadline lewat', tone: 'red' },
};

const reportMeta = {
  draft: { label: 'Draft tersimpan', tone: 'yellow' },
  submitted: { label: 'Sudah disubmit', tone: 'green' },
};

const createPayload = (period, draft, existing) => {
  if (existing && existing.payload) return existing.payload;
  return {
    title: period.label,
    progress: period.type === REPORT_TYPE.FINAL ? 100 : '',
    summary: '',
    obstacles: '',
    followUp: '',
    file: null,
    outputItems: (draft.outputs || []).map(output => ({ outputId: output.id, title: outputDefinitionLabel(output), type: output.type, status: '', link: '', file: null })),
  };
};

const displayDateTime = value => (value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

export default function InternalResearchReportPage({ initialType }) {
  const { data, setData, user, markNotificationsRead } = useRis();
  const history = useHistory();
  const researches = useMemo(() => (data.drafts || []).filter(draft => canViewInternalReports(draft, user)), [data.drafts, user]);
  const [researchId, setResearchId] = useState(researches[0] ? researches[0].id : '');
  const [activeType, setActiveType] = useState(initialType || 'all');
  const [editing, setEditing] = useState(null);
  const [payload, setPayload] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [error, setError] = useState('');
  const draft = researches.find(item => item.id === researchId);
  const scheme = draft && data.schemes.find(item => item.id === draft.schemeId);
  const periods = sortReportingSchedule(scheme ? scheme.reportingSchedule : []).filter(period => activeType === 'all' || period.type === activeType);
  const indicators = getNotificationIndicatorMap(data, user);
  const indicatorPrefix = canManageResearch(user) ? 'research:funded' : 'submission:funded';
  const reportTabs = [
    { value: 'all', label: 'Semua', target: indicatorPrefix },
    { value: REPORT_TYPE.INTERIM, label: 'Sementara', target: `${indicatorPrefix}:monev` },
    { value: REPORT_TYPE.FINAL, label: 'Final', target: `${indicatorPrefix}:final-report` },
    { value: REPORT_TYPE.OUTPUT, label: 'Luaran', target: `${indicatorPrefix}:output-report` },
  ];

  const openReport = (period, existing, viewOnly = false) => {
    setEditing({ period, existing });
    setPayload(createPayload(period, draft, existing));
    setReadOnly(viewOnly);
    setError('');
  };

  const updateOutput = (outputId, key, value) => setPayload(current => ({ ...current, outputItems: current.outputItems.map(output => (output.outputId === outputId ? { ...output, [key]: value } : output)) }));

  const persist = status => {
    const { period, existing } = editing;
    if (status === 'submitted' && !payload.summary.trim()) {
      setError('Ringkasan laporan wajib diisi sebelum submit.');
      return;
    }
    if (status === 'submitted' && period.type !== REPORT_TYPE.OUTPUT && !payload.file) {
      setError('Dokumen laporan wajib diunggah sebelum submit.');
      return;
    }
    if (status === 'submitted' && period.type === REPORT_TYPE.OUTPUT && payload.outputItems.some(output => !output.status || (!output.link && !output.file))) {
      setError('Setiap luaran wajib dan tambahan harus memiliki status serta minimal satu link atau file bukti.');
      return;
    }
    if (!canSubmitInternalReport(draft, period, user)) {
      setError('Periode submit sudah ditutup. Hubungi admin/manager untuk membuka kembali deadline.');
      return;
    }
    const now = new Date().toISOString();
    const report = {
      ...(existing || {}),
      id: existing ? existing.id : uid('internal-report'),
      researchId: draft.id,
      schemeId: scheme.id,
      periodId: period.id,
      reportType: period.type,
      reportPeriod: period.label,
      status,
      payload,
      submittedAt: status === 'submitted' ? now : (existing && existing.submittedAt) || null,
      updatedAt: now,
      updatedBy: user.id,
    };
    setData(current => ({
      ...current,
      internalReports: existing ? current.internalReports.map(item => (item.id === existing.id ? report : item)) : [...current.internalReports, report],
    }));
    setEditing(null);
  };

  const renderEditor = () => {
    if (!editing || !payload) return null;
    const { period } = editing;
    return <Modal title={readOnly ? 'Detail Laporan' : `Isi ${period.label}`} width={900} onClose={() => setEditing(null)}><div className="ris-modal-body ris-report-editor"><FloatingError message={error} /><div className="ris-form-grid two"><Field label="Nama Laporan"><input disabled={readOnly} value={payload.title} onChange={event => setPayload({ ...payload, title: event.target.value })} /></Field>{period.type !== REPORT_TYPE.OUTPUT && <Field label="Progres Penelitian (%)" required><input disabled={readOnly || period.type === REPORT_TYPE.FINAL} type="number" min="0" max="100" value={payload.progress} onChange={event => setPayload({ ...payload, progress: event.target.value })} /></Field>}</div><Field label="Ringkasan Laporan" required alignStart><textarea disabled={readOnly} rows="5" value={payload.summary} onChange={event => setPayload({ ...payload, summary: event.target.value })} /></Field>
      {period.type !== REPORT_TYPE.OUTPUT && <React.Fragment><Field label="Kendala" alignStart><textarea disabled={readOnly} rows="3" value={payload.obstacles} onChange={event => setPayload({ ...payload, obstacles: event.target.value })} /></Field><Field label="Tindak Lanjut" alignStart><textarea disabled={readOnly} rows="3" value={payload.followUp} onChange={event => setPayload({ ...payload, followUp: event.target.value })} /></Field>{readOnly ? <div className="ris-file-readonly"><span>Dokumen laporan</span><strong>{payload.file ? payload.file.name : '-'}</strong></div> : <FileDrop file={payload.file} accept=".pdf,.doc,.docx" storagePurpose="reports" onFile={file => setPayload({ ...payload, file: fileMeta(file) })} label="Unggah dokumen laporan" />}</React.Fragment>}
      {period.type === REPORT_TYPE.OUTPUT && <div className="ris-output-report-list">{payload.outputItems.map((output, index) => <section className="ris-output-report-item" key={output.outputId}><h4>{index + 1}. {output.title} <span className="ris-badge gray">{output.type === 'wajib' ? 'Wajib' : 'Tambahan'}</span></h4><div className="ris-form-grid two"><Field label="Status Luaran" required><select disabled={readOnly} value={output.status} onChange={event => updateOutput(output.outputId, 'status', event.target.value)}><option value="">-- Pilih Status --</option><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="accepted">Accepted</option><option value="published">Published</option><option value="registered">Terdaftar</option><option value="rejected">Rejected</option></select></Field><Field label="Link Bukti"><input disabled={readOnly} type="url" value={output.link} onChange={event => updateOutput(output.outputId, 'link', event.target.value)} placeholder="https://..." /></Field></div>{readOnly ? <div className="ris-file-readonly"><span>File bukti</span><strong>{output.file ? output.file.name : '-'}</strong></div> : <FileDrop file={output.file} storagePurpose="reports" onFile={file => updateOutput(output.outputId, 'file', fileMeta(file))} label="Unggah bukti luaran" />}</section>)}</div>}
      <div className="ris-modal-actions"><Button tone="gray" onClick={() => setEditing(null)}>Tutup</Button>{!readOnly && <React.Fragment><Button tone="blue" onClick={() => persist('draft')}>Simpan Draft</Button><Button onClick={() => persist('submitted')}>Submit Laporan</Button></React.Fragment>}</div></div></Modal>;
  };

  return (
    <div className="ris-page ris-workspace-page ris-internal-report-page">
      <PageHeader title="Laporan Penelitian Internal" description="Submit laporan sementara, laporan final, dan realisasi luaran sesuai periode yang ditetapkan LPPM." actions={canManageResearch(user) ? <Button tone="blue" onClick={() => history.push('/ris/skema')}>Atur Deadline</Button> : null} />
      <div className="ris-research-picker"><label>Judul penelitian</label><select value={researchId} onChange={event => setResearchId(event.target.value)}><option value="">-- Pilih Penelitian --</option>{researches.map(item => <option key={item.id} value={item.id}>{item.project.title}</option>)}</select></div>
      {!draft && <div className="ris-empty-state">Belum ada penelitian disetujui yang dapat dilaporkan.</div>}
      {draft && <React.Fragment><section className="ris-proposal-info"><h2>Informasi Penelitian</h2><p><span>Judul</span>{draft.project.title}</p><p><span>Skema</span>{getSchemeTitle(scheme)}</p><p><span>Ketua Peneliti</span>{draft.members[0] ? draft.members[0].name : '-'}</p></section><div className="ris-tabs ris-report-type-tabs">{reportTabs.map(tab => <button type="button" key={tab.value} className={activeType === tab.value ? 'active' : ''} onClick={() => { markNotificationsRead(indicators[tab.target] || []); setActiveType(tab.value); }}>{tab.label}<NotificationDot visible={Boolean(indicators[tab.target] && indicators[tab.target].length)} /></button>)}</div><div className="ris-report-period-grid">{periods.map(period => {
        const window = windowMeta[getWindowState(period)];
        const existing = reportForPeriod(data.internalReports, draft.id, period.id);
        const saved = existing && reportMeta[existing.status];
        const canSubmit = canSubmitInternalReport(draft, period, user);
        return <article className="ris-report-period-card" key={period.id}><div className="ris-report-period-head"><div><small>{REPORT_TYPE_LABEL[period.type]}</small><h3>{period.label}</h3></div><StatusBadge tone={window.tone}>{window.label}</StatusBadge></div><dl><div><dt>Dibuka</dt><dd>{displayDateTime(period.openAt)}</dd></div><div><dt>Deadline</dt><dd>{displayDateTime(period.dueAt)}</dd></div><div><dt>Status laporan</dt><dd>{saved ? <StatusBadge tone={saved.tone}>{saved.label}</StatusBadge> : <StatusBadge>Belum ada laporan</StatusBadge>}</dd></div></dl><div className="ris-report-period-actions">{existing && canManageResearch(user) && <Button tone="gray" onClick={() => openReport(period, existing, true)}>Lihat Laporan</Button>}{!canManageResearch(user) && <Button disabled={!canSubmit} title={!canSubmit ? 'Submit belum dibuka atau deadline sudah lewat.' : ''} onClick={() => openReport(period, existing)}>{existing ? 'Perbarui Laporan' : 'Isi Laporan'}</Button>}</div></article>;
      })}</div>{periods.length === 0 && <div className="ris-empty-state">Jadwal laporan belum diatur untuk skema ini.</div>}</React.Fragment>}
      {renderEditor()}
    </div>
  );
}

InternalResearchReportPage.propTypes = { initialType: PropTypes.string };
InternalResearchReportPage.defaultProps = { initialType: '' };
