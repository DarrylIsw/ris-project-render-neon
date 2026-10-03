/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React from 'react';
import { useHistory } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import { Button, EmptyRow, StatusBadge } from '../../../shared/components/Ui';
import Icon from '../../../shared/components/Icon';
import { formatDate } from '../../../core/data';
import {
  STATUS,
  canAccessExternalResearch,
  canAccessLetters,
  canAccessResearchSubmission,
  canAccessResearcherProfiles,
  canManageLetters,
  canManageResearch,
  canReviewerViewDraft,
  draftOwnerId,
  draftStatus,
  getRoleLabel,
  getSchemeTitle,
  hasTemporaryReviewerRole,
  isResearcher,
  reviewerAssignmentForUser,
} from '../../../shared/workflows/workflow';
import {
  getManagementResearchAction,
  getResearcherProposalAction,
  getReviewerTaskAction,
  managementResearchPriority,
} from '../workflows/dashboardWorkflow';
import { proposalDisplayMeta, proposalYear } from '../../research/workflows/researchMonitoringWorkflow';
import {
  canAdminReviewExternalReport,
  canArchiveExternalReport,
  externalReportTitle,
  externalStatusMeta,
  getAdminExternalQueue,
  getExternalMetrics,
  getVisibleExternalReports,
} from '../../externalResearch/workflows/externalResearchWorkflow';
import {
  LETTER_STATUS,
  getAdminLetterQueue,
  getLettersOwnedByUser,
  getLetterTitle,
  getLetterTypeMeta,
  letterStatusMeta,
} from '../../letters/workflows/letterWorkflow';
import {
  canVerifyProfile,
  getProfileByUser,
  getProfileMetrics,
  getVerificationMeta,
  isProfileAdmin,
} from '../../profiles/workflows/researcherProfileWorkflow';
import {
  FUNDED_REVIEW_TARGET,
  canScoreFundedReview,
  fundedReviewTargetLabel,
  getFundedReviewerTasks,
} from '../../research/workflows/fundedResearchReviewWorkflow';

const researchTitle = draft => (draft && draft.project && draft.project.title) || 'Tanpa judul';

