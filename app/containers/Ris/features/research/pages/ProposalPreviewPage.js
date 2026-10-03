/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import { Button, Field, FloatingError, Modal, PageHeader } from '../../../shared/components/Ui';
import ProposalDecisionReviewSummary from '../components/ProposalDecisionReviewSummary';
import downloadFundingLetterPdf from '../workflows/fundingLetterPdf';
import {
  REVIEW_CRITERIA, SDGS, formatCurrency, formatDate
} from '../../../core/data';
import {
  STATUS,
  canDecideDraft,
  canManageResearch,
  canReviewerViewDraft,
  canScoreDraft,
  canVerifyDraft,
  draftReviewerAssignments,
  draftReviews,
  draftStatus,
  getSchemeTitle,
  isDraftOwner,
} from '../../../shared/workflows/workflow';
import { outputDefinitionLabel } from '../workflows/schemeConfiguration';
import { proposalBudgetTotal, sumBudgetItems } from '../workflows/proposalBudget';
import { applyProposalDecision, applyProposalVerification } from '../workflows/researchMonitoringWorkflow';

const labels = {
  jurnal: 'Jurnal',
  prosiding: 'Prosiding',
  buku: 'Buku',
  hki: 'HKI',
  other: 'Lainnya',
  'produk/prototipe': 'Produk/Prototipe',
  produk_prototipe: 'Produk/Prototipe',
  scopus_q1: 'Artikel Jurnal Scopus Q1',
  scopus_q2: 'Artikel Jurnal Scopus Q2',
  scopus_q3: 'Artikel Jurnal Scopus Q3',
  scopus_q4: 'Artikel Jurnal Scopus Q4',
  sinta_1: 'SINTA 1',
  sinta_2: 'SINTA 2',
  sinta_3: 'SINTA 3',
  sinta_4: 'SINTA 4',
  sinta_5: 'SINTA 5',
  sinta_6: 'SINTA 6',
  paten_sederhana_registered: 'Paten Sederhana (terdaftar)',
  paten_registered: 'Paten (terdaftar)',
  additional_scopus: 'Artikel ilmiah dimuat di jurnal Internasional - Scopus',
  additional_sinta: 'Artikel ilmiah dimuat di jurnal Nasional - SINTA',
  prosiding_scopus: 'Prosiding terindeks Scopus',
  hki_paten: 'HKI - Paten',
  hki_paten_sederhana: 'HKI - Paten Sederhana',
  hki_hak_cipta: 'HKI - Hak Cipta',
  hki_merek_dagang: 'HKI - Merek Dagang',
  hki_rahasia_dagang: 'HKI - Rahasia Dagang',
  hki_desain_produk_industri: 'HKI - Desain Produk Industri',
  hki_indikasi_geografis: 'HKI - Indikasi Geografis',
  hki_perlindungan_varietas_tanaman: 'HKI - Perlindungan Varietas Tanaman',
  hki_topografi_sirkuit: 'HKI - Perlindungan Topografi Sirkuit Terpadu',
  teknologi_tepat_guna: 'Teknologi Tepat Guna',
  model_purwarupa_desain: 'Model / Purwarupa / Desain / Karya Seni / Rekayasa Sosial',
  buku_ajar: 'Buku Ajar',
  prototype: 'Prototipe',
  naskah_kebijakan: 'Naskah Kebijakan',
  karya_monumental: 'Karya Monumental',
  none: 'Tidak Ada',
  approve: 'Setujui',
  revise: 'Perlu Revisi',
  revision: 'Perlu Revisi',
  reject: 'Tolak',
  ict_based: 'ICT Based',
  business_digital_behavoir_technopreneurship: 'Business, Digital Behavior & Technopreneurship',
  business_digital_behavior_technopreneurship: 'Business, Digital Behavior & Technopreneurship',
  digital_content_digital_media_management: 'Digital Content & Digital Media Management',
  design_art_multimedia_for_industry: 'Design, Art & Multimedia for Industry',
  ai_sustainability: 'AI & Sustainability',
  ai_healthcare: 'AI for Healthcare',
  ai_business_social_studies: 'AI for Business & Social Studies',
  renewable_energy: 'Renewable Energy',
  community_empowerment: 'Community Empowerment',
  ecotourism_cultural_sustainability: 'Ecotourism & Cultural Sustainability',
  sustainable_product_design: 'Sustainable Product & Design',
  smart_farming: 'Smart Farming',
};

const verificationLabels = {
  project: 'Deskripsi Penelitian', members: 'Data Anggota', budget: 'Data Anggaran', outputs: 'Luaran Hasil', attachments: 'Data Lampiran'
};

