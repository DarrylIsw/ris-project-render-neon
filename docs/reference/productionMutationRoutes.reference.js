/*
 * PRODUCTION MUTATION ROUTES - INTENTIONALLY COMMENTED OUT
 *
 * Keep this file commented while the prototype still uses browser state.
 * Uncomment route groups only after their controller, authorization policy,
 * validation schema, migration, and transaction tests are ready.
 *
 * const express = require('express');
 * const { requireUser, requireRole, requireAdminScope, requireProposalReviewer, requireFundedResearchReviewer, requireResearchApplicant, requireLetterApplicant } = require('../../server/middlewares/auth');
 * const controller = require('./controllers/productionMutationController');
 * const router = express.Router();
 *
 * router.use(requireUser);
 *
 * router.post('/research/schemes', requireAdminScope('research_management'), controller.createScheme);
 * router.patch('/research/schemes/:schemeId', requireAdminScope('research_management'), controller.updateScheme);
 * router.post('/research/schemes/:schemeId/registration/reopen', requireAdminScope('research_management'), controller.reopenSchemeRegistration);
 * router.put('/research/schemes/:schemeId/reporting-periods', requireAdminScope('research_management'), controller.replaceReportingPeriods);
 * router.post('/research/schemes/:schemeId/reporting-periods/:periodId/reopen', requireAdminScope('research_management'), controller.reopenReportingPeriod);
 *
 * router.post('/research/drafts', requireResearchApplicant, controller.createDraft);
 * router.put('/research/drafts/:draftId', requireResearchApplicant, controller.saveDraft);
 * router.delete('/research/drafts/:draftId', requireResearchApplicant, controller.removeDraft);
 * router.post('/research/drafts/:draftId/submit', requireResearchApplicant, controller.submitDraft);
 * router.post('/research/drafts/:draftId/verification', requireAdminScope('research_management'), controller.verifyDraft);
 * router.put('/research/drafts/:draftId/reviewer-assignments', requireAdminScope('research_management'), controller.assignReviewers);
 * router.post('/research/drafts/:draftId/reviewer-reminders', requireAdminScope('research_management'), controller.remindReviewers);
 * router.post('/research/drafts/:draftId/review', requireProposalReviewer, controller.submitReview);
 * router.post('/research/drafts/:draftId/decision', requireAdminScope('research_management'), controller.decideDraft);
 * router.put('/research/drafts/:draftId/contract', requireRole('lecturer', 'manager', 'super_admin'), controller.saveContract);
 *
 * router.put('/research/:researchId/reports/:periodId', requireResearchApplicant, controller.upsertInternalReport);
 * router.post('/research/:researchId/reports/:periodId/submit', requireResearchApplicant, controller.submitInternalReport);
 * router.post('/research/:researchId/reports/:reportId/decision', requireAdminScope('research_management'), controller.decideInternalReport);
 * router.put('/research/:researchId/monev/:periodId', requireAdminScope('research_management'), controller.upsertMonevEvaluation);
 * router.post('/research/:researchId/monev/:periodId/publish', requireAdminScope('research_management'), controller.publishMonevEvaluation);
 * router.put('/research/funded-reviews/:targetType/:targetId/assignments', requireAdminScope('research_management'), controller.assignFundedReviewers);
 * router.post('/research/funded-reviews/:targetType/:targetId/reminders', requireAdminScope('research_management'), controller.remindFundedReviewers);
 * router.post('/research/funded-reviews/:targetType/:targetId/submission', requireFundedResearchReviewer, controller.submitFundedReview);
 * router.post('/research/:researchId/logbooks', requireResearchApplicant, controller.createLogbook);
 * router.put('/research/:researchId/logbooks/:entryId', requireResearchApplicant, controller.updateLogbook);
 * router.delete('/research/:researchId/logbooks/:entryId', requireResearchApplicant, controller.removeLogbook);
 *
 * router.post('/letters', requireLetterApplicant, controller.createLetterRequest);
 * router.post('/letters/:letterId/accept', requireAdminScope('letter_management'), controller.acceptLetterRequest);
 * router.post('/letters/:letterId/reject', requireAdminScope('letter_management'), controller.rejectLetterRequest);
 * router.put('/letters/:letterId/form', requireAdminScope('letter_management'), controller.publishLetterForm);
 * router.post('/letters/:letterId/data', requireLetterApplicant, controller.submitLetterData);
 * router.post('/letters/:letterId/revision', requireAdminScope('letter_management'), controller.requestLetterRevision);
 * router.post('/letters/:letterId/issue', requireAdminScope('letter_management'), controller.issueLetter);
 *
 * router.post('/external-research', requireRole('lecturer', 'manager', 'super_admin'), controller.createExternalResearch);
 * router.put('/external-research/:reportId', requireRole('lecturer', 'manager', 'super_admin'), controller.saveExternalResearch);
 * router.post('/external-research/:reportId/submit', requireRole('lecturer', 'manager', 'super_admin'), controller.submitExternalResearch);
 * router.post('/external-research/:reportId/review', requireAdminScope('research_management'), controller.reviewExternalResearch);
 * router.post('/external-research/:reportId/archive', requireAdminScope('research_management'), controller.archiveExternalResearch);
 *
 * router.post('/researcher-profiles', requireAdminScope('researcher_profile_management'), controller.createProfileWithAccount);
 * router.put('/researcher-profiles/:profileId', controller.updateProfile);
 * router.post('/researcher-profiles/:profileId/verification', requireAdminScope('researcher_profile_management'), controller.verifyProfile);
 * router.patch('/researcher-profiles/:profileId/account-status', requireAdminScope('researcher_profile_management'), controller.setAccountStatus);
 * router.put('/researcher-profiles/:profileId/admin-assignment', requireRole('manager', 'super_admin'), controller.assignProfileAdmin);
 * router.put('/users/:userId/admin-scopes', requireRole('manager', 'super_admin'), controller.replaceAdminScopes);
 *
 * router.get('/archive/research', requireRole('manager', 'super_admin'), controller.listArchivedResearch);
 * router.get('/archive/users', requireRole('manager', 'super_admin'), controller.listArchivedUsers);
 * router.patch('/archive/research/:source/:researchId/metadata', requireRole('manager', 'super_admin'), controller.updateArchivedResearchMetadata);
 * router.patch('/archive/users/:userId', requireRole('manager', 'super_admin'), controller.updateArchivedUser);
 *
 * module.exports = router;
 *
 * Every controller above must:
 * - validate request bodies before opening a transaction;
 * - load the target row FOR UPDATE and authorize ownership/state server-side;
 * - reject stale writes with a version or updated_at precondition;
 * - commit domain rows, system_activity_logs, notifications, and email_outbox atomically;
 * - use an idempotency key for submit/review/decision/generate operations;
 * - return the committed aggregate, never trust a frontend-calculated status;
 * - upload files to object storage first and persist only checked metadata/URLs.
 * - treat Manager mode as a frontend presentation choice; authorize Manager's management and applicant capabilities independently on the server.
 * - require a positive scheme maximumBudget and exactly one final reporting period when creating or replacing a scheme schedule.
 * - recalculate every budget line server-side and reject proposal submission when the aggregate exceeds the scheme maximumBudget.
 */
