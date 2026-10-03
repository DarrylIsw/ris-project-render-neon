/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useHistory } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import { Button, Field, FileDrop, FloatingError, PageBack } from '../../../shared/components/Ui';
import { uid } from '../../../core/data';
import {
  DEFAULT_PROFILE_FORM,
  DOCUMENT_TYPES,
  buildProfileFromUser,
  canEditProfile,
  createActivityLog,
  createNotification,
  createProfileDocumentMeta,
  getExpertiseForProfile,
  getProfileById,
  getProfileByUser,
  getProfileDocuments,
  isProfileAdmin,
  normalizeProfileForSave,
  syncProfileToDomainData,
  validateProfileDocument,
  validateProfileForm,
} from '../workflows/researcherProfileWorkflow';

const profileSections = [
  { key: 'basic', label: 'Informasi Dasar' },
  { key: 'contact', label: 'Kontak' },
  { key: 'institution', label: 'Institusi' },
  { key: 'identity', label: 'Identitas Penelitian' },
  { key: 'finance', label: 'Keuangan' },
  { key: 'emergency', label: 'Darurat' },
  { key: 'documents', label: 'Dokumen & Keahlian' },
  { key: 'security', label: 'Keamanan' },
];

const profileToForm = profile => ({ ...DEFAULT_PROFILE_FORM, ...(profile || {}) });
const profilePhotoMeta = (file, profileId) => (file ? {
  name: file.name,
  size: file.size,
  type: file.type,
  fileUrl: file.risFileUrl || `mock://researcher-profile-photos/${profileId}/${file.name}`,
  uploadedAt: new Date().toISOString(),
} : null);
const initials = name => String(name || '?')
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0])
  .join('')
  .toUpperCase();

