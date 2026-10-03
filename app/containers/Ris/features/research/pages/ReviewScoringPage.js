/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React, { useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import { Button, FloatingError, PageHeader } from '../../../shared/components/Ui';
import Icon from '../../../shared/components/Icon';
import {
  REVIEW_CRITERIA, SDGS, formatCurrency, formatDate, uid
} from '../../../core/data';
import {
  STATUS, canManageResearch, canScoreDraft, draftReviewerAssignments, draftReviews, getSchemeTitle, reviewerAssignmentForUser, transitionDraftStatus
} from '../../../shared/workflows/workflow';
import { outputDefinitionLabel } from '../workflows/schemeConfiguration';
import { proposalBudgetTotal, sumBudgetItems } from '../workflows/proposalBudget';
import {
  createEmptyReviewScores, reviewScoreErrors, validateProposalReview
} from '../workflows/reviewScoringWorkflow';

const valueOrDash = value => (value === null || value === undefined || value === '' ? '-' : value);
const fileSource = file => file && (file.fileUrl || file.risFileUrl || file.url || file.dataUrl || file.previewUrl || '');
const fileSize = size => (Number(size) > 0 ? `${(Number(size) / 1048576).toFixed(Number(size) >= 1048576 ? 1 : 2)} MB` : 'Ukuran tidak tersedia');
const outputFields = output => {
  const common = [['Deskripsi', output.description]];
  if (output.category === 'jurnal') return [['Target tingkat jurnal', output.journalTargetLevel], ['Target indeks jurnal', output.journalIndexTarget], ['Jenis publikasi', output.publicationType], ['Kuartil', output.targetQuartile], ...common];
  if (output.category === 'prosiding') return [['Jenis prosiding', output.proceedingType], ['Target indeks', output.indexTarget], ...common];
  if (output.category === 'buku') return [['Jenis buku', output.bookType], ['Target penerbit', output.publisherTarget], ['Rencana ISBN', output.isbnPlan], ...common];
  if (output.category === 'hki') return [['Jenis HKI', output.hkiType], ['Target tahun pendaftaran', output.targetRegistrationYear], ...common];
  if (output.category === 'produk_prototipe') return [['Jenis produk', output.productType], ['Target TKT', output.targetTkt], ['Bentuk luaran', output.expectedOutputForm], ...common];
  return [['Jenis luaran', output.otherOutputType], ...common];
};

function ProposalFiles({ files }) {
  if (!files.length) return <p className="ris-muted">Tidak ada lampiran yang diajukan.</p>;
  return (
    <div className="ris-review-file-list">
      {files.map(file => {
        const source = fileSource(file);
        const label = file.requirementName || file.category || 'Lampiran proposal';
        return (
          <article key={file.id || `${label}-${file.name}`}>
            <div><span>{label}</span><strong>{file.name || file.fileName || 'Berkas tanpa nama'}</strong><small>{fileSize(file.size || file.fileSize)}{file.uploadedAt ? ` • ${formatDate(file.uploadedAt)}` : ''}</small></div>
            {source ? <a href={source} download={source.indexOf('data:') === 0 ? (file.name || file.fileName) : undefined}><Icon name="download" size={16} />Unduh</a> : <span className="ris-file-unavailable">Berkas belum tersedia</span>}
          </article>
        );
      })}
    </div>
  );
}

function ProposalReviewPanel({ draft, scheme }) {
  const project = draft.project || {};
  const members = draft.members || [];
  const budgets = draft.budgets || [];
  const outputs = draft.outputs || [];
  const sdgs = (project.sdgs || []).map(id => (SDGS.find(item => item.id === id) || {}).name || id).join(', ');
  return (
    <div className="ris-review-proposal-content">
      <section className="ris-review-proposal-section">
        <h2>Deskripsi Penelitian</h2>
        <dl className="ris-review-details"><div><dt>Judul penelitian</dt><dd>{valueOrDash(project.title)}</dd></div><div><dt>Skema penelitian</dt><dd>{getSchemeTitle(scheme)}</dd></div><div><dt>Target TKT</dt><dd>{valueOrDash(project.targetTkt)}</dd></div><div><dt>Keterkaitan RIP</dt><dd>{valueOrDash(project.ripRelation)}</dd></div><div><dt>Pusat riset</dt><dd>{project.researchCenterRelation === 'other' ? valueOrDash(project.researchCenterOther) : valueOrDash(project.researchCenterRelation)}</dd></div><div><dt>SDG</dt><dd>{valueOrDash(sdgs)}</dd></div><div><dt>Integrasi mata kuliah</dt><dd>{project.integrated ? `${valueOrDash(project.courseName)}${project.academicYear ? ` (${project.academicYear})` : ''}` : 'Tidak'}</dd></div></dl>
      </section>
      <section className="ris-review-proposal-section">
        <h2>Member</h2>
        <div className="ris-table-wrap"><table className="ris-table ris-table-left ris-review-member-table"><thead><tr><th>No.</th><th>Peran</th><th>Nama</th><th>Identitas</th><th>Afiliasi</th></tr></thead><tbody>{members.map((member, index) => <tr key={member.id || `${member.name}-${index}`}><td>{index + 1}</td><td>{member.role === 'ketua' ? 'Ketua' : 'Anggota'}</td><td>{valueOrDash(member.name)}</td><td>{valueOrDash(member.nidn || member.nim)}</td><td>{[member.program, member.faculty].filter(Boolean).join(' • ') || '-'}</td></tr>)}</tbody></table></div>
      </section>
      <section className="ris-review-proposal-section">
        <div className="ris-review-section-title"><h2>Anggaran</h2><strong>{formatCurrency(proposalBudgetTotal(draft))}</strong></div>
        {budgets.length ? <div className="ris-table-wrap"><table className="ris-table ris-table-left ris-review-budget-table"><thead><tr><th>Komponen</th><th>Item</th><th>Jumlah</th><th>Satuan</th><th>Harga Satuan</th><th>Total</th></tr></thead><tbody>{budgets.map(item => <tr key={item.id}><td>{valueOrDash(item.component)}</td><td>{valueOrDash(item.name)}</td><td>{valueOrDash(item.volume)}</td><td>{valueOrDash(item.unit)}</td><td>{formatCurrency(item.unitPrice)}</td><td>{formatCurrency(Number(item.volume || 0) * Number(item.unitPrice || 0))}</td></tr>)}</tbody><tfoot><tr><td colSpan="5">Total rincian anggaran</td><td>{formatCurrency(sumBudgetItems(budgets))}</td></tr></tfoot></table></div> : <p className="ris-muted">Rincian item belum tersedia. Lihat dokumen RAB pada lampiran.</p>}
      </section>
      <section className="ris-review-proposal-section">
        <h2>Luaran Hasil</h2>
        <div className="ris-review-output-list">{outputs.map(output => <article key={output.id}><header><span>{output.type === 'wajib' ? 'Luaran wajib' : 'Luaran tambahan'}</span><strong>{outputDefinitionLabel(output)}</strong></header><dl>{outputFields(output).filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article>)}</div>
      </section>
      <section className="ris-review-proposal-section">
        <h2>Lampiran Proposal</h2>
        <ProposalFiles files={(draft.files || []).filter(file => file && (file.name || file.fileName))} />
      </section>
    </div>
  );
}

export default function ReviewScoringPage() {
  const { draftId } = useParams();
  const { data, setData, user } = useRis();
  const history = useHistory();
  const draft = data.drafts.find(item => item.id === draftId);
  const [scores, setScores] = useState(() => createEmptyReviewScores(REVIEW_CRITERIA));
  const [recommendation, setRecommendation] = useState('');
  const [notes, setNotes] = useState({
    strengths: '', weaknesses: '', budgetNotes: '', outputNotes: '', revisionNotes: ''
  });
  const [layout, setLayout] = useState('split');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [error, setError] = useState('');
  const groups = useMemo(() => REVIEW_CRITERIA.reduce((result, item) => ({ ...result, [item.group]: [...(result[item.group] || []), item] }), {}), []);
  const weightedScore = REVIEW_CRITERIA.reduce((sum, item) => sum + (((Number(scores[item.code]) || 0) * item.weight) / 100), 0);
  const totalScore = Math.round(weightedScore * 100) / 100;
  const autoRecommendation = totalScore >= 80 ? 'Disetujui' : totalScore >= 55 ? 'Perlu Revisi' : 'Ditolak';
  if (!draft) return <div className="ris-page"><h1>Pengajuan tidak ditemukan</h1></div>;
  if (!canScoreDraft(draft, user)) return <div className="ris-page"><h1>Penilaian tidak dapat diproses</h1></div>;
  const scheme = (data.schemes || []).find(item => item.id === draft.schemeId) || {};
  const scoreErrors = reviewScoreErrors(REVIEW_CRITERIA, scores);

  const updateScore = (code, value) => {
    const numeric = Number(value);
    const next = value === '' ? '' : (Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : '');
    setScores(current => ({ ...current, [code]: next }));
    setError('');
  };
  const updateNote = (key, value) => setNotes(current => ({ ...current, [key]: value }));
  const submit = () => {
    setSubmitAttempted(true);
    const validationError = validateProposalReview(REVIEW_CRITERIA, scores, recommendation);
    if (validationError) { setError(validationError); return; }
    const submittedAt = new Date().toISOString();
    const assignment = reviewerAssignmentForUser(draft, user);
    const review = {
      id: uid('review'), reviewerUserId: user.id, reviewerProfileId: user.profileId || (assignment && assignment.reviewerProfileId), reviewerName: user.name, scores, totalScore, recommendation, ...notes, submittedAt
    };
    setData(current => {
      const decisionMakers = (current.systemUsers || []).filter(item => canManageResearch(item) && item.isActive !== false);
      const notifications = decisionMakers.map(decisionMaker => ({
        id: uid('notif'),
        userId: decisionMaker.id,
        fromUserId: user.id,
        entityType: 'research_draft',
        entityId: draft.id,
        type: 'review_submitted',
        message: `Penilaian untuk "${draft.project.title}" sudah dikirim dan menunggu keputusan akhir.`,
        createdAt: submittedAt,
        isRead: false,
      }));
      const currentDraft = current.drafts.find(item => item.id === draft.id);
      const assignments = draftReviewerAssignments(currentDraft).map(item => (item.reviewerUserId === user.id || item.reviewerProfileId === user.profileId ? { ...item, status: 'submitted', submittedAt } : item));
      const reviews = [...draftReviews(currentDraft).filter(item => item.reviewerUserId !== user.id), review];
      const updatedDraft = currentDraft.status === STATUS.UNDER_REVIEW
        ? transitionDraftStatus(currentDraft, STATUS.REVIEWED, { assignments, reviews })
        : { ...currentDraft, status: STATUS.REVIEWED, draftStatus: STATUS.REVIEWED, assignments, reviews };
      return {
        ...current,
        drafts: current.drafts.map(item => (item.id === draft.id ? updatedDraft : item)),
        notifications: [...(current.notifications || []), ...notifications],
      };
    });
    history.push('/ris');
  };

  return (
    <div className="ris-page ris-review-workspace-page">
      <PageHeader title="Formulir Penilaian Proposal" description={draft.project.title} onBack={() => history.goBack()} actions={<Button type="button" className="ris-review-submit-header" onClick={submit}>Kirim Penilaian</Button>} />
      <FloatingError message={error} />
      <div className={`ris-review-workspace ${layout === 'proposal' ? 'proposal-focus' : layout === 'scoring' ? 'scoring-focus' : ''}`}>
        <aside className="ris-review-proposal-pane">
          <div className="ris-review-pane-header"><div><span>Proposal yang dinilai</span><h2>Informasi Pengajuan</h2><p>Seluruh data dan lampiran yang diajukan dosen.</p></div><button type="button" onClick={() => setLayout(layout === 'proposal' ? 'split' : 'proposal')} aria-label={layout === 'proposal' ? 'Tampilkan dua kolom' : 'Fokus pada informasi proposal'} title={layout === 'proposal' ? 'Tampilkan dua kolom' : 'Fokus pada informasi proposal'}><Icon name={layout === 'proposal' ? 'layers' : 'back'} className={layout === 'proposal' ? '' : 'ris-review-expand-right'} size={18} /></button></div>
          <ProposalReviewPanel draft={draft} scheme={scheme} />
        </aside>
        <section className="ris-review-scoring-pane">
          <div className="ris-review-pane-header"><div><span>Penilaian reviewer</span><h2>Formulir Penilaian</h2><p>Isi setiap skor sebelum mengirim hasil penilaian.</p></div><button type="button" onClick={() => setLayout(layout === 'scoring' ? 'split' : 'scoring')} aria-label={layout === 'scoring' ? 'Tampilkan dua kolom' : 'Fokus pada formulir penilaian'} title={layout === 'scoring' ? 'Tampilkan dua kolom' : 'Fokus pada formulir penilaian'}><Icon name={layout === 'scoring' ? 'layers' : 'back'} size={18} /></button></div>
          <div className="ris-review-scoring-content">
            <section className="ris-score-summary"><div><span>Total Skor Penilaian</span><strong>{totalScore}</strong><p>Rekomendasi sistem: <em>{autoRecommendation}</em></p></div><label><span>Rekomendasi Keputusan Akhir <b aria-hidden="true">*</b></span><select value={recommendation} onChange={event => { setRecommendation(event.target.value); setError(''); }} aria-invalid={submitAttempted && !recommendation}><option value="">Pilih rekomendasi</option><option value="approve">Setujui</option><option value="revise">Perlu Revisi</option><option value="reject">Tolak</option></select>{submitAttempted && !recommendation && <small className="ris-field-error">Rekomendasi wajib dipilih.</small>}</label></section>
            <section className="ris-notes-box"><h2>Catatan Tambahan <small>Opsional</small></h2>{[['strengths', 'Kekuatan', 'Kekuatan proposal...'], ['weaknesses', 'Kekurangan', 'Kekurangan proposal...'], ['budgetNotes', 'Catatan Anggaran', 'Catatan terkait anggaran...'], ['outputNotes', 'Catatan Luaran', 'Catatan terkait luaran...'], ['revisionNotes', 'Catatan Revisi', 'Catatan revisi yang diperlukan...']].map(([key, label, placeholder]) => <label key={key}><span>{label}</span><textarea rows="3" value={notes[key]} onChange={event => updateNote(key, event.target.value)} placeholder={placeholder} /></label>)}</section>
            <div className="ris-review-score-groups">{Object.entries(groups).map(([group, items]) => <section className="ris-score-group" key={group}><h2>{group}</h2>{items.map(item => <label key={item.code}><span>{item.label}</span><div><input type="number" min="1" max="100" inputMode="numeric" placeholder="1-100" value={scores[item.code]} onChange={event => updateScore(item.code, event.target.value)} aria-invalid={submitAttempted && Boolean(scoreErrors[item.code])} aria-describedby={submitAttempted && scoreErrors[item.code] ? `${item.code}-error` : undefined} />{submitAttempted && scoreErrors[item.code] && <small id={`${item.code}-error`} className="ris-field-error">{scoreErrors[item.code]}</small>}</div></label>)}</section>)}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
