const assert = require('assert');
const { createInitialData } = require('../../app/containers/Ris/core/data');
const { projectState, canChange } = require('../../server/services/risAccess');

describe('RIS lecturer data access', () => {
  it('keeps public profiles unchanged across a JSON request round trip', () => {
    const state = createInitialData();
    const lecturer = state.systemUsers.find(item => item.email === 'lecturer@umn.ac.id');
    const visible = projectState(state, lecturer);
    const submitted = JSON.parse(JSON.stringify(visible));

    assert.deepStrictEqual(submitted, visible);
    assert.strictEqual(visible.researcherProfiles.some(item => item.userId !== lecturer.id), true);
    assert.strictEqual(visible.systemUsers.find(item => item.id === lecturer.id).email, lecturer.email);
    assert.strictEqual(visible.systemUsers.some(item => item.id !== lecturer.id && item.email), false);
  });

  it('never projects account password material to a manager browser session', () => {
    const state = createInitialData();
    state.systemUsers[0].passwordHash = 'credential-hash';
    state.systemUsers[1].password = 'temporary-password';
    const manager = state.systemUsers.find(item => item.email === 'manager@umn.ac.id');
    const accounts = projectState(state, manager).systemUsers;

    assert.ok(accounts.every(item => !Object.prototype.hasOwnProperty.call(item, 'password')));
    assert.ok(accounts.every(item => !Object.prototype.hasOwnProperty.call(item, 'passwordHash')));
  });

  it('allows the lecturer to create their own external research report', () => {
    const state = createInitialData();
    const lecturer = state.systemUsers.find(item => item.email === 'lecturer@umn.ac.id');
    const report = { id: 'external-lecturer-test', userId: lecturer.id, submissionStatus: 'draft' };

    assert.strictEqual(canChange('externalResearchReports', null, report, lecturer, state), true);
    assert.strictEqual(canChange('externalResearchReports', null, { ...report, userId: 'other-user' }, lecturer, state), false);
  });

  it('limits external report deletion by ownership and workflow status', () => {
    const state = createInitialData();
    const lecturer = state.systemUsers.find(item => item.email === 'lecturer@umn.ac.id');
    const draft = { id: 'external-delete-draft', userId: lecturer.id, submissionStatus: 'draft' };
    const revision = { ...draft, id: 'external-delete-revision', submissionStatus: 'revision_requested' };
    const submitted = { ...draft, id: 'external-delete-submitted', submissionStatus: 'submitted' };

    assert.strictEqual(canChange('externalResearchReports', draft, null, lecturer, state), true);
    assert.strictEqual(canChange('externalResearchReports', revision, null, lecturer, state), true);
    assert.strictEqual(canChange('externalResearchReports', submitted, null, lecturer, state), false);
    assert.strictEqual(canChange('externalResearchReports', { ...draft, userId: 'other-user' }, null, lecturer, state), false);
  });

  it('allows research administrators to delete and review external reports', () => {
    const state = createInitialData();
    const reportOwner = state.systemUsers.find(item => item.email === 'lecturer@umn.ac.id');
    const admin = { id: 'research-admin', role: 'admin', adminScopes: ['research_management'] };
    const report = { id: 'external-admin-delete', userId: reportOwner.id, submissionStatus: 'submitted' };

    assert.strictEqual(canChange('externalResearchReports', report, null, admin, state), true);
    assert.strictEqual(canChange('externalResearchReports', report, { ...report, submissionStatus: 'under_review' }, admin, state), true);
    assert.strictEqual(canChange('externalResearchReports', report, null, { ...admin, adminScopes: [] }, state), false);
  });

  it('includes the assigned proposal and its attachments for an active reviewer', () => {
    const state = createInitialData();
    const reviewer = state.systemUsers.find(item => item.email === 'reviewer@umn.ac.id');
    const visible = projectState(state, reviewer);
    const assignedDraft = visible.drafts.find(draft => draft.id === 'draft-assigned');

    assert.ok(assignedDraft);
    assert.ok(Array.isArray(assignedDraft.files));
    assert.ok(assignedDraft.files.length > 0);
  });

  it('does not expose other users activity snapshots to a research administrator', () => {
    const state = createInitialData();
    state.systemActivityLogs = [
      { id: 'own-log', userId: 'research-admin', oldData: { email: 'admin@example.test' } },
      { id: 'other-log', userId: 'user-lecturer', oldData: { nik: 'private-value' } },
    ];
    const admin = { id: 'research-admin', role: 'admin', adminScopes: ['research_management'] };

    assert.deepStrictEqual(projectState(state, admin).systemActivityLogs.map(item => item.id), ['own-log']);
  });

  it('blocks direct workflow bypasses after a lecturer has submitted a record', () => {
    const state = createInitialData();
    const lecturer = state.systemUsers.find(item => item.email === 'lecturer@umn.ac.id');
    const draft = {
      id: 'draft-transition', userId: lecturer.id, status: 'draft', title: 'Awal'
    };
    const submitted = {
      ...draft, status: 'submitted', submittedAt: '2026-10-03T00:00:00.000Z'
    };

    assert.strictEqual(canChange('drafts', draft, submitted, lecturer, state), true);
    assert.strictEqual(canChange('drafts', submitted, { ...submitted, title: 'Diubah' }, lecturer, state), false);
    assert.strictEqual(canChange('drafts', null, submitted, lecturer, state), false);
  });

  it('locks canonical applicant data and terminal external submissions for lecturers', () => {
    const state = createInitialData();
    const lecturer = state.systemUsers.find(item => item.email === 'lecturer@umn.ac.id');
    const letter = {
      id: 'letter-transition', userId: lecturer.id, status: 'draft', applicant: { name: 'Dosen' }, form: {}
    };
    const report = {
      id: 'external-transition', userId: lecturer.id, submissionStatus: 'submitted', title: 'Laporan'
    };

    assert.strictEqual(canChange('letterRequests', letter, { ...letter, applicant: { name: 'Palsu' } }, lecturer, state), false);
    assert.strictEqual(canChange('letterRequests', null, { ...letter, status: 'submitted' }, lecturer, state), false);
    assert.strictEqual(canChange('externalResearchReports', report, { ...report, title: 'Diubah' }, lecturer, state), false);
  });
});
