/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React, { useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import Icon from '../../../shared/components/Icon';
import {
  Button, EmptyRow, Field, FloatingError, Modal, PageHeader, StatusBadge
} from '../../../shared/components/Ui';
import { STATUS_META, formatDate, uid } from '../../../core/data';
import {
  ADMIN_SCOPE_OPTIONS, ROLE, ROLE_LABELS, STATUS, hasFullAccess, normalizeRole
} from '../../../shared/workflows/workflow';
import {
  EXTERNAL_STATUS, EXTERNAL_STATUS_META
} from '../../externalResearch/workflows/externalResearchWorkflow';
import {
  createActivityLog, getProfileStatusMeta
} from '../../profiles/workflows/researcherProfileWorkflow';
import {
  ARCHIVE_SOURCE, applyArchiveAccountUpdate, buildResearchArchiveRecords, buildUserArchiveRecords,
  removeResearchFromArchive, removeUserFromArchive
} from '../workflows/archiveWorkflow';
import downloadCsvFromTemplate from '../../exports/exportWorkflow';
import { translateUiText } from '../../../shared/i18n/uiLanguage';

const TAB = { RESEARCH: 'research', USERS: 'users' };
const SOURCE = ARCHIVE_SOURCE;
const sourceLabel = { [SOURCE.INTERNAL]: 'Internal', [SOURCE.EXTERNAL]: 'Eksternal / Mandiri' };
const sourceTone = { [SOURCE.INTERNAL]: 'blue', [SOURCE.EXTERNAL]: 'purple' };
const MetricCard = ({ label, value }) => <div><span>{label}</span><strong>{value}</strong></div>;
const splitTags = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean);
const researchCsvColumns = [
  { label: 'ID Arsip', value: record => record.id },
  { label: 'Sumber', value: record => sourceLabel[record.source] || record.source },
  { label: 'Judul Penelitian', value: record => record.title },
  { label: 'ID Pemilik', value: record => record.ownerId },
  { label: 'Pemilik', value: record => record.ownerName },
  { label: 'Tahun', value: record => record.year },
  { label: 'Skema / Kategori', value: record => record.context },
  { label: 'Status', value: record => record.statusMeta.label },
  { label: 'Diperbarui', value: record => record.updatedAt },
  { label: 'Status Verifikasi', value: record => record.verificationStatus || '' },
  { label: 'Keputusan', value: record => record.decisionStatus || '' },
  { label: 'Nomor Surat Pendanaan', value: record => record.fundingLetterNumber || '' },
  { label: 'Status Kontrak', value: record => record.contractStatus || '' },
  { label: 'Jumlah Anggota', value: record => record.coverage.members ?? '' },
  { label: 'Item Anggaran', value: record => record.coverage.budgetItems ?? '' },
  { label: 'Luaran', value: record => record.coverage.outputs ?? '' },
  { label: 'Lampiran / Dokumen', value: record => record.coverage.attachments ?? record.coverage.documents ?? '' },
  { label: 'Jumlah Monev', value: record => record.coverage.monev ?? '' },
  { label: 'Laporan Kemajuan / Akhir', value: record => record.coverage.progressReports ?? '' },
  { label: 'Laporan Luaran', value: record => record.coverage.outputReports ?? '' },
  { label: 'Logbook', value: record => record.coverage.logbooks ?? '' },
  { label: 'Penugasan Penilai', value: record => record.coverage.proposalAssignments ?? record.coverage.fundedAssignments ?? '' },
  { label: 'Hasil Penilaian', value: record => record.coverage.proposalReviews ?? record.coverage.fundedReviews ?? record.coverage.reviews ?? '' },
  { label: 'Jenis Penelitian Eksternal', value: record => record.report && record.report.activityType },
  { label: 'Status Kegiatan Eksternal', value: record => record.report && record.report.activityStatus },
  { label: 'Pendanaan Eksternal', value: record => record.report && record.report.fundingAmount },
  { label: 'Mata Uang', value: record => record.report && record.report.currency },
  { label: 'Tag Arsip', value: record => (record.archiveMetadata.tags || []).join('; ') },
  { label: 'Catatan Arsip', value: record => record.archiveMetadata.notes || '' },
];
const userCsvColumns = [
  { label: 'ID Pengguna', value: record => record.account.id },
  { label: 'Nama', value: record => record.account.name },
  { label: 'Email', value: record => record.account.email },
  { label: 'Peran', value: record => ROLE_LABELS[normalizeRole(record.account.role)] || record.account.role },
  { label: 'Cakupan Admin', value: record => ADMIN_SCOPE_OPTIONS.filter(option => (record.account.adminScopes || []).includes(option.value)).map(option => option.label).join('; ') },
  { label: 'NIDN / Identitas', value: record => (record.profile && (record.profile.nidn || record.profile.nip)) || '' },
  { label: 'Unit / Fakultas', value: record => (record.profile && (record.profile.unit || record.profile.faculty)) || '' },
  { label: 'Program Studi', value: record => (record.profile && record.profile.studyProgram) || '' },
  { label: 'Jabatan', value: record => (record.profile && record.profile.position) || '' },
  { label: 'Status Profil', value: record => (record.profile && getProfileStatusMeta(record.profile.profileStatus).label) || 'Belum ada profil' },
  { label: 'Kelengkapan Profil (%)', value: record => (record.profile && record.profile.profileCompleteness) || 0 },
  { label: 'Bidang Keahlian', value: record => record.expertise.map(item => item.name).join('; ') },
  { label: 'Status Akun', value: record => {
    if (record.account.deletedAt) return 'Dihapus';
    return record.account.isActive === false ? 'Nonaktif' : 'Aktif';
  } },
  { label: 'Alasan Nonaktif', value: record => record.account.deactivationReason || '' },
  { label: 'Penelitian sebagai Ketua', value: record => record.ownedInternal.length },
  { label: 'Penelitian sebagai Anggota', value: record => record.participatingInternal.length },
  { label: 'Penelitian Eksternal', value: record => record.ownedExternal.length },
  { label: 'Pengajuan Surat', value: record => record.letters.length },
  { label: 'Dokumen Profil', value: record => record.documents.length },
  { label: 'Penugasan Penilaian Proposal', value: record => record.proposalAssignments.length },
  { label: 'Penugasan Penilaian Penelitian Didanai', value: record => record.fundedAssignments.length },
  { label: 'Administrator Pendamping', value: record => (record.profileAdmin && record.profileAdmin.name) || '' },
  { label: 'Tanggal Dibuat', value: record => record.account.createdAt || '' },
  { label: 'Tanggal Diperbarui', value: record => record.account.updatedAt || '' },
];

