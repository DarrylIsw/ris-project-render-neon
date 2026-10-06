/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React, { useMemo, useState } from 'react';
import { z } from 'zod';
import { useHistory } from 'react-router-dom';
import {
  ADMIN_SCOPE_OPTIONS, ALL_ADMIN_SCOPES, ROLE, ROLE_LABELS, hasFullAccess
} from '../../../shared/workflows/workflow';
import { useRis } from '../../../core/RisContext';
import { Button, EmptyRow, Field, FloatingError, Modal } from '../../../shared/components/Ui';
import Icon from '../../../shared/components/Icon';
import { uid } from '../../../core/data';
import {
  DEFAULT_PROFILE_FORM,
  PROFILE_STATUS,
  VERIFICATION_STATUS,
  applyProfileAccountAction,
  calculateProfileCompleteness,
  canEditProfile,
  canManageProfileAccount,
  canOpenProfileModule,
  createActivityLog,
  createNotification,
  exportProfilesCsv,
  filterProfiles,
  getCompletenessLabel,
  getCompletenessTone,
  getExpertiseForProfile,
  getProfileByUser,
  getProfileDocuments,
  getProfileMetrics,
  getProfileStatusMeta,
  getVerificationMeta,
  isProfileAdmin,
} from '../workflows/researcherProfileWorkflow';
import ResearcherProfileDetailPage from './ResearcherProfileDetailPage';
import downloadCsvFromTemplate from '../../exports/exportWorkflow';

const defaultFilters = {
  search: '', faculty: '', studyProgram: '', unit: '', position: '', verificationStatus: '', profileStatus: '', expertise: '', activeStatus: ''
};

const emptyAccountForm = {
  fullName: '', institutionEmail: '', role: ROLE.LECTURER, password: ''
};
const accountEmailSchema = z.email().max(320);

