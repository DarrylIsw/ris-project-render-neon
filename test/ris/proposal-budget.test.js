/* eslint-disable object-curly-newline, object-property-newline */
const assert = require('assert');
const { BUDGET_TABS, createInitialData, normalizeRisData, totalBudget } = require('../../app/containers/Ris/core/data');
const { getBudgetItemMissingFields, proposalBudgetSections, proposalBudgetTotal, validateProposalBudget } = require('../../app/containers/Ris/features/research/workflows/proposalBudget');
const { getDraftBudgetTotal, validateDraftSections, validateDraftForSubmit } = require('../../app/containers/Ris/shared/workflows/workflow');
const { getProposalSubmissionRequirements } = require('../../app/containers/Ris/features/research/workflows/schemeConfiguration');

describe('Proposal RAB and optional budget sections', () => {
  const rab = { category: 'rab', name: 'rab.xlsx' };
  const item = { id: 'item', tab: 'materials', component: 'Material', name: 'Sensor', unit: 'unit', volume: 2, unitPrice: 1000000 };
  it('accepts RAB without optional itemized budgets', () => {
    const draft = { requestedBudget: 30000000, budgets: [], files: [rab] };
    assert.strictEqual(validateProposalBudget(draft, 30000000), '');
    assert.strictEqual(validateDraftSections(draft, { maximumBudget: 30000000 }).budget, true);
    assert.strictEqual(totalBudget(draft), 30000000);
    assert.strictEqual(getDraftBudgetTotal(draft), 30000000);
  });
  it('allows final submission with RAB only and all other proposal requirements complete', () => {
    const data = createInitialData();
    const source = data.drafts.find(draft => draft.id === 'draft-demo-saved');
    const scheme = data.schemes.find(entry => entry.id === source.schemeId);
    const requirements = getProposalSubmissionRequirements(scheme);
    assert.deepStrictEqual(requirements.map(requirement => requirement.category), ['proposal', 'rab']);
    const proposal = { ...source, requestedBudget: '', budgets: [], budgetSections: [], files: requirements.map(requirement => ({ category: requirement.category, name: requirement.category === 'rab' ? 'rab.xlsx' : `${requirement.category}.pdf` })) };
    assert.strictEqual(validateDraftForSubmit(proposal, scheme), '');
    assert.match(validateDraftForSubmit({ ...proposal, files: proposal.files.filter(file => file.category !== 'rab') }, scheme), /Unggah dokumen RAB/);
    assert.match(validateDraftForSubmit({ ...proposal, files: [rab] }, scheme), /Proposal Penelitian/);
  });
  it('requires only the RAB file and enforces the maximum on optional details', () => {
    assert.strictEqual(validateProposalBudget({ files: [rab] }), '');
    assert.strictEqual(validateProposalBudget({ requestedBudget: '', files: [rab] }), '');
    assert.match(validateProposalBudget({ requestedBudget: 100 }), /Unggah dokumen RAB/);
    assert.match(validateProposalBudget({ budgets: [item], files: [rab] }, 1999999), /maksimum skema/);
    assert.strictEqual(validateProposalBudget({ budgets: [item], files: [rab] }, 2000000), '');
  });
  it('validates optional items without relying on the removed manual amount', () => {
    const draft = { requestedBudget: 3000000, files: [rab], budgets: [item] };
    assert.strictEqual(validateProposalBudget(draft), '');
    assert.strictEqual(validateProposalBudget({ ...draft, budgets: [{ ...item, notes: '' }] }), '');
    assert.strictEqual(validateProposalBudget({ ...draft, budgets: [{ ...item, notes: undefined }] }), '');
    assert.deepStrictEqual(getBudgetItemMissingFields({ ...item, unitPrice: '' }), ['Harga Satuan']);
    assert.deepStrictEqual(getBudgetItemMissingFields({ ...item, notes: '' }), []);
    assert.match(validateProposalBudget({ ...draft, budgets: [{ ...item, name: '' }] }), /Lengkapi setiap item/);
    assert.strictEqual(validateProposalBudget({ ...draft, requestedBudget: 1000000 }), '');
    assert.strictEqual(validateProposalBudget({ ...draft, budgets: [] }), '');
  });
  it('preserves totals and sections from older proposals', () => {
    const old = { budgets: [item], files: [rab] };
    assert.strictEqual(proposalBudgetTotal(old), 2000000);
    assert.strictEqual(proposalBudgetTotal({ ...old, requestedBudget: '' }), 2000000);
    assert.strictEqual(validateProposalBudget(old), '');
    assert.deepStrictEqual(proposalBudgetSections(old, BUDGET_TABS), [{ key: 'materials', label: 'Bahan dan Peralatan' }]);
    assert.deepStrictEqual(proposalBudgetSections(null, BUDGET_TABS), []);
  });
  it('persists empty custom sections and removal without restoring default sections', () => {
    const data = createInitialData();
    const draft = { ...data.drafts[0], requestedBudget: 7500000, budgets: [], budgetSections: [{ key: 'custom-one', label: 'Pengujian Lapangan' }] };
    const restored = normalizeRisData(JSON.parse(JSON.stringify({ ...data, drafts: [draft] })));
    assert.strictEqual(restored.drafts[0].requestedBudget, 7500000);
    assert.deepStrictEqual(proposalBudgetSections(restored.drafts[0], BUDGET_TABS), draft.budgetSections);
    assert.deepStrictEqual(proposalBudgetSections({ ...draft, budgetSections: [] }, BUDGET_TABS), []);
  });
});
