const assert = require('assert');
const {
  LETTER_STATUS,
  canCreateLetter,
  canDeleteLetter,
  canEditLetter,
  canTransitionLetterStatus,
  createLetterRequest,
  getLetterFormRows,
  transitionLetterStatus,
  validateLetterApplicantData,
  validateLetterConsistency,
  validateLetterFiles,
} = require('../../app/containers/Ris/features/letters/workflows/letterWorkflow');
const {
  EXTERNAL_STATUS,
  canAdminReviewExternalReport,
  canCreateExternalReport,
  canEditExternalReport,
  canSubmitExternalReport,
  canTransitionExternalStatus,
  canViewExternalReport,
  createExternalReportDraft,
  getVisibleExternalReports,
  resizeExternalTeam,
  transitionExternalStatus,
  validateExternalReport,
} = require('../../app/containers/Ris/features/externalResearch/workflows/externalResearchWorkflow');
const { validateFile } = require('../../app/containers/Ris/shared/workflows/fileValidation');
const { createInitialData } = require('../../app/containers/Ris/core/data');

describe('RIS document workflows', () => {
  it('allows letter creation only for lecturer behavior', () => {
    assert.strictEqual(canCreateLetter({ role: 'lecturer' }), true);
    assert.strictEqual(canCreateLetter({ role: 'manager', managerMode: 'lecturer' }), true);
    assert.strictEqual(canCreateLetter({ role: 'manager', managerMode: 'management' }), false);
    assert.strictEqual(canCreateLetter({ role: 'super_admin' }), false);
    assert.strictEqual(canCreateLetter({ role: 'admin', adminScopes: ['letter_management'] }), false);
  });

  it('allows external report creation for lecturers and managers in lecturer mode', () => {
    assert.strictEqual(canCreateExternalReport({ role: 'lecturer' }), true);
    assert.strictEqual(canCreateExternalReport({ role: 'manager', managerMode: 'lecturer' }), true);
    assert.strictEqual(canCreateExternalReport({ role: 'manager', managerMode: 'management' }), false);
    assert.strictEqual(canCreateExternalReport({ role: 'super_admin' }), false);
    assert.strictEqual(canCreateExternalReport({ role: 'admin', adminScopes: ['research_management'] }), false);
    assert.strictEqual(canCreateExternalReport(null), false);
  });

  it('keeps manager lecturer reports personal while restoring review access in management mode', () => {
    const personal = { id: 'manager', role: 'manager', managerMode: 'lecturer' };
    const management = { ...personal, managerMode: 'management' };
    const own = createExternalReportDraft(personal, prefix => `${prefix}-manager`);
    const other = {
      id: 'other-report', userId: 'lecturer', createdBy: 'lecturer', submissionStatus: EXTERNAL_STATUS.SUBMITTED
    };
    const data = { externalResearchReports: [own, other] };
    assert.strictEqual(own.userId, personal.id);
    assert.strictEqual(canEditExternalReport(own, personal), true);
    assert.strictEqual(canSubmitExternalReport(own, personal), true);
    assert.strictEqual(canViewExternalReport(other, personal), false);
    assert.strictEqual(canAdminReviewExternalReport(other, personal), false);
    assert.deepStrictEqual(getVisibleExternalReports(data, personal), [own]);
    assert.strictEqual(canAdminReviewExternalReport(other, management), true);
    assert.deepStrictEqual(getVisibleExternalReports(data, management), [own, other]);
    assert.strictEqual(canCreateExternalReport(management), false);
  });

  it('enforces letter transitions through review and generation', () => {
    const draft = { id: 'letter-1', status: LETTER_STATUS.DRAFT };
    const prechecked = transitionLetterStatus(draft, LETTER_STATUS.PRECHECKED);
    assert.strictEqual(prechecked.status, LETTER_STATUS.PRECHECKED);
    assert.strictEqual(canTransitionLetterStatus(prechecked, LETTER_STATUS.APPROVED), true);
    assert.strictEqual(canTransitionLetterStatus(prechecked, LETTER_STATUS.GENERATED), false);
  });

  it('enforces external report review transitions', () => {
    const submitted = { id: 'external-1', submissionStatus: EXTERNAL_STATUS.SUBMITTED };
    assert.strictEqual(canTransitionExternalStatus(submitted, EXTERNAL_STATUS.UNDER_REVIEW), true);
    assert.strictEqual(canTransitionExternalStatus(submitted, EXTERNAL_STATUS.ARCHIVED), false);
    const underReview = transitionExternalStatus(submitted, EXTERNAL_STATUS.UNDER_REVIEW);
    assert.strictEqual(underReview.submissionStatus, EXTERNAL_STATUS.UNDER_REVIEW);
  });

  it('requires one report file and validates dynamic team and optional attachments', () => {
    let nextId = 0;
    const uid = prefix => {
      nextId += 1;
      return `${prefix}-${nextId}`;
    };
    const original = createInitialData().externalResearchReports[0];
    const teamMembers = resizeExternalTeam([], 2, uid);
    assert.strictEqual(teamMembers.length, 2);
    assert.strictEqual(teamMembers[0].role, 'ketua');
    assert.strictEqual(teamMembers[1].role, 'anggota');
    assert.deepStrictEqual(resizeExternalTeam(teamMembers, 3, uid).slice(0, 2), teamMembers);
    assert.deepStrictEqual(resizeExternalTeam(teamMembers, 1, uid), [teamMembers[0]]);
    const report = {
      ...original,
      roleInResearch: undefined,
      teamMembers,
      documents: [{
        id: 'extra-1', fileType: 'additional', label: 'Surat kerja sama', name: '', fileUrl: '',
      }],
    };
    const check = value => validateExternalReport(value, { externalResearchReports: [] }, { id: original.userId });
    const invalid = check(report);
    assert.ok(invalid.errors.some(item => item.field === 'documents.report'));
    assert.ok(invalid.errors.some(item => item.field === 'documents.extra-1.file'));
    assert.ok(invalid.errors.some(item => item.field === 'teamMembers.0.name'));
    const complete = {
      ...report,
      teamMembers: teamMembers.map((member, index) => ({
        ...member, name: `Anggota ${index + 1}`, nidn: `000${index + 1}`, program: 'Sistem Informasi', faculty: 'Teknik',
      })),
      documents: [
        {
          id: 'report-1', fileType: 'report', name: 'laporan.pdf', fileUrl: '/api/files/report', size: 100,
        },
        {
          id: 'extra-1', fileType: 'additional', label: 'Surat kerja sama', name: 'surat.pdf', fileUrl: '/api/files/extra', size: 100,
        },
      ],
    };
    assert.strictEqual(check(complete).valid, true);
    assert.strictEqual(check({ ...complete, documents: [complete.documents[0]] }).valid, true);
  });

  it('uses one file validation contract for extension and size checks', () => {
    assert.strictEqual(validateFile({ name: 'proposal.pdf', size: 512 }, { allowedExtensions: ['pdf'], maxSize: 1024 }).valid, true);
    assert.strictEqual(validateFile({ name: 'proposal.exe', size: 512 }, { allowedExtensions: ['pdf'], maxSize: 1024 }).code, 'extension');
    assert.strictEqual(validateFile({ name: 'proposal.pdf', size: 2048 }, { allowedExtensions: ['pdf'], maxSize: 1024 }).code, 'size');
  });

  it('reports invalid letter attachments through the shared validator', () => {
    const errors = validateLetterFiles({ attachments: [{ fileType: 'proposal', name: 'payload.exe', size: 100 }] });
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0].field, 'file:proposal');
  });

  it('prevents administrators from creating or editing applicant letter drafts', () => {
    const admin = { id: 'user-admin', role: 'admin', adminScopes: ['letter_management'] };
    const ownDraft = { id: 'letter-own', userId: admin.id, status: LETTER_STATUS.DRAFT };
    const otherDraft = { id: 'letter-other', userId: 'user-lecturer', status: LETTER_STATUS.DRAFT };
    assert.strictEqual(canEditLetter(ownDraft, admin), false);
    assert.strictEqual(canDeleteLetter(ownDraft, admin), false);
    assert.strictEqual(canEditLetter(otherDraft, admin), false);
    assert.strictEqual(canDeleteLetter(otherDraft, admin), false);
  });

  it('supports multiple requests for one funded research without uniqueness coupling', () => {
    let sequence = 0;
    const user = {
      id: 'user-lecturer', role: 'lecturer', name: 'Lecturer', email: 'lecturer@umn.ac.id', profileId: 'lecturer-1'
    };
    const data = {
      drafts: [{
        id: 'funded-1', schemeId: 'scheme-1', status: 'funded', project: { title: 'Penelitian A' }, members: []
      }],
      schemes: [{ id: 'scheme-1', name: 'Skema A', year: 2026 }],
      applicantProfiles: [{
        id: 'lecturer-1', userId: user.id, name: 'Lecturer', identifier: 'NIDN-1', program: 'SI', faculty: 'FTI', email: user.email
      }],
    };
    const makeId = prefix => {
      sequence += 1;
      return `${prefix}-${sequence}`;
    };
    const first = createLetterRequest({ researchId: 'funded-1', type: 'support', purpose: 'interview' }, user, data, makeId);
    const second = createLetterRequest({ researchId: 'funded-1', type: 'custom', customName: 'Surat Khusus' }, user, data, makeId);
    assert.notStrictEqual(first.id, second.id);
    assert.strictEqual(first.researchId, second.researchId);
    assert.strictEqual(first.status, LETTER_STATUS.SUBMITTED);
    assert.strictEqual(second.customName, 'Surat Khusus');
  });

  it('validates only required fields configured by the letter administrator', () => {
    const letter = {
      templateFields: [
        { key: 'destination', label: 'Instansi Tujuan', required: true },
        { key: 'notes', label: 'Catatan', required: false },
      ],
      form: { destination: '' },
    };
    assert.deepStrictEqual(validateLetterApplicantData(letter), ['Instansi Tujuan wajib diisi.']);
    assert.deepStrictEqual(validateLetterApplicantData({ ...letter, form: { destination: 'UMN' } }), []);
  });

  it('formats stored letter fields without exposing internal keys', () => {
    const rows = getLetterFormRows({
      researchTitle: 'Penelitian A', researchYear: '2026', researchRole: 'leader', researchStartMonth: '2026-01'
    });
    assert.deepStrictEqual(rows, [
      ['Judul Penelitian', 'Penelitian A'],
      ['Tahun Penelitian', '2026'],
      ['Peran dalam Penelitian', 'Ketua'],
    ]);
  });

  it('rejects a research month range that ends before it starts', () => {
    const errors = validateLetterConsistency({ form: { researchStartMonth: '2026-07', researchEndMonth: '2026-05' } }, {});
    assert.strictEqual(errors[0].field, 'researchEndMonth');
  });
});
