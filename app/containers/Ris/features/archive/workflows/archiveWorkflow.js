/* eslint-disable object-curly-newline, object-property-newline */
import { STATUS_META } from '../../../core/data';
import {
  EXTERNAL_STATUS_META, externalReportTitle, externalStatus
} from '../../externalResearch/workflows/externalResearchWorkflow';
import {
  ROLE, draftStatus, getSchemeTitle, normalizeRole
} from '../../../shared/workflows/workflow';
import {
  PROFILE_STATUS, createActivityLog, createStatusHistory, syncProfileToDomainData
} from '../../profiles/workflows/researcherProfileWorkflow';

export const ARCHIVE_SOURCE = { INTERNAL: 'internal', EXTERNAL: 'external' };

const array = value => (Array.isArray(value) ? value : []);
const dateValue = value => {
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
};

const latestTimestamp = values => {
  const latest = values.reduce((result, value) => Math.max(result, dateValue(value)), 0);
  return latest ? new Date(latest).toISOString() : null;
};

const internalRecord = (data, draft) => {
  const scheme = array(data.schemes).find(item => item.id === draft.schemeId);
  const account = array(data.systemUsers).find(item => item.id === draft.userId);
  const monev = array(data.monevRecords).filter(item => item.researchId === draft.id);
  const reports = array(data.internalReports).filter(item => item.researchId === draft.id);
  const logbooks = array(data.logbooks).filter(item => item.researchId === draft.id);
  const fundedAssignments = array(data.fundedReviewAssignments).filter(item => item.researchId === draft.id);
  const fundedReviews = array(data.fundedReviews).filter(item => item.researchId === draft.id);
  const proposalAssignments = array(draft.assignments);
  const proposalReviews = array(draft.reviews);
  const progressReports = reports.filter(item => item.reportType !== 'output');
  const outputReports = reports.filter(item => item.reportType === 'output');
  const status = draftStatus(draft);
  const coverage = {
    members: array(draft.members).length,
    budgetItems: array(draft.budgets).length,
    outputs: array(draft.outputs).length,
    attachments: array(draft.files).length,
    proposalAssignments: proposalAssignments.length,
    proposalReviews: proposalReviews.length,
    verification: draft.verification ? 1 : 0,
    decision: draft.decision ? 1 : 0,
    fundingLetter: draft.fundingLetter ? 1 : 0,
    reportingPeriods: array(scheme && scheme.reportingSchedule).length,
    schemeOutputOptions: array(scheme && scheme.outputOptions).length,
    schemeAttachments: array(scheme && scheme.attachmentRequirements).length,
    contract: draft.contract ? 1 : 0,
    monev: monev.length,
    progressReports: progressReports.length,
    outputReports: outputReports.length,
    fundedAssignments: fundedAssignments.length,
    fundedReviews: fundedReviews.length,
    logbooks: logbooks.length,
  };
  const executionDates = [
    ...monev.flatMap(item => [item.updatedAt, item.publishedAt, item.submittedAt]),
    ...reports.flatMap(item => [item.updatedAt, item.submittedAt]),
    ...logbooks.flatMap(item => [item.updatedAt, item.date]),
    ...fundedAssignments.flatMap(item => [item.assignedAt, item.submittedAt, item.revokedAt]),
    ...fundedReviews.map(item => item.submittedAt),
  ];
  const hasExecutionData = Boolean(coverage.contract || coverage.monev || reports.length || coverage.logbooks || coverage.fundedAssignments);
  return {
    id: draft.id,
    source: ARCHIVE_SOURCE.INTERNAL,
    title: (draft.project && draft.project.title) || 'Tanpa judul',
    ownerId: draft.userId,
    ownerName: draft.userName || (account && account.name) || '-',
    year: (scheme && (scheme.year || String(scheme.startDate || '').slice(0, 4))) || '-',
    context: getSchemeTitle(scheme),
    status,
    statusMeta: STATUS_META[status] || STATUS_META.draft,
    updatedAt: latestTimestamp([draft.updatedAt, draft.lastSavedAt, draft.submittedAt, ...executionDates]),
    archiveMetadata: draft.archiveMetadata || {},
    coverage,
    contractStatus: (draft.contract && (draft.contract.status || draft.contract.contractStatus)) || 'belum tersedia',
    verificationStatus: (draft.verification && draft.verification.status) || 'belum diverifikasi',
    decisionStatus: (draft.decision && (draft.decision.finalDecision || draft.decision.decision)) || 'belum diputuskan',
    fundingLetterNumber: (draft.fundingLetter && (draft.fundingLetter.number || draft.fundingLetter.letterNumber)) || 'belum tersedia',
    hasExecutionData,
    coverageLabel: hasExecutionData
      ? `${coverage.monev} Monev, ${progressReports.length + outputReports.length} laporan, ${coverage.logbooks} logbook`
      : `${coverage.outputs} luaran, ${coverage.attachments} lampiran, ${coverage.proposalReviews} review`,
    draft,
    scheme,
  };
};

