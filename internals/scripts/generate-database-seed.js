/* eslint-disable object-curly-newline, object-property-newline, no-use-before-define */
// Generates relational INSERTs, not a serialized frontend/database snapshot.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MARKER = '-- BEGIN GENERATED FRONTEND SEEDS';
const DEFAULT_DATE = '2026-06-01T00:00:00.000Z';
const ACCOUNT_SEED_IDS = new Set([
  'user-super-admin', 'user-manager', 'user-admin', 'user-admin-letter',
  'user-admin-profile', 'user-lecturer', 'user-lecturer-2',
]);
const id = (domain, key) => {
  if (key === undefined || key === null || key === '') throw new Error(`Missing ${domain} seed identity`);
  const bytes = crypto.createHash('sha256').update(`ris:${domain}:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; // eslint-disable-line no-bitwise
  bytes[8] = (bytes[8] & 63) | 128; // eslint-disable-line no-bitwise
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const sql = value => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite seed number');
    return String(value);
  }
  const json = typeof value === 'object';
  return `'${(json ? JSON.stringify(value) : String(value)).replace(/'/g, "''")}'${json ? '::jsonb' : ''}`;
};
const without = (object, keys) => Object.fromEntries(Object.entries(object || {}).filter(([key]) => !keys.includes(key)));
const nullable = value => (value === '' || value === undefined ? null : value);
const timestamp = value => value || DEFAULT_DATE;
const dates = record => ({ created_at: timestamp(record.createdAt), updated_at: timestamp(record.updatedAt || record.createdAt) });
const CONTRACT_DB_STATUS = {
  unsigned: 'unsigned', awaiting_admin_contract: 'unsigned', admin_uploaded: 'unsigned', ready_to_send: 'unsigned',
  awaiting_lecturer_signature: 'unsigned', sent_to_lecturer: 'unsigned',
  signed: 'signed', completed: 'signed',
  revision: 'revision_required', revision_required: 'revision_required',
  accepted: 'accepted', verified: 'accepted',
};
const contractDbStatus = contract => {
  const status = contract.status || contract.contractStatus || 'unsigned';
  if (!Object.prototype.hasOwnProperty.call(CONTRACT_DB_STATUS, status)) throw new Error(`Unsupported contract status: ${status}`);
  return CONTRACT_DB_STATUS[status];
};

const loadFrontend = () => {
  const { createInitialData, normalizeRisData } = require('../../app/containers/Ris/core/data');
  return normalizeRisData(createInitialData());
};

