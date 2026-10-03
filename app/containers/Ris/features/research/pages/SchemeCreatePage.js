/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import Icon from '../../../shared/components/Icon';
import {
  Button, EmptyRow, Field, FileDrop, FloatingError, Modal, PageHeader, YearSelect
} from '../../../shared/components/Ui';
import OutputDefinitionFields from '../components/OutputDefinitionFields';
import { formatCurrency, uid } from '../../../core/data';
import {
  REPORT_TYPE, REPORT_TYPE_LABEL, REPORT_TYPE_OPTIONS, validateReportingSchedule
} from '../workflows/reportingWorkflow';
import {
  BASE_ATTACHMENT_REQUIREMENTS,
  emptyAttachmentRequirement,
  emptyOutputDefinition,
  isOutputDefinitionComplete,
  normalizeSchemeAttachmentRequirements,
} from '../workflows/schemeConfiguration';

const positionLabels = {
  tenaga_pengajar: 'Tenaga Pengajar', asisten_ahli: 'Asisten Ahli', lektor: 'Lektor', lektor_kepala: 'Lektor Kepala', profesor: 'Profesor'
};
const statusLabels = { fulltime: 'Penuh Waktu', homebase: 'Dosen Tetap Program Studi' };
const ELIGIBILITY_GROUPS = [
  { key: 'education', label: 'Tingkat Edukasi', values: ['S1', 'S2', 'S3'] },
  { key: 'positions', label: 'Jabatan Fungsional', values: ['Tenaga Pengajar', 'Lektor', 'Profesor', 'Lektor Kepala', 'Asisten Ahli'] },
  { key: 'statuses', label: 'Status Pekerjaan', values: ['Penuh Waktu', 'Dosen Tetap Program Studi'] },
];
const reportLabel = (type, periods) => {
  const count = periods.filter(period => period.type === type).length + 1;
  return type === REPORT_TYPE.INTERIM ? `${REPORT_TYPE_LABEL[type]} Periode ${count}` : REPORT_TYPE_LABEL[type];
};
const newPeriod = (type, periods) => ({ id: uid(`report-${type}`), type, label: reportLabel(type, periods), openAt: '', dueAt: '', extensions: [] });
const TEMPLATE_MAX_SIZE = 2 * 1024 * 1024;
const readTemplateFile = file => {
  if (file.risFileUrl) {
    return Promise.resolve({
      name: file.name, size: file.size, type: file.type || '', lastModified: file.lastModified, fileUrl: file.risFileUrl, storedFileId: file.risFileId,
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name, size: file.size, type: file.type || '', lastModified: file.lastModified, dataUrl: reader.result,
    });
    reader.onerror = () => reject(new Error('Template tidak dapat dibaca.'));
    reader.readAsDataURL(file);
  });
};

