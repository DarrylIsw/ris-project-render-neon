/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useHistory } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import { Button, EmptyRow, Field, FloatingError, Modal, PageBack } from '../../../shared/components/Ui';
import { formatDate, uid } from '../../../core/data';
import {
  PROFILE_STATUS,
  VERIFICATION_STATUS,
  applyProfileAccountAction,
  canEditProfile,
  canManageProfileAccount,
  canVerifyProfile,
  createActivityLog,
  createNotification,
  getCompletenessLabel,
  getCompletenessTone,
  getDocumentTypeLabel,
  getExpertiseForProfile,
  getProfileAdmin,
  getProfileById,
  getProfileByUser,
  getProfileDocuments,
  getProfileStatusMeta,
  getVerificationMeta,
  isProfileAdmin,
  normalizeProfileForSave,
  syncProfileToDomainData,
} from '../workflows/researcherProfileWorkflow';

const Info = ({ label, value }) => <div className="ris-info-item"><span>{label}</span><strong>{value || '-'}</strong></div>;
Info.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.node };
Info.defaultProps = { value: '-' };
const activityLabel = value => ({
  create_profile: 'Membuat profil',
  update_profile: 'Memperbarui profil',
  verify_profile: 'Memverifikasi profil',
  assign_admin: 'Menugaskan administrator pendamping',
  deactivate_profile: 'Menonaktifkan profil',
  upload_document: 'Mengunggah dokumen',
  delete_document: 'Menghapus dokumen',
}[value] || String(value || '-').replace(/_/g, ' '));
const statusLabel = value => ({ active: 'Aktif', inactive: 'Nonaktif', suspended: 'Ditangguhkan', draft: 'Draf', pending: 'Menunggu', verified: 'Terverifikasi', rejected: 'Ditolak' }[value] || value || '-');
const initials = name => String(name || '?')
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0])
  .join('')
  .toUpperCase();

