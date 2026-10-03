/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, react/prop-types */
import React, { useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import Icon from '../../../shared/components/Icon';
import NotificationDot from '../../../shared/components/NotificationDot';
import {
  Button, EmptyRow, Field, FloatingError, Modal, PageHeader, StatusBadge
} from '../../../shared/components/Ui';
import ProposalDecisionReviewSummary from './ProposalDecisionReviewSummary';
import { formatDate } from '../../../core/data';
import {
  STATUS,
  canAssignReviewer,
  canDecideDraft,
  canVerifyDraft,
  draftReviewerAssignments,
  draftReviews,
  draftStatus,
  getSchemeTitle,
  isActiveReviewerAssignment,
} from '../../../shared/workflows/workflow';
import { getNotificationIndicatorMap } from '../../../shared/workflows/notificationWorkflow';
import {
  VERIFICATION_CHECKS,
  appendReviewerReminders,
  applyProposalDecision,
  applyProposalVerification,
  applyReviewerAssignments,
  createVerificationChecklist,
  decisionStage,
  proposalDisplayMeta,
  proposalYear,
  reviewerCandidates,
  reviewerStage,
  verificationStage,
} from '../workflows/researchMonitoringWorkflow';

const TABS = [
  { value: 'preview', label: 'Pratinjau' },
  { value: 'verification', label: 'Verifikasi' },
  { value: 'reviewer', label: 'Penilai' },
  { value: 'decision', label: 'Keputusan' },
];

const MetricCard = ({ label, value }) => <div><span>{label}</span><strong>{value}</strong></div>;
const reviewerMeta = {
  unassigned: { label: 'Belum ditugaskan', tone: 'orange' },
  waiting: { label: 'Menunggu penilaian', tone: 'blue' },
  reviewed: { label: 'Sudah dinilai', tone: 'purple' },
};
const verificationMeta = {
  pending: { label: 'Belum diverifikasi', tone: 'orange' },
  verified: { label: 'Telah diverifikasi', tone: 'green' },
  rejected: { label: 'Perlu perbaikan', tone: 'red' },
};
const decisionMeta = {
  waiting: { label: 'Menunggu penilaian', tone: 'blue' },
  ready: { label: 'Siap diputuskan', tone: 'orange' },
  decided: { label: 'Sudah diputuskan', tone: 'green' },
};

const defaultDeadline = () => {
  const date = new Date(Date.now() + (14 * 86400000));
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 16);
};

const averageReviewScore = draft => {
  const reviews = draftReviews(draft);
  if (!reviews.length) return 0;
  return Math.round((reviews.reduce((sum, review) => sum + Number(review.totalScore || 0), 0) / reviews.length) * 100) / 100;
};

