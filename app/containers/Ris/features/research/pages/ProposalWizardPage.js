/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useHistory, useParams } from 'react-router-dom';
import readExcelFile from 'read-excel-file/browser';
import { useRis } from '../../../core/RisContext';
import Icon from '../../../shared/components/Icon';
import {
  BUDGET_TABS, OUTPUT_EMPTY, SDGS, fileMeta, uid
} from '../../../core/data';
import {
  STATUS,
  canEditDraft,
  getSchemeMaximumBudget,
  getSchemeTitle,
  hasActiveDraftForScheme,
  isEligibleForScheme,
  isOpenScheme,
  transitionDraftStatus,
  validateDraftForSubmit,
  validateOutputDetails,
} from '../../../shared/workflows/workflow';
import {
  AcademicYearSelect, Button, Field, FileDrop, FloatingError, Modal, PageBack
} from '../../../shared/components/Ui';
import OutputDefinitionFields from '../components/OutputDefinitionFields';
import ProposalBudgetFields from '../components/ProposalBudgetFields';
import { mergeRabImport, parseRabSheets, removeRabImport } from '../workflows/rabImport';
import { proposalBudgetSections, validateProposalBudget } from '../workflows/proposalBudget';
import { validateFile } from '../../../shared/workflows/fileValidation';
import { createActivityLog } from '../../profiles/workflows/researcherProfileWorkflow';
import {
  getProposalSubmissionRequirements,
  normalizeSchemeOutputOptions,
  outputDefinitionLabel,
} from '../workflows/schemeConfiguration';

const emptyProject = {
  title: '', mandatoryOutputPlan: '', additionalOutputPlan: '', additionalOutputPlans: [], targetTkt: '', ripRelation: '', researchCenterRelation: '', researchCenterOther: '', sdgs: [], integrated: null, courseName: '', academicYear: ''
};
const emptyMember = () => ({
  id: uid('member'), role: 'member', type: 'external_lecturer', profileId: '', name: '', nidn: '', nim: '', program: '', faculty: '', orcid: ''
});
const emptyCustomOutput = () => {
  const id = uid('output');
  return { ...OUTPUT_EMPTY, id, type: 'tambahan', customOutput: true, planValue: `custom:${id}`, planLabel: 'Luaran Tambahan' };
};

const option = (value, label, defaults = {}, description = '') => ({
  value, label, defaults, description
});

const TKT_OPTIONS = [
  option('none', 'None'),
  option('1', 'TKT 1', {}, 'Prinsip dasar telah diobservasi dan dilaporkan.'),
  option('2', 'TKT 2', {}, 'Konsep teknologi dan/atau aplikasi telah dirumuskan.'),
  option('3', 'TKT 3', {}, 'Bukti eksperimental untuk fungsi dan/atau karakteristik konsep telah diperoleh di laboratorium.'),
  option('4', 'TKT 4', {}, 'Validasi komponen dan/atau sistem di laboratorium.'),
  option('5', 'TKT 5', {}, 'Validasi komponen dan/atau sistem dalam lingkungan relevan (simulasi).'),
  option('6', 'TKT 6', {}, 'Prototipe sistem/model diuji di lingkungan yang relevan.'),
  option('7', 'TKT 7', {}, 'Prototipe sistem/model diuji di lingkungan sebenarnya.'),
  option('8', 'TKT 8', {}, 'Sistem teknologi lengkap dan telah terbukti bekerja dalam kondisi sebenarnya.'),
  option('9', 'TKT 9', {}, 'Sistem telah terbukti di lingkungan sebenarnya dan siap untuk diterapkan/komersialisasi.'),
];

const RIP_OPTIONS = [
  option('none', 'None'),
  option('ict_based', 'ICT Based'),
  option('business_digital_behavior_technopreneurship', 'Business, Digital Behavior & Technopreneurship'),
  option('digital_content_digital_media_management', 'Digital Content & Digital Media Management'),
  option('design_art_multimedia_for_industry', 'Design, Art & Multimedia for Industry'),
];

