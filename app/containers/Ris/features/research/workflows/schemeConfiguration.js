/* eslint-disable object-curly-newline, object-property-newline */

export const OUTPUT_CATEGORY_OPTIONS = [
  { value: 'jurnal', label: 'Jurnal' },
  { value: 'prosiding', label: 'Prosiding' },
  { value: 'buku', label: 'Buku' },
  { value: 'hki', label: 'HKI' },
  { value: 'produk_prototipe', label: 'Produk / Prototipe' },
  { value: 'other', label: 'Lainnya' },
];

export const JOURNAL_LEVEL_OPTIONS = [
  { value: 'sinta', label: 'SINTA' },
  { value: 'scopus', label: 'Scopus' },
  { value: 'wos', label: 'Web of Science' },
];

export const PUBLICATION_TYPE_OPTIONS = [
  { value: 'nasional', label: 'Nasional' },
  { value: 'internasional', label: 'Internasional' },
];

export const PROCEEDING_TYPE_OPTIONS = [...PUBLICATION_TYPE_OPTIONS];

export const BOOK_TYPE_OPTIONS = [
  { value: 'full_book', label: 'Full Book' },
  { value: 'book_chapter', label: 'Book Chapter' },
];

export const HKI_TYPE_OPTIONS = [
  { value: 'paten', label: 'Paten' },
  { value: 'paten_sederhana', label: 'Paten Sederhana' },
  { value: 'hak_cipta', label: 'Hak Cipta' },
  { value: 'merek_dagang', label: 'Merek Dagang' },
  { value: 'rahasia_dagang', label: 'Rahasia Dagang' },
  { value: 'desain_produk_industri', label: 'Desain Produk Industri' },
  { value: 'indikasi_geografis', label: 'Indikasi Geografis' },
  { value: 'perlindungan_varietas_tanaman', label: 'Perlindungan Varietas Tanaman' },
  { value: 'topografi_sirkuit_terpadu', label: 'Perlindungan Topografi Sirkuit Terpadu' },
];

export const EXPECTED_OUTPUT_FORM_OPTIONS = [
  { value: 'prototype', label: 'Prototype' },
  { value: 'model', label: 'Model' },
  { value: 'software', label: 'Software' },
];

export const emptyOutputDefinition = id => ({
  id,
  name: '',
  category: '',
  journalTargetLevel: '',
  journalIndexTarget: '',
  publicationType: '',
  targetQuartile: '',
  proceedingType: '',
  indexTarget: '',
  bookType: '',
  publisherTarget: '',
  isbnPlan: '',
  hkiType: '',
  targetRegistrationYear: '',
  productType: '',
  targetTkt: '',
  expectedOutputForm: '',
  otherOutputType: '',
});

const defaultOutput = (value, name, values) => ({
  ...emptyOutputDefinition(`scheme-output-${value}`),
  value,
  name,
  ...values,
});

export const DEFAULT_SCHEME_OUTPUT_OPTIONS = [
  ...Array.from({ length: 6 }, (_, index) => defaultOutput(
    `sinta_${index + 1}`,
    `Artikel Jurnal SINTA ${index + 1}`,
    { category: 'jurnal', journalTargetLevel: 'sinta', journalIndexTarget: `SINTA ${index + 1}`, publicationType: 'nasional' },
  )),
  ...Array.from({ length: 4 }, (_, index) => defaultOutput(
    `scopus_q${index + 1}`,
    `Artikel Jurnal Scopus Q${index + 1}`,
    { category: 'jurnal', journalTargetLevel: 'scopus', journalIndexTarget: `Scopus Q${index + 1}`, publicationType: 'internasional', targetQuartile: `Q${index + 1}` },
  )),
  defaultOutput('paten_sederhana_registered', 'Paten Sederhana (terdaftar)', { category: 'hki', hkiType: 'paten_sederhana', targetRegistrationYear: '2026' }),
  defaultOutput('paten_registered', 'Paten (terdaftar)', { category: 'hki', hkiType: 'paten', targetRegistrationYear: '2026' }),
];

const normalizeOutputOption = (item, index) => ({
  ...emptyOutputDefinition(item.id || `scheme-output-${index + 1}`),
  ...item,
  id: item.id || `scheme-output-${index + 1}`,
  name: item.name || item.label || `Pilihan Luaran ${index + 1}`,
});

export const normalizeSchemeOutputOptions = scheme => {
  if (scheme && Array.isArray(scheme.outputOptions)) return scheme.outputOptions.map(normalizeOutputOption);
  return DEFAULT_SCHEME_OUTPUT_OPTIONS.map((item, index) => normalizeOutputOption(item, index));
};