export default function ResearcherProfileEditorPage({ match }) {
  const { data, setData, user, changePassword } = useRis();
  const history = useHistory();
  const profileId = match.params.profileId;
  const existing = profileId === 'me' ? getProfileByUser(data, user) : getProfileById(data, profileId);
  const initialProfile = existing || buildProfileFromUser(user, uid);
  const [form, setForm] = useState(profileToForm(initialProfile));
  const [documentType, setDocumentType] = useState('KTP');
  const [documentFile, setDocumentFile] = useState(null);
  const [newExpertise, setNewExpertise] = useState('');
  const [selectedExpertiseIds, setSelectedExpertiseIds] = useState(() => getExpertiseForProfile(data, initialProfile.profileId).map(item => item.expertiseId));
  const [error, setError] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const documents = useMemo(() => getProfileDocuments(data, initialProfile.profileId), [data, initialProfile.profileId]);
  const organizationOptions = useMemo(() => {
    const records = [...(data.researcherProfiles || []), ...(data.lecturers || [])];
    const unique = key => [...new Set(records.map(item => item[key]).filter(Boolean))].sort();
    return {
      faculties: [...new Set([...unique('faculty'), 'LPPM'])].sort(),
      programs: [...new Set([...unique('studyProgram'), ...unique('program')])].sort(),
      units: [...new Set([...unique('unit'), 'LPPM'])].sort(),
    };
  }, [data.lecturers, data.researcherProfiles]);
  const admin = isProfileAdmin(user);
  const isOwnProfile = initialProfile.userId === user.id;
  const visibleProfileSections = isOwnProfile ? profileSections : profileSections.filter(section => section.key !== 'security');
  const targetAccount = (data.systemUsers || []).find(item => item.id === initialProfile.userId);

  if (!canEditProfile(existing || initialProfile, user, targetAccount)) {
    return <div className="ris-page"><h1>Ubah Profil</h1><p className="ris-muted">Akses untuk mengubah profil ini tidak diizinkan.</p></div>;
  }

  const update = field => event => setForm({ ...form, [field]: event.target.value });

  const submitPasswordChange = async () => {
    setPasswordError('');
    setPasswordStatus('');
    if (passwordForm.newPassword.length < 12) {
      setPasswordError('Kata sandi baru minimal 12 karakter.');
      return;
    }
    if (new Blob([passwordForm.newPassword]).size > 72) {
      setPasswordError('Kata sandi baru maksimal 72 byte.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordError('Kata sandi baru harus berbeda dari kata sandi saat ini.');
      return;
    }

    setPasswordSaving(true);
    try {
      const result = await changePassword(passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordStatus(result.message || 'Kata sandi berhasil diperbarui.');
    } catch (requestError) {
      setPasswordError(requestError.message || 'Kata sandi tidak dapat diperbarui.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const saveProfile = () => {
    const errors = validateProfileForm(form);
    if (errors.length) {
      setError(errors[0]);
      return;
    }
    const normalized = normalizeProfileForSave({ ...form, profileId: initialProfile.profileId, id: initialProfile.id || initialProfile.profileId, userId: initialProfile.userId }, documents, user);
    setData(current => {
      const oldProfile = (current.researcherProfiles || []).find(item => item.profileId === normalized.profileId) || null;

      let next = {
        ...current,
        researcherProfiles: oldProfile
          ? (current.researcherProfiles || []).map(item => (item.profileId === normalized.profileId ? normalized : item))
          : [...(current.researcherProfiles || []), normalized],
        researcherExpertiseMap: [
          ...(current.researcherExpertiseMap || []).filter(item => item.profileId !== normalized.profileId),
          ...selectedExpertiseIds.map(expertiseId => ({
            id: uid('expertise-map'),
            profileId: normalized.profileId,
            expertiseId,
          })),
        ],
        systemActivityLogs: [...(current.systemActivityLogs || []), createActivityLog(user, oldProfile ? 'update_profile' : 'create_profile', 'researcher_profile', normalized.profileId, oldProfile, normalized, uid)],
        notifications: [...(current.notifications || []), createNotification(normalized.userId, user.id, 'profile_updated', 'Profil peneliti berhasil diperbarui.', uid)],
      };

      next = syncProfileToDomainData(next, normalized);
      return next;
    });
    history.push(`/ris/profil-peneliti/${normalized.profileId}/detail`);
  };

  const uploadDocument = () => {
    const validation = validateProfileDocument(documentFile);
    if (validation) {
      setError(validation);
      return;
    }
    const meta = createProfileDocumentMeta(documentFile, documentType, initialProfile.profileId, user, uid);
    setData(current => {
      const currentProfile = (current.researcherProfiles || []).find(item => item.profileId === initialProfile.profileId) || { ...form, profileId: initialProfile.profileId, userId: initialProfile.userId };
      const nextDocuments = [
        ...(current.researcherDocuments || []).map(doc => (doc.profileId === initialProfile.profileId && doc.documentType === documentType ? { ...doc, isActive: false } : doc)),
        meta,
      ];
      const normalized = normalizeProfileForSave(currentProfile, nextDocuments.filter(doc => doc.profileId === initialProfile.profileId && doc.isActive !== false), user);
      let next = {
        ...current,
        researcherDocuments: nextDocuments,
        researcherProfiles: (current.researcherProfiles || []).some(item => item.profileId === normalized.profileId)
          ? (current.researcherProfiles || []).map(item => (item.profileId === normalized.profileId ? normalized : item))
          : [...(current.researcherProfiles || []), normalized],
        systemActivityLogs: [...(current.systemActivityLogs || []), createActivityLog(user, 'upload_document', 'researcher_profile', normalized.profileId, null, meta, uid)],
        notifications: [...(current.notifications || []), createNotification(normalized.userId, user.id, 'document_uploaded', `Dokumen ${documentType} berhasil diunggah.`, uid)],
      };
      next = syncProfileToDomainData(next, normalized);
      return next;
    });
    setDocumentFile(null);
    setError('');
  };

  const toggleExpertise = expertiseId => {
    setSelectedExpertiseIds(current => (current.includes(expertiseId) ? current.filter(item => item !== expertiseId) : [...current, expertiseId]));
  };

  const addExpertise = () => {
    const name = newExpertise.trim();
    if (!name) return;
    const existingExpertise = (data.researcherExpertise || []).find(item => item.name.toLowerCase() === name.toLowerCase());
    const expertiseId = existingExpertise ? existingExpertise.expertiseId : uid('expertise');
    setData(current => ({
      ...current,
      researcherExpertise: existingExpertise ? current.researcherExpertise : [...(current.researcherExpertise || []), { expertiseId, name }],
    }));
    setSelectedExpertiseIds(current => (current.includes(expertiseId) ? current : [...current, expertiseId]));
    setNewExpertise('');
  };

  const deleteDocument = documentId => {
    setData(current => {
      const oldDoc = (current.researcherDocuments || []).find(doc => doc.id === documentId);
      const nextDocuments = (current.researcherDocuments || []).map(doc => (doc.id === documentId ? { ...doc, isActive: false } : doc));
      const currentProfile = (current.researcherProfiles || []).find(item => item.profileId === initialProfile.profileId) || form;
      const normalized = normalizeProfileForSave(currentProfile, nextDocuments.filter(doc => doc.profileId === initialProfile.profileId && doc.isActive !== false), user);
      let next = {
        ...current,
        researcherDocuments: nextDocuments,
        researcherProfiles: (current.researcherProfiles || []).map(item => (item.profileId === normalized.profileId ? normalized : item)),
        systemActivityLogs: [...(current.systemActivityLogs || []), createActivityLog(user, 'delete_document', 'researcher_profile', normalized.profileId, oldDoc, null, uid)],
      };
      next = syncProfileToDomainData(next, normalized);
      return next;
    });
  };

  return (
    <div className="ris-page ris-workspace-page ris-profile-page ris-profile-editor-page">
      <div className="ris-page-head ris-profile-editor-head"><PageBack onClick={() => history.goBack()} /><div className="ris-profile-editor-head-copy"><div className="ris-profile-editor-title-row"><h1>{admin ? 'Ubah Profil Peneliti' : 'Profil Saya'}</h1><Button tone="green" onClick={saveProfile}>Simpan Profil</Button></div><p className="ris-muted">Data ini menjadi sumber utama untuk penelitian internal, surat, penelitian eksternal, dan dashboard LPPM.</p></div></div>
      <FloatingError message={error} />
      <nav className="ris-profile-section-nav" aria-label="Kategori profil">{visibleProfileSections.map(section => <a key={section.key} href={`#profil-${section.key}`}>{section.label}</a>)}</nav>
      <datalist id="ris-faculty-options">{organizationOptions.faculties.map(item => <option value={item} key={item} />)}</datalist>
      <datalist id="ris-program-options">{organizationOptions.programs.map(item => <option value={item} key={item} />)}</datalist>
      <datalist id="ris-unit-options">{organizationOptions.units.map(item => <option value={item} key={item} />)}</datalist>

      <section className="ris-card ris-profile-editor">
        <section id="profil-basic" className="ris-profile-editor-section">
          <div className="ris-profile-editor-heading"><span>01</span><div><h2>Informasi Dasar</h2><p>Identitas personal yang digunakan pada seluruh proses penelitian dan surat.</p></div></div>
          <div className="ris-form-grid two">
            <Field label="Foto Profil" alignStart>
              <div className="ris-profile-photo-field">
                <div className="ris-profile-avatar ris-profile-avatar-sm">{form.profilePhoto && form.profilePhoto.fileUrl && !form.profilePhoto.fileUrl.startsWith('mock://') ? <img src={form.profilePhoto.fileUrl} alt="Foto profil" /> : initials(form.fullName)}</div>
                <div>
                  <FileDrop file={form.profilePhoto || null} accept=".png,.jpg,.jpeg" maxSize={5 * 1024 * 1024} storagePurpose="profiles" onFile={file => setForm({ ...form, profilePhoto: profilePhotoMeta(file, initialProfile.profileId) })} label="Unggah foto profil JPG/PNG (maksimal 5 MB)" />
                  {form.profilePhoto && <button type="button" className="ris-text-danger" onClick={() => setForm({ ...form, profilePhoto: null })}>Hapus foto profil</button>}
                </div>
              </div>
            </Field>
            <Field label="Gelar Depan"><input value={form.frontTitle || ''} onChange={update('frontTitle')} /></Field>
            <Field label="Nama Lengkap" required><input value={form.fullName || ''} onChange={update('fullName')} /></Field>
            <Field label="Gelar Belakang"><input value={form.backTitle || ''} onChange={update('backTitle')} /></Field>
            <Field label="NIDN" required><input value={form.nidn || ''} onChange={update('nidn')} inputMode="numeric" autoComplete="off" /></Field>
            <Field label="NIK"><input value={form.nik || ''} onChange={update('nik')} inputMode="numeric" autoComplete="off" /></Field>
            <Field label="Tempat Lahir"><input value={form.birthPlace || ''} onChange={update('birthPlace')} /></Field>
            <Field label="Tanggal Lahir"><input type="date" value={form.birthDate || ''} onChange={update('birthDate')} /></Field>
            <Field label="Jenis Kelamin"><select value={form.gender || ''} onChange={update('gender')}><option value="">Pilih</option><option>Laki-laki</option><option>Perempuan</option></select></Field>
            <Field label="Kewarganegaraan"><select value={form.nationality || ''} onChange={update('nationality')}><option value="">Pilih</option><option value="Indonesia">Indonesia</option><option value="Warga Negara Asing">Warga Negara Asing</option></select></Field>
          </div>
        </section>

        <section id="profil-contact" className="ris-profile-editor-section">
          <div className="ris-profile-editor-heading"><span>02</span><div><h2>Kontak</h2><p>Alamat dan kanal komunikasi aktif milik peneliti.</p></div></div>
          <div className="ris-form-grid two">
            <Field label="Email Institusi" required><input type="email" autoComplete="email" value={form.institutionEmail || ''} onChange={update('institutionEmail')} /></Field>
            <Field label="Email Alternatif"><input type="email" autoComplete="email" value={form.alternateEmail || ''} onChange={update('alternateEmail')} /></Field>
            <Field label="No. HP" required><input type="tel" inputMode="tel" autoComplete="tel" value={form.phoneNumber || ''} onChange={update('phoneNumber')} /></Field>
            <Field label="Alamat Domisili"><textarea value={form.domicileAddress || ''} onChange={update('domicileAddress')} /></Field>
            <Field label="Alamat Korespondensi"><textarea value={form.correspondenceAddress || ''} onChange={update('correspondenceAddress')} /></Field>
          </div>
        </section>

        <section id="profil-institution" className="ris-profile-editor-section">
          <div className="ris-profile-editor-heading"><span>03</span><div><h2>Institusi</h2><p>Penempatan organisasi, posisi, dan informasi kepegawaian.</p></div></div>
          <div className="ris-form-grid two">
            <Field label="Fakultas" required><input list="ris-faculty-options" value={form.faculty || ''} onChange={update('faculty')} placeholder="Pilih atau ketik fakultas" /></Field>
            <Field label="Program Studi" required><input list="ris-program-options" value={form.studyProgram || ''} onChange={update('studyProgram')} placeholder="Pilih atau ketik program studi" /></Field>
            <Field label="Unit"><input list="ris-unit-options" value={form.unit || ''} onChange={update('unit')} placeholder="Pilih atau ketik unit" /></Field>
            <Field label="Posisi" required><select value={form.position || ''} onChange={update('position')}><option value="">Pilih posisi</option>{[['Dosen Fulltime', 'Dosen Penuh Waktu'], ['Dosen Homebase', 'Dosen Tetap Program Studi'], ['Admin LPPM', 'Administrator LPPM'], ['Manager LPPM', 'Manajer LPPM'], ['Super Admin', 'Administrator Utama'], ['Staf LPPM', 'Staf LPPM']].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
            <Field label="Jabatan Fungsional"><select value={form.functionalPosition || ''} onChange={update('functionalPosition')}><option value="">Pilih jabatan</option>{[['Tenaga Pengajar', 'Tenaga Pengajar'], ['Asisten Ahli', 'Asisten Ahli'], ['Lektor', 'Lektor'], ['Lektor Kepala', 'Lektor Kepala'], ['Profesor', 'Profesor'], ['Administrator', 'Administrator'], ['Manager', 'Manajer']].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
            <Field label="NIP"><input value={form.nip || ''} onChange={update('nip')} /></Field>
          </div>
        </section>

        <section id="profil-identity" className="ris-profile-editor-section">
          <div className="ris-profile-editor-heading"><span>04</span><div><h2>Identitas Penelitian</h2><p>Identitas publikasi untuk sinkronisasi rekam jejak akademik.</p></div></div>
          <div className="ris-form-grid two">
            <Field label="ORCID"><input inputMode="numeric" value={form.orcid || ''} onChange={update('orcid')} placeholder="0000-0000-0000-0000" /></Field>
            <Field label="Google Scholar"><input type="url" value={form.googleScholar || ''} onChange={update('googleScholar')} placeholder="https://scholar.google.com/..." /></Field>
            <Field label="SINTA ID"><input value={form.sintaId || ''} onChange={update('sintaId')} /></Field>
          </div>
        </section>

        <section id="profil-finance" className="ris-profile-editor-section">
          <div className="ris-profile-editor-heading"><span>05</span><div><h2>Keuangan</h2><p>Rekening yang digunakan untuk administrasi pendanaan penelitian.</p></div></div>
          <div className="ris-form-grid two">
            <Field label="Nama Bank"><select value={form.bankName || ''} onChange={update('bankName')}><option value="">Pilih bank</option>{['BCA', 'Mandiri', 'BNI', 'BRI', 'CIMB Niaga', 'BTN', 'BSI', 'Permata', 'Lainnya'].map(item => <option value={item} key={item}>{item}</option>)}</select></Field>
            <Field label="Nomor Rekening"><input inputMode="numeric" autoComplete="off" value={form.bankAccountNumber || ''} onChange={update('bankAccountNumber')} /></Field>
            <Field label="Nama Pemilik Rekening"><input value={form.bankAccountName || ''} onChange={update('bankAccountName')} /></Field>
          </div>
        </section>

        <section id="profil-emergency" className="ris-profile-editor-section">
          <div className="ris-profile-editor-heading"><span>06</span><div><h2>Kontak Darurat</h2><p>Kontak yang dapat dihubungi jika terjadi keadaan mendesak.</p></div></div>
          <div className="ris-form-grid two">
            <Field label="Nama Kontak Darurat"><input value={form.emergencyContactName || ''} onChange={update('emergencyContactName')} /></Field>
            <Field label="Relasi"><select value={form.emergencyContactRelation || ''} onChange={update('emergencyContactRelation')}><option value="">Pilih relasi</option>{['Istri', 'Suami', 'Orang Tua', 'Anak', 'Saudara', 'Teman', 'Lainnya'].map(item => <option value={item} key={item}>{item}</option>)}</select></Field>
            <Field label="No. HP Kontak Darurat"><input type="tel" inputMode="tel" value={form.emergencyContactPhone || ''} onChange={update('emergencyContactPhone')} /></Field>
          </div>
        </section>

        <section id="profil-documents" className="ris-profile-editor-section">
          <div className="ris-profile-editor-heading"><span>07</span><div><h2>Dokumen & Keahlian</h2><p>Dokumen pendukung dan bidang keahlian utama peneliti.</p></div></div>
          <div className="ris-two-column ris-profile-document-grid">
            <div>
              <h3>Dokumen Peneliti</h3>
              <div className="ris-form-grid two">
                <Field label="Jenis Dokumen"><select value={documentType} onChange={event => setDocumentType(event.target.value)}>{DOCUMENT_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}{item.required ? ' *' : ''}</option>)}</select></Field>
                <Field label="Unggah Berkas" alignStart><FileDrop file={documentFile} accept=".pdf,.png,.jpg,.jpeg" maxSize={5 * 1024 * 1024} storagePurpose="profiles" onFile={setDocumentFile} label="PDF/PNG/JPG/JPEG maksimal 5 MB" /></Field>
              </div>
              <Button tone="green" disabled={!documentFile} onClick={uploadDocument}>Unggah Dokumen</Button>
              <div className="ris-table-wrap mini"><table className="ris-table"><thead><tr><th>Jenis</th><th>Berkas</th><th>Ukuran</th><th>Aksi</th></tr></thead><tbody>{documents.map(doc => { const type = DOCUMENT_TYPES.find(item => item.value === doc.documentType); return <tr key={doc.id}><td>{type ? type.label : doc.documentType}</td><td>{doc.fileName}</td><td>{((doc.fileSize || 0) / 1048576).toFixed(1)} MB</td><td><button type="button" className="ris-action red" onClick={() => deleteDocument(doc.id)}>Hapus</button></td></tr>; })}{documents.length === 0 && <tr><td className="ris-empty" colSpan="4">Belum ada dokumen pendukung yang diunggah.</td></tr>}</tbody></table></div>
            </div>
            <div>
              <h3>Bidang Minat</h3>
              <p className="ris-profile-field-note">Pilih bidang yang sesuai atau tambahkan bidang khusus.</p>
              <div className="ris-chip-list selectable">{(data.researcherExpertise || []).map(item => <button key={item.expertiseId} type="button" aria-pressed={selectedExpertiseIds.includes(item.expertiseId)} className={selectedExpertiseIds.includes(item.expertiseId) ? 'active' : ''} onClick={() => toggleExpertise(item.expertiseId)}>{item.name}</button>)}</div>
              <div className="ris-inline-form"><input value={newExpertise} onChange={event => setNewExpertise(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addExpertise(); } }} placeholder="Tambah bidang minat" /><Button tone="blue" disabled={!newExpertise.trim()} onClick={addExpertise}>Tambah</Button></div>
            </div>
          </div>
        </section>

        {isOwnProfile && <section id="profil-security" className="ris-profile-editor-section">
          <div className="ris-profile-editor-heading"><span>08</span><div><h2>Keamanan</h2><p>Kata sandi awal tetap aktif sampai Anda memilih untuk menggantinya. Perubahan disimpan langsung.</p></div></div>
          <div className="ris-form-grid two ris-profile-security-fields">
            <Field label="Kata Sandi Saat Ini" required><input type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={event => setPasswordForm(current => ({ ...current, currentPassword: event.target.value }))} /></Field>
            <Field label="Kata Sandi Baru" required hint="Minimal 12 karakter, maksimal 72 byte."><input type="password" autoComplete="new-password" minLength={12} maxLength={72} value={passwordForm.newPassword} onChange={event => setPasswordForm(current => ({ ...current, newPassword: event.target.value }))} /></Field>
            <Field label="Konfirmasi Kata Sandi Baru" required><input type="password" autoComplete="new-password" minLength={12} maxLength={72} value={passwordForm.confirmPassword} onChange={event => setPasswordForm(current => ({ ...current, confirmPassword: event.target.value }))} /></Field>
          </div>
          <FloatingError message={passwordError} />
          {passwordStatus && <div className="ris-alert ris-alert-success" role="status">{passwordStatus}</div>}
          <div className="ris-profile-security-actions"><Button tone="green" disabled={passwordSaving || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword} onClick={submitPasswordChange}>{passwordSaving ? 'Menyimpan...' : 'Ganti Kata Sandi'}</Button></div>
        </section>}
      </section>

      <div className="ris-profile-editor-actions"><Button tone="gray" onClick={() => history.goBack()}>Batal</Button><Button tone="green" onClick={saveProfile}>Simpan Profil</Button></div>
    </div>
  );
}

ResearcherProfileEditorPage.propTypes = { match: PropTypes.object.isRequired };