const RESEARCH_CENTER_OPTIONS = [
  option('none', 'None'),
  option('ai_sustainability', 'AI & Sustainability'),
  option('ai_healthcare', 'AI for Healthcare'),
  option('ai_business_social_studies', 'AI for Business & Social Studies'),
  option('renewable_energy', 'Renewable Energy'),
  option('community_empowerment', 'Community Empowerment'),
  option('ecotourism_cultural_sustainability', 'Ecotourism & Cultural Sustainability'),
  option('sustainable_product_design', 'Sustainable Product & Design'),
  option('smart_farming', 'Smart Farming'),
  option('other', 'Other'),
];

const RIP_ALIASES = {
  sesuai_rip: 'ict_based',
  tidak_sesuai: 'none',
  business_digital_behavoir_technopreneurship: 'business_digital_behavior_technopreneurship',
  business_digital_behavior_technopreneurship: 'business_digital_behavior_technopreneurship',
};

const normalizeProjectState = source => {
  const value = source || {};
  return {
    ...emptyProject,
    ...value,
    targetTkt: value.targetTkt ? String(value.targetTkt) : '',
    ripRelation: RIP_ALIASES[value.ripRelation] || value.ripRelation || '',
    researchCenterRelation: RIP_ALIASES[value.researchCenterRelation] || value.researchCenterRelation || '',
    researchCenterOther: value.researchCenterOther || '',
  };
};

const outputMatchesOption = (output, optionValue) => output.schemeOutputOptionId === optionValue.id
  || output.planValue === optionValue.value
  || output.planValue === optionValue.id
  || (output.category === optionValue.category
    && (!optionValue.journalIndexTarget || output.journalIndexTarget === optionValue.journalIndexTarget)
    && (!optionValue.hkiType || output.hkiType === optionValue.hkiType)
    && (!optionValue.productType || output.productType === optionValue.productType));

const makeMandatoryOutput = (outputOption, current = null) => {
  const {
    id: optionId, value, name, ...fixedDefinition
  } = outputOption;
  return {
    ...OUTPUT_EMPTY,
    ...fixedDefinition,
    id: current && current.id ? current.id : uid('output'),
    type: 'wajib',
    schemeOutputOptionId: optionId,
    planValue: value || optionId,
    planLabel: name,
    name,
    description: current && current.description ? current.description : '',
    configurationLocked: true,
  };
};

const normalizeProposalOutputs = (currentOutputs, schemeOutputOptions) => (currentOutputs || []).map(output => {
  if (output.type !== 'wajib') return { ...output, type: 'tambahan', customOutput: true };
  const matchedOption = schemeOutputOptions.find(item => outputMatchesOption(output, item));
  return matchedOption ? makeMandatoryOutput(matchedOption, output) : { ...output, configurationLocked: true };
});

const selectedLabel = (options, value) => (options.find(item => item.value === value) || {}).label || 'Pilih opsi';

const validateOutput = output => validateOutputDetails(output);

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const validateAttachmentFile = (file, allowedExtensions) => {
  const result = validateFile(file, { allowedExtensions, maxSize: MAX_ATTACHMENT_SIZE });
  return result.message;
};

const attachmentSource = file => file && (file.dataUrl || file.url || file.fileUrl || file.previewUrl || '');

function CollapsibleChoice({
  label, value, options, onChange, required, documentUrl, otherValue, onOtherChange
}) {
  return (
    <Field label={label} required={required} alignStart>
      <details className="ris-choice-list" open>
        <summary>{selectedLabel(options, value)}</summary>
        <div className="ris-choice-grid">
          {options.map(item => (
            <label key={item.value} className={value === item.value ? 'active' : ''}>
              <input type="radio" checked={value === item.value} onChange={() => onChange(item.value)} />
              <span><strong>{item.label}</strong>{item.description && <small>{item.description}</small>}</span>
            </label>
          ))}
        </div>
        {value === 'other' && onOtherChange && <input className="ris-choice-other" value={otherValue || ''} onChange={event => onOtherChange(event.target.value)} placeholder="Isi manual" />}
        {documentUrl && <a className="ris-reference-link" href={documentUrl} target="_blank" rel="noreferrer">Lihat dokumen referensi</a>}
      </details>
    </Field>
  );
}

CollapsibleChoice.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  options: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  required: PropTypes.bool,
  documentUrl: PropTypes.string,
  otherValue: PropTypes.string,
  onOtherChange: PropTypes.func,
};
CollapsibleChoice.defaultProps = {
  value: '', required: false, documentUrl: '', otherValue: '', onOtherChange: null
};

