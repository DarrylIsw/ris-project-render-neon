/* eslint-disable object-curly-newline, object-property-newline */
const assert = require('assert');
const { appendWorkflowNotifications } = require('../../app/containers/Ris/shared/workflows/notificationWorkflow');
const { createInitialData, normalizeRisData } = require('../../app/containers/Ris/core/data');
const {
  createCatalogLetterDraft, saveCatalogLetter, saveLetterDefinition, getPublishedLetterDefinitions,
  createLetterDefinitionFromMaster, saveLetterMasterTemplate, deleteLetterDefinition, getEditableLetterDefinition, letterDefinitionStatus,
} = require('../../app/containers/Ris/features/letters/workflows/letterCatalogWorkflow');
const {
  canGenerateLetter, transitionLetterStatus, validateLetterApplicantData, validateLetterTemplateFields, renderLetterPlainText,
} = require('../../app/containers/Ris/features/letters/workflows/letterWorkflow');

describe('published letter catalog', () => {
  const lecturer = { id: 'user-lecturer', profileId: 'lecturer-1', name: 'Dosen', role: 'lecturer', email: 'lecturer@example.test' };
  const admin = { id: 'user-admin-letter', role: 'admin', adminScopes: ['letter_management'] };
  let sequence = 0;
  const uid = prefix => {
    sequence += 1;
    return `${prefix}-test-${sequence}`;
  };
  const makeDraft = data => createCatalogLetterDraft({ definitionId: 'letter-kind-general' }, lecturer, data, uid);
  const complete = draft => ({ ...draft, form: { recipientInstitution: 'Mitra Akademik', activityPurpose: 'Mengikuti lokakarya', activityDate: '2026-10-01' } });

  it('submits directly without a funded research and can be issued by an authorized manager', () => {
    const data = { ...createInitialData(), drafts: [] };
    const draft = makeDraft(data);
    assert.strictEqual(draft.researchId, null);
    assert.strictEqual(draft.status, 'draft');
    assert.strictEqual(draft.autoFill.researchTitle, undefined);
    const saved = saveCatalogLetter(data, complete(draft), lecturer, true).letterRequests.find(item => item.id === draft.id);
    assert.strictEqual(saved.status, 'submitted');
    assert.strictEqual(canGenerateLetter(saved, admin), true);
    assert.strictEqual(canGenerateLetter(saved, lecturer), false);
    assert.strictEqual(transitionLetterStatus(saved, 'generated').status, 'generated');
    assert.ok(renderLetterPlainText(saved).includes('Mengikuti lokakarya'));
  });

  it('keeps incomplete drafts, resumes and does not duplicate on save', () => {
    const data = createInitialData();
    const draft = makeDraft(data);
    const saved = saveCatalogLetter(data, draft, lecturer);
    assert.throws(() => saveCatalogLetter(saved, draft, lecturer, true), /wajib diisi/);
    const submitted = saveCatalogLetter(saved, complete(draft), lecturer, true);
    assert.strictEqual(submitted.letterRequests.filter(item => item.id === draft.id).length, 1);
    assert.throws(() => saveCatalogLetter(submitted, draft, lecturer), /tidak dapat diubah/);
  });

  it('freezes the published fields and template for existing requests', () => {
    const data = createInitialData();
    const draft = makeDraft(data);
    const saved = saveCatalogLetter(data, draft, lecturer);
    const definition = data.letterDefinitions.find(item => item.id === draft.definitionId);
    const updated = saveLetterDefinition(saved, { ...definition, name: 'Nama Baru', fields: [{ ...definition.fields[0], label: 'Isian Baru' }], active: false }, admin);
    assert.strictEqual(updated.letterRequests.find(item => item.id === draft.id).definitionName, draft.definitionName);
    assert.strictEqual(updated.letterRequests.find(item => item.id === draft.id).templateFields.length, 3);
    assert.strictEqual(getPublishedLetterDefinitions(updated).some(item => item.id === definition.id), false);
    assert.throws(() => makeDraft(updated), /tidak tersedia/);
    assert.strictEqual(saveCatalogLetter(updated, complete(draft), lecturer, true).letterRequests.find(item => item.id === draft.id).status, 'submitted');
  });

  it('enforces catalog management scopes and applicant ownership', () => {
    const data = createInitialData();
    const draft = makeDraft(data);
    const saved = saveCatalogLetter(data, draft, lecturer);
    assert.throws(() => saveLetterDefinition(data, data.letterDefinitions[0], lecturer), /akses/);
    assert.throws(() => saveLetterDefinition(data, data.letterDefinitions[0], { ...admin, adminScopes: ['research_management'] }), /akses/);
    assert.throws(() => createCatalogLetterDraft({ definitionId: 'letter-kind-general' }, admin, data, uid), /Hanya dosen/);
    assert.throws(() => saveCatalogLetter(saved, draft, { ...lecturer, id: 'someone-else' }), /tidak dapat diubah/);
    assert.throws(() => createCatalogLetterDraft({ definitionId: 'letter-kind-general', researchId: 'not-owned' }, lecturer, data, uid), /tidak dapat digunakan/);
  });

  it('supports revision and resubmission without a second request phase', () => {
    const data = createInitialData();
    const draft = complete(makeDraft(data));
    const submitted = saveCatalogLetter(data, draft, lecturer, true);
    const request = submitted.letterRequests.find(item => item.id === draft.id);
    const revision = transitionLetterStatus(request, 'revision_required');
    const revisedData = { ...submitted, letterRequests: submitted.letterRequests.map(item => (item.id === request.id ? revision : item)) };
    assert.strictEqual(saveCatalogLetter(revisedData, revision, lecturer, true).letterRequests.find(item => item.id === draft.id).status, 'data_submitted');
  });

  it('validates email, number, select and reserved field keys', () => {
    assert.ok(validateLetterTemplateFields([{ key: 'applicantName', label: 'Nama', type: 'text' }]).length);
    assert.ok(validateLetterTemplateFields([{ key: 'a', label: 'Nama', type: 'text' }, { key: 'a', label: 'Ulang', type: 'text' }]).length);
    const errors = validateLetterApplicantData({ templateFields: [{ key: 'email', label: 'Email', type: 'email' }, { key: 'num', label: 'Angka', type: 'number' }, { key: 'pick', label: 'Pilihan', type: 'select', options: ['A'] }], form: { email: 'invalid', num: 'abc', pick: 'B' } });
    assert.strictEqual(errors.length, 3);
  });

  it('adds a catalog to existing browser data without replacing letter history', () => {
    const data = createInitialData();
    delete data.letterDefinitions;
    const normalized = normalizeRisData(data);
    assert.ok(normalized.letterDefinitions.length);
    assert.deepStrictEqual(normalized.letterRequests, data.letterRequests);
    assert.deepStrictEqual(normalizeRisData({ ...data, letterDefinitions: [] }).letterDefinitions, []);
  });

  it('notifies the applicant and queues an optional email only when a letter is issued', () => {
    const data = createInitialData();
    const draft = complete(makeDraft(data));
    const saved = saveCatalogLetter(data, draft, lecturer, true);
    const submitted = appendWorkflowNotifications(data, saved, lecturer);
    const issued = { ...submitted, letterRequests: submitted.letterRequests.map(item => (item.id === draft.id ? transitionLetterStatus(item, 'generated') : item)) };
    const result = appendWorkflowNotifications(submitted, issued, admin);
    assert.ok(result.notifications.some(item => item.entityId === draft.id && item.type === 'letter_generated' && item.userId === lecturer.id));
    assert.ok(result.emailOutbox.some(item => item.entityId === draft.id && item.notificationType === 'letter_generated'));
    const unchanged = appendWorkflowNotifications(result, result, admin);
    assert.strictEqual(unchanged.emailOutbox.length, result.emailOutbox.length);
    const draftData = saveCatalogLetter(data, draft, lecturer);
    const draftSaved = appendWorkflowNotifications(data, draftData, lecturer);
    assert.strictEqual(draftSaved.notifications.some(item => item.entityId === draft.id), false);
  });

  it('creates independent forms from an editable master without altering existing letters', () => {
    const data = createInitialData();
    const first = createLetterDefinitionFromMaster(data, uid);
    assert.strictEqual(first.fields.length, 6);
    first.fields[0].label = 'Penerima A';
    assert.notStrictEqual(first.fields[0].label, data.letterMasterTemplate.fields[0].label);
    const next = saveLetterMasterTemplate(data, { ...data.letterMasterTemplate, fields: data.letterMasterTemplate.fields.slice(0, 2) }, admin);
    assert.strictEqual(createLetterDefinitionFromMaster(next, uid).fields.length, 2);
    assert.strictEqual(first.fields.length, 6);
    assert.deepStrictEqual(next.letterDefinitions, data.letterDefinitions);
    assert.throws(() => saveLetterMasterTemplate(data, data.letterMasterTemplate, lecturer), /akses/);
  });

  it('allows incomplete administrator drafts and publishes only valid forms', () => {
    const data = createInitialData();
    const definition = { ...createLetterDefinitionFromMaster(data, uid), fields: [] };
    const saved = saveLetterDefinition(data, definition, admin, 'draft');
    const item = saved.letterDefinitions.find(entry => entry.id === definition.id);
    assert.strictEqual(letterDefinitionStatus(item), 'draft');
    assert.strictEqual(getPublishedLetterDefinitions(saved).some(entry => entry.id === item.id), false);
    assert.throws(() => saveLetterDefinition(saved, item, admin, 'publish'), /wajib diisi/);
    const ready = { ...item, name: 'Surat Kustom', fields: data.letterMasterTemplate.fields };
    const published = saveLetterDefinition(saved, ready, admin, 'publish');
    assert.ok(getPublishedLetterDefinitions(published).some(entry => entry.id === item.id));
    assert.strictEqual(createCatalogLetterDraft({ definitionId: item.id }, lecturer, published, uid).templateFields.length, 6);
  });

  it('keeps pending changes private until publish, including deleted and reordered fields', () => {
    const data = createInitialData();
    const original = data.letterDefinitions[0];
    const edited = { ...original, name: 'Nama yang Belum Terbit', fields: original.fields.slice(1).reverse() };
    const saved = saveLetterDefinition(data, edited, admin, 'draft');
    assert.strictEqual(getPublishedLetterDefinitions(saved)[0].name, original.name);
    const pending = saved.letterDefinitions.find(item => item.id === original.id);
    assert.deepStrictEqual(getEditableLetterDefinition(pending).fields, edited.fields);
    assert.strictEqual(normalizeRisData(saved).letterDefinitions.find(item => item.id === original.id).pendingDraft.name, edited.name);
    const published = saveLetterDefinition(saved, getEditableLetterDefinition(pending), admin, 'publish');
    const next = getPublishedLetterDefinitions(published).find(item => item.id === original.id);
    assert.strictEqual(next.name, edited.name);
    assert.deepStrictEqual(next.fields, edited.fields);
    assert.strictEqual(next.pendingDraft, null);
  });

  it('removes templates from the catalog without losing existing applications or restoring deleted seeds', () => {
    const data = createInitialData();
    const draft = complete(makeDraft(data));
    const saved = saveCatalogLetter(data, draft, lecturer);
    const deleted = deleteLetterDefinition(saved, draft.definitionId, admin);
    assert.strictEqual(getPublishedLetterDefinitions(deleted).some(item => item.id === draft.definitionId), false);
    assert.strictEqual(letterDefinitionStatus(normalizeRisData(deleted).letterDefinitions.find(item => item.id === draft.definitionId)), 'deleted');
    assert.deepStrictEqual(deleted.letterRequests, saved.letterRequests);
    assert.strictEqual(saveCatalogLetter(deleted, draft, lecturer, true).letterRequests.find(item => item.id === draft.id).status, 'submitted');
    assert.throws(() => makeDraft(deleted), /tidak tersedia/);
    assert.throws(() => saveLetterDefinition(deleted, saved.letterDefinitions.find(item => item.id === draft.definitionId), admin), /dihapus/);
    assert.throws(() => deleteLetterDefinition(data, draft.definitionId, lecturer), /akses/);
  });

  it('rejects removed template variables and stale unsaved lecturer forms', () => {
    const data = createInitialData();
    const draft = complete(makeDraft(data));
    const definition = data.letterDefinitions.find(item => item.id === draft.definitionId);
    const invalid = { ...definition, template: { ...definition.template, content: '{{removed_field}}' } };
    assert.throws(() => saveLetterDefinition(data, invalid, admin, 'publish'), /tidak memiliki isian/);
    const updated = saveLetterDefinition(data, definition, admin, 'publish');
    assert.throws(() => saveCatalogLetter(updated, draft, lecturer, true), /diperbarui/);
  });
});