function SelectAllCheckbox({ label, checked, indeterminate, onChange }) {
  const inputRef = useRef(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return <label className={`ris-eligibility-select-all ${checked || indeterminate ? 'selected' : ''}`}><input ref={inputRef} type="checkbox" checked={checked} onChange={onChange} /><span>{label}</span></label>;
}
function EligibilityCheckGroup({ group, selected, onChange }) {
  const selectedCount = group.values.filter(value => selected.includes(value)).length;
  const allSelected = selectedCount === group.values.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const toggleAll = () => onChange(allSelected ? [] : group.values);
  const toggleValue = value => onChange(selected.includes(value)
    ? selected.filter(item => item !== value)
    : [...selected, value]);

  return (
    <fieldset className="ris-eligibility-group">
      <legend>
        <span>{group.label}</span>
        <SelectAllCheckbox label="Pilih semua" checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
      </legend>
      <div className="ris-eligibility-group-options">
        {group.values.map(value => <label className={selected.includes(value) ? 'selected' : ''} key={value}><input type="checkbox" checked={selected.includes(value)} onChange={() => toggleValue(value)} /><span>{value}</span></label>)}
      </div>
    </fieldset>
  );
}

export default function SchemeCreatePage() {
  const { data, setData } = useRis();
  const history = useHistory();
  const [form, setForm] = useState({
    name: '', description: '', startDate: '', endDate: '', registrationStartDate: '', registrationEndDate: '', maximumBudget: ''
  });
  const [filters, setFilters] = useState({
    education: [], positions: [], statuses: [], minSinta: '', maxSinta: '', minResearch: '', lastYear: ''
  });
  const [eligibleIds, setEligibleIds] = useState([]);
  const [reportingSchedule, setReportingSchedule] = useState([]);
  const [outputOptions, setOutputOptions] = useState([]);
  const [attachmentRequirements, setAttachmentRequirements] = useState(() => normalizeSchemeAttachmentRequirements({ attachmentRequirements: BASE_ATTACHMENT_REQUIREMENTS }));
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const formRef = React.useRef(null);
  const stepContentRef = React.useRef(null);
  const previousStep = React.useRef(activeStep);

  const steps = [
    { label: 'Informasi Skema', description: 'Nama, periode, dan batas anggaran' },
    { label: 'Luaran Wajib', description: 'Opsi luaran untuk proposal' },
    { label: 'Templat & Lampiran', description: 'Berkas yang disediakan' },
    { label: 'Jadwal Pelaporan', description: 'Periode dan tenggat laporan' },
    { label: 'Kelayakan Ketua', description: 'Kriteria dan daftar dosen' },
  ];

  useEffect(() => {
    if (!error && previousStep.current === activeStep) return;
    previousStep.current = activeStep;
    const target = stepContentRef.current && stepContentRef.current.querySelector('h2');
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeStep, error]);

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const updateFilter = (key, value) => setFilters(current => ({ ...current, [key]: value }));
  const selectedEligibilityCount = ELIGIBILITY_GROUPS.reduce((count, group) => count + group.values.filter(value => filters[group.key].includes(value)).length, 0);
  const totalEligibilityCount = ELIGIBILITY_GROUPS.reduce((count, group) => count + group.values.length, 0);
  const allEligibilitySelected = selectedEligibilityCount === totalEligibilityCount;
  const someEligibilitySelected = selectedEligibilityCount > 0 && !allEligibilitySelected;
  const toggleAllEligibility = () => setFilters(current => {
    const count = ELIGIBILITY_GROUPS.reduce((total, group) => total + group.values.filter(value => current[group.key].includes(value)).length, 0);
    const clear = count === totalEligibilityCount;
    return { ...current, ...Object.fromEntries(ELIGIBILITY_GROUPS.map(group => [group.key, clear ? [] : group.values])) };
  });
  const updatePeriod = (id, key, value) => setReportingSchedule(current => current.map(period => (period.id === id ? { ...period, [key]: value } : period)));
  const updatePeriodType = (id, type) => setReportingSchedule(current => current.map(period => (period.id === id ? { ...period, type, label: reportLabel(type, current.filter(item => item.id !== id)) } : period)));
  const removePeriod = id => setReportingSchedule(current => current.filter(period => period.id !== id));
  const addReport = () => setReportingSchedule(current => [...current, newPeriod(REPORT_TYPE.INTERIM, current)]);
  const addOutputOption = () => setOutputOptions(current => [...current, emptyOutputDefinition(uid('scheme-output'))]);
  const updateOutputOption = (id, value) => setOutputOptions(current => current.map(item => (item.id === id ? value : item)));
  const addAttachment = () => setAttachmentRequirements(current => [...current, emptyAttachmentRequirement(uid('scheme-attachment'))]);
  const updateAttachment = (id, patch) => setAttachmentRequirements(current => current.map(item => (item.id === id ? { ...item, ...patch } : item)));
  const attachTemplate = async (id, file) => {
    try {
      const template = await readTemplateFile(file);
      updateAttachment(id, { template });
      setError('');
    } catch (fileError) {
      setError(fileError.message);
    }
  };
  const eligible = eligibleIds.map(id => data.lecturers.find(item => item.id === id)).filter(Boolean);
  const searchResults = useMemo(() => (search.length < 2 ? [] : data.lecturers.filter(item => `${item.name} ${item.nidn}`.toLowerCase().includes(search.toLowerCase()) && !eligibleIds.includes(item.id))), [search, data.lecturers, eligibleIds]);

  const checkEligible = () => {
    if (!filters.education.length || !filters.positions.length || !filters.statuses.length) {
      setError('Pilih minimal satu tingkat edukasi, jabatan fungsional, dan status pekerjaan ketua penelitian.');
      return;
    }
    setError('');
    const found = data.lecturers.filter(item => filters.education.includes(item.educationLevel)
      && filters.positions.includes(positionLabels[item.functionalPosition])
      && filters.statuses.includes(statusLabels[item.employmentStatus])
      && (filters.minSinta === '' || item.sintaScore >= Number(filters.minSinta))
      && (filters.maxSinta === '' || item.sintaScore <= Number(filters.maxSinta))
      && (filters.minResearch === '' || item.researchCount >= Number(filters.minResearch))
      && (filters.lastYear === '' || item.lastResearchYear >= Number(filters.lastYear)));
    setEligibleIds(found.map(item => item.id));
  };

  const fail = (message, step) => {
    setError(message);
    if (Number.isInteger(step)) setActiveStep(step);
  };

  const validateStep = step => {
    if (formRef.current && !formRef.current.reportValidity()) return false;
    if (step === 1 && (!outputOptions.length || outputOptions.some(item => !(item.name || '').trim() || !isOutputDefinitionComplete(item)))) {
      fail('Tambahkan minimal satu pilihan luaran wajib dan lengkapi seluruh pengaturannya.', 1);
      return false;
    }
    if (step === 2) {
      if (attachmentRequirements.some(item => !item.name.trim())) {
        fail('Nama setiap lampiran wajib diisi.', 2);
        return false;
      }
      const missingTemplate = attachmentRequirements.some(item => ['proposal', 'rab'].includes(item.category)
        && !(item.template && (item.template.dataUrl || item.template.fileUrl || item.template.storedFileId)));
      if (missingTemplate) {
        fail('Template Proposal dan RAB wajib diunggah sebelum melanjutkan.', 2);
        return false;
      }
    }
    if (step === 3) {
      const scheduleError = validateReportingSchedule(reportingSchedule);
      if (scheduleError) {
        fail(scheduleError, 3);
        return false;
      }
    }
    setError('');
    return true;
  };

  const goNext = () => {
    if (validateStep(activeStep)) setActiveStep(current => Math.min(current + 1, steps.length - 1));
  };

  const submit = event => {
    event.preventDefault();
    if (!form.name.trim() || !form.startDate || !form.endDate || !form.registrationStartDate || !form.registrationEndDate) {
      fail('Lengkapi nama skema dan seluruh tanggal terlebih dahulu.', 0);
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate) || new Date(form.registrationEndDate) < new Date(form.registrationStartDate)) {
      fail('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.', 0);
      return;
    }
    if (Number(form.maximumBudget) <= 0) {
      fail('Maksimum anggaran wajib lebih besar dari Rp 0.', 0);
      return;
    }
    if (!outputOptions.length || outputOptions.some(item => !(item.name || '').trim() || !isOutputDefinitionComplete(item))) {
      fail('Tambahkan minimal satu pilihan luaran wajib dan lengkapi seluruh pengaturannya.', 1);
      return;
    }
    if (attachmentRequirements.some(item => !item.name.trim())) {
      fail('Nama setiap lampiran wajib diisi.', 2);
      return;
    }
    const missingMainTemplate = attachmentRequirements.some(item => ['proposal', 'rab'].includes(item.category)
      && !(item.template && (item.template.dataUrl || item.template.fileUrl || item.template.storedFileId)));
    if (missingMainTemplate) {
      fail('Template Proposal dan RAB wajib diunggah sebelum skema disimpan.', 2);
      return;
    }
    const scheduleError = validateReportingSchedule(reportingSchedule);
    if (scheduleError) {
      fail(scheduleError, 3);
      return;
    }
    const eligibleUsers = eligibleIds.map(id => data.lecturers.find(item => item.id === id)).filter(Boolean).map(item => item.userId);
    const scheme = {
      id: uid('scheme'),
      ...form,
      year: Number(form.startDate.slice(0, 4)),
      maximumBudget: Number(form.maximumBudget),
      status: 'open',
      schemeStatus: 'open',
      eligibleProfileIds: eligibleIds,
      eligibleUserIds: eligibleUsers,
      eligibleLecturerIds: eligibleIds,
      filters,
      reportingSchedule,
      outputOptions,
      attachmentRequirements,
    };
    setData(current => ({ ...current, schemes: [scheme, ...current.schemes] }));
    history.push('/ris/skema');
  };

  const checkDates = () => {
    if (new Date(form.endDate) < new Date(form.startDate) || new Date(form.registrationEndDate) < new Date(form.registrationStartDate)) {
      fail('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.', 0);
      return false;
    }
    return true;
  };

  const goToNextStep = () => {
    if (activeStep === 0 && !checkDates()) return;
    goNext();
  };

  const addSelected = () => {
    if (selected) setEligibleIds(current => [...current, selected.id]);
    setSelected(null); setSearch(''); setModalOpen(false);
  };

  const stepPanels = [
    <section className="ris-form-section ris-scheme-step-panel" key="scheme-info" aria-labelledby="scheme-info-title">
      <div className="ris-form-section-heading"><div><h2 id="scheme-info-title" tabIndex="-1">Informasi Skema</h2><p>Isi identitas skema, masa pelaksanaan, dan batas dana untuk setiap pengajuan.</p></div></div>
      <div className="ris-scheme-info-grid">
        <Field label="Nama Skema" required><input required value={form.name} onChange={event => update('name', event.target.value)} placeholder="Contoh: Penelitian Kolaboratif 2026" /></Field>
        <Field label="Maksimum Anggaran" required hint={form.maximumBudget ? formatCurrency(Number(form.maximumBudget)) : 'Batas total RAB untuk satu pengajuan.'}><input required type="number" min="1" step="1" inputMode="numeric" value={form.maximumBudget} onChange={event => update('maximumBudget', event.target.value)} placeholder="Contoh: 50000000" /></Field>
        <Field label="Deskripsi" alignStart><textarea rows="3" value={form.description} onChange={event => update('description', event.target.value)} placeholder="Ringkasan tujuan dan ruang lingkup skema" /></Field>
        <Field label="Tanggal Skema Dimulai" required><input required type="date" value={form.startDate} onChange={event => update('startDate', event.target.value)} /></Field>
        <Field label="Tanggal Skema Selesai" required><input required type="date" value={form.endDate} onChange={event => update('endDate', event.target.value)} /></Field>
        <Field label="Pendaftaran Dibuka" required><input required type="datetime-local" value={form.registrationStartDate} onChange={event => update('registrationStartDate', event.target.value)} /></Field>
        <Field label="Pendaftaran Ditutup" required><input required type="datetime-local" value={form.registrationEndDate} onChange={event => update('registrationEndDate', event.target.value)} /></Field>
      </div>
    </section>,
    <section className="ris-form-section ris-scheme-step-panel ris-scheme-output-editor" key="scheme-outputs" aria-labelledby="scheme-output-title">
      <div className="ris-section-title"><div><h2 id="scheme-output-title" tabIndex="-1">Tipe Luaran Wajib</h2><p className="ris-muted">Dosen dapat memilih satu atau beberapa opsi. Atribut yang ditetapkan akan dikunci pada proposal.</p></div><Button type="button" tone="blue" onClick={addOutputOption}><Icon name="plus" size={16} />Tambah Tipe Luaran</Button></div>
      {outputOptions.length === 0 && <div className="ris-empty-state">Belum ada pilihan luaran wajib. Tambahkan minimal satu pilihan.</div>}
      {outputOptions.map((output, index) => <div className="ris-form-card ris-scheme-config-card" key={output.id}><div className="ris-card-heading"><h3>Pilihan Luaran {index + 1}</h3><button type="button" className="ris-text-danger" onClick={() => setOutputOptions(current => current.filter(item => item.id !== output.id))}>Hapus</button></div><OutputDefinitionFields definition={output} includeName includeDescription={false} onChange={value => updateOutputOption(output.id, value)} /></div>)}
    </section>,
    <section className="ris-form-section ris-scheme-step-panel ris-scheme-attachment-editor" key="scheme-attachments" aria-labelledby="scheme-attachment-title">
      <div className="ris-section-title"><div><h2 id="scheme-attachment-title" tabIndex="-1">Templat dan Lampiran Proposal</h2><p className="ris-muted">Templat Proposal dan RAB dapat diunduh dosen. Lampiran tambahan mengikuti nama yang Anda tetapkan.</p></div><Button type="button" tone="blue" onClick={addAttachment}><Icon name="plus" size={16} />Tambah Lampiran</Button></div>
      {attachmentRequirements.map((requirement, index) => <div className="ris-form-card ris-scheme-config-card" key={requirement.id}><div className="ris-card-heading"><h3>{requirement.custom ? `Lampiran Tambahan ${index - 1}` : requirement.name}</h3>{requirement.custom && <button type="button" className="ris-text-danger" onClick={() => setAttachmentRequirements(current => current.filter(item => item.id !== requirement.id))}>Hapus</button>}</div>{requirement.custom && <Field label="Nama Lampiran" required><input value={requirement.name} onChange={event => updateAttachment(requirement.id, { name: event.target.value })} placeholder="Contoh: Surat Pernyataan Mitra" /></Field>}<Field label={requirement.custom ? 'Templat Lampiran (opsional)' : `Templat ${requirement.name}`} required={!requirement.custom} alignStart><FileDrop file={requirement.template} accept={requirement.templateAccept} maxSize={TEMPLATE_MAX_SIZE} storagePurpose="proposals/templates" onError={setError} onFile={file => attachTemplate(requirement.id, file)} label={`Pilih templat ${requirement.name || 'lampiran'} (maksimal 2 MB)`} />{requirement.template && <button type="button" className="ris-text-danger ris-inline-remove" onClick={() => updateAttachment(requirement.id, { template: null })}>Hapus templat</button>}</Field></div>)}
    </section>,
    <section className="ris-form-section ris-scheme-step-panel ris-report-schedule-editor" key="scheme-schedule" aria-labelledby="scheme-schedule-title">
      <div className="ris-section-title"><div><h2 id="scheme-schedule-title" tabIndex="-1">Jadwal Pelaporan</h2><p className="ris-muted">Satu laporan akhir wajib tersedia. Periode Monev dan laporan luaran dapat disesuaikan.</p></div><Button type="button" tone="blue" onClick={addReport}><Icon name="plus" size={16} />Tambah Jadwal</Button></div>
      <div className={`ris-schedule-requirement ${reportingSchedule.filter(period => period.type === REPORT_TYPE.FINAL).length === 1 ? 'complete' : 'pending'}`}><Icon name={reportingSchedule.some(period => period.type === REPORT_TYPE.FINAL) ? 'check' : 'document'} size={17} /><span>{reportingSchedule.some(period => period.type === REPORT_TYPE.FINAL) ? 'Laporan Akhir sudah tersedia' : 'Laporan Akhir belum ditambahkan'}</span></div>
      {reportingSchedule.length === 0 && <div className="ris-empty-state ris-schedule-empty">Belum ada jadwal laporan. Tambahkan setidaknya satu Laporan Akhir.</div>}
      {reportingSchedule.map(period => <div className="ris-schedule-editor-row" key={period.id}>
        <Field label="Jenis" required><select value={period.type} onChange={event => updatePeriodType(period.id, event.target.value)}>{REPORT_TYPE_OPTIONS.map(item => <option key={item.value} value={item.value} disabled={item.value === REPORT_TYPE.FINAL && reportingSchedule.some(existing => existing.id !== period.id && existing.type === REPORT_TYPE.FINAL)}>{item.label}</option>)}</select></Field>
        <Field label="Nama Periode" required><input required value={period.label} onChange={event => updatePeriod(period.id, 'label', event.target.value)} /></Field>
        <Field label="Dibuka" required><input required type="datetime-local" value={period.openAt} onChange={event => updatePeriod(period.id, 'openAt', event.target.value)} /></Field>
        <Field label="Tenggat" required><input required type="datetime-local" value={period.dueAt} onChange={event => updatePeriod(period.id, 'dueAt', event.target.value)} /></Field>
        <button type="button" className="ris-action red" onClick={() => removePeriod(period.id)}>Hapus</button>
      </div>)}
    </section>,
    <section className="ris-form-section ris-scheme-step-panel ris-scheme-eligibility" key="scheme-eligibility" aria-labelledby="scheme-eligibility-title">
      <div className="ris-form-section-heading"><div><h2 id="scheme-eligibility-title" tabIndex="-1">Kelayakan Ketua Penelitian</h2><p>Tetapkan kriteria dosen yang boleh mendaftar. Anda juga dapat menambahkan dosen secara manual.</p></div></div>
      <div className="ris-eligibility-selection">
        <div className="ris-eligibility-selection-heading">
          <div><h3>Kualifikasi Dosen</h3><p>Pilih satu atau lebih kriteria pada setiap kategori.</p></div>
          <SelectAllCheckbox label="Pilih semua opsi kategori" checked={allEligibilitySelected} indeterminate={someEligibilitySelected} onChange={toggleAllEligibility} />
        </div>
        <div className="ris-eligibility-category-grid">
          {ELIGIBILITY_GROUPS.map(group => <EligibilityCheckGroup key={group.key} group={group} selected={filters[group.key]} onChange={value => updateFilter(group.key, value)} />)}
        </div>
      </div>
      <div className="ris-eligibility-thresholds">
        <div className="ris-eligibility-threshold-heading"><h3>Ambang Rekam Jejak</h3><p>Batas minimum dan maksimum bersifat opsional.</p></div>
        <div className="ris-eligibility-metrics-grid">
          <Field label="Skor SINTA Minimum"><input type="number" min="0" value={filters.minSinta} onChange={event => updateFilter('minSinta', event.target.value)} /></Field>
          <Field label="Skor SINTA Maksimum"><input type="number" min="0" value={filters.maxSinta} onChange={event => updateFilter('maxSinta', event.target.value)} /></Field>
          <Field label="Jumlah Penelitian Minimum"><input type="number" min="0" value={filters.minResearch} onChange={event => updateFilter('minResearch', event.target.value)} /></Field>
          <Field label="Tahun Terakhir Penelitian"><YearSelect value={filters.lastYear} onChange={event => updateFilter('lastYear', event.target.value)} /></Field>
        </div>
      </div>
      <div className="ris-scheme-filter-actions"><span>Kriteria ini dapat diubah sebelum skema disimpan.</span><Button type="button" tone="blue" onClick={checkEligible}><Icon name="search" size={16} />Tampilkan Dosen yang Memenuhi Kriteria</Button></div>
      <div className="ris-section-title ris-eligible-heading"><div><h2>Dosen yang Memenuhi Syarat</h2><p className="ris-muted">{eligible.length} dosen ditetapkan sebagai ketua penelitian.</p></div><Button type="button" onClick={() => setModalOpen(true)}>Tambah Dosen</Button></div>
      <div className="ris-table-wrap"><table className="ris-table ris-table-left ris-eligible-table"><thead><tr><th>No.</th><th>Ketua Penelitian</th><th>Kualifikasi</th><th>Rekam Jejak</th><th>Aksi</th></tr></thead>
        <tbody>{eligible.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><strong>{item.name}</strong><small>NIDN {item.nidn || 'Belum tersedia'} · {item.faculty || 'Fakultas belum diisi'}</small><small>{item.program || 'Program studi belum diisi'}</small></td><td><span>{item.educationLevel || '—'} · {positionLabels[item.functionalPosition] || 'Jabatan belum diisi'}</span><small>{statusLabels[item.employmentStatus] || 'Status belum diisi'}</small></td><td><span>SINTA {item.sintaScore || 0}</span><small>{item.researchCount || 0} penelitian</small></td><td><button type="button" className="ris-text-danger" onClick={() => setEligibleIds(current => current.filter(id => id !== item.id))}>Hapus</button></td></tr>)}{eligible.length === 0 && <EmptyRow colSpan={5}>Belum ada dosen yang dipilih. Gunakan filter atau tambahkan dosen secara manual.</EmptyRow>}</tbody>
      </table></div>
    </section>,
  ];

  return (
    <div className="ris-page ris-page-narrow ris-workspace-page ris-scheme-create-page">
      <PageHeader title="Formulir Pembuatan Skema Baru" description="Atur informasi, luaran, dokumen, jadwal, dan kelayakan pendaftar." onBack={() => history.goBack()} />
      <nav className="ris-scheme-step-nav" aria-label="Tahapan pembuatan skema">
        {steps.map((step, index) => <button key={step.label} type="button" aria-current={activeStep === index ? 'step' : undefined} aria-label={`Langkah ${index + 1}: ${step.label}`} aria-pressed={activeStep === index} className={activeStep === index ? 'active' : ''} onClick={() => { setActiveStep(index); setError(''); }}>
          <span className="ris-scheme-step-number">{index + 1}</span><span className="ris-scheme-step-label">{step.label}</span>
        </button>)}
      </nav>
      <div className="ris-scheme-step-context"><div><strong>{steps[activeStep].label}</strong><span>{steps[activeStep].description}</span></div><span>Langkah {activeStep + 1} dari {steps.length}</span></div>
      <FloatingError message={error} />
      <form ref={formRef} className="ris-scheme-create-form" onSubmit={submit}>
        <div ref={stepContentRef} className="ris-scheme-step-content" aria-live="polite">
          {stepPanels[activeStep]}
        </div>
        <div className="ris-scheme-wizard-actions">
          <Button type="button" tone="gray" disabled={activeStep === 0} onClick={() => { setActiveStep(current => Math.max(0, current - 1)); setError(''); }}>Kembali</Button>
          {activeStep < steps.length - 1
            ? <Button type="button" tone="blue" onClick={goToNextStep}>Lanjutkan</Button>
            : <Button type="submit" className="ris-wide-button">Simpan Skema</Button>}
        </div>
      </form>
      {modalOpen && <Modal title="Tambah Dosen Lain" onClose={() => setModalOpen(false)}><div className="ris-modal-body"><p className="ris-modal-intro">Cari Nama atau NIDN dosen di bawah ini</p><input value={search} onChange={event => { setSearch(event.target.value); setSelected(null); }} placeholder="Ketik nama atau NIDN dosen..." />{!selected && searchResults.length > 0 && <div className="ris-autocomplete">{searchResults.map(item => <button type="button" key={item.id} onClick={() => { setSelected(item); setSearch(item.name); }}>{item.name} — {item.nidn}</button>)}</div>}{selected && <dl className="ris-info-list"><div><dt>Nama</dt><dd>{selected.name}</dd></div><div><dt>NIDN</dt><dd>{selected.nidn}</dd></div><div><dt>Fakultas</dt><dd>{selected.faculty}</dd></div><div><dt>Program Studi</dt><dd>{selected.program}</dd></div><div><dt>Tingkat Edukasi</dt><dd>{selected.educationLevel}</dd></div></dl>}<div className="ris-modal-actions"><Button type="button" tone="gray" onClick={() => setModalOpen(false)}>Batal</Button><Button type="button" disabled={!selected} onClick={addSelected}>Tambah</Button></div></div></Modal>}
    </div>
  );
}