const buildSeedRows = (mode = 'demo', sourceOverride = null) => {
  const source = sourceOverride || loadFrontend();
  const { SDGS, BUDGET_TABS, REVIEW_CRITERIA } = require('../../app/containers/Ris/core/data');
  const { FUNDED_REVIEW_CRITERIA } = require('../../app/containers/Ris/features/research/workflows/fundedResearchReviewWorkflow');
  const tables = new Map();
  const add = (table, row) => {
    if (!tables.has(table)) tables.set(table, []);
    tables.get(table).push(row);
    return row.id;
  };
  const users = source.systemUsers.filter(user => (mode === 'demo' || (mode === 'accounts' && ACCOUNT_SEED_IDS.has(user.id))
    || (mode !== 'accounts' && mode !== 'demo' && ['super_admin', 'manager'].includes(user.role))));
  const user = key => (users.some(item => item.id === key) ? id('user', key) : null);
  const admin = user('user-super-admin');
  const profile = key => (source.researcherProfiles.some(item => item.id === key && user(item.userId)) ? id('profile', key) : null);
  const file = (record, context, owner) => {
    if (!record) return null;
    if (sourceOverride && record.storedFileId) return record.storedFileId;
    if (sourceOverride && /^\/api\/files\/[0-9a-f-]{36}$/.test(record.fileUrl || '')) return record.fileUrl.split('/').pop();
    const key = id('file', context);
    if ((tables.get('stored_files') || []).some(item => item.id === key)) return key;
    const name = record.name || record.fileName || 'dokumen';
    const url = record.dataUrl || record.fileUrl || null;
    const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : null;
    const mime = record.type || ({ pdf: 'application/pdf', doc: 'application/msword', xls: 'application/vnd.ms-excel', txt: 'text/plain' }[extension]) || 'application/octet-stream';
    add('stored_files', { id: key, owner_user_id: user(owner), storage_provider: 'demo', storage_key: `demo/${context}/${name}`, file_url: url,
      original_name: name, mime_type: mime, extension, size_bytes: record.size || record.fileSize || 0,
      status: url && url.startsWith('data:') ? 'ready' : 'pending',
      metadata: { sourceId: record.id || null, demoPlaceholder: !(url && url.startsWith('data:')), category: record.category || record.fileType || null },
      uploaded_at: timestamp(record.uploadedAt) });
    return key;
  };

  [['super_admin', 'Super Admin'], ['manager', 'Manager LPPM'], ['admin', 'Admin'], ['lecturer', 'Dosen']].forEach(([code, name]) => add('roles', { code, name }));
  [['research_management', 'Manajemen Penelitian'], ['letter_management', 'Pengajuan Surat'], ['researcher_profile_management', 'Informasi Peneliti']].forEach(([code, name]) => add('admin_scopes', { code, name }));
  SDGS.forEach(item => add('sdg_goals', { id: item.id, name: item.name }));
  BUDGET_TABS.forEach((item, index) => add('budget_categories', { code: item.key, name: item.label, position: index + 1 }));
  REVIEW_CRITERIA.forEach((item, index) => add('review_criteria', { code: item.code, name: item.label, category: item.group, weight: item.weight, position: index + 1 }));
  if (mode !== 'accounts') source.researcherExpertise.forEach(item => add('researcher_expertise', { id: id('expertise', item.expertiseId), name: item.name }));
  users.forEach(item => {
    add('users', { id: user(item.id), email: item.email,
      ...(!sourceOverride || item.password ? { password_hash: { seedPassword: mode === 'demo' ? (item.password || 'password') : mode === 'accounts' ? 'RIS_TEST_ACCOUNT_PASSWORD_CHANGE_ME' : `CHANGE_BEFORE_DEPLOY_${item.role.toUpperCase()}` } } : {}),
      name: item.name, role: item.role, is_active: item.isActive !== false, applicant_enabled: ['manager', 'lecturer'].includes(item.role),
      ...(sourceOverride ? { deactivation_reason: item.deactivationReason || null, deactivated_by: user(item.deactivatedBy), deactivated_at: item.deactivatedAt || null } : {}),
      default_mode: item.role === 'lecturer' ? 'lecturer' : 'management', identifier: nullable(item.identifier), ...dates(item) });
    (item.adminScopes || []).forEach(scope => add('user_admin_scopes', { id: id('admin-scope', `${item.id}/${scope}`), user_id: user(item.id), scope, assigned_by: admin }));
  });
  if (mode === 'accounts') return { tables, source };
  const profileFields = {
    full_name: 'fullName', front_title: 'frontTitle', back_title: 'backTitle', nidn: 'nidn', nik: 'nik', nip: 'nip', birth_place: 'birthPlace', birth_date: 'birthDate', gender: 'gender', nationality: 'nationality',
    institution_email: 'institutionEmail', alternate_email: 'alternateEmail', phone_number: 'phoneNumber', domicile_address: 'domicileAddress', correspondence_address: 'correspondenceAddress',
    faculty: 'faculty', study_program: 'studyProgram', unit: 'unit', position: 'position', functional_position: 'functionalPosition', education_level: 'educationLevel', employment_status: 'employmentStatus',
    orcid: 'orcid', google_scholar: 'googleScholar', sinta_id: 'sintaId', bank_name: 'bankName', bank_account_number: 'bankAccountNumber', bank_account_name: 'bankAccountName',
    emergency_contact_name: 'emergencyContactName', emergency_contact_relation: 'emergencyContactRelation', emergency_contact_phone: 'emergencyContactPhone',
  };
  source.researcherProfiles.filter(item => user(item.userId)).forEach(item => {
    const lecturer = source.lecturers.find(candidate => candidate.userId === item.userId) || {};
    const merged = { ...lecturer, ...item };
    add('researcher_profiles', { id: profile(item.id), user_id: user(item.userId),
      ...Object.fromEntries(Object.entries(profileFields).map(([column, key]) => [column, nullable(merged[key])])),
      sinta_score: lecturer.sintaScore || 0, research_count: lecturer.researchCount || 0, last_research_year: lecturer.lastResearchYear || null,
      profile_status: item.profileStatus, verification_status: item.verificationStatus, completeness: item.profileCompleteness,
      last_updated_by: user(item.lastUpdatedBy), ...dates(item) });
  });
  const master = source.letterMasterTemplate;
  if (master && master.template && Array.isArray(master.fields)) {
    add('letter_master_templates', {
      id: 1,
      name: master.name || 'Master Template Surat',
      version: Number(master.version) > 0 ? Number(master.version) : 1,
      template_content: master.template.content || '',
      fields: master.fields,
      updated_by: user(master.updatedBy),
      ...dates(master),
    });
  }
  if (mode !== 'demo') return { tables, source };

  source.researcherDocuments.forEach(item => add('researcher_documents', { id: id('profile-document', item.id), profile_id: profile(item.profileId), document_type: item.documentType,
    file_id: file(item, `profile/${item.id}`, item.uploadedBy), uploaded_by: user(item.uploadedBy), is_active: item.isActive, uploaded_at: timestamp(item.uploadedAt) }));
  source.researcherExpertiseMap.forEach(item => add('researcher_expertise_map', { profile_id: profile(item.profileId), expertise_id: id('expertise', item.expertiseId), is_primary: Boolean(item.isPrimary) }));
  source.researcherVerifications.forEach(item => add('researcher_verifications', { id: id('profile-verification', item.id), profile_id: profile(item.profileId), status: item.verificationStatus,
    notes: item.verificationNotes, verified_by: user(item.verifiedBy), verified_at: item.verifiedAt, created_at: timestamp(item.verifiedAt) }));
  source.researcherStatusHistory.forEach(item => add('researcher_status_history', { id: id('profile-history', item.id), profile_id: profile(item.profileId), old_status: item.oldStatus,
    new_status: item.newStatus, reason: item.reason || null, changed_by: user(item.changedBy), changed_at: timestamp(item.changedAt) }));
  source.adminAssignments.forEach(item => add('admin_assignments', { id: id('profile-admin', item.id), profile_id: profile(item.profileId), admin_id: user(item.adminId), assigned_by: user(item.assignedBy), assigned_at: item.assignedAt }));
  source.applicantProfiles.forEach(item => add('applicant_profiles', { id: id('applicant', item.id), user_id: user(item.userId), name: item.name, identifier: item.identifier, applicant_role: item.applicantRole,
    applicant_kind: item.applicantKind, status: item.status, faculty: item.faculty, study_program: item.program, email: item.email }));
  source.previousEthicsClearances.forEach(item => add('previous_ethics_clearances', { id: id('ethics', item.id), user_id: user(item.userId),
    applicant_name: (source.applicantProfiles.find(person => person.userId === item.userId) || {}).name || null,
    clearance_number: item.number, research_title: item.researchTitle, issued_at: item.issuedAt, expiry_date: item.expiryDate }));

  source.schemes.forEach(item => {
    add('schemes', { id: id('scheme', item.id), name: item.name, description: item.description, start_date: item.startDate, end_date: item.endDate,
      registration_start_at: item.registrationStartDate, registration_end_at: item.registrationEndDate, year: item.year, maximum_budget: item.maximumBudget,
      status: item.status, filters: item.filters, created_by: user(item.createdBy) || user('user-admin'),
      ...(sourceOverride ? { deleted_at: item.deletedAt || null, deleted_by: user(item.deletedBy), archived_at: item.archivedAt || null } : {}), ...dates(item) });
    item.eligibleUserIds.forEach(key => add('scheme_eligible_users', { scheme_id: id('scheme', item.id), user_id: user(key) }));
    item.outputOptions.forEach((option, index) => add('scheme_output_options', { id: id('scheme-output', `${item.id}/${option.id}`), scheme_id: id('scheme', item.id), name: option.name,
      category: option.category, configuration: without(option, ['name', 'category']), position: index + 1 }));
    item.attachmentRequirements.forEach((requirement, index) => add('scheme_attachment_requirements', { id: id('requirement', `${item.id}/${requirement.category}`), scheme_id: id('scheme', item.id), category: requirement.category,
      name: requirement.name, accepted_extensions: requirement.accept, template_accepted_extensions: requirement.templateAccept, is_required: requirement.required, is_custom: requirement.custom,
      template_file_id: file(requirement.template, `scheme/${item.id}/${requirement.category}`, 'user-admin'), position: index + 1 }));
    item.reportingSchedule.forEach((period, index) => add('scheme_reporting_periods', { id: id('period', period.id), scheme_id: id('scheme', item.id), report_type: period.type,
      label: period.label, open_at: period.openAt, due_at: period.dueAt, position: index + 1, created_by: user('user-admin') }));
  });

  source.drafts.forEach(item => {
    const draftId = id('draft', item.id);
    const assignments = Array.isArray(item.assignments) ? item.assignments : [];
    const reviews = Array.isArray(item.reviews) ? item.reviews : [];
    const decisionHistory = Array.isArray(item.decisionHistory) ? item.decisionHistory : [];
    add('research_drafts', { id: draftId, user_id: user(item.userId), scheme_id: id('scheme', item.schemeId), status: item.status, current_step: item.currentStep || 1,
      requested_budget: item.requestedBudget === undefined ? null : item.requestedBudget, budget_sections: item.budgetSections || [], created_by: user(item.userId),
      submitted_at: item.submittedAt, last_saved_at: item.lastSavedAt, decided_at: item.decision && item.decision.decidedAt,
      ...(sourceOverride ? { payload: item, archive_metadata: item.archiveMetadata || {}, archived_at: item.archivedAt || null, archived_by: user(item.archivedBy) } : {}), ...dates(item) });
    const { project } = item;
    add('draft_projects', { id: id('project', item.id), draft_id: draftId, title: project.title, target_tkt: !project.targetTkt || project.targetTkt === 'none' ? null : Number(project.targetTkt), rip_relation: project.ripRelation,
      research_center_relation: project.researchCenterRelation, research_center_other: project.researchCenterOther, integrated_to_teaching: project.integrated, course_name: project.courseName, academic_year: project.academicYear,
      metadata: without(project, ['title', 'targetTkt', 'ripRelation', 'researchCenterRelation', 'researchCenterOther', 'integrated', 'courseName', 'academicYear', 'sdgs']) });
    project.sdgs.forEach(sdg => add('draft_project_sdgs', { project_id: id('project', item.id), sdg_id: sdg }));
    item.members.forEach((member, index) => add('draft_members', { id: id('member', `${item.id}/${member.id}`), draft_id: draftId, role: member.role, member_type: member.type,
      profile_id: profile(member.profileId), user_id: user(member.userId) || user((source.researcherProfiles.find(p => p.id === member.profileId) || {}).userId),
      name: member.name, nidn: member.nidn, nim: member.nim, study_program: member.program, faculty: member.faculty, orcid: member.orcid, email: member.email, position: index + 1 }));
    item.budgets.forEach((budget, index) => {
      if (!budget.component || !budget.name || !budget.unit || !(Number(budget.volume) > 0)
        || budget.unitPrice === '' || budget.unitPrice === null || budget.unitPrice === undefined
        || !Number.isFinite(Number(budget.unitPrice)) || Number(budget.unitPrice) < 0
        || (!BUDGET_TABS.some(tab => tab.key === budget.tab) && !budget.sectionLabel)) return;
      add('draft_budget_items', { id: id('budget', `${item.id}/${budget.id}`), draft_id: draftId,
        category_code: BUDGET_TABS.some(tab => tab.key === budget.tab) ? budget.tab : null, section_key: budget.tab, section_label: budget.sectionLabel || (BUDGET_TABS.find(tab => tab.key === budget.tab) || {}).label,
        component: budget.component, item_name: budget.name, volume: budget.volume, unit: budget.unit, unit_price: budget.unitPrice, notes: budget.notes, position: index + 1 });
    });
    item.outputs.forEach((output, index) => add('draft_outputs', { id: id('output', `${item.id}/${output.id}`), draft_id: draftId,
      scheme_output_option_id: output.schemeOutputOptionId ? id('scheme-output', `${item.schemeId}/${output.schemeOutputOptionId}`) : null,
      output_kind: output.type, name: output.name || output.title || '', category: output.category, description: output.description,
      configuration: without(output, ['type', 'name', 'category', 'description']), position: index + 1 }));
    item.files.forEach(document => add('draft_files', { id: id('draft-file', `${item.id}/${document.id}`), draft_id: draftId,
      requirement_id: id('requirement', `${item.schemeId}/${document.category}`), category: document.category, file_id: file(document, `proposal/${item.id}/${document.id}`, item.userId), uploaded_by: user(item.userId), uploaded_at: timestamp(item.createdAt) }));
    if (item.submittedAt) {
      add('proposal_submissions', { id: id('submission', item.id), draft_id: draftId, revision_number: 1,
        snapshot: { project: item.project, members: item.members, budgets: item.budgets, outputs: item.outputs, files: item.files }, submitted_by: user(item.userId), submitted_at: item.submittedAt });
    }
    if (item.verification) {
      add('proposal_verifications', { id: id('proposal-verification', item.id), draft_id: draftId, status: item.verification.status,
        checklist: item.verification.checklist, notes: item.verification.notes, verified_by: user(item.verification.verifiedBy), verified_at: item.verification.verifiedAt });
    }
    assignments.forEach(assignment => add('reviewer_assignments', { id: id('proposal-assignment', assignment.id), draft_id: draftId, submission_id: item.submittedAt ? id('submission', item.id) : null,
      reviewer_id: user(assignment.reviewerUserId), status: assignment.status, assigned_by: user(assignment.assignedBy), assigned_at: assignment.assignedAt, due_at: assignment.dueAt,
      submitted_at: assignment.submittedAt, revoked_at: assignment.revokedAt, revoked_by: user(assignment.revokedBy) }));
    reviews.forEach(review => {
      const assignment = assignments.find(a => a.reviewerUserId === review.reviewerUserId);
      add('submission_reviews', { id: id('proposal-review', review.id), assignment_id: id('proposal-assignment', assignment.id), recommendation: review.recommendation, total_score: review.totalScore,
        strengths: review.strengths, weaknesses: review.weaknesses, budget_notes: review.budgetNotes, output_notes: review.outputNotes, revision_notes: review.revisionNotes, submitted_at: review.submittedAt, updated_at: review.submittedAt });
      REVIEW_CRITERIA.forEach(criterion => add('review_score_details', { review_id: id('proposal-review', review.id), criteria_code: criterion.code, score: review.scores[criterion.code], weighted_score: (review.scores[criterion.code] * criterion.weight) / 100 }));
    });
    decisionHistory.forEach((decision, index) => add('proposal_decisions', { id: id('decision', `${item.id}/${index}`), draft_id: draftId, decision_round: index + 1,
      decision: decision.finalDecision, notes: decision.notes, decided_by: user(decision.decidedBy), signer_name: decision.signerName, signer_role: decision.signerRole, decided_at: decision.decidedAt }));
    if (item.fundingLetter) {
      add('funding_letters', { id: id('funding-letter', item.id), draft_id: draftId, letter_number: item.fundingLetter.number,
        file_name: item.fundingLetter.fileName, signed_by: user(item.fundingLetter.signedBy), signer_name: item.fundingLetter.signerName, signer_role: item.fundingLetter.signerRole,
        issued_at: item.fundingLetter.issuedAt, signed_at: item.fundingLetter.signedAt });
    }
    if (item.status === 'funded') {
      add('funded_research', { id: draftId, scheme_id: id('scheme', item.schemeId), lead_user_id: user(item.userId), title: item.project.title,
        funded_amount: item.budgets.reduce((total, budget) => total + budget.volume * budget.unitPrice, 0), created_by: user(item.decision.decidedBy) });
      if (item.contract) add('research_contracts', { id: id('contract', item.id), research_id: draftId, status: contractDbStatus(item.contract), template_name: item.contract.templateName });
    }
  });

  source.internalReports.forEach(item => {
    add('research_reports', { id: id('report', item.id), research_id: id('draft', item.researchId), period_id: id('period', item.periodId), output_id: item.outputId ? id('output', `${item.researchId}/${item.outputId}`) : null,
      report_type: item.reportType, report_period: item.reportPeriod, status: item.status, payload: without(item.payload, ['file']), submitted_by: user(item.updatedBy), submitted_at: item.submittedAt, ...dates(item) });
    if (item.payload.file) add('research_report_files', { id: id('report-file', item.id), report_id: id('report', item.id), file_id: file(item.payload.file, `report/${item.id}`, item.updatedBy), category: item.payload.file.category, uploaded_at: item.submittedAt });
  });
  source.monevRecords.forEach(item => {
    add('research_monev', { id: id('monev', item.id), research_id: id('draft', item.researchId), period_id: id('period', item.periodId), period_label: item.periodLabel,
      status: item.status, payload: without(item.payload, ['evidence']), evaluated_by: user(item.evaluatedBy), published_at: item.publishedAt, ...dates(item) });
    if (item.payload.evidence) add('research_monev_files', { monev_id: id('monev', item.id), file_id: file(item.payload.evidence, `monev/${item.id}`, item.updatedBy), category: item.payload.evidence.category });
  });
  source.fundedReviewAssignments.forEach(item => add('funded_review_assignments', { id: id('funded-assignment', item.id), research_id: id('draft', item.researchId), target_type: item.targetType,
    monev_id: item.targetType === 'monev' ? id('monev', item.targetId) : null, report_id: item.targetType === 'report' ? id('report', item.targetId) : null, reviewer_id: user(item.reviewerUserId),
    status: item.status, assigned_by: user(item.assignedBy), assigned_at: item.assignedAt, due_at: item.dueAt, submitted_at: item.submittedAt }));
  source.fundedReviews.forEach(item => {
    add('funded_reviews', { id: id('funded-review', item.id), assignment_id: id('funded-assignment', item.assignmentId), recommendation: item.recommendation,
      total_score: item.totalScore, substance_notes: item.substanceNotes, technical_notes: item.technicalNotes, follow_up_notes: item.followUpNotes, submitted_at: item.submittedAt, updated_at: item.submittedAt });
    FUNDED_REVIEW_CRITERIA[item.targetType].forEach(criterion => add('funded_review_score_details', { review_id: id('funded-review', item.id), criteria_code: criterion.code,
      criteria_label: criterion.label, criteria_group: criterion.group, weight: criterion.weight, score: item.scores[criterion.code], weighted_score: (item.scores[criterion.code] * criterion.weight) / 100 }));
  });
  source.logbooks.forEach(item => add('research_logbooks', { id: id('logbook', item.id), research_id: id('draft', item.researchId), activity_date: item.date,
    start_time: item.startTime, end_time: item.endTime, description: item.description,
    payload: { fileCount: item.fileCount, ...(item.evidenceFiles ? { evidenceFiles: item.evidenceFiles } : {}) },
    created_by: user((source.drafts.find(draft => draft.id === item.researchId) || {}).userId) }));

  source.letterDefinitions.forEach(item => {
    const lifecycleStatus = item.deletedAt ? 'deleted'
      : item.active ? 'published'
        : (['draft', 'inactive'].includes(item.status) ? item.status : 'draft');
    add('letter_definitions', {
      id: id('letter-definition', item.id),
      name: item.name,
      description: item.description || '',
      letter_type: item.type,
      purpose: nullable(item.purpose),
      is_active: Boolean(item.active),
      lifecycle_status: lifecycleStatus,
      master_version: item.masterVersion || null,
      pending_draft: item.pendingDraft || null,
      deleted_at: item.deletedAt || null,
      deleted_by: user(item.deletedBy),
      version: item.version || 1,
      template_name: (item.template || {}).name || item.name || '',
      template_content: (item.template || {}).content || '',
      fields: item.fields || [],
      updated_by: user(item.updatedBy),
      ...dates(item),
    });
  });
  source.letterRequests.forEach(item => {
    const letterId = id('letter', item.id);
    add('letter_requests', { id: letterId, user_id: user(item.userId), created_by: user(item.createdBy), research_id: item.researchId ? id('draft', item.researchId) : null,
      definition_id: item.definitionId ? id('letter-definition', item.definitionId) : null, definition_version: item.definitionVersion, definition_name: item.definitionName,
      letter_type: item.type, purpose: nullable(item.purpose), custom_name: item.customName, status: item.status, auto_fill_snapshot: item.autoFill, form_data: item.form,
      submitted_at: item.submittedAt, data_submitted_at: item.dataSubmittedAt, letter_number: item.generated && item.generated.letterNumber,
      ...(item.generated && item.generated.fileId ? { generated_file_id: item.generated.fileId } : {}), generated_file_url: item.generated && item.generated.fileUrl, generated_at: item.generated && item.generated.generatedAt, ...dates(item) });
    item.applicants.forEach((applicant, index) => add('letter_applicants', { id: id('letter-applicant', `${item.id}/${index}`), letter_id: letterId, user_id: user(applicant.userId), name: applicant.name,
      identifier: applicant.identifier, applicant_role: applicant.applicantRole, applicant_kind: applicant.applicantKind, status: applicant.status, faculty: applicant.faculty,
      study_program: applicant.program, email: applicant.email, is_primary: applicant.isPrimary, position: index + 1 }));
    if (item.template) {
      const templateId = id('letter-template', item.id);
      add('letter_request_templates', { id: templateId, letter_id: letterId, template_name: item.template.name, content_template: item.template.content, template_format: 'docx', configured_by: user('user-admin-letter'), configured_at: timestamp(item.updatedAt) });
      item.templateFields.forEach((field, index) => {
        const fieldId = id('letter-field', `${item.id}/${field.id}`);
        add('letter_request_fields', { id: fieldId, template_id: templateId, field_key: field.key, field_label: field.label, field_type: field.type, is_required: field.required,
          placeholder: field.placeholder, help_text: field.helpText, options: field.options, position: index + 1 });
        if (Object.prototype.hasOwnProperty.call(item.form, field.key)) {
          add('letter_request_values', { id: id('letter-value', `${item.id}/${field.id}`), letter_id: letterId, template_id: templateId,
            field_id: fieldId, field_value: item.form[field.key], submitted_by: user(item.formEditedBy || item.userId), submitted_at: timestamp(item.dataSubmittedAt || item.updatedAt) });
        }
      });
    }
    item.history.forEach((event, index) => add('letter_status_history', { id: id('letter-history', `${item.id}/${index}`), letter_id: letterId,
      old_status: index ? item.history[index - 1].status : null, new_status: event.status, note: event.note, changed_by: user(event.by), changed_at: event.at }));
    if (item.generated) {
      add('generated_letters', { id: id('generated-letter', item.id), letter_id: letterId, letter_number: item.generated.letterNumber, file_name: item.generated.fileName,
        ...(item.generated.fileId ? { file_id: item.generated.fileId } : {}), file_url: item.generated.fileUrl, content_snapshot: item.generated.content, generated_by: user(item.generated.generatedBy || 'user-admin-letter'), generated_at: item.generated.generatedAt });
    }
  });

  source.externalResearchReports.forEach(item => {
    const reportId = id('external', item.id);
    add('external_research', { id: reportId, user_id: user(item.userId), created_by: user(item.createdBy), activity_name: item.activityName, research_title: item.researchTitle,
      activity_year: item.activityYear, activity_status: item.activityStatus, activity_type: item.activityType, role_in_research: item.roleInResearch || 'ketua', organizer_origin: item.organizerOrigin,
      funding_source: item.fundingSource, funding_amount: item.fundingAmount, currency: item.currency, submission_status: item.submissionStatus, category: item.category,
      metadata: without(item.metadata, ['sdgs', 'integrationProofFile']), type_detail: item.typeDetail, submitted_at: item.submittedAt, validated_at: item.validatedAt, archived_at: item.archivedAt, ...dates(item) });
    (item.metadata.sdgs || []).forEach(sdg => add('external_research_sdgs', { external_research_id: reportId, sdg_id: sdg }));
    (item.teamMembers || []).forEach((member, index) => add('external_research_members', {
      id: id('external-member', `${item.id}/${member.id}`), external_research_id: reportId,
      role: member.role || (index === 0 ? 'ketua' : 'anggota'), member_type: member.type,
      profile_id: profile(member.profileId), name: member.name, nidn: member.nidn, nim: member.nim,
      study_program: member.program, faculty: member.faculty, orcid: member.orcid, position: index + 1,
    }));
    item.outputs.forEach((output, index) => add('external_research_outputs', { id: id('external-output', output.id), external_research_id: reportId, output_type: output.outputType, title: output.title,
      year: output.year, description: output.description, link: output.link, position: index + 1 }));
    [...item.documents, ...(item.metadata.integrationProofFile ? [{ ...item.metadata.integrationProofFile, fileType: 'integration_proof' }] : [])].filter(document => document.name || document.fileName).forEach(document => add('external_research_files', {
      id: id('external-file', document.id), external_research_id: reportId, file_type: document.fileType, display_name: document.label || null, file_id: file(document, `external/${item.id}/${document.id}`, item.userId),
      uploaded_by: user(document.uploadedBy || item.userId), uploaded_at: timestamp(document.uploadedAt || item.createdAt) }));
    item.reviews.forEach(review => add('external_research_reviews', { id: id('external-review', review.id), external_research_id: reportId, reviewer_id: user(review.reviewerId), decision: review.decision,
      notes: review.notes, checklist: review.checklist, reviewed_at: review.reviewedAt }));
    item.history.forEach((event, index) => add('external_research_history', { id: id('external-history', `${item.id}/${index}`), external_research_id: reportId,
      old_status: index ? item.history[index - 1].status : null, new_status: event.status, note: event.note, changed_by: user(event.by), changed_at: event.at }));
  });
  source.systemActivityLogs.forEach(item => add('system_activity_logs', { id: id('audit', item.id), user_id: user(item.userId), action: item.action, entity_type: item.entityType,
    entity_id: item.entityType === 'researcher_profile' ? profile(item.entityId) : null, old_data: item.oldData, new_data: item.newData, created_at: item.createdAt }));
  (source.reviewerReminders || []).forEach(item => add('reviewer_reminders', {
    id: id('reviewer-reminder', item.id), assignment_id: id('proposal-assignment', item.assignmentId),
    sent_by: user(item.sentBy), channel: item.channel || 'both', message: item.message || null,
    sent_at: timestamp(item.sentAt),
  }));
  (source.fundedReviewerReminders || []).forEach(item => add('funded_reviewer_reminders', {
    id: id('funded-reviewer-reminder', item.id), assignment_id: id('funded-assignment', item.assignmentId),
    sent_by: user(item.sentBy), channel: item.channel || 'both', message: item.message || null,
    sent_at: timestamp(item.sentAt),
  }));
  (source.notifications || []).forEach(item => add('notifications', {
    id: id('notification', item.id || item.notificationId), user_id: user(item.userId || item.recipientUserId),
    from_user_id: item.fromUserId ? user(item.fromUserId) : null,
    notification_type: item.type || item.notificationType || 'general',
    priority: ['low', 'normal', 'high', 'critical'].includes(item.priority) ? item.priority : 'normal',
    title: item.title || 'Pemberitahuan RIS', message: item.message || '',
    entity_type: item.entityType || null,
    entity_id: item.entityId ? id('notification-entity', `${item.entityType || 'system'}/${item.entityId}`) : null,
    action_path: item.actionPath || null, action_label: item.actionLabel || null,
    manager_mode: item.managerMode || null, is_read: Boolean(item.isRead),
    read_at: item.isRead ? (item.readAt || timestamp(item.createdAt)) : null,
    created_at: timestamp(item.createdAt),
  }));
  (source.emailOutbox || []).forEach(item => add('email_outbox', {
    id: id('email', item.id || item.emailId), recipient_user_id: user(item.recipientUserId || item.userId),
    recipient_email: item.recipientEmail || item.to, subject: item.subject,
    body_text: item.bodyText || item.message || null, body_html: item.bodyHtml || null,
    template_key: item.templateKey || null, notification_type: item.notificationType || item.type || 'general',
    entity_type: item.entityType || null,
    entity_id: item.entityId ? id('email-entity', `${item.entityType || 'system'}/${item.entityId}`) : null,
    action_path: item.actionPath || null,
    priority: ['low', 'normal', 'high', 'critical'].includes(item.priority) ? item.priority : 'normal',
    delivery_mode: item.deliveryMode || 'immediate',
    deduplication_key: item.deduplicationKey || item.id,
    source_event_id: item.sourceEventId || null, payload: item.payload || {}, status: item.status || 'queued',
    attempts: item.attempts || 0, available_at: timestamp(item.availableAt || item.queuedAt),
    created_at: timestamp(item.queuedAt || item.createdAt), updated_at: timestamp(item.updatedAt || item.queuedAt || item.createdAt),
  }));
  return { tables, source };
};

