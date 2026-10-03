const assert = require('assert');
const { createInitialData } = require('../../app/containers/Ris/core/data');
const { createCatalogLetterDraft, saveCatalogLetter } = require('../../app/containers/Ris/features/letters/workflows/letterCatalogWorkflow');
const { appendWorkflowNotifications } = require('../../app/containers/Ris/shared/workflows/notificationWorkflow');
const {
  canDownloadFinalLetter, canPrepareLetterPdf, canPublishSignedLetter, transitionLetterStatus
} = require('../../app/containers/Ris/features/letters/workflows/letterWorkflow');
const { renderLetterDocx } = require('../../server/services/letterDocumentService');
const { identity } = require('../../server/services/risDataService');
const { projectState } = require('../../server/services/risAccess');

describe('RIS letter publication', () => {
  const lecturer = {
    id: 'user-lecturer', role: 'lecturer', profileId: 'lecturer-1', email: 'lecturer@umn.ac.id'
  };
  const admin = { id: 'user-admin-letter', role: 'admin', adminScopes: ['letter_management'] };

  it('keeps long email record identifiers within the PostgreSQL key limit', () => {
    const longId = `email:${'letter_submission_confirmation:'.repeat(8)}`;
    assert.ok(identity({ id: longId }, 0).length <= 180);
    assert.strictEqual(identity({ id: longId }, 0), identity({ id: longId }, 1));
    assert.notStrictEqual(identity({ id: `${longId}another` }, 0), identity({ id: longId }, 0));
    assert.strictEqual(identity({ id: 'short-id' }, 0), 'short-id');
  });

  it('notifies on acceptance and releases only the signed final letter', async () => {
    const data = createInitialData();
    const definition = data.letterDefinitions.find(item => item.active);
    const draft = createCatalogLetterDraft({ definitionId: definition.id }, lecturer, data, prefix => `${prefix}-publication-test`);
    draft.form = Object.fromEntries(definition.fields.map(field => [field.key, field.type === 'date' ? '2026-10-01' : 'Data pengujian']));
    const submitted = saveCatalogLetter(data, draft, lecturer, true);
    const request = submitted.letterRequests.find(item => item.id === draft.id);
    assert.strictEqual(request.status, 'submitted');
    assert.strictEqual(canDownloadFinalLetter(request, lecturer), false);

    const acceptedLetter = transitionLetterStatus(request, 'approved');
    const accepted = { ...submitted, letterRequests: submitted.letterRequests.map(item => (item.id === draft.id ? acceptedLetter : item)) };
    const acceptedNotified = appendWorkflowNotifications(submitted, accepted, admin);
    assert.ok(acceptedNotified.notifications.some(item => item.userId === lecturer.id && item.type === 'letter_approved'));
    assert.strictEqual(canPrepareLetterPdf(acceptedLetter, admin), true);
    assert.strictEqual(canPrepareLetterPdf(acceptedLetter, lecturer), false);
    assert.strictEqual(canDownloadFinalLetter(acceptedLetter, lecturer), false);

    const docx = renderLetterDocx({ ...acceptedLetter, generated: { letterNumber: '0002/ST-RIS/LPPM/10/2026' } }, { preview: true });
    assert.strictEqual(docx.subarray(0, 2).toString('ascii'), 'PK');
    const prepared = { ...acceptedLetter, generated: { letterNumber: '0002/ST-RIS/LPPM/10/2026', draftFileUrl: '/api/files/draft-pdf' } };
    assert.strictEqual(canPublishSignedLetter(prepared, admin), true);
    assert.strictEqual(canPublishSignedLetter(prepared, lecturer), false);
    assert.strictEqual(canDownloadFinalLetter(prepared, lecturer), false);
    const lecturerState = projectState({ ...acceptedNotified, letterRequests: [prepared] }, lecturer);
    assert.strictEqual(lecturerState.letterRequests[0].generated.draftFileUrl, undefined);
    assert.strictEqual(projectState({ ...acceptedNotified, letterRequests: [prepared] }, admin).letterRequests[0].generated.draftFileUrl, '/api/files/draft-pdf');

    const completed = transitionLetterStatus(prepared, 'generated', { generated: { ...prepared.generated, fileUrl: '/api/files/signed-pdf' } });
    assert.strictEqual(canDownloadFinalLetter(completed, lecturer), true);
    const completedView = projectState({ ...acceptedNotified, letterRequests: [completed] }, lecturer).letterRequests[0];
    assert.strictEqual(completedView.generated.fileUrl, '/api/files/signed-pdf');
    assert.strictEqual(completedView.generated.draftFileUrl, undefined);
    const completedData = { ...acceptedNotified, letterRequests: acceptedNotified.letterRequests.map(item => (item.id === draft.id ? completed : item)) };
    const notified = appendWorkflowNotifications(acceptedNotified, completedData, admin);
    assert.ok(notified.notifications.some(item => item.userId === lecturer.id && item.type === 'letter_generated'));
    assert.ok(notified.emailOutbox.some(item => item.recipientUserId === lecturer.id && item.notificationType === 'letter_generated'));
  });
});