const canEditAccount = (actor, account) => {
  if (!hasFullAccess(actor) || !account || account.deletedAt || account.id === actor.id) return false;
  if (normalizeRole(actor.role) === ROLE.MANAGER && normalizeRole(account.role) === ROLE.SUPER_ADMIN) return false;
  return true;
};

const ArchiveMetric = ({ label, value }) => <div><span>{label}</span><strong>{value}</strong></div>;

const ArchiveActionMenu = ({ onOpen, locale }) => {
  const localized = value => translateUiText(value, locale);
  return <button type="button" className="ris-action gray ris-row-action-trigger" aria-label={localized('Aksi')} aria-haspopup="dialog" onClick={onOpen}>
    {localized('Aksi')}<Icon name="chevron" size={13} />
  </button>;
};

const ResearchArchiveDetail = ({ record, onClose, onNavigate }) => {
  const coverage = record.coverage || {};
  const internal = record.source === SOURCE.INTERNAL;
  return (
    <Modal title="Ringkasan Arsip Penelitian" width={1040} onClose={onClose}>
      <div className="ris-modal-body">
        <div className="ris-archive-detail-head"><div><span>{sourceLabel[record.source]}</span><h3>{record.title}</h3><p>{record.ownerName} · {record.context} · {record.year}</p></div><StatusBadge tone={record.statusMeta.tone}>{record.statusMeta.label}</StatusBadge></div>
        {record.archiveMetadata.reason === 'scheme_deleted' && <p className="ris-muted">Diarsipkan karena skema dihapus. Status sebelumnya: {(STATUS_META[record.archiveMetadata.previousStatus] || {}).label || '-'}.</p>}
        <div className="ris-archive-detail-grid">
          {internal ? <React.Fragment>
            <ArchiveMetric label="Anggota" value={coverage.members} />
            <ArchiveMetric label="Item Anggaran" value={coverage.budgetItems} />
            <ArchiveMetric label="Luaran Proposal" value={coverage.outputs} />
            <ArchiveMetric label="Lampiran Proposal" value={coverage.attachments} />
            <ArchiveMetric label="Penilai Proposal" value={coverage.proposalAssignments} />
            <ArchiveMetric label="Hasil Penilaian Proposal" value={coverage.proposalReviews} />
          </React.Fragment> : <React.Fragment>
            <ArchiveMetric label="Dokumen" value={coverage.documents} />
            <ArchiveMetric label="Luaran" value={coverage.outputs} />
            <ArchiveMetric label="Penilaian" value={coverage.reviews} />
            <ArchiveMetric label="Riwayat Status" value={coverage.history} />
          </React.Fragment>}
        </div>
        {internal && <section className="ris-archive-user-summary ris-archive-lifecycle-summary"><dl><div><dt>Verifikasi Proposal</dt><dd>{record.verificationStatus}</dd></div><div><dt>Keputusan Akhir</dt><dd>{record.decisionStatus}</dd></div><div><dt>Surat Pendanaan</dt><dd>{record.fundingLetterNumber}</dd></div><div><dt>Jadwal Pelaporan</dt><dd>{coverage.reportingPeriods} periode</dd></div><div><dt>Opsi Luaran Skema</dt><dd>{coverage.schemeOutputOptions}</dd></div><div><dt>Templat Lampiran Skema</dt><dd>{coverage.schemeAttachments}</dd></div></dl></section>}
        {internal && <section className="ris-archive-execution-summary"><div><h4>Data Pelaksanaan</h4><p>Kontrak, Monev, laporan akhir, luaran, dan penilai pelaksanaan menggunakan sumber data yang sama dengan pemantauan penelitian didanai.</p></div><dl><div><dt>Status Kontrak</dt><dd>{record.contractStatus}</dd></div><div><dt>Monev</dt><dd>{coverage.monev}</dd></div><div><dt>Laporan Akhir</dt><dd>{coverage.progressReports}</dd></div><div><dt>Laporan Luaran</dt><dd>{coverage.outputReports}</dd></div><div><dt>Penugasan Penilai</dt><dd>{coverage.fundedAssignments}</dd></div><div><dt>Hasil Penilaian</dt><dd>{coverage.fundedReviews}</dd></div></dl></section>}
        <div className="ris-modal-actions"><Button tone="gray" onClick={onClose}>Tutup</Button><Button tone="blue" onClick={() => onNavigate(internal ? `/ris/pengajuan-penelitian-internal/${record.id}/preview` : `/ris/penelitian-eksternal/${record.id}/detail`)}>{internal ? 'Buka Proposal' : 'Buka Laporan'}</Button>{internal && record.hasExecutionData && <Button onClick={() => onNavigate(`/ris/penelitian-didanai/${record.id}/pendataan`)}>Buka Pelaksanaan</Button>}</div>
      </div>
    </Modal>
  );
};

