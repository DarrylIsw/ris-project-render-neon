const { profileManager, researchManager } = require('./risAccess');

const additions = (before, after) => {
  const ids = new Set((before || []).map(item => item.id));
  return (after || []).filter(item => !ids.has(item.id));
};

const appendServerEvents = (previous, next, actor) => {
  const events = [];
  const now = new Date().toISOString();
  const users = next.systemUsers || [];
  const notify = (userId, type, entityType, entityId, message, actionPath = '') => {
    if (!userId || !users.some(user => user.id === userId)) return;
    events.push({
      id: `server-${type}-${Date.now()}-${events.length}`,
      userId,
      fromUserId: actor.id,
      entityType,
      entityId,
      type,
      message,
      actionPath,
      createdAt: now,
      isRead: false,
    });
  };

  (next.researcherProfiles || []).forEach(profile => {
    const prior = (previous.researcherProfiles || []).find(item => item.id === profile.id);
    if ((!prior || prior.verificationStatus !== profile.verificationStatus) && profile.verificationStatus === 'pending') {
      users.filter(user => user.isActive !== false && user.id !== actor.id && profileManager(user)).forEach(user => {
        notify(user.id, 'profile_pending', 'researcher_profile', profile.id, `Profil ${profile.fullName || 'peneliti'} menunggu verifikasi.`, `/ris/profil-peneliti/${profile.id}/detail`);
      });
    }
    if (!prior) return;
    if (profile.verificationStatus !== prior.verificationStatus) {
      if (profile.verificationStatus === 'verified') notify(profile.userId, 'profile_verified', 'researcher_profile', profile.id, 'Profil peneliti Anda telah diverifikasi.', '/ris/profil-peneliti');
      if (profile.verificationStatus === 'rejected') notify(profile.userId, 'profile_rejected', 'researcher_profile', profile.id, 'Profil peneliti perlu diperbaiki.', '/ris/profil-peneliti');
    } else if (profile.updatedAt !== prior.updatedAt && actor.id !== profile.userId) {
      notify(profile.userId, 'profile_updated', 'researcher_profile', profile.id, 'Profil peneliti Anda telah diperbarui.', '/ris/profil-peneliti');
    }
  });
  additions(previous.researcherDocuments, next.researcherDocuments).forEach(document => {
    const profile = (next.researcherProfiles || []).find(item => item.id === document.profileId || item.profileId === document.profileId);
    if (profile && actor.id !== profile.userId) notify(profile.userId, 'document_uploaded', 'researcher_profile', profile.id, 'Dokumen profil Anda telah diperbarui.', '/ris/profil-peneliti');
  });

  additions(previous.reviewerReminders, next.reviewerReminders).forEach(reminder => {
    const draft = (next.drafts || []).find(item => item.id === reminder.draftId);
    const assignment = draft && (draft.assignments || []).find(item => item.id === reminder.assignmentId);
    if (assignment) notify(assignment.reviewerUserId, 'reviewer_manual_reminder', 'research_draft', draft.id, `Pengingat penilaian proposal "${draft.project.title}".`, `/ris/pengajuan-penelitian-internal/${draft.id}/penilaian`);
  });
  (next.fundedReviewAssignments || []).forEach(assignment => {
    const prior = (previous.fundedReviewAssignments || []).find(item => item.id === assignment.id);
    if (!prior) notify(assignment.reviewerUserId, 'funded_reviewer_assigned', 'funded_review', assignment.targetId, 'Anda ditugaskan menilai penelitian didanai.', `/ris/penelitian-didanai/review/${assignment.targetType}/${assignment.targetId}`);
    else if (prior.status !== 'revoked' && assignment.status === 'revoked') notify(assignment.reviewerUserId, 'funded_reviewer_revoked', 'funded_review', assignment.targetId, 'Penugasan penilaian Anda telah selesai.', '/ris');
  });
  additions(previous.fundedReviewerReminders, next.fundedReviewerReminders).forEach(reminder => {
    const assignment = (next.fundedReviewAssignments || []).find(item => item.id === reminder.assignmentId);
    if (assignment) notify(assignment.reviewerUserId, 'funded_reviewer_reminder', 'funded_review', assignment.targetId, 'Pengingat untuk menyelesaikan penilaian penelitian didanai.', `/ris/penelitian-didanai/review/${assignment.targetType}/${assignment.targetId}`);
  });
  additions(previous.fundedReviews, next.fundedReviews).forEach(review => {
    const assignment = (next.fundedReviewAssignments || []).find(item => item.id === review.assignmentId);
    if (!assignment) return;
    const draft = (next.drafts || []).find(item => item.id === assignment.researchId);
    const management = users.filter(user => user.isActive !== false && researchManager(user)).map(user => user.id);
    [...new Set([...(draft ? [draft.userId] : []), ...management])].forEach(userId => {
      const owner = draft && userId === draft.userId;
      notify(userId, owner ? 'funded_review_available' : 'funded_review_submitted', 'funded_review', assignment.targetId, owner ? 'Hasil penilaian penelitian Anda telah tersedia.' : 'Hasil penilaian penelitian didanai telah masuk.', `/ris/penelitian-didanai/${assignment.researchId}/pendataan`);
    });
  });
  return events.length ? { ...next, notifications: [...(next.notifications || []), ...events] } : next;
};

module.exports = { appendServerEvents };
