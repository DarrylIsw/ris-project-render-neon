export const REVIEW_SCORE_MIN = 1;
export const REVIEW_SCORE_MAX = 100;

export const createEmptyReviewScores = criteria => Object.fromEntries(
  (criteria || []).map(item => [item.code, ''])
);

export const reviewScoreError = value => {
  if (value === '' || value === null || value === undefined) return 'Skor wajib diisi.';
  const score = Number(value);
  return Number.isFinite(score) && score >= REVIEW_SCORE_MIN && score <= REVIEW_SCORE_MAX
    ? '' : `Skor harus ${REVIEW_SCORE_MIN}-${REVIEW_SCORE_MAX}.`;
};

export const reviewScoreErrors = (criteria, scores) => (criteria || []).reduce((result, item) => ({
  ...result,
  [item.code]: reviewScoreError(scores && scores[item.code]),
}), {});

export const validateProposalReview = (criteria, scores, recommendation) => {
  const invalid = Object.values(reviewScoreErrors(criteria, scores)).some(Boolean);
  if (invalid) return 'Lengkapi seluruh skor penilaian dengan nilai 1 sampai 100.';
  if (!String(recommendation || '').trim()) return 'Pilih rekomendasi keputusan akhir.';
  return '';
};
