/* eslint-disable object-curly-newline, object-property-newline */
const assert = require('assert');
const {
  BASE_ATTACHMENT_REQUIREMENTS,
  getProposalAttachmentRequirements,
  isBaseAttachmentRequirement,
  isOutputDefinitionComplete,
  normalizeSchemeOutputOptions,
} = require('../../app/containers/Ris/features/research/workflows/schemeConfiguration');
const { validateDraftForSubmit } = require('../../app/containers/Ris/shared/workflows/workflow');
const { createInitialData, normalizeRisData } = require('../../app/containers/Ris/core/data');

describe('RIS scheme configuration', () => {
  it('provides ordered output choices for legacy schemes', () => {
    const options = normalizeSchemeOutputOptions({ id: 'legacy-scheme' });
    assert.strictEqual(options.length, 12);
    assert.deepStrictEqual(options.slice(0, 3).map(item => item.name), [
      'Artikel Jurnal SINTA 1',
      'Artikel Jurnal SINTA 2',
      'Artikel Jurnal SINTA 3',
    ]);
    assert.strictEqual(options[6].name, 'Artikel Jurnal Scopus Q1');
  });

  it('preserves administrator output definitions and validates category fields', () => {
    const custom = {
      id: 'output-book',
      name: 'Buku Ajar Nasional',
      category: 'buku',
      bookType: 'full_book',
      publisherTarget: 'Penerbit Nasional',
    };
    const options = normalizeSchemeOutputOptions({ outputOptions: [custom] });
    assert.strictEqual(options.length, 1);
    assert.strictEqual(options[0].name, custom.name);
    assert.strictEqual(isOutputDefinitionComplete(options[0]), true);
  });

  it('seeds an open demo scheme with exactly three selectable outputs', () => {
    const initial = createInitialData();
    const demo = initial.schemes.find(item => item.id === 'scheme-demo-output-2026');
    const draftDemo = initial.schemes.find(item => item.id === 'scheme-demo-draft-2026');
    const cleanDemo = initial.schemes.find(item => item.id === 'scheme-demo-clean-2026');
    const catalogDemo = initial.schemes.find(item => item.id === 'scheme-demo-catalog-2026');
    assert.ok(demo);
    assert.ok(draftDemo);
    assert.ok(cleanDemo);
    assert.ok(catalogDemo);
    assert.strictEqual(demo.status, 'open');
    assert.strictEqual(demo.outputOptions.length, 3);
    assert.ok(demo.eligibleUserIds.includes('user-lecturer'));
    assert.ok(draftDemo.eligibleUserIds.includes('user-lecturer'));
    assert.ok(cleanDemo.eligibleUserIds.includes('user-lecturer'));
    assert.strictEqual(cleanDemo.attachmentRequirements.length, 6);
    assert.ok(!catalogDemo.eligibleUserIds.includes('user-lecturer'));
    const additionalAttachments = draftDemo.attachmentRequirements.filter(item => !isBaseAttachmentRequirement(item));
    assert.strictEqual(additionalAttachments.length, 4);
    assert.deepStrictEqual(additionalAttachments.map(item => item.name), [
      'Surat Pernyataan Ketua Peneliti',
      'Surat Kesediaan Mitra',
      'Pakta Integritas Tim Peneliti',
      'Biodata Tim Peneliti',
    ]);
    assert.ok(additionalAttachments.every(item => item.template && item.template.dataUrl));

    const migrated = normalizeRisData({ schemes: [{ id: 'existing-scheme', name: 'Existing' }] });
    assert.ok(migrated.schemes.some(item => item.id === demo.id));
    assert.ok(migrated.schemes.some(item => item.id === draftDemo.id));
    assert.ok(migrated.schemes.some(item => item.id === cleanDemo.id));
    assert.ok(migrated.schemes.some(item => item.id === catalogDemo.id));
    assert.strictEqual(migrated.schemes.find(item => item.id === draftDemo.id).attachmentRequirements.length, 6);
  });

  it('preserves legacy attachment configuration and accepts outputs without title or target year', () => {
    const customAttachment = {
      id: 'partner-statement',
      category: 'scheme_attachment_partner',
      name: 'Surat Pernyataan Mitra',
      accept: '.pdf',
      required: true,
    };
    const scheme = {
      maximumBudget: 10000000,
      attachmentRequirements: [...BASE_ATTACHMENT_REQUIREMENTS, customAttachment],
    };
    const members = [
      { role: 'ketua', type: 'internal_lecturer', name: 'Lead', nidn: '1', program: 'IS', faculty: 'FTI' },
      { role: 'member', type: 'student', name: 'Student', nim: '2', program: 'IS', faculty: 'FTI' },
    ];
    const requirements = getProposalAttachmentRequirements(scheme, members);
    assert.deepStrictEqual(requirements.map(item => item.category), ['proposal', 'rab', 'scheme_attachment_partner', 'student_letter']);

    const proposal = {
      project: {
        title: 'Research',
        targetTkt: 'none',
        ripRelation: 'none',
        researchCenterRelation: 'none',
        sdgs: [1],
        integrated: false,
      },
      members,
      budgets: [{ component: 'Material', name: 'Item', volume: 1, unit: 'unit', unitPrice: 5000000 }],
      outputs: [{
        id: 'output-1',
        type: 'wajib',
        description: 'Target publikasi penelitian.',
        category: 'jurnal',
        journalTargetLevel: 'scopus',
        journalIndexTarget: 'Scopus Q2',
        publicationType: 'internasional',
        targetQuartile: 'Q2',
      }],
      files: requirements.map(item => ({ id: `file-${item.category}`, category: item.category, name: `${item.category}.pdf` })),
    };
    assert.strictEqual(validateDraftForSubmit(proposal, scheme), '');
  });
});
