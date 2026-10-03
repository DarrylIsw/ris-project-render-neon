/* eslint-disable object-curly-newline, object-property-newline, react/prop-types */
import React, { useState } from 'react';
import { useRis } from '../../../core/RisContext';
import { fileMeta, uid } from '../../../core/data';
import { FUNDED_REVIEW_TARGET } from '../workflows/fundedResearchReviewWorkflow';
import { getWindowState, WINDOW_STATE } from '../workflows/reportingWorkflow';
import { getMonevPeriods, monevForPeriod } from '../workflows/schemeDataWorkflow';
import FundedReviewControls from './FundedReviewControls';
import { Button, Field, FileDrop, FloatingError, Modal, StatusBadge } from '../../../shared/components/Ui';

const windowMeta = {
  [WINDOW_STATE.OPEN]: { label: 'Sedang Berjalan', tone: 'green' },
  [WINDOW_STATE.UPCOMING]: { label: 'Belum Dimulai', tone: 'blue' },
  [WINDOW_STATE.CLOSED]: { label: 'Periode Selesai', tone: 'gray' },
};

const recordMeta = {
  draft: { label: 'Draf Dosen', tone: 'yellow' },
  submitted: { label: 'Sudah Dikirim', tone: 'green' },
};

const emptyPayload = {
  progress: '', milestone: '', achievements: '', deviations: '', risks: '', correctiveAction: '', evidence: null,
};