export default function ResearcherProfileDashboardPage() {
  const { data, setData, user } = useRis();
  const history = useHistory();
  const [filters, setFilters] = useState(defaultFilters);
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState('');
  const [exportError, setExportError] = useState('');
  const [form, setForm] = useState(emptyAccountForm);
  const [accountAction, setAccountAction] = useState(null);
  const [profileActionMenu, setProfileActionMenu] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState('');

  const admin = isProfileAdmin(user);
  const canCreateAdminAccount = hasFullAccess(user);
  const ownProfile = getProfileByUser(data, user);
  const metrics = getProfileMetrics(data);
  const filteredProfiles = useMemo(() => filterProfiles(data.researcherProfiles || [], data, filters), [data, filters]);
  const faculties = [...new Set((data.researcherProfiles || []).map(item => item.faculty).filter(Boolean))];
  const programs = [...new Set((data.researcherProfiles || []).map(item => item.studyProgram).filter(Boolean))];

  const ensureOwnProfile = () => {
    if (ownProfile) {
      history.push(`/ris/profil-peneliti/${ownProfile.profileId}/edit`);
      return;
    }
    history.push('/ris/profil-saya');
  };

  const openOwnProfile = () => {
    if (ownProfile) {
      history.push(`/ris/profil-peneliti/${ownProfile.profileId}/detail`);
      return;
    }
    history.push('/ris/profil-saya');
  };

  if (!canOpenProfileModule(user)) {
    return <div className="ris-page"><h1>Profil Peneliti</h1><p className="ris-muted">Peran akun ini tidak memiliki akses ke area profil peneliti.</p></div>;
  }

  if (!admin && ownProfile) {
    return <ResearcherProfileDetailPage match={{ params: { profileId: ownProfile.profileId } }} />;
  }

  const createUser = () => {
    const requestedRole = canCreateAdminAccount && form.role === ROLE.ADMIN ? ROLE.ADMIN : ROLE.LECTURER;
    const creatingAdmin = requestedRole === ROLE.ADMIN;
    const cleanedEmail = String(form.institutionEmail || '').trim().toLowerCase();
    const requiredFields = ['fullName', 'institutionEmail'];
    const missing = requiredFields.find(field => !String(form[field] || '').trim());
    if (missing) {
      setCreateError('Lengkapi seluruh field wajib sebelum membuat akun.');
      return;
    }
    if (!accountEmailSchema.safeParse(cleanedEmail).success) {
      setCreateError('Masukkan alamat email institusi yang valid.');
      return;
    }
    if (String(form.password || '').length < 12) {
      setCreateError('Kata sandi awal minimal 12 karakter.');
      return;
    }
    const emailExists = (data.systemUsers || []).some(item => String(item.email || '').trim().toLowerCase() === cleanedEmail);
    if (emailExists) {
      setCreateError('Email institusi sudah digunakan akun lain.');
      return;
    }
    const now = new Date().toISOString();
    const profileNumber = Number(data.profileSequence || 0) + 1;
    const newUserId = `user-${creatingAdmin ? 'admin' : 'researcher'}-${profileNumber}`;
    const newProfileId = `${creatingAdmin ? 'admin' : 'lecturer'}-${profileNumber + 10}`;
    const account = {
      id: newUserId,
      name: form.fullName.trim(),
      email: cleanedEmail,
      password: form.password,
      role: requestedRole,
      adminScopes: creatingAdmin ? ALL_ADMIN_SCOPES : [],
      profileId: newProfileId,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    };
    const profile = {
      ...DEFAULT_PROFILE_FORM,
      profileId: newProfileId,
      id: newProfileId,
      userId: newUserId,
      fullName: form.fullName.trim(),
      institutionEmail: cleanedEmail,
      profileStatus: PROFILE_STATUS.DRAFT,
      verificationStatus: VERIFICATION_STATUS.PENDING,
      profileCompleteness: 0,
      lastUpdatedAt: now,
      lastUpdatedBy: user.id,
      createdAt: now,
      updatedAt: now,
    };
    const completeness = calculateProfileCompleteness(profile, []);
    const saved = { ...profile, profileCompleteness: completeness };
    setData(current => ({
      ...current,
      profileSequence: profileNumber,
      systemUsers: [...(current.systemUsers || []), account],
      researcherProfiles: [...(current.researcherProfiles || []), saved],
      applicantProfiles: creatingAdmin ? (current.applicantProfiles || []) : [...(current.applicantProfiles || []), {
        id: saved.profileId,
        userId: saved.userId,
        name: saved.fullName,
        identifier: '',
        applicantRole: '',
        applicantKind: 'lecturer',
        status: saved.profileStatus,
        faculty: saved.faculty,
        program: saved.studyProgram,
        email: saved.institutionEmail,
      }],
      lecturers: creatingAdmin ? (current.lecturers || []) : [...(current.lecturers || []), {
        id: saved.profileId,
        userId: saved.userId,
        name: saved.fullName,
        nidn: '',
        faculty: '',
        program: '',
        educationLevel: '',
        functionalPosition: '',
        employmentStatus: '',
        sintaScore: 0,
        researchCount: 0,
        lastResearchYear: null,
        orcid: '',
      }],
      systemActivityLogs: [...(current.systemActivityLogs || []), createActivityLog(user, 'create_user', 'researcher_profile', saved.profileId, null, { account: { ...account, password: '[redacted]' }, profile: saved }, uid)],
      notifications: [...(current.notifications || []), createNotification(saved.userId, user.id, 'new_profile_created', `Akun ${creatingAdmin ? 'admin' : 'dosen'} dibuat oleh ${user.name} dan menunggu aktivasi pengelola.`, uid)],
    }));
    setCreateError('');
    setForm(emptyAccountForm);
    setShowCreate(false);
    history.push(`/ris/profil-peneliti/${saved.profileId}/detail`);
  };

  const exportCsv = async () => {
    setExportError('');
    try {
      await downloadCsvFromTemplate('researcher-profiles', exportProfilesCsv(filteredProfiles, data));
    } catch (error) {
      setExportError(error.message || 'Ekspor CSV profil gagal.');
    }
  };

  const closeAccountAction = () => {
    setAccountAction(null);
    setActionReason('');
    setActionError('');
  };

  const submitAccountAction = () => {
    try {
      setData(current => applyProfileAccountAction(current, accountAction.profile.profileId, accountAction.action, actionReason, user, uid));
      closeAccountAction();
    } catch (error) {
      setActionError(error.message);
    }
  };

  const openAccountAction = (profile, action) => {
    setActionReason('');
    setActionError('');
    setAccountAction({ profile, action });
  };

  const ownDocs = ownProfile ? getProfileDocuments(data, ownProfile.profileId) : [];

  return (
    <div className="ris-page ris-workspace-page ris-profile-page">
      <div className="ris-page-head split">
        <div>
          <h1>Manajemen Informasi Peneliti</h1>
          <p className="ris-muted">Sumber data utama untuk identitas, dokumen, bidang minat, dan verifikasi peneliti RIS.</p>
        </div>
        {admin ? (
          <div className="ris-button-row">
            <Button tone="blue" onClick={openOwnProfile}>{ownProfile ? 'Profil Saya' : 'Buat Profil Saya'}</Button>
          </div>
        ) : <Button tone="blue" onClick={ensureOwnProfile}>{ownProfile ? 'Ubah Profil Saya' : 'Siapkan Profil Awal'}</Button>}
      </div>

      {admin && (
        <section className="ris-card ris-profile-overview ris-profile-admin-overview">
          {ownProfile ? (
            <>
              <div>
                <h2>Profil Saya</h2>
                <p className="ris-muted">{ownProfile.fullName || user.name} • {ownProfile.position || 'Peran administratif'} • {ownProfile.institutionEmail}</p>
                <div className="ris-badge-row">
                  <span className={`ris-badge ${getProfileStatusMeta(ownProfile.profileStatus).tone}`}>{getProfileStatusMeta(ownProfile.profileStatus).label}</span>
                  <span className={`ris-badge ${getVerificationMeta(ownProfile.verificationStatus).tone}`}>{getVerificationMeta(ownProfile.verificationStatus).label}</span>
                  <span className={`ris-badge ${getCompletenessTone(ownProfile.profileCompleteness)}`}>{getCompletenessLabel(ownProfile.profileCompleteness, ownProfile.verificationStatus)} • {ownProfile.profileCompleteness}%</span>
                </div>
              </div>
              <div className="ris-button-row"><Button tone="gray" onClick={ensureOwnProfile}>Ubah Profil</Button></div>
            </>
          ) : (
            <div>
              <h2>Profil Saya</h2>
              <p className="ris-muted">Profil pribadi sedang disiapkan agar akun admin/manager tetap punya data profil sendiri.</p>
            </div>
          )}
        </section>
      )}

      <section className="ris-module-grid compact">
        <div className="ris-metric-card"><span>Total Profil</span><strong>{metrics.totalProfiles}</strong><small>Seluruh peneliti</small></div>
        <div className="ris-metric-card"><span>Menunggu Verifikasi</span><strong>{metrics.pendingProfiles}</strong><small>Perlu diperiksa</small></div>
        <div className="ris-metric-card"><span>Terverifikasi</span><strong>{metrics.verifiedProfiles}</strong><small>Profil terverifikasi</small></div>
        <div className="ris-metric-card"><span>Belum Lengkap</span><strong>{metrics.incompleteProfiles}</strong><small>Perlu dilengkapi</small></div>
      </section>

      {!admin && (
        <section className="ris-card ris-profile-overview">
          {ownProfile ? (
            <>
              <div>
                <h2>{ownProfile.frontTitle ? `${ownProfile.frontTitle} ` : ''}{ownProfile.fullName}{ownProfile.backTitle ? `, ${ownProfile.backTitle}` : ''}</h2>
                <p className="ris-muted">{ownProfile.institutionEmail} • {ownProfile.faculty} / {ownProfile.studyProgram}</p>
                <div className="ris-badge-row">
                  <span className={`ris-badge ${getProfileStatusMeta(ownProfile.profileStatus).tone}`}>{getProfileStatusMeta(ownProfile.profileStatus).label}</span>
                  <span className={`ris-badge ${getVerificationMeta(ownProfile.verificationStatus).tone}`}>{getVerificationMeta(ownProfile.verificationStatus).label}</span>
                  <span className={`ris-badge ${getCompletenessTone(ownProfile.profileCompleteness)}`}>{getCompletenessLabel(ownProfile.profileCompleteness, ownProfile.verificationStatus)} • {ownProfile.profileCompleteness}%</span>
                </div>
              </div>
              <div className="ris-progress-card">
                <div className="ris-progress-line"><span style={{ width: `${ownProfile.profileCompleteness || 0}%` }} /></div>
                <small>{ownDocs.length} dokumen aktif • {getExpertiseForProfile(data, ownProfile.profileId).length} bidang minat</small>
                <div className="ris-button-row"><Button tone="blue" onClick={() => history.push(`/ris/profil-peneliti/${ownProfile.profileId}/detail`)}>Detail</Button><Button tone="green" onClick={() => history.push(`/ris/profil-peneliti/${ownProfile.profileId}/edit`)}>Ubah</Button></div>
              </div>
            </>
          ) : (
            <div>
              <h2>Profil belum tersedia</h2>
              <p className="ris-muted">Sistem akan membuat draft profil pertama kali. Lengkapi data wajib agar dapat diverifikasi LPPM.</p>
              <Button tone="green" onClick={ensureOwnProfile}>Mulai Penyiapan Profil Awal</Button>
            </div>
          )}
        </section>
      )}

      {admin && (
        <section className="ris-section-spaced">
          <div className="ris-section-title-row"><h2>Daftar Profil Peneliti</h2><div className="ris-button-row"><Button tone="green" onClick={() => setShowCreate(true)}>{canCreateAdminAccount ? 'Buat Akun' : 'Buat Akun Dosen'}</Button><Button tone="gray" onClick={exportCsv}>Ekspor CSV</Button></div></div>
          <FloatingError message={exportError} />
          <div className="ris-filter-grid">
            <Field label="Pencarian"><input value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} placeholder="Nama, email, NIDN" /></Field>
            <Field label="Fakultas"><select value={filters.faculty} onChange={event => setFilters({ ...filters, faculty: event.target.value })}><option value="">Semua</option>{faculties.map(item => <option key={item} value={item}>{item}</option>)}</select></Field>
            <Field label="Program Studi"><select value={filters.studyProgram} onChange={event => setFilters({ ...filters, studyProgram: event.target.value })}><option value="">Semua</option>{programs.map(item => <option key={item} value={item}>{item}</option>)}</select></Field>
            <Field label="Verifikasi"><select value={filters.verificationStatus} onChange={event => setFilters({ ...filters, verificationStatus: event.target.value })}><option value="">Semua</option>{Object.values(VERIFICATION_STATUS).map(item => <option key={item} value={item}>{getVerificationMeta(item).label}</option>)}</select></Field>
            <Field label="Status Akun"><select value={filters.activeStatus} onChange={event => setFilters({ ...filters, activeStatus: event.target.value })}><option value="">Semua</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></Field>
          </div>
          <div className="ris-table-wrap">
            <table className="ris-table ris-action-table ris-profile-table">
              <thead><tr><th>No.</th><th>Peneliti</th><th>Unit</th><th>Peran / Tugas</th><th>Kelengkapan</th><th>Verifikasi</th><th>Status Akun</th><th>Aksi</th></tr></thead>
              <tbody>
                {filteredProfiles.map((profile, index) => {
                  const verificationMeta = getVerificationMeta(profile.verificationStatus);
                  const account = (data.systemUsers || []).find(item => item.id === profile.userId) || {};
                  const scopeLabels = ADMIN_SCOPE_OPTIONS.filter(option => (account.adminScopes || []).includes(option.value)).map(option => option.label);
                  const canManageAccount = canManageProfileAccount(profile, user, account);
                  return (
                    <tr key={profile.profileId}>
                      <td>{index + 1}.</td>
                      <td className="ris-profile-person"><strong>{profile.frontTitle ? `${profile.frontTitle} ` : ''}{profile.fullName}{profile.backTitle ? `, ${profile.backTitle}` : ''}</strong><small>{profile.institutionEmail}</small><small>{profile.nidn || 'Identitas belum tersedia'}</small></td>
                      <td className="ris-profile-unit"><strong>{profile.faculty || '-'}</strong><small>{profile.studyProgram || '-'}</small></td>
                      <td><strong>{ROLE_LABELS[account.role] || 'Dosen'}</strong>{scopeLabels.length > 0 && <small className="ris-table-secondary">{scopeLabels.join(', ')}</small>}</td>
                      <td><div className="ris-profile-completeness"><strong>{profile.profileCompleteness || 0}%</strong><div className="ris-progress-line"><span style={{ width: `${profile.profileCompleteness || 0}%` }} /></div></div></td>
                      <td><span className={`ris-badge ${verificationMeta.tone}`}>{verificationMeta.label}</span></td>
                      <td><span className={`ris-badge ${account.isActive === false ? 'red' : 'green'}`}>{account.isActive === false ? 'Nonaktif' : 'Aktif'}</span></td>
                      <td><button type="button" className="ris-action gray ris-row-action-trigger" aria-label="Aksi" aria-haspopup="dialog" onClick={() => setProfileActionMenu({ profile, account, canEdit: canEditProfile(profile, user, account), canManage: canManageAccount })}>Aksi<Icon name="chevron" size={13} /></button></td>
                    </tr>
                  );
                })}
                {filteredProfiles.length === 0 && <EmptyRow colSpan={8}>Tidak ada profil sesuai filter.</EmptyRow>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {accountAction && <Modal title={{ activate: 'Aktifkan Akun', deactivate: 'Nonaktifkan Akun', delete: 'Hapus Akun' }[accountAction.action]} onClose={closeAccountAction} width={520}>
        <div className="ris-modal-body ris-profile-action-modal">
          <p><strong>{accountAction.profile.fullName}</strong><span>{accountAction.profile.institutionEmail}</span></p>
          {accountAction.action === 'delete' && <div className="ris-alert ris-alert-warning">Akun akan dihapus dari daftar aktif dan tidak bisa digunakan untuk masuk. Riwayat penelitian, surat, dan audit tetap tersimpan.</div>}
          {accountAction.action === 'deactivate' && <p className="ris-muted">Akun tidak dapat digunakan untuk masuk sampai diaktifkan kembali.</p>}
          {accountAction.action === 'activate' && <p className="ris-muted">Akses akun akan dipulihkan dengan peran dan tugas yang sama.</p>}
          {accountAction.action !== 'activate' && <Field label="Alasan" required alignStart><textarea rows="3" value={actionReason} onChange={event => setActionReason(event.target.value)} placeholder="Tuliskan alasan tindakan ini" /></Field>}
          <FloatingError message={actionError} />
          <div className="ris-modal-actions"><Button tone="gray" onClick={closeAccountAction}>Batal</Button><Button tone={accountAction.action === 'activate' ? 'green' : 'red'} onClick={submitAccountAction}>{accountAction.action === 'activate' ? 'Aktifkan Akun' : accountAction.action === 'delete' ? 'Hapus Akun' : 'Nonaktifkan Akun'}</Button></div>
        </div>
      </Modal>}

      {profileActionMenu && <Modal title="Aksi Profil Peneliti" onClose={() => setProfileActionMenu(null)} width={390}>
        <div className="ris-modal-body">
          <div className="ris-action-menu-list">
            <button type="button" onClick={() => { const { profile } = profileActionMenu; setProfileActionMenu(null); history.push(`/ris/profil-peneliti/${profile.profileId}/detail`); }}><Icon name="document" size={16} /><span>Detail</span></button>
            {profileActionMenu.canEdit && <button type="button" onClick={() => { const { profile } = profileActionMenu; setProfileActionMenu(null); history.push(`/ris/profil-peneliti/${profile.profileId}/edit`); }}><Icon name="user" size={16} /><span>Ubah</span></button>}
            {profileActionMenu.canManage && <React.Fragment>
              <button type="button" onClick={() => { const { profile, account } = profileActionMenu; setProfileActionMenu(null); openAccountAction(profile, account.isActive === false ? 'activate' : 'deactivate'); }}><Icon name={profileActionMenu.account.isActive === false ? 'check' : 'warning'} size={16} /><span>{profileActionMenu.account.isActive === false ? 'Aktifkan' : 'Nonaktifkan'}</span></button>
              <div className="ris-archive-action-separator" role="separator" />
              <button type="button" className="danger" onClick={() => { const { profile } = profileActionMenu; setProfileActionMenu(null); openAccountAction(profile, 'delete'); }}><Icon name="trash" size={16} /><span>Hapus</span></button>
            </React.Fragment>}
          </div>
          <div className="ris-modal-actions"><Button tone="gray" onClick={() => setProfileActionMenu(null)}>Tutup</Button></div>
        </div>
      </Modal>}

      {showCreate && (
        <Modal title="Buat Akun RIS" onClose={() => { setCreateError(''); setShowCreate(false); }} width={620}>
          <div className="ris-modal-body">
            <div className="ris-alert ris-alert-info">Akun baru dibuat dalam status nonaktif. Aktifkan akun dari tabel setelah data dan kewenangannya selesai diperiksa.</div>
            <FloatingError message={createError} />
            <div className="ris-form-grid two">
              {canCreateAdminAccount && <Field label="Peran Akun" required><select value={form.role} onChange={event => {
                setForm({ ...form, role: event.target.value });
              }}><option value={ROLE.LECTURER}>Dosen</option><option value={ROLE.ADMIN}>Administrator</option></select></Field>}
              <Field label="Nama Lengkap" required><input value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} /></Field>
              <Field label="Email Institusi" required><input type="email" autoComplete="email" maxLength={320} autoCapitalize="none" spellCheck={false} value={form.institutionEmail} onChange={event => setForm({ ...form, institutionEmail: event.target.value })} /></Field>
              <Field label="Kata Sandi Awal" required><input type="password" minLength={12} autoComplete="new-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></Field>
            </div>
            <div className="ris-modal-actions"><Button tone="gray" onClick={() => { setCreateError(''); setShowCreate(false); }}>Batal</Button><Button tone="green" onClick={createUser}>Buat Akun</Button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
