export const sumBudgetItems = items => (items || []).reduce((sum, item) => sum + (Number(item.volume) || 0) * (Number(item.unitPrice) || 0), 0);

// Preserve previously recorded RAB amounts; otherwise derive totals from optional items.
export const proposalBudgetTotal = draft => {
  if (!draft) return 0;
  return draft.requestedBudget === undefined || draft.requestedBudget === null || draft.requestedBudget === ''
    ? sumBudgetItems(draft.budgets) : Number(draft.requestedBudget) || 0;
};

export const proposalBudgetSections = (draft, defaults) => {
  const sections = [...((draft && draft.budgetSections) || [])];
  ((draft && draft.budgets) || []).forEach(item => {
    if (!sections.some(section => section.key === item.tab)) {
      const preset = defaults.find(section => section.key === item.tab);
      sections.push({ key: item.tab, label: (preset && preset.label) || item.sectionLabel || item.tab || 'Rincian Lainnya' });
    }
  });
  return sections;
};

export const getBudgetItemMissingFields = item => {
  const hasPositiveNumber = value => String(value == null ? '' : value).trim() !== ''
    && Number.isFinite(Number(value)) && Number(value) > 0;
  return [
    ['Komponen', Boolean(String((item && item.component) || '').trim())],
    ['Nama Item', Boolean(String((item && item.name) || '').trim())],
    ['Jumlah', hasPositiveNumber(item && item.volume)],
    ['Satuan', Boolean(String((item && item.unit) || '').trim())],
    ['Harga Satuan', hasPositiveNumber(item && item.unitPrice)],
  ].filter(([, complete]) => !complete).map(([label]) => label);
};

export const validateProposalBudget = (draft, maximumBudget = 0) => {
  const items = draft.budgets || [];
  const total = sumBudgetItems(items);
  if (maximumBudget > 0 && total > maximumBudget) return `Total anggaran melebihi maksimum skema sebesar Rp ${maximumBudget.toLocaleString('id-ID')}.`;
  if (!(draft.files || []).some(file => file.category === 'rab' && file.name)) return 'Unggah dokumen RAB pada bagian Anggaran.';
  if (items.some(item => getBudgetItemMissingFields(item).length)) return 'Lengkapi setiap item rincian anggaran: komponen, nama item, jumlah, satuan, dan harga satuan. Deskripsi bersifat opsional; hapus item yang tidak digunakan.';
  return '';
};
