/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, react/prop-types */
import React, { useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import { Button, FloatingError, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import {
  FUNDED_REVIEW_CRITERIA,
  FUNDED_REVIEW_TARGET,
  canScoreFundedReview,
  fundedReviewDraft,
  fundedReviewTarget,
  fundedReviewTargetLabel,
  submitFundedReview,
} from '../workflows/fundedResearchReviewWorkflow';

const templateFor = targetType => (targetType === FUNDED_REVIEW_TARGET.MONEV ? {
  title: 'Penilaian Monitoring dan Evaluasi',
  description: 'Nilai kemajuan, pengendalian risiko, bukti, dan kelayakan tindak lanjut penelitian.',
  notes: [
    ['substanceNotes', 'Capaian dan Target', 'Catatan tentang capaian kemajuan penelitian...'],
    ['technicalNotes', 'Risiko dan Pengendalian', 'Catatan tentang deviasi, risiko, dan tindakan korektif...'],
    ['followUpNotes', 'Arahan Tindak Lanjut', 'Arahan untuk periode penelitian berikutnya...'],
  ],
} : {
  title: 'Penilaian Laporan Penelitian',
  description: 'Nilai substansi hasil, validitas analisis, ketercapaian luaran, dan kualitas dokumentasi.',
  notes: [
    ['substanceNotes', 'Substansi Hasil', 'Catatan tentang kualitas hasil dan analisis penelitian...'],
    ['technicalNotes', 'Dokumentasi dan Luaran', 'Catatan tentang dokumen, bukti, dan capaian luaran...'],
    ['followUpNotes', 'Rekomendasi Perbaikan', 'Perbaikan atau tindak lanjut yang disarankan...'],
  ],
});

export default function FundedReviewScoringPage() {
  const { targetType, targetId } = useParams();
  const { data, setData, showToast, user } = useRis();
  const history = useHistory();
  const target = fundedReviewTarget(data, targetType, targetId);
  const draft = fundedReviewDraft(data, targetType, targetId);
  const criteria = FUNDED_REVIEW_CRITERIA[targetType] || [];
  const template = templateFor(targetType);
  const [scores, setScores] = useState(() => Object.fromEntries(criteria.map(item => [item.code, 0])));
  const [recommendation, setRecommendation] = useState('approve');
  const [notes, setNotes] = useState({ substanceNotes: '', technicalNotes: '', followUpNotes: '' });
  const [error, setError] = useState('');
  const groups = useMemo(() => criteria.reduce((result, item) => ({ ...result, [item.group]: [...(result[item.group] || []), item] }), {}), [criteria]);
  const totalScore = Math.round(criteria.reduce((sum, item) => sum + (((Number(scores[item.code]) || 0) * item.weight) / 100), 0) * 100) / 100;
  const autoRecommendation = totalScore >= 80 ? 'Direkomendasikan' : totalScore >= 55 ? 'Perlu Revisi' : 'Tidak Direkomendasikan';

  if (!target || !draft || !criteria.length) return <div className="ris-page"><h1>Data penilaian tidak ditemukan</h1></div>;
  if (!canScoreFundedReview(data, targetType, targetId, user)) return <div className="ris-page"><h1>Penilaian tidak dapat diproses</h1><p className="ris-muted">Penugasan tidak aktif atau hasil penilaian sudah dikirim.</p></div>;

  const updateScore = (code, value) => {
    setScores(current => ({ ...current, [code]: Math.max(0, Math.min(100, Number(value))) }));
    setError('');
  };

  const submit = () => {
    if (criteria.some(item => Number(scores[item.code]) <= 0)) {
      setError('Setiap aspek penilaian wajib memiliki skor 1 sampai 100.');
      return;
    }
    if (!notes.substanceNotes.trim() || !notes.followUpNotes.trim()) {
      setError('Catatan substansi dan tindak lanjut wajib diisi.');
      return;
    }
    setData(current => submitFundedReview(current, targetType, targetId, { scores, totalScore, recommendation, ...notes }, user));
    showToast({ tone: 'success', title: 'Penilaian dikirim', message: `Hasil penilaian ${fundedReviewTargetLabel(targetType, target)} berhasil disimpan.` });
    history.push('/ris');
  };

  return (
    <div className="ris-page ris-workspace-page">
      <PageHeader title={template.title} description={template.description} onBack={() => history.goBack()} />
      <section className="ris-review-target-summary"><div><span>Target Penilaian</span><strong>{fundedReviewTargetLabel(targetType, target)}</strong><small>{draft.project && draft.project.title}</small></div><StatusBadge tone={targetType === FUNDED_REVIEW_TARGET.MONEV ? 'cyan' : 'purple'}>{targetType === FUNDED_REVIEW_TARGET.MONEV ? 'Monev' : 'Laporan'}</StatusBadge></section>
      <FloatingError message={error} />
      <div className="ris-scoring-layout">
        <div>{Object.entries(groups).map(([group, items]) => <section className="ris-score-group" key={group}><h2>{group}</h2>{items.map(item => <label key={item.code}><span>{item.label}</span><input type="number" min="1" max="100" value={scores[item.code]} onChange={event => updateScore(item.code, event.target.value)} /></label>)}</section>)}</div>
        <div><section className="ris-score-summary"><h2>Total Skor</h2><strong>{totalScore}</strong><p>Rekomendasi sistem: <em>{autoRecommendation}</em></p><label><span>Rekomendasi Penilai</span><select value={recommendation} onChange={event => setRecommendation(event.target.value)}><option value="approve">Terima</option><option value="revision">Perlu Revisi</option><option value="reject">Tolak</option></select></label></section><section className="ris-notes-box"><h2>Catatan Penilaian</h2>{template.notes.map(([key, label, placeholder]) => <label key={key}><span>{label}</span><textarea rows="3" value={notes[key]} onChange={event => setNotes({ ...notes, [key]: event.target.value })} placeholder={placeholder} /></label>)}</section></div>
      </div>
      <div className="ris-wizard-actions"><Button tone="gray" pill onClick={() => history.goBack()}>Kembali</Button><Button pill onClick={submit}>Kirim Penilaian</Button></div>
    </div>
  );
}