export const outputCategoryLabel = category => {
  const option = OUTPUT_CATEGORY_OPTIONS.find(item => item.value === category);
  return option ? option.label : category || 'Luaran';
};

export const outputDefinitionLabel = output => output.name
  || output.planLabel
  || output.title
  || [
    outputCategoryLabel(output.category),
    output.journalIndexTarget,
    output.indexTarget,
    output.hkiType,
    output.productType,
    output.otherOutputType,
  ].filter(Boolean).join(' - ');

export const isOutputDefinitionComplete = output => {
  if (!output || !output.category) return false;
  if (output.category === 'jurnal') return Boolean(output.journalTargetLevel && output.journalIndexTarget && output.publicationType && (output.publicationType !== 'internasional' || output.targetQuartile));
  if (output.category === 'prosiding') return Boolean(output.proceedingType && output.indexTarget);
  if (output.category === 'buku') return Boolean(output.bookType && output.publisherTarget);
  if (output.category === 'hki') return Boolean(output.hkiType && output.targetRegistrationYear);
  if (output.category === 'produk_prototipe') return Boolean(output.productType && output.targetTkt && output.expectedOutputForm);
  if (output.category === 'other') return Boolean(output.otherOutputType);
  return false;
};

export const BASE_ATTACHMENT_REQUIREMENTS = [
  {
    id: 'proposal',
    category: 'proposal',
    name: 'Proposal Penelitian',
    accept: '.pdf',
    templateAccept: '.pdf,.doc,.docx',
    required: true,
    template: null,
  },
  {
    id: 'rab',
    category: 'rab',
    name: 'Rencana Anggaran Biaya (RAB)',
    accept: '.xlsx',
    templateAccept: '.xlsx',
    required: true,
    template: null,
  },
];

export const isBaseAttachmentRequirement = requirement => BASE_ATTACHMENT_REQUIREMENTS
  .some(base => base.category === (requirement && requirement.category));

export const emptyAttachmentRequirement = id => ({
  id,
  category: `scheme_attachment_${id}`,
  name: '',
  accept: '.pdf,.doc,.docx,.xls,.xlsx',
  templateAccept: '.pdf,.doc,.docx,.xls,.xlsx',
  required: true,
  template: null,
  custom: true,
});

const normalizeAttachment = (item, index) => ({
  ...emptyAttachmentRequirement(item.id || `attachment-${index + 1}`),
  ...item,
  id: item.id || `attachment-${index + 1}`,
  category: item.category || `scheme_attachment_${item.id || index + 1}`,
});

export const normalizeSchemeAttachmentRequirements = scheme => {
  if (scheme && Array.isArray(scheme.attachmentRequirements)) {
    const source = scheme.attachmentRequirements.map(normalizeAttachment);
    return [
      ...BASE_ATTACHMENT_REQUIREMENTS.map(base => {
        const current = source.find(item => item.category === base.category);
        const normalized = current ? { ...base, ...current, custom: false } : { ...base };
        return base.category === 'rab' ? { ...normalized, accept: '.xlsx', templateAccept: '.xlsx' } : normalized;
      }),
      ...source.filter(item => !isBaseAttachmentRequirement(item)),
    ];
  }
  return BASE_ATTACHMENT_REQUIREMENTS.map(item => ({ ...item }));
};

export const getProposalAttachmentRequirements = (scheme, members = []) => {
  const requirements = normalizeSchemeAttachmentRequirements(scheme);
  const schemeName = String(scheme && (scheme.name || scheme.scheme_name || '')).toLowerCase();
  if (schemeName.includes('kerjasama') && !requirements.some(item => item.category === 'moa')) {
    requirements.push({ id: 'moa', category: 'moa', name: 'Memorandum of Agreement (MoA)', accept: '.pdf', required: true, template: null });
  }
  if (members.some(item => item.type === 'student') && !requirements.some(item => item.category === 'student_letter')) {
    requirements.push({ id: 'student-letter', category: 'student_letter', name: 'Surat Keterangan Mahasiswa', accept: '.pdf', required: true, template: null });
  }
  return requirements;
};

// Registration now collects only the proposal and RAB; legacy requirements stay in scheme records.
export const getProposalSubmissionRequirements = scheme => normalizeSchemeAttachmentRequirements(scheme)
  .filter(isBaseAttachmentRequirement)
  .map(requirement => ({ ...requirement, required: true }));
