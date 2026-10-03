import { BUDGET_TABS, uid } from '../../../core/data';

const units = ['orang', 'kegiatan', 'paket', 'unit', 'bulan', 'hari', 'jam', 'dokumen', 'perjalanan'];
const clean = value => String(value == null ? '' : value).trim();
const normal = value => clean(value).toLowerCase().replace(/\s+/g, ' ');
const groupKey = label => {
  const name = normal(label);
  if (name === 'bahan' || name === normal(BUDGET_TABS[0].label)) return BUDGET_TABS[0].key;
  const preset = BUDGET_TABS.find(section => normal(section.label) === name);
  return preset ? preset.key : `rab-${name.replace(/[^a-z0-9]+/g, '-')}`;
};

export const parseRabSheets = sheets => {
  const rows = [];
  (sheets || []).forEach(sheet => {
    const data = sheet.data || [];
    const header = data.findIndex(row => normal(row[0]) === 'kelompok anggaran'
      && normal(row[2]) === 'komponen' && normal(row[3]) === 'item'
      && normal(row[6]) === 'volume' && normal(row[8]) === 'harga satuan');
    if (header < 0) return;
    data.slice(header + 1).forEach((row, offset) => {
      const group = clean(row[0]);
      const name = clean(row[3]);
      if (!group || !name || group.startsWith('(') || normal(group).startsWith('total ') || name.startsWith('(')) return;
      const volume = Number(row[6]);
      const unitPrice = Number(row[8]);
      rows.push({
        group,
        component: clean(row[2]),
        name,
        volume: Number.isFinite(volume) && volume > 0 ? volume : '',
        unit: clean(row[7]) || 'unit',
        unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : '',
        sourceRow: header + offset + 2,
      });
    });
  });
  if (!rows.length) throw new Error('RAB tidak memiliki item pada tabel Kelompok Anggaran. Gunakan template RAB yang disediakan.');
  return rows;
};

export const removeRabImport = (budgets, sections) => {
  const manualBudgets = (budgets || []).filter(item => item.origin !== 'rab');
  const manualSections = (sections || []).filter(section => section.origin !== 'rab'
    || manualBudgets.some(item => item.tab === section.key)).map(section => (
    section.origin === 'rab' ? { key: section.key, label: section.label } : section
  ));
  return { budgets: manualBudgets, sections: manualSections };
};

export const mergeRabImport = (budgets, sections, rows) => {
  const cleanState = removeRabImport(budgets, sections);
  const nextSections = [...cleanState.sections];
  const imported = rows.map(row => {
    const suggestedKey = groupKey(row.group);
    const preset = BUDGET_TABS.find(section => section.key === suggestedKey);
    const label = preset ? preset.label : row.group;
    let section = nextSections.find(entry => entry.key === suggestedKey || normal(entry.label) === normal(label));
    if (!section) {
      section = { key: suggestedKey, label, origin: 'rab' };
      nextSections.push(section);
    }
    const component = preset && preset.components.find(value => normal(value) === normal(row.component));
    const unit = units.find(value => normal(value) === normal(row.unit));
    return {
      id: uid('budget'),
      tab: section.key,
      sectionLabel: section.label,
      component: component || row.component,
      componentCustom: !component,
      name: row.name,
      volume: row.volume,
      unit: unit || row.unit,
      unitCustom: !unit,
      unitPrice: row.unitPrice,
      notes: '',
      origin: 'rab',
      rabSourceRow: row.sourceRow,
    };
  });
  return { budgets: [...cleanState.budgets, ...imported], sections: nextSections };
};

export const budgetUnitOptions = units;
