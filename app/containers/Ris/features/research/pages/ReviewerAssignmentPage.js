/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React, { useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import {
  Button, EmptyRow, Field, PageBack
} from '../../../shared/components/Ui';
import { SDGS } from '../../../core/data';
import {
  ROLE,
  canAssignReviewer,
  draftReviewerAssignments,
  draftReviews,
  getSchemeTitle,
  isActiveReviewerAssignment,
  normalizeRole,
} from '../../../shared/workflows/workflow';
import { applyReviewerAssignments } from '../workflows/researchMonitoringWorkflow';
import { outputDefinitionLabel } from '../workflows/schemeConfiguration';

const toDateTimeInput = value => {
  const date = value ? new Date(value) : new Date(Date.now() + (14 * 86400000));
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 16);
};

export default function ReviewerAssignmentPage() {
  const { draftId } = useParams();
  const { data, setData, user } = useRis();
  const history = useHistory();
  const draft = data.drafts.find(item => item.id === draftId);
  const existingAssignments = draftReviewerAssignments(draft).filter(isActiveReviewerAssignment);
  const lockedUserIds = existingAssignments.filter(item => item.status === 'submitted').map(item => item.reviewerUserId);
  const [selectedIds, setSelectedIds] = useState(existingAssignments.map(item => item.reviewerUserId));
  const [reviewDeadline, setReviewDeadline] = useState(() => {
    const existingDeadline = existingAssignments.find(item => item.dueAt || item.deadline);
    return toDateTimeInput(existingDeadline && (existingDeadline.dueAt || existingDeadline.deadline));
  });
  const [error, setError] = useState('');

  const candidates = useMemo(() => (data.lecturers || []).filter(lecturer => {
    const account = (data.systemUsers || []).find(item => item.id === lecturer.userId);
    return lecturer.userId !== (draft && draft.userId) && account && account.isActive !== false && normalizeRole(account.role) === ROLE.LECTURER;
  }).map(lecturer => {
    const expertiseIds = (data.researcherExpertiseMap || []).filter(item => item.profileId === lecturer.id).map(item => item.expertiseId);
    const expertise = (data.researcherExpertise || []).filter(item => expertiseIds.includes(item.expertiseId)).map(item => item.name);
    const reviewCount = (data.drafts || []).reduce((count, item) => count + draftReviews(item).filter(review => review.reviewerUserId === lecturer.userId).length, 0);
    return { ...lecturer, expertise, reviewCount };
  }), [data, draft]);

  if (!draft) return <div className="ris-page"><h1>Pengajuan tidak ditemukan</h1></div>;
  if (!canAssignReviewer(draft, user)) return <div className="ris-page"><h1>Proposal tidak dapat ditugaskan reviewer</h1></div>;
  const scheme = data.schemes.find(item => item.id === draft.schemeId) || {};
  const selected = candidates.filter(candidate => selectedIds.includes(candidate.userId));

  const toggle = reviewerUserId => {
    if (lockedUserIds.includes(reviewerUserId)) return;
    setSelectedIds(current => (current.includes(reviewerUserId) ? current.filter(id => id !== reviewerUserId) : [...current, reviewerUserId]));
    setError('');
  };

  const submit = () => {
    if (!selectedIds.length) { setError('Pilih minimal satu lecturer sebagai reviewer.'); return; }
    const now = new Date();
    const deadline = new Date(reviewDeadline);
    if (Number.isNaN(deadline.getTime()) || deadline <= now) { setError('Deadline penilaian wajib berada setelah waktu sekarang.'); return; }
    const dueAt = deadline.toISOString();
    setData(current => applyReviewerAssignments(current, draft.id, selectedIds, dueAt, user, now));
    history.push('/ris/skema/pengajuan?stage=reviewer');
  };

  return <div className="ris-page"><PageBack onClick={() => history.goBack()} /><h1>Pemilihan Reviewer</h1><p className="ris-muted">Pilih satu atau beberapa lecturer. Penugasan reviewer berlaku sementara untuk proposal ini.</p>
    <div className="ris-reviewer-layout"><aside className="ris-proposal-summary"><h2>Ringkasan Proposal</h2><dl><div><dt>Judul Penelitian</dt><dd>{draft.project.title}</dd></div><div><dt>Skema</dt><dd>{getSchemeTitle(scheme)}</dd></div><div><dt>Ketua</dt><dd>{draft.members[0] ? draft.members[0].name : '-'}</dd></div><div><dt>Luaran Wajib</dt><dd>{(draft.outputs || []).filter(output => output.type === 'wajib').map(outputDefinitionLabel).join(', ') || '-'}</dd></div><div><dt>SDGs</dt><dd>{draft.project.sdgs.map(id => { const sdg = SDGS.find(item => item.id === id); return sdg ? sdg.name : id; }).join(', ')}</dd></div></dl></aside>
      <section className="ris-reviewer-list"><div className="ris-section-title"><div><h2>Lecturer Tersedia</h2><p className="ris-muted">Deadline berlaku untuk reviewer aktif yang dipilih pada penyimpanan ini.</p></div><Field label="Deadline Penilaian" required><input type="datetime-local" min={toDateTimeInput(new Date())} value={reviewDeadline} onChange={event => { setReviewDeadline(event.target.value); setError(''); }} /></Field></div><div className="ris-table-wrap"><table className="ris-table ris-table-left"><thead><tr><th aria-label="Pilih" /><th>Nama Lecturer</th><th>Afiliasi</th><th>Keahlian</th><th>Review Selesai</th><th>Status</th></tr></thead><tbody>{candidates.map(candidate => {
        const checked = selectedIds.includes(candidate.userId);
        const locked = lockedUserIds.includes(candidate.userId);
        return <tr key={candidate.id}><td><input type="checkbox" checked={checked} disabled={locked} onChange={() => toggle(candidate.userId)} aria-label={`Pilih ${candidate.name}`} /></td><td><strong>{candidate.name}</strong><small className="ris-table-secondary">{candidate.nidn}</small></td><td>{candidate.faculty}<small className="ris-table-secondary">{candidate.program}</small></td><td><div className="ris-chip-list">{candidate.expertise.length ? candidate.expertise.map(item => <span key={item}>{item}</span>) : <span>Belum diisi</span>}</div></td><td>{candidate.reviewCount}</td><td><span className={`ris-badge ${locked ? 'purple' : checked ? 'green' : 'gray'}`}>{locked ? 'Sudah menilai' : checked ? 'Dipilih' : 'Belum dipilih'}</span></td></tr>;
      })}{candidates.length === 0 && <EmptyRow colSpan={6}>Tidak ada lecturer aktif yang dapat ditugaskan.</EmptyRow>}</tbody></table></div></section>
    </div>
    <div className="ris-bottom-bar"><div><strong>Reviewer dipilih: </strong><b>{selected.length ? selected.map(item => item.name).join(', ') : '-'}</b></div><div>{error && <span className="ris-inline-error">{error}</span>}<Button type="button" tone="gray" onClick={() => setSelectedIds(lockedUserIds)}>Reset</Button><Button type="button" onClick={submit}>Simpan Penugasan</Button></div></div>
  </div>;
}