const labelFor = value => labels[value] || value || '-';

const Row = ({ label, children }) => <div className="ris-preview-row"><dt>{label}</dt><dd>{children || '-'}</dd></div>;
Row.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node };
Row.defaultProps = { children: '-' };

function ReviewScoreBreakdown({ review }) {
  const scores = review.scores || {};
  return (
    <div className="ris-review-score-breakdown">
      <h4>Rincian Skor per Kriteria</h4>
      <div className="ris-table-wrap"><table className="ris-table ris-table-left"><thead><tr><th>Kriteria Penilaian</th><th>Aspek</th><th>Skor</th><th>Bobot</th><th>Kontribusi</th></tr></thead><tbody>{REVIEW_CRITERIA.map(item => {
        const score = scores[item.code];
        const contribution = score === '' || score === null || score === undefined ? null : (Number(score) * item.weight) / 100;
        return <tr key={item.code}><td>{item.label}</td><td>{item.group}</td><td>{score ?? '-'}</td><td>{item.weight}%</td><td>{contribution === null ? '-' : contribution.toFixed(2)}</td></tr>;
      })}</tbody><tfoot><tr><td colSpan="4">Total skor penilai</td><td>{review.totalScore ?? '-'}</td></tr></tfoot></table></div>
    </div>
  );
}

