/* eslint-disable react/prop-types */
import React from 'react';
import { formatDate } from '../../../core/data';
import { draftReviews } from '../../../shared/workflows/workflow';

const recommendationLabel = value => ({ approve: 'Setujui', revise: 'Perlu Revisi', reject: 'Tolak' }[value] || value || '-');

export default function ProposalDecisionReviewSummary({ draft, users }) {
  const reviews = draftReviews(draft);
  const average = reviews.length
    ? Math.round((reviews.reduce((sum, review) => sum + Number(review.totalScore || 0), 0) / reviews.length) * 100) / 100
    : 0;

  return (
    <React.Fragment>
      <section className="ris-decision-reviewers">
        <h3>Hasil Penilaian per Penilai</h3>
        {reviews.length ? <div className="ris-decision-reviewer-list">{reviews.map((review, index) => {
          const account = users.find(item => item.id === review.reviewerUserId) || {};
          return <article key={review.id || review.reviewerUserId}><div><span>Penilai {index + 1}</span><strong>{account.name || review.reviewerName || '-'}</strong><small>{review.submittedAt ? formatDate(review.submittedAt) : 'Waktu penilaian tidak tersedia'}</small></div><dl><div><dt>Total skor</dt><dd>{review.totalScore ?? '-'}</dd></div><div><dt>Rekomendasi</dt><dd>{recommendationLabel(review.recommendation)}</dd></div></dl></article>;
        })}</div> : <p className="ris-muted">Belum ada hasil penilaian yang dikirim.</p>}
      </section>
      <div className="ris-decision-summary"><span>{reviews.length} hasil penilaian</span><strong>Rata-rata skor {average}</strong></div>
    </React.Fragment>
  );
}
