const assert = require('assert');
const {
  createEmptyReviewScores,
  reviewScoreError,
  validateProposalReview,
} = require('../../app/containers/Ris/features/research/workflows/reviewScoringWorkflow');

describe('Proposal review scoring validation', () => {
  const criteria = [{ code: 'quality' }, { code: 'strategy' }];

  it('starts each reviewer score blank rather than with an actual zero', () => {
    assert.deepStrictEqual(createEmptyReviewScores(criteria), {
      quality: '',
      strategy: '',
    });
  });

  it('requires score values from 1 through 100', () => {
    assert.strictEqual(reviewScoreError(''), 'Skor wajib diisi.');
    assert.strictEqual(reviewScoreError(0), 'Skor harus 1-100.');
    assert.strictEqual(reviewScoreError(101), 'Skor harus 1-100.');
    assert.strictEqual(reviewScoreError(80), '');
  });

  it('requires every score and the final recommendation, but not notes', () => {
    assert.match(validateProposalReview(criteria, { quality: 90, strategy: '' }, 'approve'), /Lengkapi seluruh skor/);
    assert.strictEqual(validateProposalReview(criteria, { quality: 90, strategy: 85 }, ''), 'Pilih rekomendasi keputusan akhir.');
    assert.strictEqual(validateProposalReview(criteria, { quality: 90, strategy: 85 }, 'approve'), '');
  });
});