const renderRows = tables => {
  // Sort by schema declaration order, so every foreign key resolves on INSERT.
  const schema = fs.readFileSync(path.resolve(__dirname, '../../database.sql'), 'utf8');
  const order = [...schema.matchAll(/^CREATE TABLE (\w+) \(/gm)].map(match => match[1]);
  [...tables.keys()].forEach(table => { if (!order.includes(table)) throw new Error(`Missing table ${table} in database.sql`); });
  return order.filter(table => tables.has(table)).map(table => {
    const rows = tables.get(table);
    const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
    const value = (column, item) => {
      if (column === 'password_hash') return `crypt(${sql(item.seedPassword)}, gen_salt('bf', 12))`;
      if (column === 'field_value') return `${sql(JSON.stringify(item))}::jsonb`;
      return sql(item);
    };
    return `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${rows.map(row => `  (${columns.map(column => value(column, row[column])).join(', ')})`).join(',\n')};`;
  }).join('\n\n');
};

const generateSeedSql = () => {
  const accounts = renderRows(buildSeedRows('accounts').tables);
  return `${MARKER}
-- Generated by: node internals/scripts/generate-database-seed.js
-- Source: normalized app/containers/Ris/core/data.js. Run with TZ=Asia/Jakarta.
-- IDs are deterministic UUIDs; repeated child IDs are scoped to their parent.
-- This deploy seed includes reference catalogs and seven test accounts only.
-- Reviewer is a lecturer account that receives reviewer access only by assignment.

-- BEGIN SEED: CLEAN NEON TESTING (ACTIVE)
-- Replace RIS_TEST_ACCOUNT_PASSWORD_CHANGE_ME before running this public test seed.
${accounts}
-- END SEED

COMMIT;
`;
};

if (require.main === module) {
  process.env.NODE_ENV = 'test';
  process.env.TZ = 'Asia/Jakarta';
  require('@babel/register')();
  const filePath = path.resolve(__dirname, '../../database.sql');
  const current = fs.readFileSync(filePath, 'utf8');
  const marker = current.includes(MARKER) ? MARKER : '-- Static lookup seed.';
  const boundary = current.indexOf(marker);
  if (boundary < 0) throw new Error('Seed boundary not found');
  const next = `${current.slice(0, boundary)}${generateSeedSql()}`;
  if (process.argv.includes('--check')) {
    if (next.replace(/\r\n/g, '\n') !== current.replace(/\r\n/g, '\n')) throw new Error('database.sql seeds differ from data.js. Regenerate them.');
    console.log('Database seeds match normalized frontend data.');
  } else {
    fs.writeFileSync(filePath, next, 'utf8');
    console.log('Regenerated database.sql with clean Neon testing accounts.');
  }
}

module.exports = { ACCOUNT_SEED_IDS, buildSeedRows, generateSeedSql, id, loadFrontend, renderRows, sql };