export default function ProposalPreviewPage({ mode }) {
  const { draftId } = useParams();
  const { data, setData, user } = useRis();
  const history = useHistory();
  const location = useLocation();
  const draft = data.drafts.find(item => item.id === draftId);
  const [checks, setChecks] = useState({
    project: true, members: true, budget: true, outputs: true, attachments: true
  });
  const [incompleteOpen, setIncompleteOpen] = useState(false);
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionSaving, setDecisionSaving] = useState(false);

  if (!draft) return <div className="ris-page"><h1>Pengajuan tidak ditemukan</h1></div>;
  const allowedPreview = isDraftOwner(draft, user) || canManageResearch(user) || canReviewerViewDraft(draft, user);
  if (!allowedPreview) return <div className="ris-page"><h1>Akses tidak diizinkan</h1></div>;
  if (mode === 'verify' && !canVerifyDraft(draft, user)) return <div className="ris-page"><h1>Status tidak dapat diverifikasi</h1></div>;
  if (mode === 'reviewer' && !canReviewerViewDraft(draft, user)) return <div className="ris-page"><h1>Penilai tidak ditugaskan</h1></div>;
  if (mode === 'decision' && !decisionSaving && !canDecideDraft(draft, user)) return <div className="ris-page"><h1>Belum dapat membuat keputusan</h1></div>;
  const scheme = data.schemes.find(item => item.id === draft.schemeId) || {};
  const reviews = draftReviews(draft);
  const assignments = draftReviewerAssignments(draft);
  const reviewAverage = reviews.length ? Math.round((reviews.reduce((sum, review) => sum + Number(review.totalScore || 0), 0) / reviews.length) * 100) / 100 : 0;
  const complete = Object.values(checks).every(Boolean);

  const submitVerification = () => {
    if (complete) {
      setData(current => applyProposalVerification(current, draft.id, checks, '', user));
      setTimeout(() => history.push('/ris/skema/pengajuan?stage=reviewer'), 0);
    } else setIncompleteOpen(true);
  };

  const markIncomplete = () => {
    setData(current => applyProposalVerification(current, draft.id, checks, 'Data pengajuan belum lengkap.', user));
    history.push('/ris/skema/pengajuan?stage=verification');
  };

  const submitDecision = async () => {
    if (decisionSaving) return;
    if (!decision || !notes.trim()) { setError('Pilih keputusan dan isi catatan keputusan.'); return; }
    setDecisionSaving(true);
    setError('');
    try {
      const result = await setData(current => applyProposalDecision(current, draft.id, decision, notes, user), { optimistic: false });
      if (!result.ok) { setError(result.error.message); return; }
      setDecisionModalOpen(false);
      history.push('/ris/skema/pengajuan?stage=decision');
    } catch (saveError) { setError(saveError.message); } finally { setDecisionSaving(false); }
  };

  const openDecisionModal = () => {
    setDecision('');
    setNotes('');
    setError('');
    setDecisionModalOpen(true);
  };

  return (
    <div className="ris-page">
      <PageHeader title={mode === 'verify' ? 'Verifikasi Pengajuan' : mode === 'reviewer' ? 'Pratinjau Pengajuan untuk Penilai' : mode === 'decision' ? 'Buat Keputusan' : 'Pratinjau Pengajuan'} description={mode === 'preview' ? draft.project.title : ''} onBack={() => history.goBack()} actions={mode === 'preview' && canDecideDraft(draft, user) ? <Button type="button" onClick={openDecisionModal}>Putuskan</Button> : null} />
      <div className="ris-preview">
        <section><h2>Deskripsi Penelitian</h2><dl>
          <Row label="Skema Penelitian">{getSchemeTitle(scheme)}</Row><Row label="Judul Penelitian">{draft.project.title}</Row>
          <Row label="Target TKT">{labelFor(draft.project.targetTkt)}</Row><Row label="Keterkaitan dengan RIP">{labelFor(draft.project.ripRelation)}</Row>
          <Row label="Pusat Riset">{draft.project.researchCenterRelation === 'other' ? (draft.project.researchCenterOther || 'Lainnya') : labelFor(draft.project.researchCenterRelation)}</Row><Row label="SDG">{(draft.project.sdgs || []).map(id => { const sdg = SDGS.find(item => item.id === id); return sdg ? `${sdg.code}. ${sdg.name}` : id; }).join(', ')}</Row>
          <Row label="Integrasi Mata Kuliah">{draft.project.integrated ? 'Ya' : 'Tidak'}</Row>{draft.project.integrated && <React.Fragment><Row label="Nama Mata Kuliah">{draft.project.courseName}</Row><Row label="Tahun Akademik">{draft.project.academicYear}</Row></React.Fragment>}
        </dl></section>
        <section><h2>Anggota</h2><div className="ris-table-wrap"><table className="ris-table ris-table-left"><thead><tr><th>No.</th><th>Peran</th><th>Nama</th><th>Tipe</th><th>NIDN / NIM</th><th>Program Studi</th><th>Fakultas</th><th>ORCID</th></tr></thead><tbody>{draft.members.map((member, index) => <tr key={member.id}><td>{index + 1}.</td><td>{member.role === 'ketua' ? 'Ketua' : 'Anggota'}</td><td>{member.name}</td><td>{member.type === 'internal_lecturer' ? 'Dosen Internal' : member.type === 'external_lecturer' ? 'Dosen Eksternal' : 'Mahasiswa'}</td><td>{member.nidn || member.nim}</td><td>{member.program}</td><td>{member.faculty}</td><td>{member.orcid || '-'}</td></tr>)}</tbody></table></div></section>
        <section><h2>Data Anggaran</h2><dl><Row label={Number(draft.requestedBudget) > 0 ? 'Total Anggaran RAB' : 'Total Rincian Anggaran'}>{Number(draft.requestedBudget) > 0 || (draft.budgets || []).length ? formatCurrency(proposalBudgetTotal(draft)) : '-'}</Row></dl>
          {(draft.files || []).filter(file => file.category === 'rab').map(file => <div key={file.id} className="ris-attachment-row"><strong>Dokumen RAB</strong><span>{file.name}</span><small>{(file.size / 1048576).toFixed(1)} MB</small></div>)}
          {(draft.budgets || []).length ? <div className="ris-table-wrap"><table className="ris-table ris-table-left"><thead><tr><th>No.</th><th>Jenis / Komponen</th><th>Nama Item</th><th>Jumlah</th><th>Satuan</th><th>Harga Satuan</th><th>Total</th><th>Deskripsi</th></tr></thead><tbody>{draft.budgets.map((item, index) => <tr key={item.id}><td>{index + 1}.</td><td>{item.sectionLabel && <small>{item.sectionLabel}<br /></small>}{item.component}</td><td>{item.name}</td><td>{item.volume}</td><td>{item.unit}</td><td>{formatCurrency(item.unitPrice)}</td><td>{formatCurrency(item.volume * item.unitPrice)}</td><td>{item.notes || '-'}</td></tr>)}</tbody><tfoot><tr><td colSpan="6"><strong>Total Rincian Opsional</strong></td><td colSpan="2"><strong>{formatCurrency(sumBudgetItems(draft.budgets))}</strong></td></tr></tfoot></table></div> : <p className="ris-muted">Tidak ada rincian anggaran tambahan.</p>}
        </section>
        <section><h2>Luaran Hasil</h2>{draft.outputs.map(output => <div key={output.id} className="ris-output-preview"><h3>{output.type === 'wajib' ? 'Wajib' : 'Tambahan'} - {outputDefinitionLabel(output)}</h3><dl><Row label="Kategori">{labelFor(output.category)}</Row>{output.category === 'jurnal' && <React.Fragment><Row label="Target Tingkat Jurnal">{output.journalTargetLevel}</Row><Row label="Target Indeks Jurnal">{output.journalIndexTarget}</Row><Row label="Jenis Publikasi">{output.publicationType}</Row><Row label="Kuartil">{output.targetQuartile}</Row></React.Fragment>}{output.category === 'prosiding' && <React.Fragment><Row label="Jenis Prosiding">{output.proceedingType}</Row><Row label="Target Indeks">{output.indexTarget}</Row></React.Fragment>}{output.category === 'buku' && <React.Fragment><Row label="Jenis Buku">{output.bookType}</Row><Row label="Target Penerbit">{output.publisherTarget}</Row><Row label="Rencana ISBN">{output.isbnPlan}</Row></React.Fragment>}{output.category === 'hki' && <React.Fragment><Row label="Jenis HKI">{output.hkiType}</Row><Row label="Target Tahun Pendaftaran">{output.targetRegistrationYear}</Row></React.Fragment>}{output.category === 'produk_prototipe' && <React.Fragment><Row label="Jenis Produk">{output.productType}</Row><Row label="Target TKT">{output.targetTkt}</Row><Row label="Bentuk Luaran">{output.expectedOutputForm}</Row></React.Fragment>}{output.category === 'other' && <Row label="Jenis Luaran">{output.otherOutputType}</Row>}<Row label="Deskripsi">{output.description}</Row></dl></div>)}</section>
        <section><h2>Data Lampiran</h2>{draft.files.filter(file => file.category !== 'rab').map(file => <div key={file.id} className="ris-attachment-row"><strong>{file.requirementName || labelFor(file.category)}</strong><span>{file.name}</span><small>{(file.size / 1048576).toFixed(1)} MB</small></div>)}</section>
        {assignments.length > 0 && <section><h2>Status Penilai</h2><div className="ris-table-wrap"><table className="ris-table ris-table-left"><thead><tr><th>Penilai</th><th>Status</th><th>Ditugaskan</th><th>Penilaian</th></tr></thead><tbody>{assignments.map(assignment => {
          const account = (data.systemUsers || []).find(item => item.id === assignment.reviewerUserId) || {};
          return <tr key={assignment.id}><td>{account.name || assignment.reviewerUserId}</td><td><span className={`ris-badge ${assignment.status === 'submitted' ? 'purple' : assignment.status === 'revoked' ? 'gray' : 'blue'}`}>{assignment.status === 'submitted' ? 'Sudah menilai' : assignment.status === 'revoked' ? 'Selesai' : 'Menunggu penilaian'}</span></td><td>{formatDate(assignment.assignedAt)}</td><td>{assignment.submittedAt ? formatDate(assignment.submittedAt) : '-'}</td></tr>;
        })}</tbody></table></div></section>}
        {reviews.length > 0 && <section><h2>Hasil Penilaian</h2><div className="ris-review-summary"><strong>Rata-rata skor: {reviewAverage}</strong><span>{reviews.length} penilaian telah diterima</span></div>{reviews.map((review, index) => {
          const account = (data.systemUsers || []).find(item => item.id === review.reviewerUserId) || {};
          return <div className="ris-output-preview" key={review.id || review.reviewerUserId}><h3>Penilai {index + 1}: {account.name || review.reviewerName || '-'}</h3><dl><Row label="Total Skor">{review.totalScore}</Row><Row label="Rekomendasi">{labelFor(review.recommendation)}</Row><Row label="Kekuatan">{review.strengths}</Row><Row label="Kekurangan">{review.weaknesses}</Row><Row label="Catatan Anggaran">{review.budgetNotes}</Row><Row label="Catatan Luaran">{review.outputNotes}</Row><Row label="Catatan Revisi">{review.revisionNotes}</Row></dl><ReviewScoreBreakdown review={review} /></div>;
        })}</section>}
        {draft.decision && mode === 'preview' && new URLSearchParams(location.search).get('hideDecision') !== '1' && <section><h2>Keputusan Akhir</h2><dl><Row label="Keputusan">{draft.decision.finalDecision === 'funded' ? 'Sudah Didanai' : draft.decision.finalDecision}</Row><Row label="Catatan">{draft.decision.notes}</Row><Row label="Tanggal">{formatDate(draft.decision.decidedAt)}</Row><Row label="Penandatangan">{draft.decision.signerName || '-'}</Row></dl>{draftStatus(draft) === STATUS.FUNDED && draft.fundingLetter && <Button type="button" tone="green" onClick={() => downloadFundingLetterPdf(draft, scheme)}>Unduh Surat Pendanaan PDF</Button>}</section>}
      </div>

      {mode === 'verify' && <div className="ris-verification"><h2>Kelengkapan Data</h2>{Object.entries(verificationLabels).map(([key, label]) => <label key={key}><input type="checkbox" checked={checks[key]} onChange={event => setChecks(current => ({ ...current, [key]: event.target.checked }))} /><span>{label}</span><b>{checks[key] ? 'Lengkap' : 'Tidak Lengkap'}</b></label>)}<div className="ris-align-right"><Button type="button" tone={complete ? 'green' : 'red'} onClick={submitVerification}>{complete ? 'Data Lengkap' : 'Data Tidak Lengkap'}</Button></div></div>}
      {mode === 'reviewer' && <div className="ris-wizard-actions"><Button type="button" tone="gray" pill onClick={() => history.push('/ris')}>Kembali</Button>{canScoreDraft(draft, user) ? <Button type="button" pill onClick={() => history.push(`/ris/pengajuan-penelitian-internal/${draft.id}/penilaian`)}>Lanjut Penilaian</Button> : <span className="ris-badge purple">Penilaian sudah dikirim</span>}</div>}
      {mode === 'decision' && <div className="ris-decision-box"><h2>Keputusan Akhir</h2><p className="ris-muted">Keputusan disimpan oleh {user.name} dan menjadi identitas penandatangan surat penetapan pendanaan.</p><FloatingError message={error} /><div className="ris-field"><label>Pilih Keputusan Akhir</label><div className="ris-field-control"><select disabled={decisionSaving} value={decision} onChange={event => setDecision(event.target.value)}><option value="">-- Pilih Keputusan --</option><option value="funded">Setujui & Danai</option><option value="revision">Minta Revisi</option><option value="rejected">Tolak</option></select></div></div><div className="ris-field ris-field-start"><label>Catatan Keputusan</label><div className="ris-field-control"><textarea disabled={decisionSaving} rows="5" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Masukkan catatan keputusan..." /></div></div><div className="ris-align-right"><Button type="button" tone={decision === 'funded' ? 'green' : 'blue'} disabled={decisionSaving} onClick={submitDecision}>{decisionSaving ? 'Menyimpan...' : decision === 'funded' ? 'Setujui Pendanaan' : 'Simpan Keputusan'}</Button></div></div>}
      {decisionModalOpen && <Modal title="Keputusan Akhir Proposal" width={760} onClose={() => { if (!decisionSaving) setDecisionModalOpen(false); }}><div className="ris-modal-body"><p className="ris-modal-intro">{draft.project.title}</p><ProposalDecisionReviewSummary draft={draft} users={data.systemUsers || []} /><FloatingError message={error} /><Field label="Keputusan Akhir" required><select disabled={decisionSaving} value={decision} onChange={event => { setDecision(event.target.value); setError(''); }}><option value="">Pilih keputusan</option><option value="funded">Setujui dan Danai</option><option value="revision">Minta Revisi</option><option value="rejected">Tolak Proposal</option></select></Field><Field label="Catatan Keputusan" required alignStart><textarea disabled={decisionSaving} rows="5" value={notes} onChange={event => { setNotes(event.target.value); setError(''); }} placeholder="Tuliskan alasan dan arahan keputusan..." /></Field><div className="ris-modal-actions"><Button tone="gray" disabled={decisionSaving} onClick={() => setDecisionModalOpen(false)}>Batal</Button><Button tone={decision === 'funded' ? 'green' : 'blue'} disabled={decisionSaving} onClick={submitDecision}>{decisionSaving ? 'Menyimpan...' : decision === 'funded' ? 'Setujui Pendanaan' : 'Simpan Keputusan'}</Button></div></div></Modal>}
      {incompleteOpen && <Modal title="Konfirmasi Data Tidak Lengkap" onClose={() => setIncompleteOpen(false)}><div className="ris-modal-body"><p>Apakah Anda yakin data berikut tidak lengkap?</p><ul>{Object.entries(checks).filter(([, value]) => !value).map(([key]) => <li key={key}>{verificationLabels[key]}</li>)}</ul><div className="ris-modal-actions"><Button type="button" tone="gray" onClick={() => setIncompleteOpen(false)}>Batal</Button><Button type="button" tone="red" onClick={markIncomplete}>Ya, Tandai Tidak Lengkap</Button></div></div></Modal>}
    </div>
  );
}

ProposalPreviewPage.propTypes = { mode: PropTypes.oneOf(['preview', 'verify', 'reviewer', 'decision']) };
ProposalPreviewPage.defaultProps = { mode: 'preview' };
