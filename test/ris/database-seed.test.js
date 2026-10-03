/* eslint-disable object-curly-newline */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildSeedRows, generateSeedSql, id } = require('../../internals/scripts/generate-database-seed');
const { accountOnlyInitialData, entriesFor } = require('../../server/services/risDataService');

describe('PostgreSQL frontend seed parity', () => {
  it('keeps the checked-in SQL synchronized with normalized frontend data', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../../database.sql'), 'utf8').replace(/\r\n/g, '\n');
    assert.strictEqual(sql.slice(sql.indexOf('-- BEGIN GENERATED FRONTEND SEEDS')), generateSeedSql().replace(/\r\n/g, '\n'));
  });

  it('maps all main entities and nested scheme/proposal data without invented notifications', () => {
    const { tables, source } = buildSeedRows();
    const pairs = {
      users: 'systemUsers',
      researcher_profiles: 'researcherProfiles',
      researcher_documents: 'researcherDocuments',
      schemes: 'schemes',
      research_drafts: 'drafts',
      letter_requests: 'letterRequests',
      letter_definitions: 'letterDefinitions',
      external_research: 'externalResearchReports',
      research_monev: 'monevRecords',
      research_reports: 'internalReports',
      funded_review_assignments: 'fundedReviewAssignments',
      funded_reviews: 'fundedReviews',
      research_logbooks: 'logbooks',
    };
    Object.entries(pairs).forEach(([table, key]) => assert.strictEqual((tables.get(table) || []).length, source[key].length, table));
    assert.strictEqual(tables.get('scheme_output_options').length, source.schemes.reduce((count, scheme) => count + scheme.outputOptions.length, 0));
    assert.strictEqual(tables.get('scheme_attachment_requirements').length, source.schemes.reduce((count, scheme) => count + scheme.attachmentRequirements.length, 0));
    source.schemes.forEach(scheme => {
      const periods = tables.get('scheme_reporting_periods').filter(row => row.scheme_id === id('scheme', scheme.id));
      assert.deepStrictEqual(periods.map(row => [row.report_type, row.open_at, row.due_at]), scheme.reportingSchedule.map(period => [period.type, period.openAt, period.dueAt]));
    });
    assert.strictEqual(tables.has('notifications'), false);
    assert.strictEqual(tables.has('email_outbox'), false);
    assert.strictEqual(tables.has('letter_reviews'), false);
  });

  it('maps an autosaved proposal before reviewer and decision data exist', () => {
    const { source } = buildSeedRows();
    const base = source.drafts.find(item => item.status === 'draft');
    const draft = Object.fromEntries(Object.entries(base).filter(([key]) => !['assignments', 'reviews', 'decisionHistory'].includes(key)));
    const pending = {
      ...draft,
      id: 'draft-autosave-test',
      project: { ...draft.project, title: 'Autosave test', targetTkt: '', sdgs: [] },
      budgets: [{ id: 'partial-budget', tab: 'materials', component: '', name: '', volume: '', unit: '', unitPrice: '' }],
    };
    const { tables } = buildSeedRows('demo', { ...source, drafts: [...source.drafts, pending] });
    assert.ok(tables.get('research_drafts').some(row => row.id === id('draft', pending.id)));
    assert.ok(tables.get('draft_projects').some(row => row.draft_id === id('draft', pending.id)));
    assert.strictEqual(tables.get('draft_projects').find(row => row.draft_id === id('draft', pending.id)).target_tkt, null);
    assert.ok(!(tables.get('draft_budget_items') || []).some(row => row.draft_id === id('draft', pending.id)));
    assert.ok(!(tables.get('reviewer_assignments') || []).some(row => row.draft_id === id('draft', pending.id)));
    assert.strictEqual(pending.assignments, undefined);
  });

  it('maps external team members and named attachments without storing empty upload slots', () => {
    const { source } = buildSeedRows();
    const report = source.externalResearchReports[0];
    const updated = {
      ...report,
      teamMembers: [{ id: 'member-1', type: 'external_lecturer', name: 'Dr. Anggota', nidn: '123', nim: '', program: 'SI', faculty: 'FTI', orcid: '' }],
      documents: [
        ...report.documents,
        { id: 'named-file', fileType: 'additional', label: 'Surat kerja sama', name: 'surat.pdf', fileUrl: 'surat.pdf', size: 100 },
        { id: 'empty-slot', fileType: 'additional', label: 'Berkas lain', name: '', fileUrl: '' },
      ],
    };
    const { tables } = buildSeedRows('demo', { ...source, externalResearchReports: source.externalResearchReports.map(item => (item.id === report.id ? updated : item)) });
    const parentId = id('external', report.id);
    assert.strictEqual(tables.get('external_research_members').find(row => row.external_research_id === parentId).name, 'Dr. Anggota');
    assert.strictEqual(tables.get('external_research_files').find(row => row.id === id('external-file', 'named-file')).display_name, 'Surat kerja sama');
    assert.ok(!tables.get('external_research_files').some(row => row.id === id('external-file', 'empty-slot')));
  });

  it('preserves original review scores and downloadable template contents', () => {
    const { tables, source } = buildSeedRows();
    source.fundedReviews.forEach(review => {
      const scores = tables.get('funded_review_score_details').filter(row => row.review_id === id('funded-review', review.id));
      assert.deepStrictEqual(Object.fromEntries(scores.map(row => [row.criteria_code, row.score])), review.scores);
      assert.strictEqual(tables.get('funded_reviews').find(row => row.id === id('funded-review', review.id)).total_score, review.totalScore);
    });
    const templates = source.schemes.flatMap(scheme => scheme.attachmentRequirements.filter(requirement => requirement.template).map(requirement => requirement.template));
    templates.forEach(template => assert.ok(tables.get('stored_files').some(row => row.file_url === template.dataUrl && row.original_name === template.name)));
    assert.ok(tables.get('stored_files').filter(row => row.status === 'pending').every(row => row.metadata.demoPlaceholder));
  });

  it('uses deterministic parent-scoped UUIDs and never creates student/reviewer accounts', () => {
    const { tables } = buildSeedRows();
    assert.notStrictEqual(id('output', 'draft-one/output-1'), id('output', 'draft-two/output-1'));
    assert.throws(() => id('output'), /Missing/);
    tables.forEach(rows => {
      const ids = rows.filter(row => row.id !== undefined).map(row => row.id);
      assert.strictEqual(new Set(ids).size, ids.length);
    });
    assert.ok(tables.get('users').every(row => ['super_admin', 'manager', 'admin', 'lecturer'].includes(row.role)));
    assert.strictEqual(tables.get('users').find(row => row.email === 'reviewer@umn.ac.id').role, 'lecturer');
  });

  it('provides a clean alternative with only two accounts and required system defaults', () => {
    const { tables } = buildSeedRows('production');
    assert.deepStrictEqual(tables.get('users').map(row => row.role), ['super_admin', 'manager']);
    assert.strictEqual(tables.get('researcher_profiles').length, 2);
    assert.strictEqual(tables.get('letter_master_templates').length, 1);
    ['schemes', 'research_drafts', 'letter_requests', 'letter_definitions', 'external_research', 'notifications', 'email_outbox', 'researcher_documents'].forEach(table => assert.strictEqual(tables.has(table), false));
  });

  it('creates an account-only testing seed with module admins and a lecturer reviewer account', () => {
    const { tables } = buildSeedRows('accounts');
    assert.deepStrictEqual(tables.get('users').map(row => row.email), [
      'superadmin@umn.ac.id', 'manager@umn.ac.id', 'admin.penelitian@umn.ac.id',
      'admin.surat@umn.ac.id', 'admin.profil@umn.ac.id', 'lecturer@umn.ac.id', 'reviewer@umn.ac.id',
    ]);
    assert.deepStrictEqual([...tables.keys()], [
      'roles', 'admin_scopes', 'sdg_goals', 'budget_categories', 'review_criteria', 'users', 'user_admin_scopes',
    ]);
    assert.ok(tables.get('users').every(row => row.password_hash.seedPassword === 'RIS_TEST_ACCOUNT_PASSWORD_CHANGE_ME'));
    assert.strictEqual(tables.get('users').find(row => row.email === 'reviewer@umn.ac.id').role, 'lecturer');
  });

  it('initializes only the seven accounts in the runtime projection after migrations', () => {
    const { source } = buildSeedRows('accounts');
    const initialState = accountOnlyInitialData(source);
    assert.strictEqual(initialState.systemUsers.length, 7);
    assert.ok(initialState.systemUsers.every(user => !user.password && !user.passwordHash));
    ['schemes', 'drafts', 'researcherProfiles', 'letterRequests', 'externalResearchReports'].forEach(domain => {
      assert.deepStrictEqual(initialState[domain], [], domain);
    });
    const runtimeRows = entriesFor(initialState);
    assert.strictEqual(runtimeRows.filter(row => row.domain === 'systemUsers').length, 7);
    assert.strictEqual(runtimeRows.filter(row => ['schemes', 'drafts', 'researcherProfiles', 'letterRequests', 'externalResearchReports'].includes(row.domain)).length, 0);
  });
});