export default function ResearcherProfileDetailPage({ match }) {
  const { data, setData, user } = useRis();
  const history = useHistory();
  const profile = match.params.profileId === 'me' ? getProfileByUser(data, user) : getProfileById(data, match.params.profileId);
  const [notes, setNotes] = useState('');
  const [accountAction, setAccountAction] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [exportError, setExportError] = useState('');
  const [assignAdminId, setAssignAdminId] = useState('user-admin-profile');

  if (!profile) return <div className="ris-page"><h1>Profil tidak ditemukan</h1></div>;
  const admin = isProfileAdmin(user);
  const selfProfile = profile.userId === (user && user.id);
  const showAdminPanel = admin && !selfProfile;
  const documents = getProfileDocuments(data, profile.profileId);
  const expertises = getExpertiseForProfile(data, profile.profileId);
  const profileAccount = (data.systemUsers || []).find(item => item.id === profile.userId);
  const assignedAdmin = getProfileAdmin(data, profile.profileId);
  const statusMeta = getProfileStatusMeta(profile.profileStatus);
  const verificationMeta = getVerificationMeta(profile.verificationStatus);
  const logs = (data.systemActivityLogs || []).filter(item => item.entityType === 'researcher_profile' && item.entityId === profile.profileId);
  const verifications = (data.researcherVerifications || []).filter(item => item.profileId === profile.profileId);
  const statusHistory = (data.researcherStatusHistory || []).filter(item => item.profileId === profile.profileId);
  const admins = (data.systemUsers || []).filter(item => isProfileAdmin(item));

  const updateProfileDecision = (decision) => {
    const now = new Date().toISOString();
    const newVerification = decision === 'approve' ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.REJECTED;
    setData(current => {
      const oldProfile = (current.researcherProfiles || []).find(item => item.profileId === profile.profileId);
      const documentsForProfile = (current.researcherDocuments || []).filter(doc => doc.profileId === profile.profileId && doc.isActive !== false);
      const updated = normalizeProfileForSave({ ...oldProfile, verificationStatus: newVerification }, documentsForProfile, user);
      const finalProfile = newVerification === VERIFICATION_STATUS.VERIFIED ? { ...updated, profileCompleteness: 100, profileStatus: PROFILE_STATUS.ACTIVE } : updated;
      let next = {
        ...current,
        researcherProfiles: (current.researcherProfiles || []).map(item => (item.profileId === finalProfile.profileId ? finalProfile : item)),
        researcherVerifications: [...(current.researcherVerifications || []), {
          id: uid('verification'),
          profileId: profile.profileId,
          adminId: user.id,
          verificationStatus: newVerification,
          verificationNotes: notes || (decision === 'approve' ? 'Profil disetujui.' : 'Profil ditolak dan perlu perbaikan.'),
          verifiedBy: user.id,
          verifiedAt: now,
        }],
        systemActivityLogs: [...(current.systemActivityLogs || []), createActivityLog(user, 'verify_profile', 'researcher_profile', profile.profileId, oldProfile, finalProfile, uid)],
        notifications: [...(current.notifications || []), createNotification(profile.userId, user.id, newVerification === VERIFICATION_STATUS.VERIFIED ? 'profile_verified' : 'profile_rejected', notes || (newVerification === VERIFICATION_STATUS.VERIFIED ? 'Profil peneliti berhasil diverifikasi.' : 'Profil peneliti ditolak dan perlu revisi.'), uid)],
      };
      next = syncProfileToDomainData(next, finalProfile);
      return next;
    });
    setNotes('');
  };

  const assignAdmin = () => {
    setData(current => ({
      ...current,
      adminAssignments: [
        ...(current.adminAssignments || []).filter(item => item.profileId !== profile.profileId),
        { id: uid('admin-assignment'), profileId: profile.profileId, adminId: assignAdminId, assignedAt: new Date().toISOString(), assignedBy: user.id },
      ],
      systemActivityLogs: [...(current.systemActivityLogs || []), createActivityLog(user, 'assign_admin', 'researcher_profile', profile.profileId, null, { adminId: assignAdminId }, uid)],
    }));
  };

  const closeAccountAction = () => {
    setAccountAction('');
    setActionReason('');
    setActionError('');
  };

  const submitAccountAction = () => {
    try {
      setData(current => applyProfileAccountAction(current, profile.profileId, accountAction, actionReason, user, uid));
      if (accountAction === 'delete') history.replace('/ris/profil-peneliti');
      closeAccountAction();
    } catch (error) {
      setActionError(error.message);
    }
  };

  const downloadProfile = async () => {
    setExportError('');
    try {
      const response = await fetch(`/api/researcher-profiles/${encodeURIComponent(profile.profileId)}/export.docx`, { credentials: 'same-origin' });
      if (!response.ok) {
        let message = 'Ekspor Word profil gagal dibuat.';
        try {
          const result = await response.json();
          message = result.message || message;
        } catch (error) {
          // The server may return a non-JSON error response.
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || `profil-${profile.profileId}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setExportError(error.message || 'Ekspor Word profil gagal dibuat.');
    }
  };

  return (
    <div className="ris-page ris-workspace-page ris-profile-page">
      <div className="ris-page-head split">
        <div className="ris-page-head"><PageBack onClick={() => history.goBack()} /><div><h1>{profile.frontTitle ? `${profile.frontTitle} ` : ''}{profile.fullName}{profile.backTitle ? `, ${profile.backTitle}` : ''}</h1><p className="ris-muted">{profile.institutionEmail} • {profile.faculty} / {profile.studyProgram}</p></div></div>
        <div className="ris-button-row">{canEditProfile(profile, user, profileAccount) && <Button tone="blue" onClick={() => history.push(`/ris/profil-peneliti/${profile.profileId}/edit`)}>Ubah Profil</Button>}<Button tone="gray" onClick={downloadProfile}>Ekspor Word</Button></div>
      </div>
      <FloatingError message={exportError} />

      <section className="ris-card ris-profile-identity-card">
        <div className="ris-profile-avatar">{initials(profile.fullName)}</div>
        <div className="ris-profile-identity-copy">
          <h2>{profile.fullName || '-'}</h2>
          <p className="ris-muted">{profile.position || 'Peneliti'} · {profile.studyProgram || profile.unit || '-'}</p>
        </div>
        <div className="ris-profile-identity-status"><span className={`ris-badge ${profileAccount && profileAccount.isActive === false ? 'red' : 'green'}`}>{profileAccount && profileAccount.isActive === false ? 'Akun Nonaktif' : 'Akun Aktif'}</span><span className={`ris-badge ${verificationMeta.tone}`}>{verificationMeta.label}</span></div>
      </section>

      <section className="ris-module-grid compact">
        <div className="ris-metric-card"><span>Kelengkapan</span><strong className={`ris-text-${getCompletenessTone(profile.profileCompleteness)}`}>{profile.profileCompleteness || 0}%</strong><small>{getCompletenessLabel(profile.profileCompleteness, profile.verificationStatus)}</small><div className="ris-progress-line"><span style={{ width: `${profile.profileCompleteness || 0}%` }} /></div></div>
        <div className="ris-metric-card"><span>Status Profil</span><strong className={`ris-text-${statusMeta.tone}`}>{statusMeta.label}</strong><small>{profile.inactiveReason || 'Status akun peneliti'}</small></div>
        <div className="ris-metric-card"><span>Verifikasi</span><strong className={`ris-text-${verificationMeta.tone}`}>{verificationMeta.label}</strong><small>{verifications.length} riwayat verifikasi</small></div>
        <div className="ris-metric-card"><span>Administrator Pendamping</span><strong>{assignedAdmin ? assignedAdmin.name : '-'}</strong><small>{assignedAdmin ? assignedAdmin.email : 'Belum ditugaskan'}</small></div>
      </section>

      <section className="ris-two-column">
        <div className="ris-card">
          <h2>Informasi Profil</h2>
          <div className="ris-info-grid">
            <Info label="NIDN" value={profile.nidn} /><Info label="NIK" value={profile.nik} /><Info label="Tempat/Tgl Lahir" value={`${profile.birthPlace || '-'} / ${profile.birthDate || '-'}`} /><Info label="Jenis Kelamin" value={profile.gender} />
            <Info label="Telepon" value={profile.phoneNumber} /><Info label="Alamat Domisili" value={profile.domicileAddress} /><Info label="Fakultas" value={profile.faculty} /><Info label="Program Studi" value={profile.studyProgram} />
            <Info label="Unit" value={profile.unit} /><Info label="Posisi" value={profile.position} /><Info label="Jabatan Fungsional" value={profile.functionalPosition} /><Info label="NIP" value={profile.nip} />
            <Info label="ORCID" value={profile.orcid} /><Info label="Google Scholar" value={profile.googleScholar} /><Info label="SINTA ID" value={profile.sintaId} />
          </div>
        </div>
        <div className="ris-card">
          <h2>Keuangan & Darurat</h2>
          <div className="ris-info-grid single"><Info label="Bank" value={profile.bankName} /><Info label="Nomor Rekening" value={profile.bankAccountNumber} /><Info label="Nama Rekening" value={profile.bankAccountName} /><Info label="Kontak Darurat" value={profile.emergencyContactName} /><Info label="Relasi" value={profile.emergencyContactRelation} /><Info label="No. HP Darurat" value={profile.emergencyContactPhone} /></div>
          <h3>Bidang Minat</h3>
          <div className="ris-chip-list">{expertises.length ? expertises.map(item => <span key={item.expertiseId}>{item.name}</span>) : <span>Belum ada bidang minat</span>}</div>
        </div>
      </section>

      <section className="ris-section-spaced">
        <h2>Dokumen Peneliti</h2>
        <div className="ris-table-wrap"><table className="ris-table"><thead><tr><th>No.</th><th>Jenis</th><th>Berkas</th><th>Format</th><th>Ukuran</th><th>Waktu Unggah</th></tr></thead><tbody>{documents.map((doc, index) => <tr key={doc.id}><td>{index + 1}.</td><td>{getDocumentTypeLabel(doc.documentType)}</td><td>{doc.fileName || doc.fileUrl}</td><td>{doc.fileFormat}</td><td>{((doc.fileSize || 0) / 1048576).toFixed(1)} MB</td><td>{formatDate(doc.uploadedAt)}</td></tr>)}{documents.length === 0 && <EmptyRow colSpan={6}>Belum ada dokumen.</EmptyRow>}</tbody></table></div>
      </section>

      {showAdminPanel && (
        <section className="ris-section-spaced ris-card">
          <h2>Panel Admin LPPM</h2>
          {canVerifyProfile(profile, user, profileAccount) && <div className="ris-form-grid"><Field label="Catatan Verifikasi"><textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Catatan persetujuan atau penolakan" /></Field><div className="ris-button-row"><Button tone="green" onClick={() => updateProfileDecision('approve')}>Setujui dan Verifikasi</Button><Button tone="red" onClick={() => updateProfileDecision('reject')}>Tolak</Button></div></div>}
          <div className="ris-form-grid two"><Field label="Tugaskan Administrator Pendamping"><select value={assignAdminId} onChange={event => setAssignAdminId(event.target.value)}>{admins.map(item => <option key={item.id} value={item.id}>{item.name} — {item.email}</option>)}</select></Field><div className="ris-field-control align-bottom"><Button tone="blue" onClick={assignAdmin}>Tugaskan Administrator</Button></div></div>
          {canManageProfileAccount(profile, user, profileAccount) && <div className="ris-profile-account-controls"><div><h3>Kelola Akun</h3><p className="ris-muted">Atur akses masuk akun ini.</p></div><div className="ris-button-row"><Button tone={profileAccount.isActive === false ? 'green' : 'gray'} onClick={() => setAccountAction(profileAccount.isActive === false ? 'activate' : 'deactivate')}>{profileAccount.isActive === false ? 'Aktifkan Akun' : 'Nonaktifkan Akun'}</Button><Button tone="red" onClick={() => setAccountAction('delete')}>Hapus Akun</Button></div></div>}
        </section>
      )}

      <section className="ris-two-column">
        <div className="ris-card"><h2>Riwayat Verifikasi</h2><div className="ris-table-wrap mini"><table className="ris-table"><thead><tr><th>Status</th><th>Catatan</th><th>Waktu</th></tr></thead><tbody>{verifications.map(item => <tr key={item.id}><td>{item.verificationStatus}</td><td>{item.verificationNotes}</td><td>{formatDate(item.verifiedAt)}</td></tr>)}{verifications.length === 0 && <EmptyRow colSpan={3}>Belum ada riwayat verifikasi.</EmptyRow>}</tbody></table></div></div>
        <div className="ris-card"><h2>Catatan Audit</h2><div className="ris-table-wrap mini"><table className="ris-table"><thead><tr><th>Tindakan</th><th>Pelaku</th><th>Waktu</th></tr></thead><tbody>{logs.map(item => <tr key={item.id}><td>{activityLabel(item.action)}</td><td>{item.userId}</td><td>{formatDate(item.createdAt)}</td></tr>)}{logs.length === 0 && <EmptyRow colSpan={3}>Belum ada catatan audit.</EmptyRow>}</tbody></table></div><h3>Riwayat Status</h3><div className="ris-chip-list">{statusHistory.map(item => <span key={item.id}>{statusLabel(item.oldStatus)} → {statusLabel(item.newStatus)}</span>)}</div></div>
      </section>
      {accountAction && <Modal title={{ activate: 'Aktifkan Akun', deactivate: 'Nonaktifkan Akun', delete: 'Hapus Akun' }[accountAction]} onClose={closeAccountAction} width={520}><div className="ris-modal-body ris-profile-action-modal"><p><strong>{profile.fullName}</strong><span>{profile.institutionEmail}</span></p>{accountAction === 'delete' && <div className="ris-alert ris-alert-warning">Akun akan dihapus dari daftar aktif dan tidak bisa digunakan untuk masuk. Riwayat penelitian, surat, dan audit tetap tersimpan.</div>}{accountAction !== 'activate' && <Field label="Alasan" required alignStart><textarea rows="3" value={actionReason} onChange={event => setActionReason(event.target.value)} placeholder="Tuliskan alasan tindakan ini" /></Field>}<FloatingError message={actionError} /><div className="ris-modal-actions"><Button tone="gray" onClick={closeAccountAction}>Batal</Button><Button tone={accountAction === 'activate' ? 'green' : 'red'} onClick={submitAccountAction}>{accountAction === 'activate' ? 'Aktifkan Akun' : accountAction === 'delete' ? 'Hapus Akun' : 'Nonaktifkan Akun'}</Button></div></div></Modal>}
    </div>
  );
}

ResearcherProfileDetailPage.propTypes = { match: PropTypes.object.isRequired };
