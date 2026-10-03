/* eslint-disable object-curly-newline, object-property-newline, react/prop-types */
import React, { useState } from 'react';
import { useRis } from '../../../core/RisContext';
import { formatDate } from '../../../core/data';
import {
  FUNDED_REVIEW_CRITERIA,
  appendFundedReviewerReminders,
  applyFundedReviewerAssignments,
  canAssignFundedReviewer,
  fundedAssignmentsFor,
  fundedReviewerCandidates,
  fundedReviewsFor,
  fundedReviewTargetLabel,
} from '../workflows/fundedResearchReviewWorkflow';
import { Button, EmptyRow, Field, FloatingError, Modal, StatusBadge } from '../../../shared/components/Ui';
import Icon from '../../../shared/components/Icon';

const defaultDeadline = () => {
  const date = new Date(Date.now() + (14 * 86400000));
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 16);
};

const reviewerStatus = (assignments, reviews) => {
  if (reviews.length && assignments.every(item => item.status === 'submitted')) return { label: 'Penilaian selesai', tone: 'green' };
  if (assignments.length) return { label: `${assignments.filter(item => item.status !== 'submitted').length} menunggu`, tone: 'orange' };
  return { label: 'Belum ada penilai', tone: 'gray' };
};

const recommendationLabel = value => ({ approve: 'Direkomendasikan', revision: 'Perlu Revisi', reject: 'Tidak Direkomendasikan' }[value] || value || '-');

const ReviewResult = ({ account, index, review, targetType }) => {
  const criteria = FUNDED_REVIEW_CRITERIA[targetType] || [];
  return (
    <article>
      <div className="ris-review-result-reviewer">
        <span>Penilai {index + 1}</span>
        <strong>{account.name || review.reviewerName || '-'}</strong>
        <small>{formatDate(review.submittedAt)}</small>
      </div>
      <div className="ris-review-result-content">
        <div className="ris-funded-review-score-list">
          {criteria.map(item => <div key={item.code}><span>{item.label}</span><strong>{review.scores && review.scores[item.code] !== undefined ? review.scores[item.code] : '-'}</strong><small>Bobot {item.weight}%</small></div>)}
        </div>
        <dl>
          <div><dt>Total Skor</dt><dd>{review.totalScore}</dd></div>
          <div><dt>Rekomendasi</dt><dd>{recommendationLabel(review.recommendation)}</dd></div>
          <div><dt>Catatan Substansi</dt><dd>{review.substanceNotes || '-'}</dd></div>
          <div><dt>Catatan Teknis</dt><dd>{review.technicalNotes || '-'}</dd></div>
          <div><dt>Tindak Lanjut</dt><dd>{review.followUpNotes || '-'}</dd></div>
        </dl>
      </div>
    </article>
  );
};

