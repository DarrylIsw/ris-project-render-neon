/* eslint-disable object-curly-newline, object-property-newline */
import {
  STATUS,
  canAssignReviewer,
  canDecideDraft,
  canEditDraft,
  canManageResearch,
  canScoreDraft,
  canVerifyDraft,
  draftStatus,
} from '../../../shared/workflows/workflow';

const monitoringPath = (stage, draftId) => `/ris/skema/pengajuan?stage=${stage}&focus=${draftId}`;
const previewPath = draftId => `/ris/pengajuan-penelitian-internal/${draftId}/preview`;
const schemeDataPath = (draftId, tab = '') => `/ris/penelitian-didanai/${draftId}/pendataan${tab ? `?tab=${tab}` : ''}`;

export const getManagementResearchAction = (draft, user) => {
  if (!draft || !canManageResearch(user)) return null;
  if (draftStatus(draft) === STATUS.FUNDED) return { label: 'Pantau', tone: 'green', path: schemeDataPath(draft.id) };
  if (canDecideDraft(draft, user)) return { label: 'Putuskan', tone: 'cyan', path: monitoringPath('decision', draft.id) };
  if (canVerifyDraft(draft, user)) return { label: 'Verifikasi', tone: 'cyan', path: monitoringPath('verification', draft.id) };
  if (canAssignReviewer(draft, user)) {
    const assigned = draftStatus(draft) === STATUS.UNDER_REVIEW;
    return { label: assigned ? 'Pantau Penilai' : 'Atur Penilai', tone: 'blue', path: monitoringPath('reviewer', draft.id) };
  }
  return { label: 'Lihat', tone: 'gray', path: `${previewPath(draft.id)}?hideDecision=1` };
};

export const getResearcherProposalAction = (draft, user) => {
  if (!draft || !user) return null;
  if (draftStatus(draft) === STATUS.FUNDED) {
    const contract = draft.contract || {};
    const contractSigned = Boolean(contract.lecturerSignedFile || contract.signedFile || ['signed', 'completed'].includes(contract.status || contract.contractStatus));
    const contractReady = Boolean(contract.adminSignedFile && contract.sentToLecturerAt);
    return contractSigned
      ? { label: 'Kelola Penelitian', tone: 'green', path: schemeDataPath(draft.id, 'monev') }
      : { label: contractReady ? 'TTD Kontrak' : 'Buka Pendataan', tone: 'green', path: schemeDataPath(draft.id, 'contract') };
  }
  if (canEditDraft(draft, user)) return { label: draftStatus(draft) === STATUS.REVISION ? 'Perbaiki' : 'Lanjutkan', tone: 'yellow', path: `/ris/pengajuan-penelitian-internal/scheme/${draft.schemeId}` };
  return { label: 'Lihat', tone: 'gray', path: previewPath(draft.id) };
};

export const getReviewerTaskAction = (draft, user) => {
  if (!draft || !user) return null;
  if (canScoreDraft(draft, user)) return { label: 'Beri Penilaian', tone: 'blue', path: `/ris/pengajuan-penelitian-internal/${draft.id}/penilaian` };
  return { label: 'Lihat Penilaian', tone: 'gray', path: `${previewPath(draft.id)}?reviewer=1` };
};

export const managementResearchPriority = (draft, user) => {
  if (canDecideDraft(draft, user)) return 0;
  if (canVerifyDraft(draft, user)) return 1;
  if (canAssignReviewer(draft, user)) return 2;
  if (draftStatus(draft) === STATUS.FUNDED) return 3;
  return 4;
};
