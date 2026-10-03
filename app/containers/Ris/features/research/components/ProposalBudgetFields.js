/* eslint-disable react/prop-types, object-curly-newline, object-property-newline */
import React, { useState } from 'react';
import { BUDGET_TABS, formatCurrency, uid } from '../../../core/data';
import { getBudgetItemMissingFields, sumBudgetItems } from '../workflows/proposalBudget';
import { budgetUnitOptions } from '../workflows/rabImport';
import { Button, Field, FileDrop, FloatingError, Modal } from '../../../shared/components/Ui';
import Icon from '../../../shared/components/Icon';
import NotificationDot from '../../../shared/components/NotificationDot';

export default function ProposalBudgetFields({ budgets, sections, maximumBudget, requirement, file, showValidation, onBudgets, onSections, onPrepareRab, onFile, onRemoveFile, onError }) {
  const [activeKey, setActiveKey] = useState((sections[0] || {}).key || '');
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState('');
  const [customName, setCustomName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [removing, setRemoving] = useState(null);
  const active = sections.find(section => section.key === activeKey) || sections[0];
  const preset = active && BUDGET_TABS.find(section => section.key === active.key);
  const activeItems = active ? budgets.filter(item => item.tab === active.key) : [];
  const total = sumBudgetItems(budgets);
  const exceeded = maximumBudget > 0 && total > maximumBudget;
  const revealValidation = showValidation || budgets.some(item => item.origin === 'rab' && getBudgetItemMissingFields(item).length);
  const { template } = requirement;
  const templateUrl = template && (template.dataUrl || template.url || template.fileUrl || template.previewUrl);
  const addSection = () => {
    const selected = BUDGET_TABS.find(item => item.key === category);
    const label = selected ? selected.label : customName.trim();
    if (!category || !label) { setCategoryError('Pilih jenis anggaran atau isi nama jenis baru.'); return; }
    if (sections.some(item => item.label.toLowerCase() === label.toLowerCase())) { setCategoryError('Jenis anggaran tersebut sudah ditambahkan.'); return; }
    const key = selected ? selected.key : uid('budget-section');
    onSections([...sections, { key, label }]);
    setActiveKey(key);
    setAdding(false);
  };
  const removeSection = () => {
    onBudgets(budgets.filter(item => item.tab !== removing.key));
    onSections(sections.filter(item => item.key !== removing.key));
    setRemoving(null);
  };

  return <section className="ris-form-section ris-proposal-budget">
    <div className="ris-section-title"><h2>Anggaran</h2></div>
    <div className="ris-budget-document">
      <div className="ris-card-heading"><h3>Rencana Anggaran Biaya (RAB)</h3><span className="ris-badge blue">Wajib</span></div>
      {templateUrl ? <a className="ris-template-download" href={templateUrl} download={template.name}><Icon name="download" size={17} /><span><strong>Unduh Template RAB</strong><small>{template.name}</small></span></a> : <div className="ris-template-unavailable">Template RAB belum disediakan oleh pengelola skema.</div>}
      <FileDrop file={file} accept={requirement.accept} maxSize={10 * 1024 * 1024} storagePurpose="rab" onError={onError} label="Unggah RAB .xlsx (maksimal 10 MB)" onPrepare={onPrepareRab} onFile={onFile} />
      {file && <div className="ris-budget-document-actions"><Button tone="red" onClick={onRemoveFile}><Icon name="trash" size={16} />Hapus RAB</Button></div>}
      {budgets.some(item => item.origin === 'rab') && <p className="ris-muted">{budgets.filter(item => item.origin === 'rab').length} item diisi dari RAB. Periksa kembali rincian sebelum mengirim proposal.</p>}
    </div>

    <div className="ris-section-title ris-budget-section-heading"><h3>Rincian Anggaran <span className="ris-muted">(opsional)</span></h3><Button tone="blue" onClick={() => { setAdding(true); setCategory(''); setCustomName(''); setCategoryError(''); }}><Icon name="plus" size={16} />Tambah Jenis Anggaran</Button></div>
    {!sections.length && <div className="ris-output-selection-note">Belum ada rincian anggaran tambahan.</div>}
    {!!sections.length && <div className="ris-tabs">{sections.map(section => {
      const hasIncompleteItems = revealValidation && budgets.some(item => item.tab === section.key && getBudgetItemMissingFields(item).length);
      return <button type="button" key={section.key} className={active && active.key === section.key ? 'active' : ''} onClick={() => setActiveKey(section.key)}>{section.label === 'Pelaporan Hasil Penelitian dan Luaran Wajib' ? 'Pelaporan Hasil' : section.label}<NotificationDot visible={hasIncompleteItems} /></button>;
    })}</div>}
    {active && <React.Fragment>
      <div className="ris-card-heading ris-budget-section-heading"><h3>{active.label}</h3><Button tone="red" onClick={() => setRemoving(active)}><Icon name="trash" size={16} />Hapus Jenis Anggaran</Button></div>
      {activeItems.map((item, index) => {
        const missingFields = revealValidation ? getBudgetItemMissingFields(item) : [];
        const fieldError = label => (missingFields.includes(label) ? 'Belum diisi.' : '');
        const update = (key, value) => onBudgets(budgets.map(entry => {
          if (entry.id !== item.id) return entry;
          const changed = { ...entry, [key]: value };
          if (key === 'component') changed.componentCustom = !!value && (!preset || !preset.components.includes(value));
          if (key === 'unit') changed.unitCustom = !!value && !budgetUnitOptions.includes(value);
          return changed;
        }));
        return <div className={`ris-form-card ris-budget-item-card ${missingFields.length ? 'has-errors' : ''}`} key={item.id}>
          <div className="ris-card-heading"><h3>Item {index + 1}</h3><button type="button" className="ris-text-danger" onClick={() => onBudgets(budgets.filter(entry => entry.id !== item.id))}>Hapus Item</button></div>
          {missingFields.length > 0 && <p className="ris-budget-item-errors" role="status">Belum lengkap: {missingFields.join(', ')}. Deskripsi tidak wajib.</p>}
          <Field label="Komponen" required error={fieldError('Komponen')}>{preset ? <select value={item.component} onChange={event => update('component', event.target.value)}><option value="">Pilih komponen</option>{preset.components.map(component => <option key={component}>{component}</option>)}{item.component && !preset.components.includes(item.component) && <option value={item.component}>{item.component} (Kustom)</option>}</select> : <input value={item.component} onChange={event => update('component', event.target.value)} />}</Field>
          <Field label="Nama Item" required error={fieldError('Nama Item')}><input value={item.name} onChange={event => update('name', event.target.value)} /></Field>
          <Field label="Jumlah" required error={fieldError('Jumlah')}><input type="number" min="0.01" step="0.01" inputMode="decimal" value={item.volume} onChange={event => update('volume', event.target.value)} /></Field>
          <Field label="Satuan" required error={fieldError('Satuan')}><select value={item.unit} onChange={event => update('unit', event.target.value)}><option value="">Pilih satuan</option>{budgetUnitOptions.map(unit => <option key={unit} value={unit}>{unit.charAt(0).toUpperCase() + unit.slice(1)}</option>)}{item.unit && !budgetUnitOptions.includes(item.unit) && <option value={item.unit}>{item.unit} (Kustom)</option>}</select></Field>
          <Field label="Harga Satuan" required error={fieldError('Harga Satuan')}><input type="number" min="1" step="1" inputMode="numeric" value={item.unitPrice} onChange={event => update('unitPrice', event.target.value)} /></Field>
          <Field label="Total"><input disabled value={formatCurrency(Number(item.volume) * Number(item.unitPrice))} /></Field>
          <Field label="Deskripsi (opsional)"><input value={item.notes} onChange={event => update('notes', event.target.value)} /></Field>
        </div>;
      })}
      <div className="ris-budget-footer"><Button tone="gray" onClick={() => onBudgets([...budgets, { id: uid('budget'), tab: active.key, sectionLabel: active.label, component: '', name: '', volume: 1, unit: '', unitPrice: '', notes: '' }])}><Icon name="plus" size={16} />Tambah Item</Button><strong>Total {active.label}: {formatCurrency(sumBudgetItems(activeItems))}</strong></div>
    </React.Fragment>}
    <div className="ris-budget-proposal-summary">
      {!!budgets.length && <div><span>Total Rincian Anggaran</span><strong className={exceeded ? 'ris-text-danger' : ''}>{formatCurrency(total)}</strong></div>}
      {maximumBudget > 0 && <div><span>Maksimum Anggaran Skema</span><strong>{formatCurrency(maximumBudget)}</strong></div>}
    </div>
    <FloatingError message={exceeded ? `Total rincian anggaran melebihi batas skema sebesar ${formatCurrency(total - maximumBudget)}.` : ''} />
    {adding && <Modal title="Tambah Jenis Anggaran" onClose={() => setAdding(false)}><div className="ris-modal-body">
      <FloatingError message={categoryError} />
      <Field label="Jenis Anggaran" required><select aria-label="Jenis Anggaran" value={category} onChange={event => setCategory(event.target.value)}><option value="">Pilih jenis anggaran</option>{BUDGET_TABS.filter(item => !sections.some(section => section.key === item.key)).map(item => <option key={item.key} value={item.key}>{item.label}</option>)}<option value="custom">Jenis Baru</option></select></Field>
      {category === 'custom' && <Field label="Nama Jenis Anggaran" required><input aria-label="Nama Jenis Anggaran" maxLength="180" value={customName} onChange={event => setCustomName(event.target.value)} /></Field>}
      <div className="ris-modal-actions"><Button tone="gray" onClick={() => setAdding(false)}>Batal</Button><Button onClick={addSection}>Tambah</Button></div>
    </div></Modal>}
    {removing && <Modal title="Hapus Jenis Anggaran" onClose={() => setRemoving(null)}><div className="ris-modal-body"><p>Hapus {removing.label} beserta seluruh itemnya? Dokumen RAB dan jenis anggaran lainnya tidak akan dihapus.</p><div className="ris-modal-actions"><Button tone="gray" onClick={() => setRemoving(null)}>Batal</Button><Button tone="red" onClick={removeSection}>Hapus</Button></div></div></Modal>}
  </section>;
}