function SectionHeading({ title, description, actionLabel, onAction }) {
  return (
    <div className="ris-section-title ris-dashboard-section-title">
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {onAction && <Button tone="gray" onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}

function ProposalIdentity({ draft, scheme }) {
  return (
    <div className="ris-proposal-stack">
      <strong>{researchTitle(draft)}</strong>
      <span>{draft.userName || 'Pengaju belum tersedia'}</span>
      <small>{getSchemeTitle(scheme)}</small>
    </div>
  );
}

export default function DashboardPage() {
  const { data, user } = useRis();
  const history = useHistory();
  const researchAdmin = canManageResearch(user);
  const letterAdmin = canManageLetters(user);
  const profileAdmin = isProfileAdmin(user);
  const researcher = isResearcher(user);
  const temporaryReviewer = hasTemporaryReviewerRole(data, user);
  const drafts = (data.drafts || []).filter(draft => draftStatus(draft) !== STATUS.ARCHIVED);
  const schemes = (data.schemes || []).filter(scheme => !scheme.deletedAt);
  const schemeFor = draft => schemes.find(item => item.id === draft.schemeId) || {};
  const accountFor = profile => (data.systemUsers || []).find(item => item.id === profile.userId) || null;

  const managementResearch = researchAdmin
    ? drafts.filter(draft => draftStatus(draft) !== STATUS.DRAFT).sort((left, right) => managementResearchPriority(left, user) - managementResearchPriority(right, user))
    : [];
  const ownProposals = researcher ? drafts.filter(draft => draftOwnerId(draft) === user.id) : [];
  const reviewerTasks = temporaryReviewer
    ? drafts.filter(draft => draftOwnerId(draft) !== user.id && canReviewerViewDraft(draft, user))
    : [];
  const fundedReviewerTasks = temporaryReviewer ? getFundedReviewerTasks(data, user) : [];
  const ownLetters = getLettersOwnedByUser(data, user);
  const letterQueue = letterAdmin ? getAdminLetterQueue(data) : [];
  const externalQueue = researchAdmin ? getAdminExternalQueue(data) : [];
  const ownExternalReports = researcher ? getVisibleExternalReports(data, user) : [];
  const externalMetrics = getExternalMetrics(researchAdmin ? externalQueue : ownExternalReports);
  const profileMetrics = getProfileMetrics(data);
  const ownProfile = getProfileByUser(data, user);
  const profileQueue = profileAdmin ? (data.researcherProfiles || []).filter(profile => canVerifyProfile(profile, user, accountFor(profile))) : [];

  const featureCards = [
    {
      id: 'internal-research', label: 'Riset Internal', icon: 'document', tone: 'blue',
      title: researchAdmin ? 'Manajemen Penelitian' : 'Pengajuan Penelitian Internal',
      description: researchAdmin
        ? `${managementResearch.length} penelitian dipantau; ${managementResearch.filter(draft => getManagementResearchAction(draft, user).label !== 'Lihat').length} memiliki tindakan lanjutan.`
        : `${ownProposals.length} pengajuan milik Anda${reviewerTasks.length + fundedReviewerTasks.length ? ` dan ${reviewerTasks.length + fundedReviewerTasks.length} tugas penilaian aktif` : ''}.`,
      path: researchAdmin ? '/ris/skema/pengajuan?stage=preview' : '/ris/pengajuan-penelitian-internal',
      visible: canAccessResearchSubmission(user),
    },
    {
      id: 'letters', label: 'Surat', icon: 'mail', title: 'Pengajuan Surat', tone: 'green',
      description: letterAdmin ? `${letterQueue.length} pengajuan membutuhkan pemeriksaan, penyusunan form, atau penerbitan.` : `${ownLetters.length} pengajuan surat tercatat pada akun ini.`,
      path: '/ris/pengajuan-surat', visible: canAccessLetters(user),
    },
    {
      id: 'external-research', label: 'Riset Eksternal', icon: 'report', title: 'Pelaporan Penelitian Eksternal & Mandiri', tone: 'blue',
      description: researchAdmin ? `${externalMetrics.totalReports} laporan memerlukan monitoring LPPM.` : `${externalMetrics.totalReports} laporan eksternal atau mandiri milik Anda.`,
      path: '/ris/penelitian-eksternal', visible: canAccessExternalResearch(user),
    },
    {
      id: 'researcher-profile', label: 'Profil Peneliti', icon: 'user', title: profileAdmin ? 'Manajemen Informasi Peneliti' : 'Profil Saya', tone: 'green',
      description: profileAdmin ? `${profileMetrics.totalProfiles} profil; ${profileQueue.length} memerlukan pemeriksaan.` : (ownProfile ? `Kelengkapan profil Anda ${ownProfile.profileCompleteness || 0}%.` : 'Profil peneliti belum dilengkapi.'),
      path: profileAdmin ? '/ris/profil-peneliti' : '/ris/profil-saya', visible: canAccessResearcherProfiles(user),
    },
  ].filter(card => card.visible);

  return (
    <div className="ris-page ris-workspace-page ris-dashboard-page">
      <div className="ris-page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Ringkasan pekerjaan untuk {getRoleLabel(user)}. Setiap antrean mengarah langsung ke alur kerja yang sesuai dengan akses aktif.</p>
        </div>
      </div>

      {featureCards.length > 0 && <section className="ris-module-grid ris-dashboard-modules">
        {featureCards.map(card => (
          <article className="ris-module-card active" key={card.id}>
            <div className="ris-module-icon"><Icon name={card.icon} /></div>
            <span>{card.label}</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <div className="ris-module-card-footer"><Button tone={card.tone} onClick={() => history.push(card.path)}>Buka</Button></div>
          </article>
        ))}
      </section>}

      {researchAdmin && <section className="ris-section-spaced">
        <SectionHeading title="Antrean Pemantauan Penelitian" description="Proposal diurutkan berdasarkan tindakan yang paling perlu diproses." actionLabel="Buka Pemantauan" onAction={() => history.push('/ris/skema/pengajuan?stage=preview')} />
        <div className="ris-table-wrap">
          <table className="ris-table ris-action-table ris-table-left">
            <thead><tr><th>No.</th><th>Proposal</th><th>Tahun</th><th>Status</th><th>Tindakan Berikutnya</th></tr></thead>
            <tbody>{managementResearch.map((draft, index) => {
              const meta = proposalDisplayMeta(draft);
              const action = getManagementResearchAction(draft, user);
              return <tr key={draft.id}><td>{index + 1}.</td><td><ProposalIdentity draft={draft} scheme={schemeFor(draft)} /></td><td>{proposalYear(draft, schemeFor(draft))}</td><td><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td><td><button type="button" className={`ris-action ${action.tone}`} onClick={() => history.push(action.path)}>{action.label}</button></td></tr>;
            })}{managementResearch.length === 0 && <EmptyRow colSpan={5}>Belum ada proposal yang masuk ke monitoring.</EmptyRow>}</tbody>
          </table>
        </div>
      </section>}

      {researcher && <section className="ris-section-spaced">
        <SectionHeading title="Pengajuan Penelitian Saya" description="Draft, proposal berjalan, dan penelitian didanai milik akun aktif." actionLabel="Buka Daftar Skema" onAction={() => history.push('/ris/pengajuan-penelitian-internal')} />
        <div className="ris-table-wrap">
          <table className="ris-table ris-action-table ris-table-left">
            <thead><tr><th>No.</th><th>Proposal</th><th>Tahun</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>{ownProposals.map((draft, index) => {
              const meta = proposalDisplayMeta(draft);
              const action = getResearcherProposalAction(draft, user);
              return <tr key={draft.id}><td>{index + 1}.</td><td><ProposalIdentity draft={draft} scheme={schemeFor(draft)} /></td><td>{proposalYear(draft, schemeFor(draft))}</td><td><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td><td><button type="button" className={`ris-action ${action.tone}`} onClick={() => history.push(action.path)}>{action.label}</button></td></tr>;
            })}{ownProposals.length === 0 && <EmptyRow colSpan={5}>Belum ada pengajuan penelitian pada akun ini.</EmptyRow>}</tbody>
          </table>
        </div>
      </section>}

      {reviewerTasks.length > 0 && <section className="ris-section-spaced">
        <SectionHeading title="Tugas Penilaian Saya" description="Penugasan penilai sementara dipisahkan dari proposal yang Anda ajukan sendiri." />
        <div className="ris-table-wrap">
          <table className="ris-table ris-action-table ris-table-left">
            <thead><tr><th>No.</th><th>Proposal</th><th>Tenggat</th><th>Status Penilaian</th><th>Aksi</th></tr></thead>
            <tbody>{reviewerTasks.map((draft, index) => {
              const assignment = reviewerAssignmentForUser(draft, user) || {};
              const submitted = assignment.status === 'submitted';
              const action = getReviewerTaskAction(draft, user);
              return <tr key={draft.id}><td>{index + 1}.</td><td><ProposalIdentity draft={draft} scheme={schemeFor(draft)} /></td><td>{formatDate(assignment.dueAt || assignment.deadline)}</td><td><StatusBadge tone={submitted ? 'green' : 'orange'}>{submitted ? 'Sudah dikirim' : 'Perlu dinilai'}</StatusBadge></td><td><button type="button" className={`ris-action ${action.tone}`} onClick={() => history.push(action.path)}>{action.label}</button></td></tr>;
            })}{reviewerTasks.length === 0 && <EmptyRow colSpan={5}>Tidak ada tugas penilaian aktif.</EmptyRow>}</tbody>
          </table>
        </div>
      </section>}

      {fundedReviewerTasks.length > 0 && <section className="ris-section-spaced">
        <SectionHeading title="Tugas Penilaian Penelitian Didanai" description="Penilaian Monev dan laporan menggunakan rubrik yang berbeda dari proposal." />
        <div className="ris-table-wrap"><table className="ris-table ris-action-table ris-table-left"><thead><tr><th>No.</th><th>Target Penilaian</th><th>Penelitian</th><th>Tenggat</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{fundedReviewerTasks.map((task, index) => {
          const canScore = canScoreFundedReview(data, task.assignment.targetType, task.assignment.targetId, user);
          const path = `/ris/penelitian-didanai/review/${task.assignment.targetType}/${task.assignment.targetId}`;
          return <tr key={task.assignment.id}><td>{index + 1}.</td><td><strong>{fundedReviewTargetLabel(task.assignment.targetType, task.target)}</strong><small className="ris-table-secondary">{task.assignment.targetType === FUNDED_REVIEW_TARGET.MONEV ? 'Monev' : 'Laporan penelitian'}</small></td><td className="ris-title-cell">{researchTitle(task.draft)}</td><td>{formatDate(task.assignment.dueAt || task.assignment.deadline)}</td><td><StatusBadge tone={canScore ? 'orange' : 'green'}>{canScore ? 'Perlu dinilai' : 'Sudah dikirim'}</StatusBadge></td><td><button type="button" disabled={!canScore} className={`ris-action ${canScore ? 'blue' : 'gray'}`} onClick={() => history.push(path)}>{canScore ? 'Beri Penilaian' : 'Selesai'}</button></td></tr>;
        })}</tbody></table></div>
      </section>}

      {letterAdmin && <section className="ris-section-spaced">
        <SectionHeading title="Antrean Pengajuan Surat" description="Permintaan ditampilkan saat memerlukan tindakan dari pengelola." actionLabel="Buka Pengajuan Surat" onAction={() => history.push('/ris/pengajuan-surat')} />
        <div className="ris-table-wrap">
          <table className="ris-table ris-action-table ris-table-left">
            <thead><tr><th>No.</th><th>Pengajuan</th><th>Jenis Surat</th><th>Pemohon</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>{letterQueue.map((letter, index) => {
              const meta = letterStatusMeta(letter);
              const type = getLetterTypeMeta(letter.type);
              const action = letter.status === LETTER_STATUS.FORM_DESIGN ? { label: 'Susun Formulir', tone: 'blue' } : [LETTER_STATUS.DATA_SUBMITTED, LETTER_STATUS.APPROVED].includes(letter.status) ? { label: 'Finalisasi', tone: 'green' } : { label: 'Periksa', tone: 'cyan' };
              return <tr key={letter.id}><td>{index + 1}.</td><td className="ris-title-cell" title={getLetterTitle(letter)}>{getLetterTitle(letter)}</td><td>{type.shortLabel || type.label}</td><td>{(letter.applicant && letter.applicant.name) || '-'}</td><td><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td><td><button type="button" className={`ris-action ${action.tone}`} onClick={() => history.push(`/ris/pengajuan-surat/${letter.id}/admin`)}>{action.label}</button></td></tr>;
            })}{letterQueue.length === 0 && <EmptyRow colSpan={6}>Tidak ada surat yang menunggu tindakan.</EmptyRow>}</tbody>
          </table>
        </div>
      </section>}

      {researchAdmin && <section className="ris-section-spaced">
        <SectionHeading title="Antrean Penelitian Eksternal" description="Laporan yang sedang direview, menunggu perbaikan, atau siap diarsipkan." actionLabel="Buka Pelaporan Eksternal" onAction={() => history.push('/ris/penelitian-eksternal')} />
        <div className="ris-table-wrap">
          <table className="ris-table ris-action-table ris-table-left">
            <thead><tr><th>No.</th><th>Penelitian</th><th>Pelapor</th><th>Tahun</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>{externalQueue.map((report, index) => {
              const meta = externalStatusMeta(report);
              const reviewable = canAdminReviewExternalReport(report, user);
              const archivable = canArchiveExternalReport(report, user);
              const action = archivable ? { label: 'Arsipkan', tone: 'purple', path: `/ris/penelitian-eksternal/${report.id}/admin` } : reviewable ? { label: 'Nilai', tone: 'cyan', path: `/ris/penelitian-eksternal/${report.id}/admin` } : { label: 'Lihat', tone: 'gray', path: `/ris/penelitian-eksternal/${report.id}/detail` };
              return <tr key={report.id}><td>{index + 1}.</td><td className="ris-title-cell" title={externalReportTitle(report)}>{externalReportTitle(report)}</td><td>{report.userName || report.applicantName || '-'}</td><td>{report.activityYear || '-'}</td><td><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td><td><button type="button" className={`ris-action ${action.tone}`} onClick={() => history.push(action.path)}>{action.label}</button></td></tr>;
            })}{externalQueue.length === 0 && <EmptyRow colSpan={6}>Tidak ada laporan eksternal yang menunggu monitoring.</EmptyRow>}</tbody>
          </table>
        </div>
      </section>}

      {profileAdmin && <section className="ris-section-spaced">
        <SectionHeading title="Profil Memerlukan Pemeriksaan" description="Profil belum terverifikasi yang dapat diproses oleh akses aktif." actionLabel="Buka Manajemen Profil" onAction={() => history.push('/ris/profil-peneliti')} />
        <div className="ris-table-wrap">
          <table className="ris-table ris-action-table ris-table-left">
            <thead><tr><th>No.</th><th>Nama</th><th>Email</th><th>Unit</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>{profileQueue.map((profile, index) => {
              const meta = getVerificationMeta(profile.verificationStatus);
              return <tr key={profile.profileId}><td>{index + 1}.</td><td><strong>{profile.fullName || '-'}</strong></td><td>{profile.institutionEmail || '-'}</td><td>{profile.unit || profile.faculty || '-'}</td><td><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td><td><button type="button" className="ris-action cyan" onClick={() => history.push(`/ris/profil-peneliti/${profile.profileId}/detail`)}>Periksa</button></td></tr>;
            })}{profileQueue.length === 0 && <EmptyRow colSpan={6}>Tidak ada profil yang memerlukan pemeriksaan.</EmptyRow>}</tbody>
          </table>
        </div>
      </section>}
    </div>
  );
}
