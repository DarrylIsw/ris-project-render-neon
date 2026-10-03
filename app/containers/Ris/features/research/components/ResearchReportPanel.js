/* eslint-disable object-curly-newline, object-property-newline, react/prop-types */
import React, { useState } from 'react';
import { useRis } from '../../../core/RisContext';
import { fileMeta, uid } from '../../../core/data';
import {
  canSubmitInternalReport,
  getWindowState,
  REPORT_TYPE,
  REPORT_TYPE_LABEL,
  WINDOW_STATE,
} from '../workflows/reportingWorkflow';
import {
  getOutputReportPeriods,
  getProgressReportPeriods,
  internalReportFor,
} from '../workflows/schemeDataWorkflow';
import { outputDefinitionLabel } from '../workflows/schemeConfiguration';
import { FUNDED_REVIEW_TARGET } from '../workflows/fundedResearchReviewWorkflow';
import FundedReviewControls from './FundedReviewControls';
import { Button, Field, FileDrop, FloatingError, Modal, StatusBadge } from '../../../shared/components/Ui';

const windowMeta = {
  [WINDOW_STATE.OPEN]: { label: 'Sedang Dibuka', tone: 'green' },
  [WINDOW_STATE.UPCOMING]: { label: 'Belum Dibuka', tone: 'blue' },
  [WINDOW_STATE.CLOSED]: { label: 'Tenggat Terlewati', tone: 'red' },
};

const reportMeta = {
  draft: { label: 'Draf Tersimpan', tone: 'yellow' },
  submitted: { label: 'Sudah Dikirim', tone: 'green' },
  under_review: { label: 'Sedang Dinilai', tone: 'blue' },
  accepted: { label: 'Diterima', tone: 'green' },
  revision: { label: 'Perlu Revisi', tone: 'orange' },
  rejected: { label: 'Ditolak', tone: 'red' },
};

const emptyProgressPayload = period => ({
  title: period.label,
  progress: period.type === REPORT_TYPE.FINAL ? 100 : '',
  summary: '',
  obstacles: '',
  followUp: '',
  file: null,
});

const emptyOutputPayload = output => ({
  title: outputDefinitionLabel(output),
  status: '',
  link: '',
  description: output.description || '',
  file: null,
});

