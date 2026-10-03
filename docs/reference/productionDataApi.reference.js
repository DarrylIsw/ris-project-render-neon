/*
 * PRODUCTION DATA API REFERENCE - INTENTIONALLY COMMENTED OUT
 *
 * Historical domain-command reference. The running UI already uses the
 * authenticated PostgreSQL gateway in RisContext/dataGateway. This file is
 * not runtime code. Use it when replacing aggregate state writes with
 * narrower validated endpoints; do not restore localStorage persistence.
 *
 * const JSON_HEADERS = { 'Content-Type': 'application/json' };
 *
 * const createRequestId = () => `web_${Date.now()}_${Math.random().toString(16).slice(2)}`;
 * const createIdempotencyKey = operation => `${operation}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
 *
 * const request = async (path, options = {}) => {
 *   const response = await fetch(`/api${path}`, {
 *     credentials: 'include',
 *     ...options,
 *     headers: {
 *       ...(options.body instanceof FormData ? {} : JSON_HEADERS),
 *       'x-request-id': createRequestId(),
 *       ...(options.headers || {}),
 *     },
 *   });
 *   const payload = response.status === 204 ? null : await response.json();
 *   if (!response.ok) {
 *     const error = new Error((payload && payload.message) || 'Permintaan data gagal.');
 *     error.code = payload && payload.code;
 *     error.requestId = (payload && payload.requestId) || response.headers.get('x-request-id');
 *     throw error;
 *   }
 *   return payload;
 * };
 *
 * const mutate = (path, method, body, operation) => request(path, {
 *   method,
 *   body: body === undefined ? undefined : JSON.stringify(body),
 *   headers: { 'x-idempotency-key': createIdempotencyKey(operation) },
 * });
 *
 * export const productionDataApi = {
 *   auth: {
 *     login: credentials => mutate('/auth/login', 'POST', credentials, 'auth_login'),
 *     logout: () => mutate('/auth/logout', 'POST', {}, 'auth_logout'),
 *     session: () => request('/auth/session'),
 *   },
 *
 *   schemes: {
 *     list: () => request('/research/schemes'),
 *     create: scheme => mutate('/research/schemes', 'POST', scheme, 'scheme_create'),
 *     update: (schemeId, changes) => mutate(`/research/schemes/${schemeId}`, 'PATCH', changes, 'scheme_update'),
 *     reopenRegistration: (schemeId, deadline) => mutate(`/research/schemes/${schemeId}/registration/reopen`, 'POST', { deadline }, 'scheme_registration_reopen'),
 *     replaceReportingSchedule: (schemeId, periods) => mutate(`/research/schemes/${schemeId}/reporting-periods`, 'PUT', { periods }, 'scheme_reporting_schedule'),
 *     reopenReportingPeriod: (schemeId, periodId, deadline) => mutate(`/research/schemes/${schemeId}/reporting-periods/${periodId}/reopen`, 'POST', { deadline }, 'reporting_period_reopen'),
 *   },
 *
 *   proposals: {
 *     list: () => request('/research/drafts'),
 *     createDraft: draft => mutate('/research/drafts', 'POST', draft, 'proposal_draft_create'),
 *     saveDraft: (draftId, draft, version) => mutate(`/research/drafts/${draftId}`, 'PUT', { draft, version }, 'proposal_draft_save'),
 *     removeDraft: draftId => mutate(`/research/drafts/${draftId}`, 'DELETE', undefined, 'proposal_draft_delete'),
 *     submit: draftId => mutate(`/research/drafts/${draftId}/submit`, 'POST', {}, 'proposal_submit'),
 *     verify: (draftId, verification) => mutate(`/research/drafts/${draftId}/verification`, 'POST', verification, 'proposal_verify'),
 *     assignReviewers: (draftId, reviewerIds) => mutate(`/research/drafts/${draftId}/reviewer-assignments`, 'PUT', { reviewerIds }, 'reviewers_assign'),
 *     remindReviewers: draftId => mutate(`/research/drafts/${draftId}/reviewer-reminders`, 'POST', {}, 'reviewers_remind'),
 *     submitReview: (draftId, review) => mutate(`/research/drafts/${draftId}/review`, 'POST', review, 'review_submit'),
 *     decide: (draftId, decision) => mutate(`/research/drafts/${draftId}/decision`, 'POST', decision, 'proposal_decide'),
 *     saveContract: (draftId, contract) => mutate(`/research/drafts/${draftId}/contract`, 'PUT', contract, 'contract_save'),
 *   },
 *
 *   internalReports: {
 *     list: researchId => request(`/research/${researchId}/reports`),
 *     upsert: (researchId, periodId, report) => mutate(`/research/${researchId}/reports/${periodId}`, 'PUT', report, 'internal_report_save'),
 *     submit: (researchId, periodId) => mutate(`/research/${researchId}/reports/${periodId}/submit`, 'POST', {}, 'internal_report_submit'),
 *     managementDecision: (researchId, reportId, decision) => mutate(`/research/${researchId}/reports/${reportId}/decision`, 'POST', decision, 'internal_report_decision'),
 *   },
 *   monev: {
 *     list: researchId => request(`/research/${researchId}/monev`),
 *     upsertEvaluation: (researchId, periodId, payload) => mutate(`/research/${researchId}/monev/${periodId}`, 'PUT', payload, 'monev_evaluation_save'),
 *     publish: (researchId, periodId) => mutate(`/research/${researchId}/monev/${periodId}/publish`, 'POST', {}, 'monev_publish'),
 *   },
 *   fundedReviews: {
 *     list: researchId => request(`/research/${researchId}/funded-reviews`),
 *     replaceAssignments: (targetType, targetId, reviewerIds, dueAt) => mutate(`/research/funded-reviews/${targetType}/${targetId}/assignments`, 'PUT', { reviewerIds, dueAt }, 'funded_reviewers_assign'),
 *     remind: (targetType, targetId) => mutate(`/research/funded-reviews/${targetType}/${targetId}/reminders`, 'POST', {}, 'funded_reviewers_remind'),
 *     submit: (targetType, targetId, review) => mutate(`/research/funded-reviews/${targetType}/${targetId}/submission`, 'POST', review, 'funded_review_submit'),
 *   },
 *
 *   logbooks: {
 *     list: researchId => request(`/research/${researchId}/logbooks`),
 *     create: (researchId, entry) => mutate(`/research/${researchId}/logbooks`, 'POST', entry, 'logbook_create'),
 *     update: (researchId, entryId, entry) => mutate(`/research/${researchId}/logbooks/${entryId}`, 'PUT', entry, 'logbook_update'),
 *     remove: (researchId, entryId) => mutate(`/research/${researchId}/logbooks/${entryId}`, 'DELETE', undefined, 'logbook_delete'),
 *   },
 *
 *   letters: {
 *     list: () => request('/letters'),
 *     createRequest: requestData => mutate('/letters', 'POST', requestData, 'letter_request_create'),
 *     acceptRequest: (letterId, notes) => mutate(`/letters/${letterId}/accept`, 'POST', { notes }, 'letter_request_accept'),
 *     rejectRequest: (letterId, notes) => mutate(`/letters/${letterId}/reject`, 'POST', { notes }, 'letter_request_reject'),
 *     publishForm: (letterId, template, fields, version) => mutate(`/letters/${letterId}/form`, 'PUT', { template, fields, version }, 'letter_form_publish'),
 *     submitData: (letterId, values, version) => mutate(`/letters/${letterId}/data`, 'POST', { values, version }, 'letter_data_submit'),
 *     requestRevision: (letterId, notes) => mutate(`/letters/${letterId}/revision`, 'POST', { notes }, 'letter_data_revision'),
 *     issue: (letterId, notes) => mutate(`/letters/${letterId}/issue`, 'POST', { notes }, 'letter_issue'),
 *   },
 *
 *   externalResearch: {
 *     list: () => request('/external-research'),
 *     createDraft: report => mutate('/external-research', 'POST', report, 'external_research_create'),
 *     saveDraft: (reportId, report, version) => mutate(`/external-research/${reportId}`, 'PUT', { report, version }, 'external_research_save'),
 *     submit: reportId => mutate(`/external-research/${reportId}/submit`, 'POST', {}, 'external_research_submit'),
 *     review: (reportId, review) => mutate(`/external-research/${reportId}/review`, 'POST', review, 'external_research_review'),
 *     archive: reportId => mutate(`/external-research/${reportId}/archive`, 'POST', {}, 'external_research_archive'),
 *   },
 *
 *   profiles: {
 *     list: () => request('/researcher-profiles'),
 *     createWithAccount: payload => mutate('/researcher-profiles', 'POST', payload, 'profile_create'),
 *     update: (profileId, profile, version) => mutate(`/researcher-profiles/${profileId}`, 'PUT', { profile, version }, 'profile_update'),
 *     verify: (profileId, verification) => mutate(`/researcher-profiles/${profileId}/verification`, 'POST', verification, 'profile_verify'),
 *     setAccountActive: (profileId, isActive, reason) => mutate(`/researcher-profiles/${profileId}/account-status`, 'PATCH', { isActive, reason }, 'account_status_change'),
 *     assignAdmin: (profileId, adminId) => mutate(`/researcher-profiles/${profileId}/admin-assignment`, 'PUT', { adminId }, 'profile_admin_assign'),
 *   },
 *
 *   accounts: {
 *     replaceAdminScopes: (userId, adminScopes) => mutate(`/users/${userId}/admin-scopes`, 'PUT', { adminScopes }, 'admin_scopes_replace'),
 *   },
 *
 *   archive: {
 *     research: filters => request(`/archive/research?${new URLSearchParams(filters || {})}`),
 *     users: filters => request(`/archive/users?${new URLSearchParams(filters || {})}`),
 *     updateResearchMetadata: (source, researchId, changes) => mutate(`/archive/research/${source}/${researchId}/metadata`, 'PATCH', changes, 'archive_research_metadata_update'),
 *     updateUser: (userId, changes) => mutate(`/archive/users/${userId}`, 'PATCH', changes, 'archive_user_update'),
 *   },
 *
 *   uploads: {
 *     create: async (scope, entityId, file, category) => {
 *       const form = new FormData();
 *       form.append('file', file);
 *       form.append('category', category);
 *       return request(`/uploads/${scope}/${entityId}`, { method: 'POST', body: form });
 *     },
 *     remove: fileId => mutate(`/uploads/${fileId}`, 'DELETE', undefined, 'file_delete'),
 *   },
 * };
 *
 * Production migration order for each UI handler:
 * 1. Await the matching API method.
 * 2. Replace local state from the API response or invalidate/refetch the query.
 * 3. Show the returned requestId in error UI for support diagnostics.
 * 4. Do not keep passwords, authorization tokens, or uploaded file contents in localStorage.
 */