const UserArchiveDetail = ({ record, onClose, onNavigate }) => {
  const { account, profile } = record;
  const scopeLabels = ADMIN_SCOPE_OPTIONS.filter(option => (account.adminScopes || []).includes(option.value)).map(option => option.label);
  return (
    <Modal title="Ringkasan Arsip Pengguna" width={980} onClose={onClose}>
      <div className="ris-modal-body">
        <div className="ris-archive-detail-head"><div><span>{ROLE_LABELS[normalizeRole(account.role)] || account.role}</span><h3>{account.name}</h3><p>{account.email}</p></div><StatusBadge tone={account.deletedAt ? 'gray' : account.isActive === false ? 'red' : 'green'}>{account.deletedAt ? 'Dihapus' : account.isActive === false ? 'Nonaktif' : 'Aktif'}</StatusBadge></div>
        <div className="ris-archive-detail-grid ris-archive-user-metrics"><ArchiveMetric label="Sebagai Ketua" value={record.ownedInternal.length} /><ArchiveMetric label="Sebagai Anggota" value={record.participatingInternal.length} /><ArchiveMetric label="Penelitian Eksternal" value={record.ownedExternal.length} /><ArchiveMetric label="Pengajuan Surat" value={record.letters.length} /><ArchiveMetric label="Dokumen Profil" value={record.documents.length} /><ArchiveMetric label="Penilaian Proposal" value={record.proposalAssignments.length} /><ArchiveMetric label="Penilaian Monev/Laporan" value={record.fundedAssignments.length} /></div>
        <section className="ris-archive-user-summary"><dl><div><dt>NIDN / Identitas</dt><dd>{(profile && (profile.nidn || profile.nip)) || '-'}</dd></div><div><dt>Unit / Fakultas</dt><dd>{(profile && (profile.unit || profile.faculty)) || '-'}</dd></div><div><dt>Program Studi</dt><dd>{(profile && profile.studyProgram) || '-'}</dd></div><div><dt>Kelengkapan Profil</dt><dd>{profile ? `${profile.profileCompleteness || 0}%` : '-'}</dd></div><div><dt>Bidang Keahlian</dt><dd>{record.expertise.length ? record.expertise.map(item => item.name).join(', ') : '-'}</dd></div><div><dt>Administrator Penanggung Jawab</dt><dd>{(record.profileAdmin && record.profileAdmin.name) || '-'}</dd></div><div><dt>Akses Administrator</dt><dd>{scopeLabels.length ? scopeLabels.join(', ') : '-'}</dd></div><div><dt>Penilai Aktif</dt><dd>{record.activeReviewerAssignments.length} penugasan</dd></div><div><dt>Riwayat Verifikasi</dt><dd>{record.verifications.length}</dd></div><div><dt>Riwayat Status</dt><dd>{record.statusHistory.length}</dd></div></dl></section>
        <div className="ris-modal-actions"><Button tone="gray" onClick={onClose}>Tutup</Button>{profile && <Button onClick={() => onNavigate(`/ris/profil-peneliti/${profile.profileId}/detail`)}>Buka Profil Lengkap</Button>}</div>
      </div>
    </Modal>
  );
};