export default function ResearchMonitoringWorkspace() {
  const { data, setData, showToast, user, markNotificationsRead } = useRis();
  const history = useHistory();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const requestedTab = query.get('stage');
  const focusedDraftId = query.get('focus');
  const activeTab = TABS.some(tab => tab.value === requestedTab) ? requestedTab : 'preview';
  const indicators = useMemo(() => getNotificationIndicatorMap(data, user), [data, user]);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('all');
  const [schemeId, setSchemeId] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [verificationDraft, setVerificationDraft] = useState(null);
  const [checks, setChecks] = useState({});
  const [verificationNotes, setVerificationNotes] = useState('');
  const [assignmentDraft, setAssignmentDraft] = useState(null);
  const [selectedReviewerIds, setSelectedReviewerIds] = useState([]);
  const [reviewDeadline, setReviewDeadline] = useState(defaultDeadline);
  const [modalError, setModalError] = useState('');
  const [reviewDraft, setReviewDraft] = useState(null);
  const [decisionDraft, setDecisionDraft] = useState(null);
  const [decision, setDecision] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionSaving, setDecisionSaving] = useState(false);

  const schemes = (data.schemes || []).filter(scheme => !scheme.deletedAt);
  const drafts = (data.drafts || []).filter(draft => draftStatus(draft) !== STATUS.ARCHIVED);
  const schemeFor = draft => schemes.find(item => item.id === draft.schemeId) || {};
  const yearOptions = useMemo(() => [...new Set(drafts.map(draft => proposalYear(draft, schemes.find(item => item.id === draft.schemeId))).filter(value => value !== '-'))].sort((left, right) => Number(right) - Number(left)), [drafts, schemes]);
  const stagePool = useMemo(() => {
    if (activeTab === 'verification') return drafts.filter(draft => draftStatus(draft) !== STATUS.DRAFT);
    if (activeTab === 'reviewer') return drafts.filter(draft => draft.verification && draft.verification.status === 'verified');
    if (activeTab === 'decision') return drafts.filter(draft => draftReviews(draft).length > 0 || draft.decision);
    return drafts;
  }, [activeTab, drafts]);
  const visibleDrafts = useMemo(() => stagePool.filter(draft => {
    const scheme = schemes.find(item => item.id === draft.schemeId) || {};
    const haystack = `${(draft.project && draft.project.title) || ''} ${draft.userName || ''} ${getSchemeTitle(scheme)}`.toLowerCase();
    const stage = activeTab === 'verification' ? verificationStage(draft) : activeTab === 'reviewer' ? reviewerStage(draft) : activeTab === 'decision' ? decisionStage(draft) : draftStatus(draft);
    return haystack.includes(search.trim().toLowerCase())
      && (!focusedDraftId || draft.id === focusedDraftId)
      && (year === 'all' || String(proposalYear(draft, scheme)) === year)
      && (schemeId === 'all' || draft.schemeId === schemeId)
      && (stageFilter === 'all' || stage === stageFilter);
  }), [activeTab, focusedDraftId, schemeId, schemes, search, stageFilter, stagePool, year]);

  const setTab = value => {
    markNotificationsRead(indicators[`research:monitoring:${value}`] || []);
    history.replace(`${location.pathname}?stage=${value}`);
    setStageFilter('all');
    setSearch('');
    setYear('all');
    setSchemeId('all');
  };
  const resetFilters = () => {
    history.replace(`${location.pathname}?stage=${activeTab}`);
    setSearch('');
    setYear('all');
    setSchemeId('all');
    setStageFilter('all');
  };
  const openDetail = draft => history.push(`/ris/pengajuan-penelitian-internal/${draft.id}/preview?hideDecision=1`);

  const openVerification = draft => {
    setVerificationDraft(draft);
    setChecks(createVerificationChecklist(draft));
    setVerificationNotes((draft.verification && draft.verification.notes) || '');
    setModalError('');
  };
  const saveVerification = () => {
    const complete = VERIFICATION_CHECKS.every(item => checks[item.key]);
    if (!complete && !verificationNotes.trim()) {
      setModalError('Isi catatan perbaikan untuk data yang belum lengkap.');
      return;
    }
    setData(current => applyProposalVerification(current, verificationDraft.id, checks, verificationNotes, user));
    setVerificationDraft(null);
    showToast({ tone: complete ? 'success' : 'warning', title: 'Verifikasi tersimpan', message: complete ? 'Proposal siap masuk ke tahap penugasan penilai.' : 'Proposal dikembalikan kepada dosen untuk diperbaiki.' });
  };

  const openAssignment = draft => {
    const active = draftReviewerAssignments(draft).filter(isActiveReviewerAssignment);
    const existingDeadline = active.find(item => item.dueAt || item.deadline);
    setAssignmentDraft(draft);
    setSelectedReviewerIds(active.map(item => item.reviewerUserId));
    setReviewDeadline(existingDeadline ? new Date(new Date(existingDeadline.dueAt || existingDeadline.deadline).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : defaultDeadline());
    setModalError('');
  };
  const saveAssignment = () => {
    const locked = draftReviewerAssignments(assignmentDraft).filter(item => item.status === 'submitted').map(item => item.reviewerUserId);
    if (!selectedReviewerIds.length || locked.some(id => !selectedReviewerIds.includes(id))) {
      setModalError('Pilih minimal satu dosen. Penilai yang sudah memberikan penilaian tidak dapat dilepas.');
      return;
    }
    const deadline = new Date(reviewDeadline);
    if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
      setModalError('Tenggat penilaian harus melewati waktu saat ini.');
      return;
    }
    setData(current => applyReviewerAssignments(current, assignmentDraft.id, selectedReviewerIds, deadline.toISOString(), user));
    setAssignmentDraft(null);
    showToast({ tone: 'success', title: 'Penilai ditugaskan', message: 'Hak penilai sementara dan tenggat penilaian berhasil diperbarui.' });
  };
  const sendReminder = draft => {
    const pending = draftReviewerAssignments(draft).filter(item => !['submitted', 'revoked'].includes(item.status));
    if (!pending.length) return;
    setData(current => appendReviewerReminders(current, draft.id, user));
    showToast({ tone: 'success', title: 'Pengingat terkirim', message: `Pengingat dikirim kepada ${pending.length} penilai melalui notifikasi dan antrean email.` });
  };

  const openDecision = draft => {
    setDecisionDraft(draft);
    setDecision('');
    setDecisionNotes('');
    setModalError('');
  };
  const saveDecision = async () => {
    if (decisionSaving) return;
    if (!decision || !decisionNotes.trim()) {
      setModalError('Pilih keputusan final dan isi catatan keputusan.');
      return;
    }
    setDecisionSaving(true);
    setModalError('');
    try {
      const result = await setData(current => applyProposalDecision(current, decisionDraft.id, decision, decisionNotes, user), { optimistic: false });
      if (!result.ok) { setModalError(result.error.message); return; }
      setDecisionDraft(null);
      showToast({ tone: decision === 'funded' ? 'success' : 'info', title: 'Keputusan tersimpan', message: decision === 'funded' ? 'Proposal telah disetujui dan ditetapkan sebagai penelitian didanai.' : 'Keputusan final proposal berhasil disimpan.' });
    } catch (error) { setModalError(error.message); } finally { setDecisionSaving(false); }
  };

  const renderFilters = options => <section className="ris-list-filters ris-monitoring-filters" aria-label={`Filter ${activeTab}`}>
    <div className="ris-search"><Icon name="search" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari judul, pengaju, atau skema..." aria-label="Cari proposal" /></div>
    <select value={year} onChange={event => setYear(event.target.value)} aria-label="Tahun penelitian"><option value="all">Semua tahun</option>{yearOptions.map(value => <option value={value} key={value}>{value}</option>)}</select>
    <select value={schemeId} onChange={event => setSchemeId(event.target.value)} aria-label="Skema penelitian"><option value="all">Semua skema</option>{schemes.map(scheme => <option value={scheme.id} key={scheme.id}>{getSchemeTitle(scheme)}</option>)}</select>
    <select value={stageFilter} onChange={event => setStageFilter(event.target.value)} aria-label="Status tahap"><option value="all">Semua status</option>{options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select>
    {(focusedDraftId || search || year !== 'all' || schemeId !== 'all' || stageFilter !== 'all') && <button type="button" className="ris-filter-reset" onClick={resetFilters}>Tampilkan semua</button>}
  </section>;

  const renderPreview = () => <React.Fragment>
    {renderFilters(Object.values(STATUS).map(value => ({ value, label: proposalDisplayMeta({ status: value }).label })))}
    <div className="ris-table-wrap"><table className="ris-table ris-action-table"><thead><tr><th>No.</th><th>Judul Penelitian</th><th>Pengaju</th><th>Skema</th><th>Tahun</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{visibleDrafts.map((draft, index) => {
      const meta = proposalDisplayMeta(draft);
      return <tr key={draft.id}><td>{index + 1}.</td><td className="ris-title-cell"><strong>{(draft.project && draft.project.title) || 'Tanpa judul'}</strong></td><td>{draft.userName || '-'}</td><td>{getSchemeTitle(schemeFor(draft))}</td><td>{proposalYear(draft, schemeFor(draft))}</td><td><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td><td><button type="button" className="ris-action gray" onClick={() => openDetail(draft)}>Lihat</button></td></tr>;
    })}{visibleDrafts.length === 0 && <EmptyRow colSpan={7}>Tidak ada proposal yang sesuai.</EmptyRow>}</tbody></table></div>
  </React.Fragment>;

  const renderVerification = () => {
    const counts = stagePool.reduce((result, draft) => ({ ...result, [verificationStage(draft)]: result[verificationStage(draft)] + 1 }), { pending: 0, verified: 0, rejected: 0 });
    return <React.Fragment><section className="ris-letter-stats ris-monitoring-stats"><MetricCard label="Total Verifikasi" value={stagePool.length} /><MetricCard label="Belum Verifikasi" value={counts.pending} /><MetricCard label="Telah Diverifikasi" value={counts.verified} /><MetricCard label="Perlu Perbaikan" value={counts.rejected} /></section>
      {renderFilters(Object.entries(verificationMeta).map(([value, meta]) => ({ value, label: meta.label })))}
      <div className="ris-table-wrap"><table className="ris-table ris-action-table"><thead><tr><th>No.</th><th>Judul</th><th>Tahun</th><th>Skema</th><th>Status</th><th>Verifikasi</th><th>Detail</th></tr></thead><tbody>{visibleDrafts.map((draft, index) => {
        const stage = verificationStage(draft); const meta = verificationMeta[stage]; const actionable = canVerifyDraft(draft, user);
        return <tr key={draft.id}><td>{index + 1}.</td><td className="ris-title-cell"><strong>{(draft.project && draft.project.title) || 'Tanpa judul'}</strong></td><td>{proposalYear(draft, schemeFor(draft))}</td><td>{getSchemeTitle(schemeFor(draft))}</td><td><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td><td><button type="button" disabled={!actionable} className={`ris-action ${actionable ? 'cyan' : 'gray'}`} onClick={() => openVerification(draft)}>{actionable ? 'Verifikasi' : stage === 'verified' ? 'Terverifikasi' : 'Menunggu submit ulang'}</button></td><td><button type="button" className="ris-action gray" onClick={() => openDetail(draft)}>Lihat</button></td></tr>;
      })}{visibleDrafts.length === 0 && <EmptyRow colSpan={7}>Tidak ada proposal pada tahap verifikasi ini.</EmptyRow>}</tbody></table></div>
    </React.Fragment>;
  };

  const renderReviewer = () => {
    const counts = stagePool.reduce((result, draft) => ({ ...result, [reviewerStage(draft)]: result[reviewerStage(draft)] + 1 }), { unassigned: 0, waiting: 0, reviewed: 0 });
    return <React.Fragment><section className="ris-letter-stats ris-monitoring-stats"><MetricCard label="Total Proposal" value={stagePool.length} /><MetricCard label="Belum Ada Penilai" value={counts.unassigned} /><MetricCard label="Menunggu Penilaian" value={counts.waiting} /><MetricCard label="Sudah Dinilai" value={counts.reviewed} /></section>
      {renderFilters(Object.entries(reviewerMeta).map(([value, meta]) => ({ value, label: meta.label })))}
      <div className="ris-table-wrap"><table className="ris-table ris-action-table ris-reviewer-monitoring-table"><thead><tr><th>No.</th><th>Judul</th><th>Tahun</th><th>Status Proposal</th><th>Ajukan Penilai</th><th>Nama Penilai</th><th>Status Penilai</th><th>Hasil Penilaian</th></tr></thead><tbody>{visibleDrafts.map((draft, index) => {
        const reviews = draftReviews(draft); const reviewedUserIds = reviews.map(review => review.reviewerUserId); const assignments = draftReviewerAssignments(draft).filter(assignment => isActiveReviewerAssignment(assignment) || reviewedUserIds.includes(assignment.reviewerUserId)); const pendingAssignments = assignments.filter(assignment => isActiveReviewerAssignment(assignment) && assignment.status !== 'submitted'); const stage = reviewerStage(draft); const meta = reviewerMeta[stage]; const assignable = canAssignReviewer(draft, user);
        return <tr key={draft.id}><td>{index + 1}.</td><td className="ris-title-cell"><strong>{(draft.project && draft.project.title) || 'Tanpa judul'}</strong><small>{getSchemeTitle(schemeFor(draft))}</small></td><td>{proposalYear(draft, schemeFor(draft))}</td><td><StatusBadge tone={proposalDisplayMeta(draft).tone}>{proposalDisplayMeta(draft).label}</StatusBadge></td><td><button type="button" disabled={!assignable} className={`ris-action ${assignable ? 'blue' : 'gray'}`} onClick={() => openAssignment(draft)}>{assignable ? (assignments.length ? 'Atur Penilai' : 'Pilih Penilai') : 'Selesai'}</button></td><td><div className="ris-reviewer-name-list">{assignments.length ? assignments.map(assignment => { const account = (data.systemUsers || []).find(item => item.id === assignment.reviewerUserId); return <span key={assignment.id}>{account ? account.name : assignment.reviewerUserId}</span>; }) : <span>-</span>}</div></td><td><div className="ris-reviewer-status-cell"><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>{pendingAssignments.length > 0 && <button type="button" className="ris-action yellow" onClick={() => sendReminder(draft)}><Icon name="bell" size={14} />Ingatkan</button>}</div></td><td>{reviews.length ? <button type="button" className="ris-action purple" onClick={() => setReviewDraft(draft)}>Lihat ({reviews.length})</button> : <span className="ris-muted">Belum ada</span>}</td></tr>;
      })}{visibleDrafts.length === 0 && <EmptyRow colSpan={8}>Tidak ada proposal terverifikasi yang sesuai.</EmptyRow>}</tbody></table></div>
    </React.Fragment>;
  };

  const renderDecision = () => {
    const counts = stagePool.reduce((result, draft) => ({ ...result, [decisionStage(draft)]: result[decisionStage(draft)] + 1 }), { waiting: 0, ready: 0, decided: 0 });
    return <React.Fragment><section className="ris-letter-stats ris-monitoring-stats"><MetricCard label="Total Kandidat" value={stagePool.length} /><MetricCard label="Menunggu Penilaian" value={counts.waiting} /><MetricCard label="Siap Diputuskan" value={counts.ready} /><MetricCard label="Sudah Diputuskan" value={counts.decided} /></section>
      {renderFilters(Object.entries(decisionMeta).map(([value, meta]) => ({ value, label: meta.label })))}
      <div className="ris-table-wrap"><table className="ris-table ris-action-table"><thead><tr><th>No.</th><th>Proposal</th><th>Tahun</th><th>Keterangan</th><th>Status</th><th>Detail</th><th>Keputusan</th></tr></thead><tbody>{visibleDrafts.map((draft, index) => {
        const stage = decisionStage(draft); const meta = decisionMeta[stage]; const reviews = draftReviews(draft); const decidable = canDecideDraft(draft, user); const lead = (draft.members || []).find(member => member.role === 'ketua') || (draft.members || [])[0] || {};
        return <tr key={draft.id}><td>{index + 1}.</td><td><div className="ris-proposal-stack"><strong>{(draft.project && draft.project.title) || 'Tanpa judul'}</strong><span>{lead.name || draft.userName || '-'}</span><small>{getSchemeTitle(schemeFor(draft))}</small></div></td><td>{proposalYear(draft, schemeFor(draft))}</td><td><div className="ris-proposal-review-note"><strong>{reviews.length} hasil penilaian</strong><span>{reviews.length ? `Rata-rata skor ${averageReviewScore(draft)}` : 'Menunggu penilaian'}</span></div></td><td><StatusBadge tone={meta.tone}>{draft.decision ? proposalDisplayMeta(draft).label : meta.label}</StatusBadge></td><td><button type="button" className="ris-action gray" onClick={() => openDetail(draft)}>Lihat</button></td><td><button type="button" disabled={!decidable} className={`ris-action ${decidable ? 'green' : 'gray'}`} onClick={() => openDecision(draft)}>{decidable ? 'Putuskan' : draft.decision ? 'Selesai' : 'Belum siap'}</button></td></tr>;
      })}{visibleDrafts.length === 0 && <EmptyRow colSpan={7}>Belum ada proposal dengan hasil penilaian.</EmptyRow>}</tbody></table></div>
    </React.Fragment>;
  };

  const candidates = assignmentDraft ? reviewerCandidates(data, assignmentDraft) : [];
  const lockedReviewerIds = assignmentDraft ? draftReviewerAssignments(assignmentDraft).filter(item => item.status === 'submitted').map(item => item.reviewerUserId) : [];
  const reviewsInModal = reviewDraft ? draftReviews(reviewDraft) : [];

  return <div className="ris-page ris-workspace-page ris-monitoring-workspace">
    <PageHeader title="Pemantauan Penelitian" description="Pantau proposal dari penerimaan data, verifikasi, penugasan penilai, hingga keputusan akhir." />
    <div className="ris-tabs ris-scheme-data-tabs ris-monitoring-tabs" role="tablist" aria-label="Tahap monitoring penelitian">{TABS.map(tab => <button type="button" role="tab" aria-selected={activeTab === tab.value} className={activeTab === tab.value ? 'active' : ''} key={tab.value} onClick={() => setTab(tab.value)}>{tab.label}<NotificationDot visible={Boolean(indicators[`research:monitoring:${tab.value}`] && indicators[`research:monitoring:${tab.value}`].length)} /></button>)}</div>
    <section className="ris-monitoring-panel">{activeTab === 'preview' ? renderPreview() : activeTab === 'verification' ? renderVerification() : activeTab === 'reviewer' ? renderReviewer() : renderDecision()}</section>

    {verificationDraft && <Modal title="Verifikasi Kelengkapan Data" width={720} onClose={() => setVerificationDraft(null)}><div className="ris-modal-body"><p className="ris-modal-intro">{verificationDraft.project.title}</p><FloatingError message={modalError} /><div className="ris-monitoring-checklist">{VERIFICATION_CHECKS.map(item => <label key={item.key}><input type="checkbox" checked={Boolean(checks[item.key])} onChange={event => { setChecks(current => ({ ...current, [item.key]: event.target.checked })); setModalError(''); }} /><span><strong>{item.label}</strong><small>{checks[item.key] ? 'Data dinyatakan lengkap' : 'Perlu diperbaiki oleh pengaju'}</small></span><StatusBadge tone={checks[item.key] ? 'green' : 'red'}>{checks[item.key] ? 'Lengkap' : 'Belum lengkap'}</StatusBadge></label>)}</div><Field label="Catatan Verifikasi" alignStart hint="Wajib diisi bila ada data yang belum lengkap."><textarea rows="4" value={verificationNotes} onChange={event => { setVerificationNotes(event.target.value); setModalError(''); }} placeholder="Tuliskan catatan pemeriksaan atau perbaikan..." /></Field><div className="ris-modal-actions"><Button tone="gray" onClick={() => setVerificationDraft(null)}>Batal</Button><Button tone={VERIFICATION_CHECKS.every(item => checks[item.key]) ? 'green' : 'red'} onClick={saveVerification}>Simpan Verifikasi</Button></div></div></Modal>}

    {assignmentDraft && <Modal title="Atur Penilai Proposal" width={1080} onClose={() => setAssignmentDraft(null)}><div className="ris-modal-body"><div className="ris-section-title"><div><strong>{assignmentDraft.project.title}</strong><p className="ris-muted">Pilih satu atau beberapa dosen. Hak penilai hanya aktif selama penugasan proposal ini.</p></div><Field label="Tenggat Penilaian" required><input type="datetime-local" value={reviewDeadline} onChange={event => { setReviewDeadline(event.target.value); setModalError(''); }} /></Field></div><FloatingError message={modalError} /><div className="ris-table-wrap"><table className="ris-table ris-table-left"><thead><tr><th aria-label="Pilih" /><th>Dosen</th><th>Afiliasi</th><th>Keahlian</th><th>Penilaian Selesai</th><th>Status</th></tr></thead><tbody>{candidates.map(candidate => { const checked = selectedReviewerIds.includes(candidate.userId); const locked = lockedReviewerIds.includes(candidate.userId); return <tr key={candidate.id}><td><input type="checkbox" checked={checked} disabled={locked} onChange={() => { setSelectedReviewerIds(current => { if (current.includes(candidate.userId)) return current.filter(id => id !== candidate.userId); return [...current, candidate.userId]; }); setModalError(''); }} aria-label={`Pilih ${candidate.name}`} /></td><td><strong>{candidate.name}</strong><small className="ris-table-secondary">{candidate.email || candidate.nidn}</small></td><td>{candidate.faculty}<small className="ris-table-secondary">{candidate.program}</small></td><td><div className="ris-chip-list">{candidate.expertise.length ? candidate.expertise.map(item => <span key={item}>{item}</span>) : <span>Belum diisi</span>}</div></td><td>{candidate.reviewCount}</td><td><StatusBadge tone={locked ? 'purple' : checked ? 'green' : 'gray'}>{locked ? 'Sudah menilai' : checked ? 'Dipilih' : 'Belum dipilih'}</StatusBadge></td></tr>; })}{candidates.length === 0 && <EmptyRow colSpan={6}>Tidak ada dosen aktif yang tersedia.</EmptyRow>}</tbody></table></div><div className="ris-modal-actions"><Button tone="gray" onClick={() => setAssignmentDraft(null)}>Batal</Button><Button onClick={saveAssignment}>Simpan Penugasan</Button></div></div></Modal>}

    {reviewDraft && <Modal title="Hasil Penilaian" width={900} onClose={() => setReviewDraft(null)}><div className="ris-modal-body"><p className="ris-modal-intro">{reviewDraft.project.title}</p><div className="ris-review-results-list">{reviewsInModal.map((review, index) => { const account = (data.systemUsers || []).find(item => item.id === review.reviewerUserId) || {}; return <article key={review.id || review.reviewerUserId}><div><span>Penilai {index + 1}</span><strong>{account.name || review.reviewerName || '-'}</strong><small>{formatDate(review.submittedAt)}</small></div><dl><div><dt>Total Skor</dt><dd>{review.totalScore || '-'}</dd></div><div><dt>Rekomendasi</dt><dd>{review.recommendation || '-'}</dd></div><div><dt>Kekuatan</dt><dd>{review.strengths || '-'}</dd></div><div><dt>Kekurangan</dt><dd>{review.weaknesses || '-'}</dd></div><div><dt>Catatan Anggaran</dt><dd>{review.budgetNotes || '-'}</dd></div><div><dt>Catatan Luaran</dt><dd>{review.outputNotes || '-'}</dd></div></dl></article>; })}</div><div className="ris-modal-actions"><Button tone="gray" onClick={() => setReviewDraft(null)}>Tutup</Button></div></div></Modal>}

    {decisionDraft && <Modal title="Keputusan Akhir Proposal" width={760} onClose={() => { if (!decisionSaving) setDecisionDraft(null); }}><div className="ris-modal-body"><p className="ris-modal-intro">{decisionDraft.project.title}</p><ProposalDecisionReviewSummary draft={decisionDraft} users={data.systemUsers || []} /><FloatingError message={modalError} /><Field label="Keputusan Akhir" required><select disabled={decisionSaving} value={decision} onChange={event => { setDecision(event.target.value); setModalError(''); }}><option value="">Pilih keputusan</option><option value="funded">Setujui dan Danai</option><option value="revision">Minta Revisi</option><option value="rejected">Tolak Proposal</option></select></Field><Field label="Catatan Keputusan" required alignStart><textarea disabled={decisionSaving} rows="5" value={decisionNotes} onChange={event => { setDecisionNotes(event.target.value); setModalError(''); }} placeholder="Tuliskan alasan dan arahan keputusan..." /></Field><div className="ris-modal-actions"><Button tone="gray" disabled={decisionSaving} onClick={() => setDecisionDraft(null)}>Batal</Button><Button tone={decision === 'funded' ? 'green' : 'blue'} disabled={decisionSaving} onClick={saveDecision}>{decisionSaving ? 'Menyimpan...' : decision === 'funded' ? 'Setujui Pendanaan' : 'Simpan Keputusan'}</Button></div></div></Modal>}
  </div>;
}