const externalRecord = (data, report) => {
  const account = array(data.systemUsers).find(item => item.id === report.userId);
  const status = externalStatus(report);
  const coverage = {
    documents: array(report.documents).length,
    outputs: array(report.outputs).length,
    reviews: array(report.reviews).length,
    history: array(report.history).length,
  };
  return {
    id: report.id,
    source: ARCHIVE_SOURCE.EXTERNAL,
    title: externalReportTitle(report),
    ownerId: report.userId,
    ownerName: report.userName || (account && account.name) || '-',
    year: report.activityYear || '-',
    context: report.category || report.activityType || '-',
    status,
    statusMeta: EXTERNAL_STATUS_META[status] || EXTERNAL_STATUS_META.draft,
    updatedAt: latestTimestamp([report.updatedAt, report.submittedAt, report.validatedAt, report.archivedAt, ...array(report.history).map(item => item.at)]),
    archiveMetadata: report.archiveMetadata || {},
    coverage,
    coverageLabel: `${coverage.documents} dokumen, ${coverage.outputs} luaran, ${coverage.reviews} review`,
    hasExecutionData: false,
    report,
  };
};

export const buildResearchArchiveRecords = data => [
  ...array(data.drafts).filter(draft => !(draft.archiveMetadata || {}).removedFromArchiveAt).map(draft => internalRecord(data, draft)),
  ...array(data.externalResearchReports).filter(report => !(report.archiveMetadata || {}).removedFromArchiveAt).map(report => externalRecord(data, report)),
];

export const buildUserArchiveRecords = data => array(data.systemUsers).filter(account => !(account.archiveMetadata || {}).removedFromArchiveAt).map(account => {
  const profile = array(data.researcherProfiles).find(item => item.userId === account.id) || null;
  const profileId = profile && (profile.profileId || profile.id);
  const expertiseIds = array(data.researcherExpertiseMap).filter(item => item.profileId === profileId).map(item => item.expertiseId);
  const expertise = array(data.researcherExpertise).filter(item => expertiseIds.includes(item.expertiseId));
  const proposalAssignments = array(data.drafts).flatMap(draft => array(draft.assignments).map(assignment => ({ ...assignment, researchId: draft.id }))).filter(item => item.reviewerUserId === account.id);
  const fundedAssignments = array(data.fundedReviewAssignments).filter(item => item.reviewerUserId === account.id);
  const ownedInternal = array(data.drafts).filter(item => item.userId === account.id);
  const participatingInternal = array(data.drafts).filter(draft => draft.userId !== account.id && array(draft.members).some(member => member.userId === account.id || member.profileId === profileId));
  const ownedExternal = array(data.externalResearchReports).filter(item => item.userId === account.id);
  const letters = array(data.letterRequests).filter(item => item.userId === account.id || item.createdBy === account.id);
  const documents = array(data.researcherDocuments).filter(item => item.profileId === profileId && item.isActive !== false);
  const verifications = array(data.researcherVerifications).filter(item => item.profileId === profileId);
  const statusHistory = array(data.researcherStatusHistory).filter(item => item.profileId === profileId);
  const adminAssignment = array(data.adminAssignments).find(item => item.profileId === profileId);
  const profileAdmin = adminAssignment ? array(data.systemUsers).find(item => item.id === adminAssignment.adminId) || null : null;
  const activeReviewerAssignments = [...proposalAssignments, ...fundedAssignments].filter(item => ['assigned', 'in_progress'].includes(item.status));
  return {
    account,
    profile,
    documents,
    expertise,
    verifications,
    statusHistory,
    profileAdmin,
    ownedInternal,
    participatingInternal,
    ownedExternal,
    letters,
    proposalAssignments,
    fundedAssignments,
    activeReviewerAssignments,
    isLecturer: normalizeRole(account.role) === ROLE.LECTURER,
    researchLabel: `${ownedInternal.length} ketua, ${participatingInternal.length} anggota, ${ownedExternal.length} eksternal`,
  };
});

