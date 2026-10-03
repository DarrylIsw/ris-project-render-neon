/* eslint-disable object-curly-newline, object-property-newline */
import {
  STATUS,
  canManageResearch,
  canEditDraft,
  draftId,
  draftOwnerId,
  draftSchemeId,
  draftStatus,
  draftReviewerAssignments,
  isEligibleForScheme,
  isOpenScheme,
} from '../../../shared/workflows/workflow';
import { createActivityLog } from '../../profiles/workflows/researcherProfileWorkflow';

const STATUS_PRIORITY = {
  [STATUS.DRAFT]: 80,
  [STATUS.REVISION]: 70,
  [STATUS.FUNDED]: 60,
  [STATUS.REVIEWED]: 50,
  [STATUS.UNDER_REVIEW]: 40,
  [STATUS.SUBMITTED]: 30,
  [STATUS.REJECTED]: 20,
};

const draftTimestamp = draft => new Date(draft.updatedAt || draft.lastSavedAt || draft.submittedAt || draft.createdAt || 0).getTime();

export const getUserDrafts = (data, user) => (data.drafts || []).filter(draft => draftStatus(draft) !== STATUS.ARCHIVED && draftOwnerId(draft) === (user && user.id));

export const getUserDraftForScheme = (data, user, schemeId) => getUserDrafts(data, user)
  .filter(draft => draftSchemeId(draft) === schemeId)
  .sort((left, right) => {
    const priority = (STATUS_PRIORITY[draftStatus(right)] || 0) - (STATUS_PRIORITY[draftStatus(left)] || 0);
    return priority || draftTimestamp(right) - draftTimestamp(left);
  })[0] || null;

export const getSchemeCatalogMetrics = (data, user) => {
  const schemes = (data.schemes || []).filter(scheme => !scheme.deletedAt);
  const drafts = getUserDrafts(data, user);
  const opened = schemes.filter(isOpenScheme);
  const eligible = opened.filter(scheme => isEligibleForScheme(scheme, user));
  const ready = eligible.filter(scheme => !getUserDraftForScheme(data, user, scheme.id));
  return {
    opened: opened.length,
    eligible: eligible.length,
    applications: drafts.length,
    ready: ready.length,
    funded: drafts.filter(draft => draftStatus(draft) === STATUS.FUNDED).length,
  };
};

export const partitionSchemeCatalog = (schemes, data, user) => schemes.reduce((sections, scheme) => {
  if (scheme.deletedAt) return sections;
  const draft = getUserDraftForScheme(data, user, scheme.id);
  const item = { scheme, draft };
  if (draft && draftStatus(draft) === STATUS.FUNDED) return sections;
  if (draft && canEditDraft(draft, user)) sections.drafts.push(item);
  else if (draft) sections.applications.push(item);
  else if (isOpenScheme(scheme) && isEligibleForScheme(scheme, user)) sections.eligible.push(item);
  else sections.catalog.push(item);
  return sections;
}, { drafts: [], applications: [], eligible: [], catalog: [] });

export const canDeleteProposalDraft = (draft, user) => Boolean(
  draft
  && draftStatus(draft) === STATUS.DRAFT
  && draftOwnerId(draft) === (user && user.id)
);

export const deleteProposalDraftData = (data, draft) => {
  const id = draftId(draft);
  return {
    ...data,
    drafts: (data.drafts || []).filter(item => draftId(item) !== id),
    logbooks: (data.logbooks || []).filter(item => item.researchId !== id && item.proposalId !== id),
    internalReports: (data.internalReports || []).filter(item => item.researchId !== id && item.proposalId !== id),
    monevRecords: (data.monevRecords || []).filter(item => item.researchId !== id && item.proposalId !== id),
    temporaryRoleAssignments: (data.temporaryRoleAssignments || []).filter(item => item.entityId !== id),
    notifications: (data.notifications || []).filter(item => item.entityId !== id && item.researchId !== id),
  };
};

export const getSchemeDeletionError = (data, schemeId) => {
  if (!(data.schemes || []).some(scheme => scheme.id === schemeId && !scheme.deletedAt)) return 'Skema tidak ditemukan atau sudah dihapus.';
  const hasFundingDecision = decision => decision && ['funded', 'approved'].includes(decision.finalDecision || decision.decision);
  const funded = (data.drafts || []).some(draft => draftSchemeId(draft) === schemeId && (draftStatus(draft) === STATUS.FUNDED || draft.fundedAt || draft.fundingLetter || hasFundingDecision(draft.decision) || (draft.decisionHistory || []).some(hasFundingDecision)))
    || (data.fundedResearch || []).some(research => draftSchemeId(research) === schemeId);
  return funded ? 'Skema tidak dapat dihapus karena sudah memiliki penelitian yang didanai.' : '';
};

export const deleteResearchSchemeData = (data, schemeId, user, uid) => {
  if (!canManageResearch(user)) throw new Error('Anda tidak memiliki akses untuk menghapus skema penelitian.');
  const error = getSchemeDeletionError(data, schemeId);
  if (error) throw new Error(error);
  const scheme = data.schemes.find(record => record.id === schemeId);
  const archivedAt = new Date().toISOString();
  const relatedIds = new Set((data.drafts || []).filter(draft => draftSchemeId(draft) === schemeId).map(draftId));
  const deletedScheme = { ...scheme, status: 'archived', schemeStatus: 'archived', archivedAt, deletedAt: archivedAt, deletedBy: user.id, updatedAt: archivedAt };
  const belongsToScheme = record => (record.entityType === 'scheme' && record.entityId === schemeId) || relatedIds.has(record.entityId) || relatedIds.has(record.researchId);
  return {
    ...data,
    // Keep the original scheme for archive joins and prevent demo reseeding on reload.
    schemes: data.schemes.map(record => (record.id === schemeId ? deletedScheme : record)),
    drafts: (data.drafts || []).map(draft => (relatedIds.has(draftId(draft)) ? {
      ...draft,
      status: STATUS.ARCHIVED,
      draftStatus: STATUS.ARCHIVED,
      archivedAt: draft.archivedAt || archivedAt,
      archivedBy: user.id,
      archiveMetadata: { ...draft.archiveMetadata, previousStatus: (draft.archiveMetadata && draft.archiveMetadata.previousStatus) || draftStatus(draft), reason: 'scheme_deleted', schemeId },
      assignments: draftReviewerAssignments(draft).map(assignment => ({ ...assignment, status: 'revoked', revokedAt: assignment.revokedAt || archivedAt, revokedBy: assignment.revokedBy || user.id })),
      updatedAt: archivedAt,
    } : draft)),
    temporaryRoleAssignments: (data.temporaryRoleAssignments || []).map(grant => (relatedIds.has(grant.entityId) ? { ...grant, status: 'revoked', revokedAt: archivedAt, revokedBy: user.id } : grant)),
    notifications: (data.notifications || []).filter(record => !belongsToScheme(record)),
    emailOutbox: (data.emailOutbox || []).map(record => (belongsToScheme(record) && record.status === 'queued' ? { ...record, status: 'cancelled', updatedAt: archivedAt, errorMessage: null } : record)),
    systemActivityLogs: [...(data.systemActivityLogs || []), createActivityLog(user, 'delete_research_scheme', 'scheme', schemeId, scheme, deletedScheme, uid)],
  };
};
