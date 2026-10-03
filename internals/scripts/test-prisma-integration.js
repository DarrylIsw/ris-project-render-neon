/* eslint-disable no-console, no-await-in-loop */
require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) throw new Error('DATABASE_URL is required for integration tests.');
const database = `ris_integration_${crypto.randomBytes(5).toString('hex')}`;
const clean = process.argv.includes('--clean');
const uploadParent = path.resolve(process.cwd(), 'var', 'integration-uploads');
const uploadRoot = path.resolve(uploadParent, database);
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${database}`;

const run = (command, args, extraEnv = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(), stdio: 'inherit', shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv, DATABASE_URL: testUrl.toString() },
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed.`);
};

const assert = (condition, message) => { if (!condition) throw new Error(message); };

const main = async () => {
  const admin = new Client({ connectionString: adminUrl.toString() });
  let prisma;
  let httpServer;
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${database}`);
    process.env.DATABASE_URL = testUrl.toString();
    process.env.FILE_STORAGE_DIR = uploadRoot;
    run('npx', ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma']);
    run('node', clean ? ['prisma/seed.js', '--clean'] : ['prisma/seed.js'], clean ? {
      RIS_BOOTSTRAP_SUPERADMIN_PASSWORD: 'IntegrationSuperAdmin123!',
      RIS_BOOTSTRAP_MANAGER_PASSWORD: 'IntegrationManager123!',
    } : {});
    prisma = require('../../server/config/prisma');
    const { loadState, resolveAccount } = require('../../server/services/risDataService');
    const { saveState } = require('../../server/services/risStateMutation');
    const { projectState, canChange } = require('../../server/services/risAccess');
    const state = await loadState();
    if (clean) {
      assert(state.systemUsers.length === 2 && state.schemes.length === 0 && state.drafts.length === 0, 'Clean seed contains demo data.');
      const cleanManager = await prisma.users.findFirst({ where: { email: 'manager@umn.ac.id' } });
      const check = await prisma.$queryRaw`SELECT password_hash = crypt(${'IntegrationManager123!'}, password_hash) AS valid FROM users WHERE id = ${cleanManager.id}::uuid`;
      assert(check[0].valid, 'Clean manager bootstrap password does not work.');
      console.log('Prisma clean seed and bootstrap authentication passed.');
      return;
    }
    assert(state.systemUsers.length === 9 && state.schemes.length === 7 && state.drafts.length === 5, 'Demo seed parity failed.');
    const databaseUser = await prisma.users.findFirst({ where: { email: 'lecturer@umn.ac.id' } });
    const account = resolveAccount(state, databaseUser);
    const visible = projectState(state, account);
    const draft = visible.drafts.find(item => item.status === 'draft');
    assert(draft, 'No editable lecturer draft in demo seed.');
    assert(canChange('drafts', draft, null, account, state), 'Lecturer cannot delete their own proposal draft.');
    assert(!canChange('drafts', visible.drafts.find(item => item.status === 'funded'), null, account, state), 'Lecturer could delete funded research.');
    const draftWithoutReviewState = Object.fromEntries(Object.entries(draft).filter(([key]) => !['assignments', 'reviews', 'decisionHistory'].includes(key)));
    const autosavedDraft = {
      ...draftWithoutReviewState,
      id: 'integration-autosaved-proposal',
      schemeId: 'scheme-demo-clean-2026',
      project: { ...draft.project, title: 'Integration autosaved proposal', targetTkt: '', sdgs: [] },
      budgets: [{ id: 'partial-budget', tab: 'materials', component: '', name: '', volume: '', unit: '', unitPrice: '' }],
      outputs: [],
      files: [],
    };
    const edited = { ...visible, drafts: [...visible.drafts.map(item => (item.id === draft.id
      ? { ...item, project: { ...item.project, title: 'Integration test proposal' } } : item)), autosavedDraft] };
    const saved = await saveState({ databaseUser, submitted: edited, expectedVersion: 1 });
    assert(saved.version === 2, 'Revision did not advance.');
    const persisted = await prisma.draft_projects.findUnique({ where: { draft_id: require('./generate-database-seed').id('draft', draft.id) } });
    assert(persisted.title === 'Integration test proposal', 'Relational draft project did not update.');
    const autosaved = await prisma.draft_projects.findUnique({ where: { draft_id: require('./generate-database-seed').id('draft', autosavedDraft.id) } });
    assert(autosaved && autosaved.title === 'Integration autosaved proposal' && autosaved.target_tkt === null, 'New partial proposal autosave did not reach PostgreSQL.');
    assert(saved.data.drafts.find(item => item.id === autosavedDraft.id).budgets.length === 1, 'Incomplete budget was lost from the saved draft.');
    for (const [field, value] of [
      ['notificationReadIds', [...saved.data.notificationReadIds, 'not-a-visible-notification']],
      ['externalResearchSequence', Number(saved.data.externalResearchSequence || 0) + 100],
    ]) {
      try {
        await saveState({ databaseUser, submitted: { [field]: value }, expectedVersion: 2 });
        throw new Error(`Lecturer changed protected ${field}.`);
      } catch (error) {
        if (error.message === `Lecturer changed protected ${field}.`) throw error;
        assert(error.status === 403, `Incorrect authorization for ${field}.`);
      }
    }
    try {
      await saveState({
        databaseUser,
        submitted: { drafts: saved.data.drafts.map(item => (item.id === draft.id
          ? { ...item, project: { ...item.project, title: 'File /api/files/11111111-1111-4111-8111-111111111111' } } : item)) },
        expectedVersion: 2,
      });
      throw new Error('Lecturer linked an unowned file.');
    } catch (error) {
      if (error.message === 'Lecturer linked an unowned file.') throw error;
      assert(error.status === 403, 'Unowned file reference was not rejected.');
    }
    const forbidden = { ...saved.data, drafts: saved.data.drafts.map(item => (item.id === draft.id
      ? { ...item, status: 'funded' } : item)) };
    try {
      await saveState({ databaseUser, submitted: forbidden, expectedVersion: 2 });
      throw new Error('Lecturer could fund their own proposal.');
    } catch (error) {
      if (error.message === 'Lecturer could fund their own proposal.') throw error;
      assert(error.status === 403, 'Incorrect authorization error.');
    }
    const manager = await prisma.users.findFirst({ where: { email: 'manager@umn.ac.id' } });
    const managerData = projectState(await loadState(), resolveAccount(await loadState(), manager));
    const scheme = managerData.schemes[0];
    const next = { ...managerData, schemes: managerData.schemes.map(item => (item.id === scheme.id
      ? { ...item, description: 'Integration test scheme description' } : item)) };
    await saveState({ databaseUser: manager, submitted: next, expectedVersion: 2 });
    const relationalScheme = await prisma.schemes.findUnique({ where: { id: require('./generate-database-seed').id('scheme', scheme.id) } });
    assert(relationalScheme.description === 'Integration test scheme description', 'Relational scheme did not update.');
    const newId = 'integration-new-lecturer';
    const newProfileId = 'integration-new-profile';
    const baseProfile = managerData.researcherProfiles.find(item => item.userId === account.id);
    const baseLecturer = managerData.lecturers.find(item => item.userId === account.id);
    const baseApplicant = managerData.applicantProfiles.find(item => item.userId === account.id);
    const newAccount = {
      id: newId, name: 'Integration Lecturer', email: 'integration.lecturer@example.test',
      password: 'TemporaryTestPassword123!', role: 'lecturer', adminScopes: [],
      profileId: newProfileId, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const addedAccount = {
      ...next,
      systemUsers: [...next.systemUsers, newAccount],
      researcherProfiles: [...next.researcherProfiles, {
        ...baseProfile, id: newProfileId, profileId: newProfileId, userId: newId,
        fullName: newAccount.name, institutionEmail: newAccount.email, nidn: '1234567890',
      }],
      lecturers: [...next.lecturers, { ...baseLecturer, id: newProfileId, userId: newId, name: newAccount.name, nidn: '1234567890' }],
      applicantProfiles: [...next.applicantProfiles, {
        ...baseApplicant, id: newProfileId, userId: newId, name: newAccount.name,
        email: newAccount.email, identifier: '1234567890',
      }],
    };
    const created = await saveState({ databaseUser: manager, submitted: addedAccount, expectedVersion: 3 });
    assert(created.version === 4, 'New account revision did not advance.');
    assert(!created.data.systemUsers.find(item => item.id === newId).password, 'Account password leaked into returned state.');
    const storedUser = await prisma.users.findFirst({ where: { email: newAccount.email } });
    assert(storedUser && storedUser.password_hash !== newAccount.password, 'New account password was not hashed.');
    const passwordCheck = await prisma.$queryRaw`SELECT password_hash = crypt(${newAccount.password}, password_hash) AS valid FROM users WHERE id = ${storedUser.id}::uuid`;
    assert(passwordCheck[0].valid, 'New account cannot authenticate with its initial password.');
    const noticeCount = await prisma.notifications.count({ where: { user_id: storedUser.id } });
    const mailCount = await prisma.email_outbox.count({ where: { recipient_user_id: storedUser.id } });
    assert(noticeCount > 0 && mailCount > 0, 'Account notifications and optional email were not written to PostgreSQL.');
    const assignedDraft = created.data.drafts.find(item => item.id === 'draft-assigned');
    assert(assignedDraft && assignedDraft.assignments.length, 'Reviewer fixture is missing.');
    const assignment = assignedDraft.assignments[0];
    const reassigned = {
      ...created.data,
      drafts: created.data.drafts.map(item => (item.id === assignedDraft.id ? {
        ...item, assignments: item.assignments.map(record => (record.id === assignment.id
          ? { ...record, status: 'revoked', revokedAt: new Date().toISOString(), revokedBy: 'user-manager' } : record)),
      } : item)),
    };
    const revoked = await saveState({ databaseUser: manager, submitted: reassigned, expectedVersion: 4 });
    const grant = revoked.data.temporaryRoleAssignments.find(item => item.entityId === assignedDraft.id && item.userId === assignment.reviewerUserId);
    assert(grant && grant.status === 'revoked', 'Temporary reviewer role did not follow the assignment.');
    const relationalAssignment = await prisma.reviewer_assignments.findUnique({ where: { id: require('./generate-database-seed').id('proposal-assignment', assignment.id) } });
    assert(relationalAssignment.status === 'revoked', 'Reviewer revocation was not written to PostgreSQL.');
    const express = require('express');
    const { optionalUser } = require('../../server/middlewares/auth');
    const app = express();
    app.use(express.json());
    app.use('/api', optionalUser);
    app.use('/api/auth', require('../../server/routes/authRoutes'));
    app.use('/api/ris/state', require('../../server/routes/risStateRoutes'));
    app.use('/api/files', require('../../server/routes/fileRoutes'));
    app.use('/api/letters', require('../../server/routes/letterRoutes'));
    app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message })); // eslint-disable-line no-unused-vars
    httpServer = await new Promise(resolve => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    const base = `http://127.0.0.1:${httpServer.address().port}`;
    const login = async (email, password) => {
      const response = await fetch(`${base}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      assert(response.status === 200, `Cannot log in as ${email}.`);
      return response.headers.get('set-cookie').split(';')[0];
    };
    const ownerCookie = await login(newAccount.email, newAccount.password);
    const binary = Buffer.from('%PDF-1.4\nRIS integration file\n');
    const uploaded = await fetch(`${base}/api/files`, {
      method: 'POST', headers: { Cookie: ownerCookie, 'Content-Type': 'application/pdf', 'X-File-Name': 'test.pdf' }, body: binary,
    });
    const file = await uploaded.json();
    assert(uploaded.status === 201 && file.fileUrl, 'Local file upload failed.');
    const oldDocument = (draft.files || []).find(item => item.category === 'proposal');
    const linkedDocument = {
      id: oldDocument ? oldDocument.id : 'integration-upload', category: 'proposal', name: 'test.pdf', type: 'application/pdf',
      size: binary.length, fileUrl: file.fileUrl, storedFileId: file.id,
    };
    const linked = {
      ...revoked.data,
      drafts: revoked.data.drafts.map(item => (item.id === draft.id
        ? { ...item, files: [...(item.files || []).filter(document => document.category !== 'proposal'), linkedDocument] } : item)),
    };
    const savedLinked = await saveState({ databaseUser: manager, submitted: linked, expectedVersion: revoked.version });
    const relationalFile = await prisma.draft_files.findUnique({ where: { id: require('./generate-database-seed').id('draft-file', `${draft.id}/${linkedDocument.id}`) } });
    assert(relationalFile.file_id === file.id, 'Proposal attachment does not reference the uploaded local file.');
    const { deleteResearchSchemeData } = require('../../app/containers/Ris/features/research/workflows/schemeCatalogWorkflow');
    const removableScheme = savedLinked.data.schemes.find(item => item.id === 'scheme-demo-draft-2026');
    const archivedState = deleteResearchSchemeData(savedLinked.data, removableScheme.id,
      resolveAccount(savedLinked.data, manager), prefix => `${prefix}-integration`);
    const archived = await saveState({ databaseUser: manager, submitted: archivedState, expectedVersion: savedLinked.version });
    assert(archived.data.schemes.find(item => item.id === removableScheme.id).deletedAt, 'Deleted scheme was not archived.');
    const relationalDeleted = await prisma.schemes.findUnique({ where: { id: require('./generate-database-seed').id('scheme', removableScheme.id) } });
    assert(relationalDeleted.deleted_at, 'SQL scheme deletion did not persist.');
    const latestState = await loadState();
    const lecturerState = projectState(latestState, resolveAccount(latestState, databaseUser));
    const { createExternalReportDraft } = require('../../app/containers/Ris/features/externalResearch/workflows/externalResearchWorkflow');
    const lecturerCookie = await login('lecturer@umn.ac.id', 'password');
    const externalUpload = await fetch(`${base}/api/files`, {
      method: 'POST', headers: { Cookie: lecturerCookie, 'Content-Type': 'application/pdf', 'X-File-Name': 'laporan.pdf' }, body: binary,
    });
    const externalFile = await externalUpload.json();
    assert(externalUpload.status === 201, 'External report file upload failed.');
    const externalDraft = {
      ...createExternalReportDraft(account, prefix => `${prefix}-integration`),
      teamMembers: [{ id: 'member-integration', type: 'external_lecturer', name: 'Dr. Anggota', nidn: '123', nim: '', program: 'SI', faculty: 'FTI', orcid: '' }],
      documents: [
        { id: 'report-integration', fileType: 'report', name: 'laporan.pdf', fileUrl: externalFile.fileUrl, size: binary.length },
        { id: 'extra-integration', fileType: 'additional', label: 'Surat kerja sama', name: 'laporan.pdf', fileUrl: externalFile.fileUrl, size: binary.length },
      ],
    };
    const externalSaved = await saveState({
      databaseUser,
      submitted: {
        ...lecturerState,
        externalResearchReports: [...lecturerState.externalResearchReports, externalDraft],
      },
      expectedVersion: archived.version,
    });
    assert(externalSaved.data.externalResearchReports.some(item => item.id === externalDraft.id), 'Lecturer external-report draft was not returned.');
    const relationalExternal = await prisma.external_research.findUnique({ where: { id: require('./generate-database-seed').id('external', externalDraft.id) } });
    assert(relationalExternal && relationalExternal.submission_status === 'draft', 'Lecturer external-report draft was not stored in PostgreSQL.');
    const externalMember = await prisma.external_research_members.findFirst({ where: { external_research_id: relationalExternal.id } });
    assert(externalMember && externalMember.name === 'Dr. Anggota', 'External research team was not stored in PostgreSQL.');
    const namedAttachment = await prisma.external_research_files.findUnique({ where: { id: require('./generate-database-seed').id('external-file', 'extra-integration') } });
    assert(namedAttachment && namedAttachment.display_name === 'Surat kerja sama', 'Custom external attachment name was not stored in PostgreSQL.');
    const downloaded = await fetch(`${base}${file.fileUrl}`, { headers: { Cookie: ownerCookie } });
    assert(downloaded.status === 200 && Buffer.compare(Buffer.from(await downloaded.arrayBuffer()), binary) === 0, 'Local file download differs from uploaded bytes.');
    const otherCookie = await login('reviewer@umn.ac.id', 'password');
    const denied = await fetch(`${base}${file.fileUrl}`, { headers: { Cookie: otherCookie } });
    assert(denied.status === 403, 'Another lecturer could download an unshared file.');
    const accountState = await loadState();
    const managerAccount = resolveAccount(accountState, manager);
    const { applyProfileAccountAction } = require('../../app/containers/Ris/features/profiles/workflows/researcherProfileWorkflow');
    const removedAccountState = applyProfileAccountAction(accountState, newProfileId, 'delete', 'Akun uji selesai', managerAccount, prefix => `${prefix}-integration`);
    const removedAccount = await saveState({ databaseUser: manager, submitted: removedAccountState, expectedVersion: externalSaved.version });
    assert(removedAccount.data.systemUsers.find(item => item.id === newId).deletedAt, 'Deleted account was not retained in the audit state.');
    const actionLog = removedAccount.data.systemActivityLogs.find(item => item.action === 'account_delete' && item.entityId === newProfileId);
    assert(actionLog, 'Account deletion was not added to the audit history.');
    const persistedLog = await prisma.system_activity_logs.findUnique({ where: { id: require('./generate-database-seed').id('audit', actionLog.id) } });
    assert(persistedLog, 'Account deletion audit event was not stored in PostgreSQL.');
    const disabledUser = await prisma.users.findUnique({ where: { id: storedUser.id } });
    assert(disabledUser && !disabledUser.is_active, 'Deleted account could still authenticate in PostgreSQL.');
    assert(disabledUser.deactivation_reason === 'Akun uji selesai' && disabledUser.deactivated_by === manager.id, 'Account deactivation details were not synchronized.');
    const blockedLogin = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newAccount.email, password: newAccount.password }),
    });
    assert(blockedLogin.status === 401, 'Deleted account login was not rejected.');

    const managerCookie = await login('manager@umn.ac.id', 'password');
    const researchAdminCookie = await login('admin.penelitian@umn.ac.id', 'password');
    const letterId = 'letter-data-submitted-1';
    const acceptedState = {
      ...removedAccount.data,
      letterRequests: removedAccount.data.letterRequests.map(item => (item.id === letterId ? {
        ...item, status: 'approved',
        template: { ...item.template, sourceId: 'B01', values: { letterPlace: 'Tangerang', signerName: 'Pejabat Pengujian', signerTitle: 'Kepala RIS', letterDate: '2026-10-01' } },
        templateFields: [...item.templateFields, { id: 'letter-test-custom', key: 'customRemark', label: 'Catatan Tambahan', type: 'textarea', required: false, options: [] }],
        form: { ...item.form, customRemark: 'Informasi kustom untuk pengujian integrasi' },
      } : item)),
    };
    await saveState({ databaseUser: manager, submitted: acceptedState, expectedVersion: removedAccount.version });
    const send = (route, cookie, body) => fetch(`${base}${route}`, {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
    });
    const privatePreview = await send('/api/letters/preview', lecturerCookie, { letterId });
    assert(privatePreview.status === 403, 'Lecturer could preview an unsigned letter.');
    const wrongScope = await send(`/api/letters/${letterId}/generate-pdf`, researchAdminCookie);
    assert(wrongScope.status === 403, 'Research-only admin could generate letters.');
    const previewResponse = await send('/api/letters/preview', managerCookie, { letterId });
    assert(previewResponse.status === 200 && previewResponse.headers.get('content-type').startsWith('application/pdf'), 'Word PDF preview failed.');
    const previewBytes = Buffer.from(await previewResponse.arrayBuffer());
    assert(previewBytes.subarray(0, 5).toString() === '%PDF-', 'Preview is not a real PDF.');
    const generatedResponse = await send(`/api/letters/${letterId}/generate-pdf`, managerCookie);
    const generatedBody = await generatedResponse.json();
    assert(generatedResponse.status === 200, `Letter PDF generation failed: ${generatedBody.message}`);
    const generatedLetter = generatedBody.data.letterRequests.find(item => item.id === letterId);
    assert(generatedLetter.generated.draftFileId && generatedLetter.status === 'approved', 'Generating a draft incorrectly published the letter.');
    const blockedDraft = await fetch(`${base}${generatedLetter.generated.draftFileUrl}`, { headers: { Cookie: lecturerCookie } });
    assert(blockedDraft.status === 403, 'Lecturer could read the unsigned stored PDF.');
    const otherLetter = await fetch(`${base}/api/letters/${letterId}/pdf`, { headers: { Cookie: otherCookie } });
    assert(otherLetter.status === 404, 'Another lecturer could discover a private letter.');
    const earlyFinal = await fetch(`${base}/api/letters/${letterId}/pdf`, { headers: { Cookie: lecturerCookie } });
    assert(earlyFinal.status === 403, 'Lecturer could download a final letter before signing.');
    const unsignedAsFinal = await send(`/api/letters/${letterId}/publish-signed`, managerCookie, { fileId: generatedLetter.generated.draftFileId });
    assert(unsignedAsFinal.status === 422, 'Generated draft was accepted as its own signed upload.');
    // Stand in for the external signing system: re-upload a valid PDF as a distinct file.
    const signedUpload = await fetch(`${base}/api/files`, {
      method: 'POST', headers: { Cookie: managerCookie, 'Content-Type': 'application/pdf', 'X-File-Name': 'surat-bertanda-tangan-test.pdf' }, body: previewBytes,
    });
    const signed = await signedUpload.json();
    assert(signedUpload.status === 201, 'Signed PDF upload failed.');
    const publishedResponse = await send(`/api/letters/${letterId}/publish-signed`, managerCookie, { fileId: signed.id });
    const published = await publishedResponse.json();
    assert(publishedResponse.status === 200, `Final publication failed: ${published.message}`);
    assert(published.data.letterRequests.find(item => item.id === letterId).status === 'generated', 'Final status did not become complete.');
    assert(published.data.notifications.some(item => item.entityId === letterId && item.userId === 'user-lecturer' && item.type === 'letter_generated'), 'Final publication notification missing.');
    assert(published.data.emailOutbox.some(item => item.entityId === letterId && item.notificationType === 'letter_generated'), 'Final publication email was not queued.');
    const finalResponse = await fetch(`${base}/api/letters/${letterId}/pdf?inline=1`, { headers: { Cookie: lecturerCookie } });
    assert(finalResponse.status === 200 && finalResponse.headers.get('content-disposition').startsWith('inline'), 'Final signed PDF cannot be previewed.');
    assert(Buffer.compare(Buffer.from(await finalResponse.arrayBuffer()), previewBytes) === 0, 'Final download did not use the uploaded signed PDF.');
    const finalRelational = await prisma.generated_letters.findUnique({ where: { letter_id: require('./generate-database-seed').id('letter', letterId) } });
    assert(finalRelational.file_id === signed.id, 'Signed PDF was not mirrored to PostgreSQL.');
    const invalidState = await fetch(`${base}/api/ris/state`, {
      method: 'PUT',
      headers: { Cookie: lecturerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { drafts: {} }, version: published.version }),
    });
    assert(invalidState.status === 400, `Malformed state domain passed API schema validation (${invalidState.status}: ${await invalidState.text()}).`);
    const lecturerVisible = projectState(await loadState(), account);
    const ownNotice = lecturerVisible.notifications.find(item => item.userId === account.id && !lecturerVisible.notificationReadIds.includes(item.id));
    assert(ownNotice, 'No unread lecturer notification was available to test read access.');
    const markedRead = await saveState({
      databaseUser,
      submitted: { notificationReadIds: [...lecturerVisible.notificationReadIds, ownNotice.id] },
      expectedVersion: published.version,
    });
    assert(markedRead.data.notificationReadIds.includes(ownNotice.id), 'Lecturer could not mark their own notification as read.');

    process.env.MFA_REQUIRED = 'true';
    process.env.MFA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    const mfaRequest = code => fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@umn.ac.id', password: 'password', ...(code ? { code } : {}) }),
    });
    const enrollmentResponse = await mfaRequest();
    const enrollment = await enrollmentResponse.json();
    assert(enrollmentResponse.status === 202 && enrollment.setupKey && !enrollmentResponse.headers.get('set-cookie'), 'Admin MFA enrollment issued a session prematurely.');
    const priorSession = await fetch(`${base}/api/auth/session`, { headers: { Cookie: managerCookie } });
    assert((await priorSession.json()).user === null, 'Pre-MFA admin session remained active.');
    const { generate } = await import('otplib');
    const code = await generate({ secret: enrollment.setupKey });
    const verifiedResponse = await mfaRequest(code);
    assert(verifiedResponse.status === 200 && verifiedResponse.headers.get('set-cookie'), 'Admin MFA verification failed.');
    const replay = await mfaRequest(code);
    assert(replay.status === 401, 'A TOTP code was accepted twice.');
    const lecturerWithMfaRequired = await fetch(`${base}/api/auth/session`, { headers: { Cookie: lecturerCookie } });
    assert((await lecturerWithMfaRequired.json()).user, 'Lecturer was incorrectly forced through admin MFA.');
    delete process.env.MFA_REQUIRED;
    delete process.env.MFA_ENCRYPTION_KEY;
    console.log('Word PDF preview, scoped access, signing flow, publication notifications and final file parity passed.');
    console.log('Admin MFA enrollment, session upgrade and TOTP replay protection passed.');
    console.log('Prisma demo seed, transactional writes, role isolation and relational mirror passed.');
  } finally {
    if (httpServer) await new Promise(resolve => httpServer.close(resolve));
    if (prisma) await prisma.$disconnect();
    await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin.end();
    if (uploadRoot.startsWith(`${uploadParent}${path.sep}`)) fs.rmSync(uploadRoot, { recursive: true, force: true });
  }
};

main().catch(error => { console.error(error.message); process.exitCode = 1; });