export default function FundedReviewControls({ targetType, target, managementMode }) {
  const { data, setData, showToast, user } = useRis();
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [error, setError] = useState('');
  if (!target) return null;
  const assignments = fundedAssignmentsFor(data, targetType, target.id);
  const reviews = fundedReviewsFor(data, targetType, target.id);
  const pending = assignments.filter(item => item.status !== 'submitted');
  const status = reviewerStatus(assignments, reviews);
  const label = fundedReviewTargetLabel(targetType, target);
  const assignable = canAssignFundedReviewer(data, targetType, target.id, user);
  const candidates = assignmentOpen ? fundedReviewerCandidates(data, targetType, target.id) : [];
  const lockedIds = assignments.filter(item => item.status === 'submitted').map(item => item.reviewerUserId);

  const openAssignment = () => {
    setSelectedIds(assignments.map(item => item.reviewerUserId));
    const savedDeadline = assignments.find(item => item.dueAt || item.deadline);
    if (savedDeadline) {
      const date = new Date(savedDeadline.dueAt || savedDeadline.deadline);
      setDeadline(new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16));
    } else setDeadline(defaultDeadline());
    setError('');
    setAssignmentOpen(true);
  };

  const toggleReviewer = reviewerId => {
    setSelectedIds(current => (current.includes(reviewerId) ? current.filter(id => id !== reviewerId) : [...current, reviewerId]));
    setError('');
  };

  const saveAssignment = () => {
    if (!selectedIds.length || lockedIds.some(id => !selectedIds.includes(id))) {
      setError('Pilih minimal satu dosen. Penilai yang sudah memberikan penilaian tidak dapat dilepas.');
      return;
    }
    const dueAt = new Date(deadline);
    if (Number.isNaN(dueAt.getTime()) || dueAt <= new Date()) {
      setError('Tenggat penilaian harus melewati waktu saat ini.');
      return;
    }
    setData(current => applyFundedReviewerAssignments(current, targetType, target.id, selectedIds, dueAt.toISOString(), user));
    setAssignmentOpen(false);
    showToast({ tone: 'success', title: 'Penilai ditugaskan', message: `Penugasan penilai untuk ${label} berhasil disimpan.` });
  };

  const remind = () => {
    setData(current => appendFundedReviewerReminders(current, targetType, target.id, user));
    showToast({ tone: 'success', title: 'Pengingat dikirim', message: `Pengingat dikirim kepada ${pending.length} penilai.` });
  };

  return (
    <div className="ris-funded-review-controls">
      <div className="ris-funded-review-summary">
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        {assignments.length > 0 && <span>{assignments.length} penilai</span>}
      </div>
      <div className="ris-funded-review-actions">
        {managementMode && <Button tone="blue" disabled={!assignable} title={assignable ? '' : 'Data harus dikirim sebelum penilai ditugaskan.'} onClick={openAssignment}>{assignments.length ? 'Atur Penilai' : 'Pilih Penilai'}</Button>}
        {managementMode && pending.length > 0 && <Button tone="amber" onClick={remind}><Icon name="bell" size={14} />Ingatkan</Button>}
        {reviews.length > 0 && <Button tone="gray" onClick={() => setResultsOpen(true)}>Hasil Penilaian ({reviews.length})</Button>}
      </div>

      {assignmentOpen && <Modal title="Atur Penilai" width={1040} onClose={() => setAssignmentOpen(false)}><div className="ris-modal-body"><div className="ris-section-title"><div><strong>{label}</strong><p className="ris-muted">Pilih satu atau beberapa dosen. Penugasan ini terpisah dari penilaian proposal.</p></div><Field label="Tenggat Penilaian" required><input type="datetime-local" value={deadline} onChange={event => { setDeadline(event.target.value); setError(''); }} /></Field></div><FloatingError message={error} /><div className="ris-table-wrap"><table className="ris-table ris-table-left"><thead><tr><th aria-label="Pilih" /><th>Dosen</th><th>Afiliasi</th><th>Keahlian</th><th>Status</th></tr></thead><tbody>{candidates.map(candidate => { const checked = selectedIds.includes(candidate.userId); const locked = lockedIds.includes(candidate.userId); return <tr key={candidate.id}><td><input type="checkbox" checked={checked} disabled={locked} onChange={() => toggleReviewer(candidate.userId)} aria-label={`Pilih ${candidate.name}`} /></td><td><strong>{candidate.name}</strong><small className="ris-table-secondary">{candidate.email || candidate.nidn}</small></td><td>{candidate.faculty}<small className="ris-table-secondary">{candidate.program}</small></td><td><div className="ris-chip-list">{candidate.expertise.length ? candidate.expertise.map(item => <span key={item}>{item}</span>) : <span>Belum diisi</span>}</div></td><td><StatusBadge tone={locked ? 'purple' : checked ? 'green' : 'gray'}>{locked ? 'Sudah menilai' : checked ? 'Dipilih' : 'Belum dipilih'}</StatusBadge></td></tr>; })}{candidates.length === 0 && <EmptyRow colSpan={5}>Tidak ada dosen aktif yang tersedia.</EmptyRow>}</tbody></table></div><div className="ris-modal-actions"><Button tone="gray" onClick={() => setAssignmentOpen(false)}>Batal</Button><Button onClick={saveAssignment}>Simpan Penugasan</Button></div></div></Modal>}

      {resultsOpen && <Modal title="Hasil Penilaian" width={1040} onClose={() => setResultsOpen(false)}><div className="ris-modal-body"><p className="ris-modal-intro">{label}</p><div className="ris-review-results-list">{reviews.map((review, index) => <ReviewResult key={review.id} account={(data.systemUsers || []).find(item => item.id === review.reviewerUserId) || {}} index={index} review={review} targetType={targetType} />)}</div><div className="ris-modal-actions"><Button tone="gray" onClick={() => setResultsOpen(false)}>Tutup</Button></div></div></Modal>}
    </div>
  );
}