const displayDateTime = value => (value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

export default function MonevPanel({ draft, scheme, managementMode }) {
  const { data, setData, user } = useRis();
  const [editing, setEditing] = useState(null);
  const [payload, setPayload] = useState(emptyPayload);
  const [error, setError] = useState('');
  const periods = getMonevPeriods(scheme);

  const openEditor = (period, existing, readOnly = false) => {
    setEditing({ period, existing, readOnly });
    setPayload(existing && existing.payload ? existing.payload : { ...emptyPayload });
    setError('');
  };

  const persist = status => {
    const progress = Number(payload.progress);
    if (managementMode) {
      setError('Pengelola hanya dapat memantau hasil Monev yang dikirim dosen.');
      return;
    }
    if (status === 'submitted' && (!Number.isFinite(progress) || progress < 0 || progress > 100 || !payload.milestone.trim() || !payload.achievements.trim())) {
      setError('Progres 0-100%, target pencapaian, dan capaian aktual wajib diisi.');
      return;
    }
    const now = new Date().toISOString();
    const record = {
      ...(editing.existing || {}),
      id: editing.existing ? editing.existing.id : uid('monev'),
      researchId: draft.id, schemeId: scheme.id, periodId: editing.period.id, periodLabel: editing.period.label,
      status, payload,
      submittedBy: status === 'submitted' ? user.id : (editing.existing && editing.existing.submittedBy) || null,
      submittedAt: status === 'submitted' ? now : (editing.existing && editing.existing.submittedAt) || null,
      publishedAt: null, evaluatedBy: null, updatedAt: now, updatedBy: user.id,
    };
    setData(current => ({
      ...current,
      monevRecords: editing.existing
        ? (current.monevRecords || []).map(item => (item.id === editing.existing.id ? record : item))
        : [...(current.monevRecords || []), record],
    }));
    setEditing(null);
  };

  return (
    <section className="ris-scheme-data-panel">
      <div className="ris-section-title"><div><h2>Pemantauan dan Evaluasi</h2><p className="ris-muted">{managementMode ? 'Terima hasil Monev yang dikirim ketua penelitian, pantau kelengkapannya, dan tugaskan penilai bila diperlukan.' : 'Isi hasil Monev sesuai periode yang dibuka, lalu kirim ke pengelola untuk dipantau dan dinilai.'}</p></div></div>
      {periods.length === 0 && <div className="ris-empty-state">Periode Monev belum ditetapkan oleh pengelola skema.</div>}
      <div className="ris-report-period-grid">
        {periods.map(period => {
          const windowState = getWindowState(period);
          const window = windowMeta[windowState];
          const existing = monevForPeriod(data.monevRecords, draft.id, period.id);
          const isSubmitted = existing && existing.status === 'submitted';
          const visibleRecord = managementMode ? (isSubmitted ? existing : null) : existing;
          const saved = visibleRecord && recordMeta[visibleRecord.status];
          const canEdit = !managementMode && windowState === WINDOW_STATE.OPEN && (!existing || existing.status === 'draft');
          const actionLabel = managementMode ? (isSubmitted ? 'Lihat Monev' : 'Belum Dikirim') : (existing ? (existing.status === 'submitted' ? 'Lihat Monev' : 'Lanjutkan Monev') : 'Isi Monev');
          return (
            <article className="ris-report-period-card" key={period.id}>
              <div className="ris-report-period-head"><div><small>Periode Monev</small><h3>{period.label}</h3></div><StatusBadge tone={window.tone}>{window.label}</StatusBadge></div>
              <dl><div><dt>Periode mulai</dt><dd>{displayDateTime(period.openAt)}</dd></div><div><dt>Periode selesai</dt><dd>{displayDateTime(period.dueAt)}</dd></div><div><dt>Hasil Monev</dt><dd>{saved ? <StatusBadge tone={saved.tone}>{saved.label}</StatusBadge> : <StatusBadge>Belum Ada Laporan</StatusBadge>}</dd></div></dl>
              <div className="ris-report-period-actions"><Button tone={managementMode ? 'gray' : 'green'} disabled={managementMode ? !isSubmitted : (!canEdit && !existing)} title={managementMode && !isSubmitted ? 'Dosen belum mengirim hasil Monev.' : !managementMode && !canEdit && !existing ? 'Periode Monev belum dibuka atau sudah berakhir.' : ''} onClick={() => openEditor(period, existing, managementMode || (existing && existing.status === 'submitted'))}>{actionLabel}</Button></div>
              {isSubmitted && <FundedReviewControls targetType={FUNDED_REVIEW_TARGET.MONEV} target={existing} managementMode={managementMode} />}
            </article>
          );
        })}
      </div>
      {editing && <Modal title={`Monev ${editing.period.label}`} width={880} onClose={() => setEditing(null)}><div className="ris-modal-body ris-report-editor"><FloatingError message={error} /><div className="ris-form-grid two"><Field label="Progres Penelitian (%)" required><input disabled={editing.readOnly} type="number" min="0" max="100" value={payload.progress} onChange={event => setPayload({ ...payload, progress: event.target.value })} /></Field><Field label="Target Pencapaian" required><input disabled={editing.readOnly} value={payload.milestone} onChange={event => setPayload({ ...payload, milestone: event.target.value })} placeholder="Target yang seharusnya dicapai" /></Field></div><Field label="Capaian Aktual" required alignStart><textarea disabled={editing.readOnly} rows="4" value={payload.achievements} onChange={event => setPayload({ ...payload, achievements: event.target.value })} /></Field><Field label="Deviasi dari Rencana" alignStart><textarea disabled={editing.readOnly} rows="3" value={payload.deviations} onChange={event => setPayload({ ...payload, deviations: event.target.value })} /></Field><Field label="Risiko Penelitian" alignStart><textarea disabled={editing.readOnly} rows="3" value={payload.risks} onChange={event => setPayload({ ...payload, risks: event.target.value })} /></Field><Field label="Tindakan Korektif" alignStart><textarea disabled={editing.readOnly} rows="3" value={payload.correctiveAction} onChange={event => setPayload({ ...payload, correctiveAction: event.target.value })} /></Field>{editing.readOnly ? <div className="ris-file-readonly"><span>Bukti pendukung Monev</span><strong>{payload.evidence ? payload.evidence.name : '-'}</strong></div> : <FileDrop file={payload.evidence} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" maxSize={10 * 1024 * 1024} storagePurpose="reports" onError={setError} onFile={file => setPayload({ ...payload, evidence: fileMeta(file) })} label="Unggah bukti pendukung Monev" />}<div className="ris-modal-actions"><Button tone="gray" onClick={() => setEditing(null)}>{editing.readOnly ? 'Tutup' : 'Batal'}</Button>{!editing.readOnly && <React.Fragment><Button tone="blue" onClick={() => persist('draft')}>Simpan Draf</Button><Button onClick={() => persist('submitted')}>Kirim Monev</Button></React.Fragment>}</div></div></Modal>}
    </section>
  );
}

MonevPanel.defaultProps = { managementMode: false };