const displayDateTime = value => (value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

function PeriodCard({ period, existing, canSubmit, onOpen, label, title, readOnly }) {
  const window = windowMeta[getWindowState(period)];
  const saved = existing && reportMeta[existing.status];
  let actionLabel = existing ? 'Perbarui Laporan' : 'Isi Laporan';
  let actionTitle = canSubmit ? '' : 'Pengunggahan belum dibuka atau tenggat sudah lewat.';
  if (readOnly) {
    actionLabel = existing ? 'Lihat Laporan' : 'Belum Dikirim';
    actionTitle = existing ? '' : 'Laporan belum diisi oleh ketua penelitian.';
  }
  return (
    <article className="ris-report-period-card">
      <div className="ris-report-period-head"><div><small>{label}</small><h3>{title}</h3></div><StatusBadge tone={window.tone}>{window.label}</StatusBadge></div>
      <dl>
        <div><dt>Dibuka</dt><dd>{displayDateTime(period.openAt)}</dd></div>
        <div><dt>Tenggat</dt><dd>{displayDateTime(period.dueAt)}</dd></div>
        <div><dt>Status</dt><dd>{saved ? <StatusBadge tone={saved.tone}>{saved.label}</StatusBadge> : <StatusBadge>Belum Ada Laporan</StatusBadge>}</dd></div>
      </dl>
      <div className="ris-report-period-actions"><Button tone={readOnly ? 'gray' : 'green'} disabled={readOnly ? !existing : !canSubmit} title={actionTitle} onClick={onOpen}>{actionLabel}</Button></div>
      {existing && ['submitted', 'under_review', 'accepted'].includes(existing.status) && <FundedReviewControls targetType={FUNDED_REVIEW_TARGET.REPORT} target={existing} managementMode={readOnly} />}
    </article>
  );
}

export default function ResearchReportPanel({ draft, scheme, mode, readOnly }) {
  const { data, setData, user } = useRis();
  const [editing, setEditing] = useState(null);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const outputs = draft.outputs || [];
  const progressPeriods = getProgressReportPeriods(scheme);
  const outputPeriods = getOutputReportPeriods(scheme);

  const openProgress = (period, existing) => {
    setEditing({ period, existing, output: null });
    setPayload(existing && existing.payload ? existing.payload : emptyProgressPayload(period));
    setError('');
  };

  const openOutput = (period, output, existing) => {
    setEditing({ period, output, existing });
    setPayload(existing && existing.payload ? existing.payload : emptyOutputPayload(output));
    setError('');
  };

  const persist = status => {
    const { period, output, existing } = editing;
    if (!canSubmitInternalReport(draft, period, user)) {
      setError('Periode pengiriman belum dibuka atau tenggat sudah lewat. Hubungi pengelola untuk membuka kembali periode.');
      return;
    }
    if (status === 'submitted' && !output && (!payload.summary.trim() || !payload.file)) {
      setError('Ringkasan dan dokumen laporan wajib diisi sebelum disimpan.');
      return;
    }
    if (status === 'submitted' && output && (!payload.status || (!payload.link && !payload.file))) {
      setError('Status luaran serta minimal satu tautan atau berkas bukti wajib diisi.');
      return;
    }
    const now = new Date().toISOString();
    const report = {
      ...(existing || {}),
      id: existing ? existing.id : uid('internal-report'),
      researchId: draft.id,
      schemeId: scheme.id,
      periodId: period.id,
      outputId: output ? output.id : null,
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
      internalReports: existing
        ? current.internalReports.map(item => (item.id === existing.id ? report : item))
        : [...current.internalReports, report],
    }));
    setEditing(null);
  };

  const renderProgressGroup = (type, title, description) => {
    const periods = progressPeriods.filter(period => period.type === type);
    return (
      <section className="ris-report-group">
        <div className="ris-section-title"><div><h3>{title}</h3><p className="ris-muted">{description}</p></div><span className="ris-section-count">{periods.length}</span></div>
        {periods.length === 0 ? <div className="ris-empty-state">Jadwal {title.toLowerCase()} belum ditetapkan oleh pengelola.</div> : <div className="ris-report-period-grid">{periods.map(period => {
          const existing = internalReportFor(data.internalReports, draft.id, period.id);
          return <PeriodCard key={period.id} period={period} existing={existing} canSubmit={canSubmitInternalReport(draft, period, user)} onOpen={() => openProgress(period, existing)} label={REPORT_TYPE_LABEL[period.type]} title={period.label} readOnly={readOnly} />;
        })}</div>}
      </section>
    );
  };

  return (
    <section className="ris-scheme-data-panel">
      {mode === 'final' && renderProgressGroup(REPORT_TYPE.FINAL, 'Laporan Akhir', 'Laporan akhir penelitian dengan progres penelitian 100%.')}

      {mode === 'output' && <React.Fragment>
        <div className="ris-section-title"><div><h2>Laporan Luaran</h2><p className="ris-muted">{readOnly ? 'Hasil realisasi setiap luaran wajib dan tambahan dari ketua penelitian.' : 'Setiap luaran wajib dan tambahan memiliki laporan serta bukti realisasi tersendiri.'}</p></div><span className="ris-section-count">{outputs.length}</span></div>
        {outputPeriods.length === 0 && <div className="ris-empty-state">Jadwal laporan luaran belum ditetapkan oleh pengelola.</div>}
        {outputPeriods.map(period => <section className="ris-report-group" key={period.id}><div className="ris-section-title"><div><h3>{period.label}</h3><p className="ris-muted">{displayDateTime(period.openAt)} sampai {displayDateTime(period.dueAt)}</p></div></div>{outputs.length === 0 ? <div className="ris-empty-state">Belum ada luaran yang dipilih pada proposal.</div> : <div className="ris-report-period-grid">{outputs.map(output => {
          const existing = internalReportFor(data.internalReports, draft.id, period.id, output.id);
          return <PeriodCard key={`${period.id}-${output.id}`} period={period} existing={existing} canSubmit={canSubmitInternalReport(draft, period, user)} onOpen={() => openOutput(period, output, existing)} label={output.type === 'wajib' ? 'Luaran Wajib' : 'Luaran Tambahan'} title={outputDefinitionLabel(output)} readOnly={readOnly} />;
        })}</div>}</section>)}
      </React.Fragment>}

      {editing && payload && (
        <Modal title={editing.output ? `Laporan ${outputDefinitionLabel(editing.output)}` : editing.period.label} width={900} onClose={() => setEditing(null)}>
          <div className="ris-modal-body ris-report-editor">
            <FloatingError message={error} />
            {!editing.output && <React.Fragment>
              <div className="ris-form-grid two"><Field label="Nama Laporan"><input disabled={readOnly} value={payload.title} onChange={event => setPayload({ ...payload, title: event.target.value })} /></Field><Field label="Progres Penelitian (%)" required><input type="number" min="0" max="100" disabled={readOnly || editing.period.type === REPORT_TYPE.FINAL} value={payload.progress} onChange={event => setPayload({ ...payload, progress: event.target.value })} /></Field></div>
              <Field label="Ringkasan Laporan" required alignStart><textarea disabled={readOnly} rows="5" value={payload.summary} onChange={event => setPayload({ ...payload, summary: event.target.value })} /></Field>
              <Field label="Kendala" alignStart><textarea disabled={readOnly} rows="3" value={payload.obstacles} onChange={event => setPayload({ ...payload, obstacles: event.target.value })} /></Field>
              <Field label="Tindak Lanjut" alignStart><textarea disabled={readOnly} rows="3" value={payload.followUp} onChange={event => setPayload({ ...payload, followUp: event.target.value })} /></Field>
              {readOnly ? <div className="ris-file-readonly"><span>Dokumen laporan</span><strong>{payload.file ? payload.file.name : '-'}</strong></div> : <FileDrop file={payload.file} accept=".pdf,.doc,.docx" maxSize={15 * 1024 * 1024} storagePurpose="reports" onError={setError} onFile={file => setPayload({ ...payload, file: fileMeta(file) })} label="Unggah dokumen laporan" />}
            </React.Fragment>}
            {editing.output && <React.Fragment>
              <div className="ris-form-grid two"><Field label="Status Luaran" required><select disabled={readOnly} value={payload.status} onChange={event => setPayload({ ...payload, status: event.target.value })}><option value="">Pilih status</option><option value="draft">Draf</option><option value="submitted">Dikirim</option><option value="accepted">Diterima</option><option value="published">Diterbitkan</option><option value="registered">Terdaftar</option><option value="rejected">Ditolak</option></select></Field><Field label="Tautan Bukti"><input disabled={readOnly} type="url" value={payload.link} onChange={event => setPayload({ ...payload, link: event.target.value })} placeholder="https://..." /></Field></div>
              <Field label="Deskripsi Realisasi" alignStart><textarea disabled={readOnly} rows="4" value={payload.description} onChange={event => setPayload({ ...payload, description: event.target.value })} /></Field>
              {readOnly ? <div className="ris-file-readonly"><span>Bukti luaran</span><strong>{payload.file ? payload.file.name : '-'}</strong></div> : <FileDrop file={payload.file} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" maxSize={15 * 1024 * 1024} storagePurpose="reports" onError={setError} onFile={file => setPayload({ ...payload, file: fileMeta(file) })} label="Unggah bukti luaran" />}
            </React.Fragment>}
            <div className="ris-modal-actions"><Button tone="gray" onClick={() => setEditing(null)}>{readOnly ? 'Tutup' : 'Batal'}</Button>{!readOnly && <React.Fragment><Button tone="blue" onClick={() => persist('draft')}>Simpan Draf</Button><Button onClick={() => persist('submitted')}>Kirim Laporan</Button></React.Fragment>}</div>
          </div>
        </Modal>
      )}
    </section>
  );
}

ResearchReportPanel.defaultProps = { mode: 'progress', readOnly: false };