function MemberFields({ member, lecturers, onChange }) {
  const update = (key, value) => onChange({ ...member, [key]: value });
  const selectProfile = id => {
    const profile = lecturers.find(item => item.id === id);
    if (!profile) {
      update('profileId', '');
      return;
    }
    onChange({
      ...member, profileId: profile.id, name: profile.name, nidn: profile.nidn, program: profile.program, faculty: profile.faculty, orcid: profile.orcid
    });
  };
  const internal = member.type === 'internal_lecturer';
  return <div>
    <Field label="Tipe Anggota" required><select value={member.type} onChange={event => onChange({
      ...emptyMember(), id: member.id, role: member.role, type: event.target.value
    })}><option value="external_lecturer">Dosen Eksternal</option><option value="internal_lecturer">Dosen Internal</option>{member.role !== 'ketua' && <option value="student">Mahasiswa</option>}</select></Field>
    {internal ? <Field label="Nama" required><select value={member.profileId} onChange={event => selectProfile(event.target.value)}><option value="">-- Pilih Dosen --</option>{lecturers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field> : <Field label="Nama" required><input value={member.name} onChange={event => update('name', event.target.value)} placeholder="Dosen XYZ" /></Field>}
    {member.type === 'student' ? <Field label="NIM" required><input inputMode="numeric" maxLength="12" value={member.nim} onChange={event => update('nim', event.target.value.replace(/\D/g, ''))} placeholder="0000000000" /></Field> : <Field label="NIDN" required><input disabled={internal} inputMode="numeric" maxLength="12" value={member.nidn} onChange={event => update('nidn', event.target.value.replace(/\D/g, ''))} placeholder="0000000000" /></Field>}
    <Field label="Program Studi" required><input disabled={internal} value={member.program} onChange={event => update('program', event.target.value)} placeholder="Sistem Informasi" /></Field>
    <Field label="Fakultas" required><input disabled={internal} value={member.faculty} onChange={event => update('faculty', event.target.value)} placeholder="Teknik dan Informatika" /></Field>
    <Field label="ORCID (opsional)"><input disabled={internal} inputMode="numeric" maxLength="16" value={member.orcid} onChange={event => update('orcid', event.target.value.replace(/\D/g, ''))} placeholder="0000000000000000" /></Field>
  </div>;
}

MemberFields.propTypes = { member: PropTypes.object.isRequired, lecturers: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired };

export default function ProposalWizardPage({ archiveMode }) {
  const params = useParams();
  const {
    data, setData, showToast, user
  } = useRis();
  const history = useHistory();
  const archivedDraft = archiveMode ? (data.drafts || []).find(item => item.id === params.draftId) : null;
  const schemeId = archiveMode && archivedDraft ? archivedDraft.schemeId : params.schemeId;
  const scheme = data.schemes.find(item => item.id === schemeId);
  const existing = archiveMode ? archivedDraft : (data.drafts || []).find(item => item.schemeId === schemeId && item.userId === user.id);
  const defaultLeaderProfile = data.lecturers.find(item => item.id === user.profileId);
  const defaultLeader = defaultLeaderProfile ? {
    ...emptyMember(), role: 'ketua', type: 'internal_lecturer', profileId: defaultLeaderProfile.id, name: defaultLeaderProfile.name, nidn: defaultLeaderProfile.nidn, program: defaultLeaderProfile.program, faculty: defaultLeaderProfile.faculty, orcid: defaultLeaderProfile.orcid
  } : { ...emptyMember(), role: 'ketua' };
  const initialProject = normalizeProjectState(existing ? existing.project : emptyProject);
  const schemeOutputOptions = useMemo(() => normalizeSchemeOutputOptions(scheme), [scheme]);
  const [step, setStep] = useState(existing ? Math.min(existing.currentStep || 1, 5) : 1);
  const [project, setProject] = useState(initialProject);
  const [members, setMembers] = useState(existing && existing.members.length ? existing.members : [defaultLeader, emptyMember()]);
  const [budgets, setBudgets] = useState(existing ? existing.budgets || [] : []);
  const [budgetSections, setBudgetSections] = useState(() => proposalBudgetSections(existing, BUDGET_TABS));
  const [outputs, setOutputs] = useState(() => normalizeProposalOutputs(existing ? existing.outputs : [], schemeOutputOptions));
  const [files, setFiles] = useState(existing ? existing.files : []);
  const [error, setError] = useState('');
  const [budgetValidationAttempted, setBudgetValidationAttempted] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const [revisionOpen, setRevisionOpen] = useState(false);
  const autosaveTimer = useRef(null);

  const leader = members[0];
  const regularMembers = members.slice(1);
  const schemeTitle = getSchemeTitle(scheme);
  const maximumBudget = getSchemeMaximumBudget(scheme);
  const attachmentRequirements = useMemo(() => getProposalSubmissionRequirements(scheme), [scheme]);
  const rabRequirement = attachmentRequirements.find(item => item.category === 'rab');
  const primaryAttachmentRequirements = attachmentRequirements.filter(item => item.category === 'proposal');
  const mandatoryOutputs = outputs.filter(item => item.type === 'wajib');
  const additionalOutputs = outputs.filter(item => item.type === 'tambahan');
  const selectedMandatoryOptionIds = mandatoryOutputs.filter(item => item.schemeOutputOptionId).map(item => item.schemeOutputOptionId);

  const buildDraft = (status, currentExisting = existing) => {
    const now = new Date().toISOString();
    const nextDraft = {
      ...(currentExisting || {}),
      id: currentExisting ? currentExisting.id : uid('draft'),
      userId: currentExisting ? currentExisting.userId : user.id,
      userName: currentExisting ? currentExisting.userName : user.name,
      createdBy: currentExisting ? currentExisting.createdBy : user.id,
      schemeId,
      status,
      draftStatus: status,
      currentStep: step,
      project,
      members,
      budgets,
      budgetSections,
      outputs,
      files: files.filter(item => item && item.name),
      createdAt: currentExisting ? currentExisting.createdAt : now,
      updatedAt: now,
      lastSavedAt: now,
      submittedAt: status === STATUS.SUBMITTED ? now : (currentExisting && currentExisting.submittedAt),
      decision: currentExisting && currentExisting.decision,
      assignment: currentExisting && currentExisting.assignment,
      review: currentExisting && currentExisting.review,
      ...(!currentExisting ? { assignments: [], reviews: [], decisionHistory: [] } : {}),
      contract: currentExisting && currentExisting.contract,
    };
    return nextDraft;
  };

  const persist = (status, redirect) => {
    setData(current => {
      if (!archiveMode && current.schemes.some(item => item.id === schemeId && item.deletedAt)) return current;
      const currentExisting = (current.drafts || []).find(item => (existing && item.id === existing.id) || (!archiveMode && item.schemeId === schemeId && item.userId === user.id && canEditDraft(item, user)));
      const builtDraft = buildDraft(status, currentExisting);
      const nextDraft = currentExisting ? (transitionDraftStatus(currentExisting, status, builtDraft) || currentExisting) : builtDraft;
      return {
        ...current,
        drafts: currentExisting ? (current.drafts || []).map(item => (item.id === currentExisting.id ? nextDraft : item)) : [...(current.drafts || []), nextDraft],
        systemActivityLogs: archiveMode ? [...(current.systemActivityLogs || []), createActivityLog(user, 'archive_edit_internal_research', 'research_draft', nextDraft.id, currentExisting, nextDraft, uid)] : current.systemActivityLogs,
      };
    });
    if (redirect) history.push(redirect);
  };

  const saveDraft = () => {
    persist(existing ? existing.status : STATUS.DRAFT);
    setSavedAt(new Date().toISOString());
    showToast({
      tone: 'success',
      title: existing && existing.status === STATUS.REVISION ? 'Revisi tersimpan' : 'Draft tersimpan',
      message: 'Perubahan proposal berhasil disimpan.',
    });
  };

  useEffect(() => {
    if (!scheme || !user) return undefined;
    if (archiveMode) return undefined;
    if (scheme && scheme.deletedAt) return undefined;
    if (existing && !archiveMode && !canEditDraft(existing, user)) return undefined;
    if (!archiveMode && !existing && (!isOpenScheme(scheme) || !isEligibleForScheme(scheme, user) || hasActiveDraftForScheme(data, user, schemeId))) return undefined;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      setData(current => {
        if (current.schemes.some(item => item.id === schemeId && item.deletedAt)) return current;
        const currentExisting = (current.drafts || []).find(item => (existing && item.id === existing.id) || (!archiveMode && item.schemeId === schemeId && item.userId === user.id && canEditDraft(item, user)));
        const status = currentExisting ? currentExisting.status : STATUS.DRAFT;
        const builtDraft = buildDraft(status, currentExisting);
        const nextDraft = currentExisting ? (transitionDraftStatus(currentExisting, status, builtDraft) || currentExisting) : builtDraft;
        return {
          ...current,
          drafts: currentExisting ? (current.drafts || []).map(item => (item.id === currentExisting.id ? nextDraft : item)) : [...(current.drafts || []), nextDraft],
        };
      });
    }, 800);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [step, project, members, budgets, budgetSections, outputs, files, archiveMode, schemeId, user && user.id]);

  if (!scheme) return <div className="ris-page"><h1>Skema tidak ditemukan</h1></div>;
  if (!archiveMode && scheme.deletedAt) return <div className="ris-page"><h1>Skema sudah dihapus</h1><p className="ris-muted">Proposal terkait telah dipindahkan ke Arsip dan tidak dapat dilanjutkan.</p></div>;
  if (!archiveMode && !isOpenScheme(scheme) && !existing) return <div className="ris-page"><h1>Skema tidak sedang dibuka</h1></div>;
  if (!archiveMode && !existing && !isEligibleForScheme(scheme, user)) return <div className="ris-page"><h1>Akun tidak eligible untuk skema ini</h1><p className="ris-muted">Akun ini tidak termasuk daftar pengguna yang memenuhi kriteria skema.</p></div>;
  if (!archiveMode && existing && !canEditDraft(existing, user)) return <div className="ris-page"><h1>Proposal tidak dapat diedit</h1><p className="ris-muted">Hanya draft atau proposal revisi milik dosen yang dapat diedit.</p></div>;
  if (!archiveMode && !existing && hasActiveDraftForScheme(data, user, schemeId)) return <div className="ris-page"><h1>Pengajuan aktif sudah ada</h1><p className="ris-muted">Satu dosen hanya boleh memiliki satu draft/pengajuan aktif per skema.</p></div>;

  const validateStep = () => {
    if (step === 1 && (!project.title || !project.targetTkt || !project.ripRelation || !project.researchCenterRelation || (project.researchCenterRelation === 'other' && !project.researchCenterOther) || !(project.sdgs || []).length || project.integrated === null || (project.integrated && (!project.courseName || !project.academicYear)))) return 'Lengkapi seluruh data proyek yang wajib diisi.';
    if (step === 2 && (members.length < 2 || members.some(item => !item.name || (!item.nidn && !item.nim) || !item.program || !item.faculty))) return 'Lengkapi data ketua dan minimal satu anggota.';
    if (step === 3) return validateProposalBudget({ budgets, files }, maximumBudget);
    if (step === 4 && (!outputs.some(item => item.type === 'wajib') || outputs.some(item => !validateOutput(item)))) return 'Pilih minimal satu luaran wajib dan lengkapi seluruh data luaran.';
    if (step === 5 && attachmentRequirements.filter(item => item.required !== false).some(item => !fileFor(item.category))) return 'Unggah seluruh lampiran yang ditetapkan pada skema.';
    return '';
  };

  const next = () => {
    const message = archiveMode ? '' : validateStep();
    if (message) {
      if (step === 3) setBudgetValidationAttempted(true);
      setError(message);
      return;
    }
    if (step === 3) setBudgetValidationAttempted(false);
    setError('');
    const nextStep = Math.min(5, step + 1);
    setStep(nextStep);
    setTimeout(() => window.scrollTo(0, 0), 0);
  };

  const updateBudgetItems = nextBudgets => {
    setBudgets(nextBudgets);
    if (step === 3 && budgetValidationAttempted && !validateProposalBudget({ budgets: nextBudgets, files }, maximumBudget)) setError('');
  };

  const submit = () => {
    const candidate = buildDraft(STATUS.SUBMITTED);
    const message = validateDraftForSubmit(candidate, scheme);
    if (message) { setError(message); return; }
    persist(STATUS.SUBMITTED, '/ris');
  };

  const setFixedFile = (requirement, file) => {
    const allowed = String(requirement.accept || '').split(',').map(item => item.trim().replace(/^\./, '')).filter(Boolean);
    const validation = validateAttachmentFile(file, allowed);
    if (validation) {
      setError(validation);
      return;
    }
    const currentFile = files.find(item => item.category === requirement.category);
    if (currentFile && currentFile.fileUrl && currentFile.fileUrl.indexOf('blob:') === 0 && window.URL && window.URL.revokeObjectURL) window.URL.revokeObjectURL(currentFile.fileUrl);
    const fileUrl = file.risFileUrl || (window.URL && window.URL.createObjectURL ? window.URL.createObjectURL(file) : '');
    const meta = { ...fileMeta(file), category: requirement.category, requirementName: requirement.name, uploadedAt: new Date().toISOString(), fileUrl };
    setFiles(current => [...current.filter(item => item.category !== requirement.category), meta]);
    setError('');
  };

  const fileFor = category => files.find(item => item.category === category) || null;
  const removeFixedFile = category => {
    const currentFile = fileFor(category);
    if (currentFile && currentFile.fileUrl && currentFile.fileUrl.indexOf('blob:') === 0 && window.URL && window.URL.revokeObjectURL) window.URL.revokeObjectURL(currentFile.fileUrl);
    setFiles(current => current.filter(item => item.category !== category));
    setError('');
  };
  const prepareRab = async file => parseRabSheets(await readExcelFile(file));
  const applyRab = (file, rows) => {
    const imported = mergeRabImport(budgets, budgetSections, rows);
    setBudgets(imported.budgets);
    setBudgetSections(imported.sections);
    setFixedFile(rabRequirement, file);
  };
  const removeRab = () => {
    const cleared = removeRabImport(budgets, budgetSections);
    setBudgets(cleared.budgets);
    setBudgetSections(cleared.sections);
    removeFixedFile('rab');
  };
  const projectUpdate = (key, value) => {
    const nextProject = { ...project, [key]: value };
    setProject(nextProject);
    if (key === 'targetTkt') {
      setOutputs(current => current.map(output => (output.type === 'tambahan' && output.category === 'produk_prototipe' && (!output.targetTkt || output.targetTkt === project.targetTkt) ? { ...output, targetTkt: value } : output)));
    }
  };
  const toggleMandatoryOutput = outputOption => {
    setOutputs(current => {
      const selected = current.some(item => item.type === 'wajib' && item.schemeOutputOptionId === outputOption.id);
      if (selected) return current.filter(item => !(item.type === 'wajib' && item.schemeOutputOptionId === outputOption.id));
      return [...current, makeMandatoryOutput(outputOption)];
    });
  };

  return (
    <div className="ris-page">
      <PageBack onClick={() => history.push(archiveMode ? '/ris/arsip' : '/ris/pengajuan-penelitian-internal')} />
      <div className="ris-title-with-action"><h1>{archiveMode ? 'Penyunting Arsip Penelitian Internal' : 'Formulir Pendaftaran Proposal'}</h1>{existing && existing.status === STATUS.REVISION && existing.decision && <Button type="button" tone="amber" pill onClick={() => setRevisionOpen(true)}>Tampilkan Catatan Revisi</Button>}</div>
      <div className="ris-stepper">{['Deskripsi Penelitian', 'Anggota', 'Anggaran', 'Luaran Hasil', 'Lampiran'].map((label, index) => <div key={label} className={step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''}><span>{index + 1}</span><small>{label}</small></div>)}</div>
      <FloatingError message={error} />

      {step === 1 && <section className="ris-form-section"><h2>Deskripsi Penelitian</h2>
        <Field label="Skema Penelitian"><span className="ris-static-value">{schemeTitle}</span></Field>
        <Field label="Judul Penelitian" required><input value={project.title} onChange={event => projectUpdate('title', event.target.value)} placeholder="Pengembangan..." /></Field>
        <CollapsibleChoice label="Target TKT (Tingkat Kesiapterapan Teknologi)" required value={project.targetTkt} options={TKT_OPTIONS} documentUrl="https://bit.ly/pengukuranTKTUMN" onChange={value => projectUpdate('targetTkt', value)} />
        <CollapsibleChoice label="Keterkaitan dengan RIP" required value={project.ripRelation} options={RIP_OPTIONS} documentUrl="https://bit.ly/riprenstrarisetUMN" onChange={value => projectUpdate('ripRelation', value)} />
        <CollapsibleChoice label="Keterkaitan dengan Pusat Riset" required value={project.researchCenterRelation} options={RESEARCH_CENTER_OPTIONS} otherValue={project.researchCenterOther} onOtherChange={value => projectUpdate('researchCenterOther', value)} onChange={value => projectUpdate('researchCenterRelation', value)} />
        <Field label="Keterkaitan dengan SDGs" required alignStart><div className="ris-sdg-grid">{SDGS.map(item => <label key={item.id}><input type="checkbox" checked={project.sdgs.includes(item.id)} onChange={() => projectUpdate('sdgs', project.sdgs.includes(item.id) ? project.sdgs.filter(id => id !== item.id) : [...project.sdgs, item.id])} /><span>{item.code}</span>{item.name}</label>)}</div></Field>
        <Field label="Apakah penelitian terintegrasi dengan mata kuliah?" required><div className="ris-radio-group"><label><input type="radio" checked={project.integrated === true} onChange={() => projectUpdate('integrated', true)} />Ya</label><label><input type="radio" checked={project.integrated === false} onChange={() => projectUpdate('integrated', false)} />Tidak</label></div></Field>
        {project.integrated && <React.Fragment><Field label="Nama Mata Kuliah" required><select value={project.courseName} onChange={event => projectUpdate('courseName', event.target.value)}><option value="">-- Pilih --</option><option value="machine_learning">Pembelajaran Mesin</option><option value="deep_learning">Pembelajaran Mendalam</option><option value="data_mining">Penambangan Data</option></select></Field><Field label="Tahun Akademik" required><AcademicYearSelect value={project.academicYear} onChange={event => projectUpdate('academicYear', event.target.value)} /></Field></React.Fragment>}
      </section>}

      {step === 2 && <section className="ris-form-section"><h2>Anggota</h2><div className="ris-form-card"><h3>Ketua</h3><MemberFields member={leader} lecturers={data.lecturers} onChange={value => setMembers([value, ...regularMembers])} /></div>{regularMembers.map((member, index) => <div className="ris-form-card" key={member.id}><div className="ris-card-heading"><h3>{regularMembers.length > 1 ? `Anggota ${index + 1}` : 'Anggota'}</h3>{regularMembers.length > 1 && <button type="button" className="ris-text-danger" onClick={() => setMembers([leader, ...regularMembers.filter(item => item.id !== member.id)])}>Hapus Anggota</button>}</div><MemberFields member={member} lecturers={data.lecturers} onChange={value => setMembers([leader, ...regularMembers.map(item => (item.id === member.id ? value : item))])} /></div>)}<div className="ris-align-right"><Button type="button" tone="gray" pill onClick={() => setMembers(current => [...current, emptyMember()])}>Tambah Anggota +</Button></div></section>}

      {step === 3 && <ProposalBudgetFields budgets={budgets} sections={budgetSections} maximumBudget={maximumBudget} requirement={rabRequirement} file={fileFor('rab')} showValidation={budgetValidationAttempted} onBudgets={updateBudgetItems} onSections={setBudgetSections} onPrepareRab={prepareRab} onFile={applyRab} onRemoveFile={removeRab} onError={setError} />}

      {step === 4 && <section className="ris-form-section">
        <div className="ris-section-title ris-wizard-section-heading"><div><h2>Luaran Hasil</h2><p>Pilih minimal satu luaran wajib yang telah ditetapkan pada skema. Anda dapat memilih beberapa opsi.</p></div></div>
        <div className="ris-mandatory-output-picker">
          <h3>Pilihan Luaran Wajib</h3>
          <div className="ris-mandatory-output-list">{schemeOutputOptions.map(item => <label key={item.id} className={selectedMandatoryOptionIds.includes(item.id) ? 'active' : ''}><input type="checkbox" checked={selectedMandatoryOptionIds.includes(item.id)} onChange={() => toggleMandatoryOutput(item)} /><span>{outputDefinitionLabel(item)}</span></label>)}</div>
        </div>
        {!mandatoryOutputs.length && <div className="ris-output-selection-note">Belum ada luaran wajib yang dipilih.</div>}
        {mandatoryOutputs.map(output => <div className="ris-form-card ris-proposal-output-card" key={output.id}><div className="ris-card-heading"><h3>Luaran Wajib - {outputDefinitionLabel(output)}</h3></div><OutputDefinitionFields definition={output} locked onChange={value => setOutputs(current => current.map(item => (item.id === output.id ? value : item)))} /></div>)}
        {additionalOutputs.map(output => <div className="ris-form-card ris-proposal-output-card" key={output.id}><div className="ris-card-heading"><h3>Luaran Tambahan - {outputDefinitionLabel(output)}</h3><button type="button" className="ris-text-danger" onClick={() => setOutputs(current => current.filter(item => item.id !== output.id))}>Hapus Luaran</button></div><OutputDefinitionFields definition={output} onChange={value => setOutputs(current => current.map(item => (item.id === output.id ? value : item)))} /></div>)}
        <div className="ris-additional-output-action"><Button type="button" tone="blue" onClick={() => setOutputs(current => [...current, emptyCustomOutput()])}><Icon name="plus" size={16} />Tambah Luaran Tambahan</Button></div>
      </section>}

      {step === 5 && <section className="ris-form-section">
        <div className="ris-section-title ris-wizard-section-heading"><div><h2>Lampiran</h2><p>Unduh template yang disediakan, lengkapi dokumen, lalu unggah kembali sesuai formatnya.</p></div></div>
        {primaryAttachmentRequirements.map((requirement, index) => <div className="ris-form-card ris-proposal-attachment-card" key={requirement.id}><div className="ris-card-heading"><h3>{index + 1}. {requirement.name}</h3><span className="ris-badge blue">Wajib</span></div>{requirement.template && attachmentSource(requirement.template) ? <a className="ris-template-download" href={attachmentSource(requirement.template)} download={requirement.template.name}><Icon name="download" size={17} /><span><strong>Unduh Template</strong><small>{requirement.template.name}</small></span></a> : <div className="ris-template-unavailable">Template tidak disediakan untuk lampiran ini.</div>}<FileDrop file={fileFor(requirement.category)} accept={requirement.accept} maxSize={MAX_ATTACHMENT_SIZE} storagePurpose="proposals" onError={setError} label={`Unggah ${requirement.name} (maksimal 10 MB)`} onFile={file => setFixedFile(requirement, file)} /></div>)}
      </section>}

      <div className="ris-wizard-actions"><div>{step > 1 && <Button type="button" tone="gray" pill onClick={() => { setError(''); setStep(value => value - 1); }}>Kembali</Button>}</div><div>{savedAt && !archiveMode && <span className="ris-draft-saved-status" role="status"><Icon name="check" size={15} />Draf tersimpan</span>}{archiveMode && <Button type="button" tone="blue" pill onClick={() => { persist(existing ? existing.status : STATUS.DRAFT, '/ris/arsip'); showToast({ tone: 'success', title: 'Perubahan tersimpan', message: 'Data penelitian di arsip berhasil diperbarui.' }); }}>Simpan Perubahan</Button>}{!archiveMode && <Button type="button" tone="gray" pill onClick={saveDraft}>{existing && existing.status === STATUS.REVISION ? 'Simpan Revisi' : 'Simpan Draf'}</Button>}{step < 5 ? <Button type="button" pill onClick={next}>Selanjutnya</Button> : !archiveMode && <Button type="button" pill onClick={submit}>Kirim</Button>}</div></div>
      {revisionOpen && <Modal title="Catatan Revisi" onClose={() => setRevisionOpen(false)}><div className="ris-modal-body"><p className="ris-prewrap">{existing.decision.notes}</p><div className="ris-modal-actions"><Button type="button" tone="gray" pill onClick={() => setRevisionOpen(false)}>Tutup</Button></div></div></Modal>}
    </div>
  );
}

ProposalWizardPage.propTypes = { archiveMode: PropTypes.bool };
ProposalWizardPage.defaultProps = { archiveMode: false };