export default function ArchivePage() {
  const { data, setData, user } = useRis();
  const history = useHistory();
  const [activeTab, setActiveTab] = useState(TAB.RESEARCH);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [accountStatusFilter, setAccountStatusFilter] = useState('all');
  const [selectedResearch, setSelectedResearch] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [researchEditor, setResearchEditor] = useState(null);
  const [researchDetail, setResearchDetail] = useState(null);
  const [researchForm, setResearchForm] = useState({ title: '', ownerId: '', status: '', notes: '', tags: '' });
  const [accountEditor, setAccountEditor] = useState(null);
  const [accountDetail, setAccountDetail] = useState(null);
  const [actionMenu, setActionMenu] = useState(null);
  const [archiveRemoval, setArchiveRemoval] = useState(null);
  const [accountForm, setAccountForm] = useState({ name: '', email: '', role: ROLE.LECTURER, adminScopes: [], isActive: true, deactivationReason: '' });
  const [error, setError] = useState('');

  const users = data.systemUsers || [];
  const ownerOptions = users.filter(account => [ROLE.LECTURER, ROLE.MANAGER].includes(normalizeRole(account.role)) && account.isActive !== false);
  const accountFor = userId => users.find(account => account.id === userId);

  const researchRecords = useMemo(() => buildResearchArchiveRecords(data), [data]);
  const userRecords = useMemo(() => buildUserArchiveRecords(data), [data]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredResearch = researchRecords.filter(record => `${record.title} ${record.ownerName} ${record.context}`.toLowerCase().includes(normalizedSearch)
    && (sourceFilter === 'all' || record.source === sourceFilter)
    && (statusFilter === 'all' || record.status === statusFilter));
  const filteredUsers = userRecords.filter(record => {
    const { account, profile } = record;
    return `${account.name} ${account.email} ${(profile && profile.nidn) || ''}`.toLowerCase().includes(normalizedSearch)
      && (roleFilter === 'all' || normalizeRole(account.role) === roleFilter)
      && (accountStatusFilter === 'all' || (accountStatusFilter === 'deleted' ? Boolean(account.deletedAt) : !account.deletedAt && (accountStatusFilter === 'active') === (account.isActive !== false)));
  });
  const filteredResearchKeys = filteredResearch.map(record => `${record.source}:${record.id}`);
  const filteredUserIds = filteredUsers.map(record => record.account.id);
  const selectedFilteredResearch = filteredResearch.filter(record => selectedResearch.includes(`${record.source}:${record.id}`));
  const selectedFilteredUsers = filteredUsers.filter(record => selectedUsers.includes(record.account.id));

  const toggleResearchSelection = key => {
    setSelectedResearch(current => (current.includes(key) ? current.filter(item => item !== key) : [...current, key]));
  };
  const toggleUserSelection = id => {
    setSelectedUsers(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]));
  };
  const toggleAllResearch = () => {
    setSelectedResearch(current => (filteredResearchKeys.every(key => current.includes(key))
      ? current.filter(key => !filteredResearchKeys.includes(key))
      : [...new Set([...current, ...filteredResearchKeys])]));
  };
  const toggleAllUsers = () => {
    setSelectedUsers(current => (filteredUserIds.every(id => current.includes(id))
      ? current.filter(id => !filteredUserIds.includes(id))
      : [...new Set([...current, ...filteredUserIds])]));
  };
  const exportResearch = async records => {
    setError('');
    try {
      await downloadCsvFromTemplate('archive-research', records.map(record => Object.fromEntries(researchCsvColumns.map(column => [column.label, column.value(record)]))));
    } catch (exportError) {
      setError(exportError.message || 'Ekspor CSV penelitian gagal.');
    }
  };
  const exportUsers = async records => {
    setError('');
    try {
      await downloadCsvFromTemplate('archive-users', records.map(record => Object.fromEntries(userCsvColumns.map(column => [column.label, column.value(record)]))));
    } catch (exportError) {
      setError(exportError.message || 'Ekspor CSV pengguna gagal.');
    }
  };
  const hasFilteredRecords = activeTab === TAB.RESEARCH ? Boolean(filteredResearch.length) : Boolean(filteredUsers.length);

  const researchMetrics = {
    total: researchRecords.length,
    internal: researchRecords.filter(item => item.source === SOURCE.INTERNAL).length,
    external: researchRecords.filter(item => item.source === SOURCE.EXTERNAL).length,
    final: researchRecords.filter(item => [STATUS.FUNDED, EXTERNAL_STATUS.VALIDATED, EXTERNAL_STATUS.ARCHIVED].includes(item.status)).length,
  };
  const userMetrics = {
    total: userRecords.length,
    lecturer: userRecords.filter(record => record.isLecturer).length,
    active: userRecords.filter(record => !record.account.deletedAt && record.account.isActive !== false).length,
    inactive: userRecords.filter(record => !record.account.deletedAt && record.account.isActive === false).length,
  };

  const clearFilters = () => {
    setSearch(''); setSourceFilter('all'); setStatusFilter('all'); setRoleFilter('all'); setAccountStatusFilter('all');
  };

  const openResearchEditor = record => {
    setResearchEditor(record);
    setResearchForm({
      title: record.title,
      ownerId: record.ownerId || '',
      status: record.status,
      notes: record.archiveMetadata.notes || '',
      tags: (record.archiveMetadata.tags || []).join(', '),
    });
    setError('');
  };

  const saveResearchMetadata = () => {
    if (researchEditor.source === SOURCE.INTERNAL && researchEditor.draft.archivedAt && researchForm.status !== STATUS.ARCHIVED) {
      setError('Proposal dari skema yang dihapus harus tetap berstatus Diarsipkan.');
      return;
    }
    if (!researchForm.title.trim() || !researchForm.ownerId || !researchForm.status) {
      setError('Judul, pemilik, dan status wajib diisi.');
      return;
    }
    const owner = accountFor(researchForm.ownerId);
    const archiveMetadata = { notes: researchForm.notes.trim(), tags: splitTags(researchForm.tags), updatedAt: new Date().toISOString(), updatedBy: user.id };
    setData(current => {
      const collection = researchEditor.source === SOURCE.INTERNAL ? current.drafts : current.externalResearchReports;
      const previous = (collection || []).find(item => item.id === researchEditor.id);
      const updated = researchEditor.source === SOURCE.INTERNAL ? {
        ...previous,
        userId: researchForm.ownerId,
        userName: owner ? owner.name : previous.userName,
        status: previous.archivedAt ? STATUS.ARCHIVED : researchForm.status,
        draftStatus: previous.archivedAt ? STATUS.ARCHIVED : researchForm.status,
        project: { ...(previous.project || {}), title: researchForm.title.trim() },
        archiveMetadata: { ...previous.archiveMetadata, ...archiveMetadata },
        updatedAt: new Date().toISOString(),
      } : {
        ...previous,
        userId: researchForm.ownerId,
        userName: owner ? owner.name : previous.userName,
        researchTitle: researchForm.title.trim(),
        submissionStatus: researchForm.status,
        archiveMetadata,
        updatedAt: new Date().toISOString(),
      };
      const key = researchEditor.source === SOURCE.INTERNAL ? 'drafts' : 'externalResearchReports';
      return {
        ...current,
        [key]: (collection || []).map(item => (item.id === researchEditor.id ? updated : item)),
        systemActivityLogs: [...(current.systemActivityLogs || []), createActivityLog(user, 'archive_update_research_metadata', researchEditor.source === SOURCE.INTERNAL ? 'research_draft' : 'external_research', researchEditor.id, previous, updated, uid)],
      };
    });
    setResearchEditor(null);
  };

  const researchPath = (record, edit) => {
    if (record.source === SOURCE.INTERNAL) return edit ? `/ris/arsip/penelitian/internal/${record.id}/edit` : `/ris/pengajuan-penelitian-internal/${record.id}/preview`;
    return edit ? `/ris/arsip/penelitian/external/${record.id}/edit` : `/ris/penelitian-eksternal/${record.id}/detail`;
  };

  const openAccountEditor = account => {
    setAccountEditor(account);
    setAccountForm({
      name: account.name || '',
      email: account.email || '',
      role: normalizeRole(account.role),
      adminScopes: account.adminScopes || [],
      isActive: account.isActive !== false,
      deactivationReason: account.deactivationReason || '',
    });
    setError('');
  };

  const saveAccount = () => {
    if (!accountForm.name.trim() || !accountForm.email.trim() || !accountForm.email.includes('@')) {
      setError('Nama dan email institusi yang valid wajib diisi.');
      return;
    }
    if (users.some(account => account.id !== accountEditor.id && String(account.email || '').toLowerCase() === accountForm.email.trim().toLowerCase())) {
      setError('Email sudah digunakan akun lain.');
      return;
    }
    const allowedRole = normalizeRole(user.role) === ROLE.SUPER_ADMIN || accountForm.role !== ROLE.SUPER_ADMIN;
    if (!allowedRole) {
      setError('Hanya Super Admin yang dapat memberikan role Super Admin.');
      return;
    }
    if (accountForm.role === ROLE.ADMIN && !accountForm.adminScopes.length) {
      setError('Pilih minimal satu tugas dan akses untuk akun admin.');
      return;
    }
    if (accountEditor.isActive !== false && !accountForm.isActive && !accountForm.deactivationReason.trim()) {
      setError('Alasan penonaktifan wajib diisi.');
      return;
    }
    setData(current => applyArchiveAccountUpdate(current, accountEditor.id, accountForm, user, uid));
    setAccountEditor(null);
  };

  const researchActions = record => [
    { key: 'summary', label: 'Ringkasan', icon: 'report', onSelect: () => setResearchDetail(record) },
    { key: 'metadata', label: 'Metadata', icon: 'document', onSelect: () => openResearchEditor(record) },
    { key: 'edit', label: 'Edit Lengkap', icon: 'document', onSelect: () => history.push(researchPath(record, true)) },
    { key: 'export', label: 'Ekspor CSV', icon: 'download', onSelect: () => exportResearch([record]) },
    { key: 'separator', separator: true },
    { key: 'remove', label: 'Hapus dari Arsip', icon: 'trash', danger: true, onSelect: () => setArchiveRemoval({ type: TAB.RESEARCH, record }) },
  ];

  const userActions = (record, editable) => {
    const { account, profile } = record;
    const actions = [
      { key: 'summary', label: 'Ringkasan', icon: 'report', onSelect: () => setAccountDetail(record) },
    ];
    if (profile) {
      actions.push({
        key: 'profile', label: 'Ubah Profil', icon: 'user', disabled: !editable,
        title: !editable ? 'Akun sendiri atau akun yang dihapus tidak dapat diubah dari arsip ini.' : '',
        onSelect: () => history.push(`/ris/profil-peneliti/${profile.profileId}/edit`),
      });
    }
    actions.push(
      {
        key: 'account', label: 'Ubah Akun', icon: 'user', disabled: !editable,
        title: !editable ? 'Akun sendiri atau akun yang dihapus tidak dapat diubah dari arsip ini.' : '',
        onSelect: () => openAccountEditor(account),
      },
      { key: 'export', label: 'Ekspor CSV', icon: 'download', onSelect: () => exportUsers([record]) },
      { key: 'separator', separator: true },
      {
        key: 'remove', label: 'Hapus dari Arsip', icon: 'trash', danger: true, disabled: !editable,
        title: !editable ? 'Akun sendiri atau akun yang dihapus tidak dapat dihapus dari arsip.' : '',
        onSelect: () => setArchiveRemoval({ type: TAB.USERS, record }),
      }
    );
    return actions;
  };

  const confirmArchiveRemoval = () => {
    if (!archiveRemoval) return;
    if (archiveRemoval.type === TAB.RESEARCH) {
      const { record } = archiveRemoval;
      setData(current => removeResearchFromArchive(current, record.source, record.id, user, uid));
      setSelectedResearch(current => current.filter(key => key !== `${record.source}:${record.id}`));
    } else {
      const { account } = archiveRemoval.record;
      setData(current => removeUserFromArchive(current, account.id, user, uid));
      setSelectedUsers(current => current.filter(id => id !== account.id));
    }
    setArchiveRemoval(null);
  };

  const actionMenuItems = actionMenu
    ? (actionMenu.type === TAB.RESEARCH
      ? researchActions(actionMenu.record)
      : userActions(actionMenu.record, actionMenu.editable))
    : [];

  const roleOptions = normalizeRole(user.role) === ROLE.SUPER_ADMIN ? Object.values(ROLE) : [ROLE.MANAGER, ROLE.ADMIN, ROLE.LECTURER];
  const statusOptions = activeTab === TAB.RESEARCH
    ? [...new Set(researchRecords.filter(item => sourceFilter === 'all' || item.source === sourceFilter).map(item => item.status))]
    : [];
  const filtersActive = search || sourceFilter !== 'all' || statusFilter !== 'all' || roleFilter !== 'all' || accountStatusFilter !== 'all';

  return (
    <div className="ris-page ris-workspace-page ris-archive-page">
      <PageHeader title="Arsip" description="Pusat data penelitian dan akun yang tersimpan di RIS." />
      <div className="ris-tabs ris-archive-tabs" role="tablist" aria-label="Jenis arsip">
        <button type="button" role="tab" aria-selected={activeTab === TAB.RESEARCH} className={activeTab === TAB.RESEARCH ? 'active' : ''} onClick={() => { setActiveTab(TAB.RESEARCH); clearFilters(); }}><Icon name="report" size={17} />Penelitian <span>{researchRecords.length}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === TAB.USERS} className={activeTab === TAB.USERS ? 'active' : ''} onClick={() => { setActiveTab(TAB.USERS); clearFilters(); }}><Icon name="user" size={17} />Pengguna <span>{userRecords.length}</span></button>
      </div>

      <section className="ris-letter-stats ris-research-stats">
        {activeTab === TAB.RESEARCH ? <React.Fragment><MetricCard label="Total Penelitian" value={researchMetrics.total} /><MetricCard label="Penelitian Internal" value={researchMetrics.internal} /><MetricCard label="Eksternal / Mandiri" value={researchMetrics.external} /><MetricCard label="Akhir / Tervalidasi" value={researchMetrics.final} /></React.Fragment> : <React.Fragment><MetricCard label="Total Pengguna" value={userMetrics.total} /><MetricCard label="Dosen" value={userMetrics.lecturer} /><MetricCard label="Akun Aktif" value={userMetrics.active} /><MetricCard label="Akun Nonaktif" value={userMetrics.inactive} /></React.Fragment>}
      </section>

      <section className="ris-list-filters" aria-label={`Filter arsip ${activeTab === TAB.RESEARCH ? 'penelitian' : 'pengguna'}`}>
        <div className="ris-search"><Icon name="search" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={activeTab === TAB.RESEARCH ? 'Cari penelitian atau pemilik...' : 'Cari nama, email, atau NIDN...'} /></div>
        {activeTab === TAB.RESEARCH ? <React.Fragment><select value={sourceFilter} onChange={event => { setSourceFilter(event.target.value); setStatusFilter('all'); }} aria-label="Sumber penelitian"><option value="all">Semua sumber</option><option value={SOURCE.INTERNAL}>Internal</option><option value={SOURCE.EXTERNAL}>Eksternal / Mandiri</option></select><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Status penelitian"><option value="all">Semua status</option>{statusOptions.map(status => <option key={status} value={status}>{(STATUS_META[status] || EXTERNAL_STATUS_META[status] || {}).label || status}</option>)}</select></React.Fragment> : <React.Fragment><select value={roleFilter} onChange={event => setRoleFilter(event.target.value)} aria-label="Peran pengguna"><option value="all">Semua peran</option>{Object.values(ROLE).map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select><select value={accountStatusFilter} onChange={event => setAccountStatusFilter(event.target.value)} aria-label="Status akun"><option value="all">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option><option value="deleted">Dihapus</option></select></React.Fragment>}
        {filtersActive && <button type="button" className="ris-filter-reset" onClick={clearFilters}>Atur ulang filter</button>}
      </section>

      <div className="ris-archive-export-bar">
        <span>{activeTab === TAB.RESEARCH ? `${selectedFilteredResearch.length} dari ${filteredResearch.length} penelitian dipilih` : `${selectedFilteredUsers.length} dari ${filteredUsers.length} pengguna dipilih`}</span>
        <div>
          <Button tone="gray" disabled={!hasFilteredRecords} onClick={() => { if (activeTab === TAB.RESEARCH) exportResearch(filteredResearch); else exportUsers(filteredUsers); }}><Icon name="download" size={15} />Ekspor Hasil Filter</Button>
          <Button disabled={activeTab === TAB.RESEARCH ? !selectedFilteredResearch.length : !selectedFilteredUsers.length} onClick={() => { if (activeTab === TAB.RESEARCH) exportResearch(selectedFilteredResearch); else exportUsers(selectedFilteredUsers); }}><Icon name="download" size={15} />Ekspor Pilihan</Button>
        </div>
      </div>
      <FloatingError message={!researchEditor && !accountEditor ? error : ''} />

      {activeTab === TAB.RESEARCH && <div className="ris-table-wrap"><table className="ris-table ris-action-table ris-archive-research-table"><thead><tr><th><input type="checkbox" aria-label="Pilih semua hasil penelitian" checked={filteredResearch.length > 0 && filteredResearchKeys.every(key => selectedResearch.includes(key))} onChange={toggleAllResearch} /></th><th>Judul Penelitian</th><th>Pemilik</th><th>Sumber</th><th>Tahun</th><th>Skema / Kategori</th><th>Cakupan Data</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filteredResearch.map(record => { const key = `${record.source}:${record.id}`; return <tr key={key}><td><input type="checkbox" aria-label={`Pilih ${record.title}`} checked={selectedResearch.includes(key)} onChange={() => toggleResearchSelection(key)} /></td><td className="ris-title-cell ris-archive-title-cell"><strong title={record.title}>{record.title}</strong><small>Diperbarui {formatDate(record.updatedAt)}</small></td><td className="ris-archive-owner-cell">{record.ownerName}</td><td><StatusBadge tone={sourceTone[record.source]}>{sourceLabel[record.source]}</StatusBadge></td><td>{record.year}</td><td className="ris-archive-context-cell">{record.context}</td><td className="ris-archive-coverage-cell">{record.coverageLabel}</td><td className="ris-archive-status-cell"><StatusBadge tone={record.statusMeta.tone}>{record.statusMeta.label}</StatusBadge></td><td><ArchiveActionMenu locale={user.uiLocale} onOpen={() => setActionMenu({ type: TAB.RESEARCH, record })} /></td></tr>; })}{filteredResearch.length === 0 && <EmptyRow colSpan={9}>Tidak ada penelitian yang sesuai.</EmptyRow>}</tbody></table></div>}

      {activeTab === TAB.USERS && <div className="ris-table-wrap"><table className="ris-table ris-action-table ris-archive-user-table"><thead><tr><th><input type="checkbox" aria-label="Pilih semua hasil pengguna" checked={filteredUsers.length > 0 && filteredUserIds.every(id => selectedUsers.includes(id))} onChange={toggleAllUsers} /></th><th>Nama</th><th>Email</th><th>Peran</th><th>NIDN / Identitas</th><th>Unit / Fakultas</th><th>Keterkaitan</th><th>Status Profil</th><th>Status Akun</th><th>Aksi</th></tr></thead><tbody>{filteredUsers.map(record => { const { account, profile } = record; const profileStatus = getProfileStatusMeta(profile && profile.profileStatus); const editable = canEditAccount(user, account); return <tr key={account.id}><td><input type="checkbox" aria-label={`Pilih ${account.name}`} checked={selectedUsers.includes(account.id)} onChange={() => toggleUserSelection(account.id)} /></td><td className="ris-title-cell">{account.name}</td><td>{account.email}</td><td>{ROLE_LABELS[normalizeRole(account.role)] || account.role}</td><td>{(profile && (profile.nidn || profile.nip)) || '-'}</td><td>{(profile && (profile.unit || profile.faculty)) || '-'}</td><td className="ris-archive-relation-cell"><strong>{record.researchLabel}</strong><small>{record.proposalAssignments.length + record.fundedAssignments.length} penugasan penilaian</small></td><td><StatusBadge tone={profileStatus.tone}>{profile ? profileStatus.label : 'Belum ada profil'}</StatusBadge></td><td><StatusBadge tone={account.deletedAt ? 'gray' : account.isActive === false ? 'red' : 'green'}>{account.deletedAt ? 'Dihapus' : account.isActive === false ? 'Nonaktif' : 'Aktif'}</StatusBadge></td><td><ArchiveActionMenu locale={user.uiLocale} onOpen={() => setActionMenu({ type: TAB.USERS, record, editable })} /></td></tr>; })}{filteredUsers.length === 0 && <EmptyRow colSpan={10}>Tidak ada pengguna yang sesuai.</EmptyRow>}</tbody></table></div>}

      {researchDetail && <ResearchArchiveDetail record={researchDetail} onClose={() => setResearchDetail(null)} onNavigate={path => { setResearchDetail(null); history.push(path); }} />}
      {accountDetail && <UserArchiveDetail record={accountDetail} onClose={() => setAccountDetail(null)} onNavigate={path => { setAccountDetail(null); history.push(path); }} />}

      {actionMenu && <Modal title={actionMenu.type === TAB.RESEARCH ? 'Aksi Arsip Penelitian' : 'Aksi Arsip Pengguna'} width={390} onClose={() => setActionMenu(null)}><div className="ris-modal-body"><div className="ris-action-menu-list">{actionMenuItems.map(action => (action.separator ? <div key={action.key} className="ris-archive-action-separator" role="separator" /> : <button key={action.key} type="button" disabled={action.disabled} className={action.danger ? 'danger' : ''} title={action.title || undefined} onClick={() => { setActionMenu(null); action.onSelect(); }}><Icon name={action.icon || 'document'} size={16} /><span>{action.label}</span></button>))}</div><div className="ris-modal-actions"><Button tone="gray" onClick={() => setActionMenu(null)}>Tutup</Button></div></div></Modal>}

      {archiveRemoval && <Modal title="Konfirmasi Penghapusan Arsip" width={520} onClose={() => setArchiveRemoval(null)}><div className="ris-modal-body"><p className="ris-modal-intro">{archiveRemoval.type === TAB.RESEARCH ? 'Hapus penelitian ini dari arsip?' : 'Hapus pengguna ini dari arsip?'}</p><p className="ris-archive-removal-note">Data sumber dan seluruh relasi tetap tersimpan; hanya entri arsip ini yang disembunyikan.</p><div className="ris-modal-actions"><Button tone="gray" onClick={() => setArchiveRemoval(null)}>Batal</Button><Button tone="red" onClick={confirmArchiveRemoval}>Hapus dari Arsip</Button></div></div></Modal>}

      {researchEditor && <Modal title="Edit Metadata Penelitian" width={760} onClose={() => setResearchEditor(null)}><div className="ris-modal-body"><FloatingError message={error} /><div className="ris-form-grid two"><Field label="Judul Penelitian" required><input value={researchForm.title} onChange={event => setResearchForm(current => ({ ...current, title: event.target.value }))} /></Field><Field label="Pemilik" required><select value={researchForm.ownerId} onChange={event => setResearchForm(current => ({ ...current, ownerId: event.target.value }))}>{ownerOptions.map(account => <option key={account.id} value={account.id}>{account.name} — {account.email}</option>)}</select></Field><Field label="Status" required><select disabled={Boolean(researchEditor.source === SOURCE.INTERNAL && researchEditor.draft.archivedAt)} value={researchForm.status} onChange={event => setResearchForm(current => ({ ...current, status: event.target.value }))}>{(researchEditor.source === SOURCE.INTERNAL ? Object.values(STATUS) : Object.values(EXTERNAL_STATUS)).map(status => <option key={status} value={status}>{(STATUS_META[status] || EXTERNAL_STATUS_META[status] || {}).label || status}</option>)}</select></Field><Field label="Tag Arsip" hint="Pisahkan beberapa tag dengan koma."><input value={researchForm.tags} onChange={event => setResearchForm(current => ({ ...current, tags: event.target.value }))} placeholder="prioritas, kolaborasi, 2026" /></Field></div><Field label="Catatan Arsip" alignStart><textarea rows="4" value={researchForm.notes} onChange={event => setResearchForm(current => ({ ...current, notes: event.target.value }))} /></Field><div className="ris-modal-actions"><Button tone="gray" onClick={() => setResearchEditor(null)}>Batal</Button><Button onClick={saveResearchMetadata}>Simpan Metadata</Button></div></div></Modal>}

      {accountEditor && <Modal title="Ubah Akun Pengguna" width={820} onClose={() => setAccountEditor(null)}><div className="ris-modal-body"><FloatingError message={error} /><div className="ris-form-grid two"><Field label="Nama" required><input value={accountForm.name} onChange={event => setAccountForm(current => ({ ...current, name: event.target.value }))} /></Field><Field label="Email Institusi" required><input type="email" value={accountForm.email} onChange={event => setAccountForm(current => ({ ...current, email: event.target.value }))} /></Field><Field label="Peran" required><select value={accountForm.role} onChange={event => { const role = event.target.value; setAccountForm(current => ({ ...current, role, adminScopes: role === ROLE.ADMIN ? current.adminScopes : [] })); }}>{roleOptions.map(role => <option value={role} key={role}>{ROLE_LABELS[role]}</option>)}</select></Field><Field label="Status Akun"><label className="ris-toggle-line"><input type="checkbox" checked={accountForm.isActive} onChange={event => setAccountForm(current => ({ ...current, isActive: event.target.checked, deactivationReason: event.target.checked ? '' : current.deactivationReason }))} /><span>{accountForm.isActive ? 'Aktif' : 'Nonaktif'}</span></label></Field></div>{accountForm.role === ROLE.ADMIN && <Field label="Tugas dan Akses Administrator" required alignStart><div className="ris-choice-grid ris-admin-scope-grid">{ADMIN_SCOPE_OPTIONS.map(option => { const selected = accountForm.adminScopes.includes(option.value); return <label key={option.value} className={selected ? 'active' : ''}><input type="checkbox" checked={selected} onChange={() => setAccountForm(current => ({ ...current, adminScopes: selected ? current.adminScopes.filter(scope => scope !== option.value) : [...current.adminScopes, option.value] }))} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>; })}</div></Field>}{!accountForm.isActive && <Field label="Alasan Penonaktifan" required alignStart><textarea rows="3" value={accountForm.deactivationReason} onChange={event => setAccountForm(current => ({ ...current, deactivationReason: event.target.value }))} placeholder="Jelaskan alasan akun dinonaktifkan" /></Field>}<div className="ris-modal-actions"><Button tone="gray" onClick={() => setAccountEditor(null)}>Batal</Button><Button onClick={saveAccount}>Simpan Akun</Button></div></div></Modal>}
    </div>
  );
}