export const removeResearchFromArchive = (data, source, researchId, actor, uid, now = new Date()) => {
  const domain = source === ARCHIVE_SOURCE.INTERNAL ? 'drafts' : 'externalResearchReports';
  const collection = array(data[domain]);
  const previous = collection.find(item => item.id === researchId);
  if (!previous || (previous.archiveMetadata || {}).removedFromArchiveAt) return data;
  const removedAt = now.toISOString();
  const updated = {
    ...previous,
    archiveMetadata: {
      ...(previous.archiveMetadata || {}),
      removedFromArchiveAt: removedAt,
      removedFromArchiveBy: actor.id,
    },
  };
  return {
    ...data,
    [domain]: collection.map(item => (item.id === researchId ? updated : item)),
    systemActivityLogs: [...array(data.systemActivityLogs), createActivityLog(
      actor,
      'archive_remove_research',
      source === ARCHIVE_SOURCE.INTERNAL ? 'research_draft' : 'external_research',
      researchId,
      previous,
      updated,
      uid
    )],
  };
};

export const removeUserFromArchive = (data, accountId, actor, uid, now = new Date()) => {
  const collection = array(data.systemUsers);
  const previous = collection.find(account => account.id === accountId);
  if (!previous || previous.id === actor.id || previous.deletedAt || (previous.archiveMetadata || {}).removedFromArchiveAt) return data;
  const removedAt = now.toISOString();
  const updated = {
    ...previous,
    archiveMetadata: {
      ...(previous.archiveMetadata || {}),
      removedFromArchiveAt: removedAt,
      removedFromArchiveBy: actor.id,
    },
  };
  return {
    ...data,
    systemUsers: collection.map(account => (account.id === accountId ? updated : account)),
    systemActivityLogs: [...array(data.systemActivityLogs), createActivityLog(
      actor, 'archive_remove_user', 'user', accountId, previous, updated, uid
    )],
  };
};

export const applyArchiveAccountUpdate = (data, accountId, form, actor, uid, now = new Date()) => {
  const updatedAt = now.toISOString();
  const previousAccount = array(data.systemUsers).find(account => account.id === accountId);
  if (!previousAccount) return data;
  const updatedAccount = {
    ...previousAccount,
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    role: form.role,
    adminScopes: form.role === ROLE.ADMIN ? form.adminScopes : [],
    isActive: form.isActive,
    deactivationReason: form.isActive ? null : form.deactivationReason.trim(),
    deactivatedAt: form.isActive ? null : (previousAccount.deactivatedAt || updatedAt),
    deactivatedBy: form.isActive ? null : actor.id,
    updatedAt,
    updatedBy: actor.id,
  };
  const previousProfile = array(data.researcherProfiles).find(profile => profile.userId === accountId);
  const reactivatedStatus = Number(previousProfile && previousProfile.profileCompleteness) >= 50 ? PROFILE_STATUS.ACTIVE : PROFILE_STATUS.DRAFT;
  const updatedProfile = previousProfile ? {
    ...previousProfile,
    fullName: updatedAccount.name,
    institutionEmail: updatedAccount.email,
    profileStatus: updatedAccount.isActive ? (previousProfile.profileStatus === PROFILE_STATUS.INACTIVE ? reactivatedStatus : previousProfile.profileStatus) : PROFILE_STATUS.INACTIVE,
    inactiveReason: updatedAccount.isActive ? null : updatedAccount.deactivationReason,
    inactiveAt: updatedAccount.isActive ? null : (previousProfile.inactiveAt || updatedAt),
    inactiveBy: updatedAccount.isActive ? null : actor.id,
    updatedAt,
    lastUpdatedAt: updatedAt,
    lastUpdatedBy: actor.id,
  } : null;
  const statusChanged = previousProfile && previousProfile.profileStatus !== updatedProfile.profileStatus;
  let next = {
    ...data,
    systemUsers: array(data.systemUsers).map(account => (account.id === accountId ? updatedAccount : account)),
    researcherProfiles: updatedProfile ? array(data.researcherProfiles).map(profile => (profile.profileId === updatedProfile.profileId ? updatedProfile : profile)) : array(data.researcherProfiles),
    researcherStatusHistory: statusChanged ? [...array(data.researcherStatusHistory), createStatusHistory(previousProfile, previousProfile.profileStatus, updatedProfile.profileStatus, actor, uid)] : array(data.researcherStatusHistory),
    systemActivityLogs: [...array(data.systemActivityLogs), createActivityLog(actor, 'archive_update_user', 'user', accountId, { account: previousAccount, profile: previousProfile }, { account: updatedAccount, profile: updatedProfile }, uid)],
  };
  if (updatedProfile) next = syncProfileToDomainData(next, updatedProfile);
  return next;
};
