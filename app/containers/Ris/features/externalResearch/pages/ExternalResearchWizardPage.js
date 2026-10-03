/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useHistory } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import Icon from '../../../shared/components/Icon';
import {
  AcademicYearSelect, Button, Field, FileDrop, FloatingError, PageBack, YearSelect
} from '../../../shared/components/Ui';
import { SDGS, fileMeta, uid } from '../../../core/data';
import { createActivityLog } from '../../profiles/workflows/researcherProfileWorkflow';
import {
  ACTIVITY_STATUS_OPTIONS,
  ACTIVITY_TYPE_OPTIONS,
  EXTERNAL_STATUS,
  GRANT_TYPE_OPTIONS,
  INDEPENDENT_TYPE_OPTIONS,
  OUTPUT_TYPE_OPTIONS,
  RESEARCH_CATEGORY_OPTIONS,
  RIP_OPTIONS,
  canSubmitExternalReport,
  createExternalReportDraft,
  externalReportTitle,
  makeExternalDocument,
  makeExternalOutput,
  makeExternalTeamMember,
  resizeExternalTeam,
  transitionExternalStatus,
  validateExternalReport,
} from '../workflows/externalResearchWorkflow';

const STEPS = ['Informasi Dasar', 'Lampiran', 'Luaran'];

const inputValue = value => (value === null || value === undefined ? '' : value);
const fundingDigits = value => String(value === null || value === undefined ? '' : value).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
const formatFundingAmount = value => fundingDigits(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const upsertReport = (reports, report) => (
  reports.some(item => item.id === report.id)
    ? reports.map(item => (item.id === report.id ? report : item))
    : [...reports, report]
);

function ExternalTeamMemberFields({ member, lecturers, onChange }) {
  const internal = member.type === 'internal_lecturer';
  const update = (key, value) => onChange({ ...member, [key]: value });
  const selectProfile = profileId => {
    const profile = lecturers.find(item => item.id === profileId);
    onChange(profile ? {
      ...member, profileId, name: profile.name, nidn: profile.nidn, program: profile.program, faculty: profile.faculty, orcid: profile.orcid,
    } : { ...member, profileId: '', name: '', nidn: '', program: '', faculty: '', orcid: '' });
  };
  return <>
    <Field label="Peran" required><select value={member.role || 'anggota'} onChange={event => update('role', event.target.value)}><option value="ketua">Ketua</option><option value="anggota">Anggota</option></select></Field>
    <Field label="Tipe Anggota" required><select value={member.type} onChange={event => onChange({ ...makeExternalTeamMember(uid), id: member.id, role: member.role || 'anggota', type: event.target.value })}><option value="external_lecturer">Dosen Eksternal</option><option value="internal_lecturer">Dosen Internal</option><option value="student">Mahasiswa</option></select></Field>
    {internal ? <Field label="Nama" required><select value={member.profileId} onChange={event => selectProfile(event.target.value)}><option value="">Pilih dosen</option>{lecturers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field> : <Field label="Nama" required><input maxLength="180" value={inputValue(member.name)} onChange={event => update('name', event.target.value)} /></Field>}
    {member.type === 'student' ? <Field label="NIM" required><input inputMode="numeric" maxLength="12" value={inputValue(member.nim)} onChange={event => update('nim', event.target.value.replace(/\D/g, ''))} /></Field> : <Field label="NIDN" required><input disabled={internal} inputMode="numeric" maxLength="12" value={inputValue(member.nidn)} onChange={event => update('nidn', event.target.value.replace(/\D/g, ''))} /></Field>}
    <Field label="Program Studi" required><input disabled={internal} maxLength="180" value={inputValue(member.program)} onChange={event => update('program', event.target.value)} /></Field>
    <Field label="Fakultas" required><input disabled={internal} maxLength="180" value={inputValue(member.faculty)} onChange={event => update('faculty', event.target.value)} /></Field>
    <Field label="ORCID (opsional)"><input disabled={internal} inputMode="numeric" maxLength="16" value={inputValue(member.orcid)} onChange={event => update('orcid', event.target.value.replace(/\D/g, ''))} /></Field>
  </>;
}

ExternalTeamMemberFields.propTypes = { member: PropTypes.object.isRequired, lecturers: PropTypes.array.isRequired, onChange: PropTypes.func.isRequired };

export default function ExternalResearchWizardPage({ archiveMode, match }) {
  const {
    data, setData, showToast, user
  } = useRis();
  const history = useHistory();
  const createdRef = useRef(false);
  const reportId = match.params.reportId;
  const existing = reportId ? (data.externalResearchReports || []).find(item => item.id === reportId) : null;
  const [report, setReport] = useState(() => existing || createExternalReportDraft(user, uid));
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!reportId && !createdRef.current) {
      createdRef.current = true;
      setData(current => ({
        ...current,
        externalResearchReports: [...(current.externalResearchReports || []), report],
      }));
    }
  }, [report, reportId, setData]);

  useEffect(() => {
    if (!reportId && createdRef.current && (data.externalResearchReports || []).some(item => item.id === report.id)) {
      history.replace(`/ris/penelitian-eksternal/${report.id}/edit`);
    }
  }, [data.externalResearchReports, history, report.id, reportId]);

  useEffect(() => {
    if (existing) setReport(existing);
  }, [existing]);

  const validation = useMemo(() => validateExternalReport(report, data, user), [data, report, user]);
  const teamMembers = report.teamMembers || [];
  const reportDocument = (report.documents || []).find(item => item.fileType === 'report');
  const additionalDocuments = (report.documents || []).filter(item => item.fileType === 'additional');

  const update = patch => {
    setReport(current => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
    setMessage('');
    setErrors([]);
  };
  const updateMeta = patch => update({ metadata: { ...(report.metadata || {}), ...patch } });
  const updateDetail = patch => update({ typeDetail: { ...(report.typeDetail || {}), ...patch } });
  const updateMember = (memberId, value) => update({ teamMembers: teamMembers.map(item => (item.id === memberId ? value : item)) });

  const saveDraft = () => {
    setData(current => {
      const previous = (current.externalResearchReports || []).find(item => item.id === report.id);
      const saved = { ...report, submissionStatus: report.submissionStatus || EXTERNAL_STATUS.DRAFT, updatedAt: new Date().toISOString() };
      return {
        ...current,
        externalResearchReports: upsertReport(current.externalResearchReports || [], saved),
        systemActivityLogs: archiveMode ? [...(current.systemActivityLogs || []), createActivityLog(user, 'archive_edit_external_research', 'external_research', report.id, previous, saved, uid)] : (current.systemActivityLogs || []),
      };
    });
    setMessage(archiveMode ? 'Perubahan arsip berhasil disimpan.' : 'Draf laporan berhasil disimpan.');
    showToast({
      tone: 'success',
      title: archiveMode ? 'Perubahan tersimpan' : 'Draf tersimpan',
      message: archiveMode ? 'Data penelitian eksternal berhasil diperbarui.' : 'Draf laporan penelitian eksternal berhasil disimpan.',
    });
  };

  const submitReport = () => {
    const result = validateExternalReport(report, data, user);
    if (!result.valid) {
      setErrors(result.errors);
      setMessage('');
      return;
    }
    if (!canSubmitExternalReport(report, user)) {
      setErrors([{ field: 'permission', message: 'Laporan ini tidak dapat dikirim oleh akun aktif atau statusnya sudah tidak dapat diubah.' }]);
      return;
    }
    const now = new Date().toISOString();
    const submitted = transitionExternalStatus(report, EXTERNAL_STATUS.SUBMITTED, {
      submittedAt: now,
      updatedAt: now,
      history: [
        ...(report.history || []),
        { status: EXTERNAL_STATUS.SUBMITTED, note: 'Laporan dikirim dan masuk antrean penilaian administrator LPPM.', at: now, by: user.id },
      ],
    });
    if (!submitted) {
      setErrors([{ field: 'status', message: 'Perubahan status laporan tidak valid.' }]);
      return;
    }
    setData(current => ({
      ...current,
      externalResearchReports: upsertReport(current.externalResearchReports || [], submitted),
      notifications: [
        ...(current.notifications || []),
        { id: uid('notif'), userId: 'user-admin', entityType: 'external_research', entityId: report.id, type: 'external_report_submitted', message: `Laporan eksternal ${report.researchTitle} menunggu penilaian.`, createdAt: now, isRead: false },
      ],
    }));
    history.push(`/ris/penelitian-eksternal/${report.id}/detail`);
  };

  const addDocument = (fileType, file) => {
    if (!file) return;
    const doc = makeExternalDocument(uid, fileType, file, user);
    update({ documents: [...(report.documents || []).filter(item => item.fileType !== fileType), doc] });
  };

  const addOptionalDocument = () => update({ documents: [...(report.documents || []), { id: uid('external-file'), fileType: 'additional', label: '', name: '', fileUrl: '' }] });
  const renameOptionalDocument = (documentId, label) => update({ documents: (report.documents || []).map(item => (item.id === documentId ? { ...item, label } : item)) });
  const uploadOptionalDocument = (documentId, file) => {
    if (!file) return;
    update({ documents: (report.documents || []).map(item => (item.id === documentId ? { ...makeExternalDocument(uid, 'additional', file, user), id: documentId, label: item.label } : item)) });
  };

  const removeDocument = fileId => update({ documents: (report.documents || []).filter(item => item.id !== fileId) });
  const addOutput = () => update({ outputs: [...(report.outputs || []), makeExternalOutput(uid)] });
  const updateOutput = (outputId, patch) => update({ outputs: (report.outputs || []).map(item => (item.id === outputId ? { ...item, ...patch } : item)) });
  const removeOutput = outputId => update({ outputs: (report.outputs || []).filter(item => item.id !== outputId) });

  const attachOutputFile = (outputId, file) => {
    if (!file) return;
    updateOutput(outputId, { file: fileMeta(file) });
  };

  const errorList = errors.length ? errors : [];

  if (reportId && !existing) return <div className="ris-page"><PageBack onClick={() => history.push('/ris/penelitian-eksternal')} /><h1>Laporan tidak ditemukan</h1></div>;

  return (
    <div className="ris-page ris-page-narrow">
      <PageBack onClick={() => history.push(archiveMode ? '/ris/arsip' : '/ris/penelitian-eksternal')} />
      <div className="ris-page-heading">
        <div>
          <h1>{archiveMode ? `Editor Arsip: ${externalReportTitle(report)}` : externalReportTitle(report)}</h1>
          <p>{archiveMode ? 'Perbarui informasi, lampiran, dan luaran penelitian eksternal.' : 'Lengkapi informasi dasar, lampiran, dan luaran sebelum mengirim laporan.'}</p>
        </div>
        <div className="ris-heading-actions">
          <Button tone={archiveMode ? 'blue' : 'gray'} onClick={saveDraft}>{archiveMode ? 'Simpan Perubahan' : 'Simpan Draf'}</Button>
        </div>
      </div>

      <div className="ris-stepper ris-external-stepper">
        {STEPS.map((label, index) => <div key={label} className={`${index === step ? 'active' : ''} ${index < step ? 'done' : ''}`}><span>{index + 1}</span><small>{label}</small></div>)}
      </div>

      {message && <div className="ris-alert ris-alert-success"><strong>Berhasil</strong><span>{message}</span></div>}
      <FloatingError message={errorList.length ? `Validasi belum terpenuhi: ${errorList.map(item => item.message).join(' ')}` : ''} />
      <datalist id="ris-organizer-options"><option value="Kemdikbudristek" /><option value="Industri" /><option value="Universitas Mitra" /><option value="Pemerintah Daerah" /><option value="Organisasi Internasional" /></datalist>
      <datalist id="ris-funding-options"><option value="DRTPM" /><option value="Industri" /><option value="Universitas Mitra" /><option value="Mandiri" /><option value="Pemerintah Daerah" /></datalist>

      {step === 0 && (
        <section className="ris-form-section">
          <div className="ris-form-section-heading">
            <h2>Langkah 1 - Informasi Dasar</h2>
            <p>Lengkapi jenis, identitas, dan metadata penelitian dalam satu tahap.</p>
          </div>
          <h3 className="ris-external-group-title">Jenis Penelitian</h3>
          <div className="ris-category-grid">
            {RESEARCH_CATEGORY_OPTIONS.map(item => (
              <button key={item.value} type="button" className={`ris-category-card ${report.category === item.value ? 'active' : ''}`} onClick={() => update({ category: item.value, typeDetail: {} })}>
                <strong>{item.label}</strong><small>{item.description}</small>
              </button>
            ))}
          </div>
          {report.category === 'grant' && (
            <>
              <Field label="Jenis Hibah" required><select value={inputValue(report.typeDetail.grantType)} onChange={event => updateDetail({ grantType: event.target.value })}><option value="">Pilih tipe hibah</option>{GRANT_TYPE_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
              <Field label="Nama Hibah" required><input value={inputValue(report.typeDetail.grantName)} onChange={event => updateDetail({ grantName: event.target.value })} /></Field>
              <Field label="Tautan Hibah"><input type="url" value={inputValue(report.typeDetail.grantLink)} onChange={event => updateDetail({ grantLink: event.target.value })} placeholder="https://" /></Field>
              <Field label="Status Penelitian" required><select value={inputValue(report.typeDetail.researchStatus)} onChange={event => updateDetail({ researchStatus: event.target.value })}><option value="">Pilih status</option><option value="awarded">Pendanaan Diberikan</option><option value="running">Sedang Berjalan</option><option value="completed">Selesai</option></select></Field>
            </>
          )}
          {report.category === 'partner' && (
            <>
              <Field label="Nama Mitra" required><input value={inputValue(report.typeDetail.partnerName)} onChange={event => updateDetail({ partnerName: event.target.value })} /></Field>
              <Field label="Perwakilan Mitra" required><input value={inputValue(report.typeDetail.partnerRepresentative)} onChange={event => updateDetail({ partnerRepresentative: event.target.value })} /></Field>
              <Field label="Asal Mitra" required><select value={inputValue(report.typeDetail.partnerOrigin)} onChange={event => updateDetail({ partnerOrigin: event.target.value })}><option value="">Pilih asal mitra</option><option value="local">Lokal</option><option value="national">Nasional</option><option value="international">Internasional</option></select></Field>
            </>
          )}
          {report.category === 'university' && (
            <>
              <Field label="Universitas Mitra" required><input value={inputValue(report.typeDetail.partnerUniversity)} onChange={event => updateDetail({ partnerUniversity: event.target.value })} /></Field>
              <Field label="Asal Universitas" required><select value={inputValue(report.typeDetail.partnerOrigin)} onChange={event => updateDetail({ partnerOrigin: event.target.value })}><option value="">Pilih asal universitas</option><option value="national">Dalam Negeri</option><option value="international">Luar Negeri</option></select></Field>
              <Field label="Status MoU" required><select value={inputValue(report.typeDetail.mouStatus)} onChange={event => updateDetail({ mouStatus: event.target.value })}><option value="">Pilih</option><option value="yes">Ya</option><option value="no">Tidak</option></select></Field>
            </>
          )}
          {report.category === 'independent' && (
            <Field label="Jenis Penelitian Mandiri" required><select value={inputValue(report.typeDetail.independentType)} onChange={event => updateDetail({ independentType: event.target.value })}><option value="">Pilih jenis mandiri</option>{INDEPENDENT_TYPE_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
          )}

          <h3 className="ris-external-group-title">Identitas Penelitian</h3>
          <Field label="Nama Aktivitas" required><input value={inputValue(report.activityName)} onChange={event => update({ activityName: event.target.value })} placeholder="Contoh: Hibah Riset Terapan Kemdikbud" /></Field>
          <Field label="Judul Penelitian" required><input value={inputValue(report.researchTitle)} onChange={event => update({ researchTitle: event.target.value })} placeholder="Judul penelitian eksternal/mandiri" /></Field>
          <Field label="Tahun Aktivitas" required><YearSelect value={inputValue(report.activityYear)} onChange={event => update({ activityYear: event.target.value })} /></Field>
          <Field label="Status Aktivitas" required><select value={report.activityStatus} onChange={event => update({ activityStatus: event.target.value })}>{ACTIVITY_STATUS_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
          <Field label="Tipe Aktivitas" required><select value={report.activityType} onChange={event => update({ activityType: event.target.value })}>{ACTIVITY_TYPE_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
          <Field label="Tim yang Terlibat" required><input type="text" inputMode="numeric" maxLength="2" value={teamMembers.length ? String(teamMembers.length) : ''} onChange={event => update({ teamMembers: resizeExternalTeam(teamMembers, event.target.value.replace(/\D/g, ''), uid) })} aria-label="Jumlah anggota tim yang terlibat" /></Field>
          {teamMembers.map((member, index) => <div className="ris-form-card" key={member.id}><h4>Anggota {index + 1}</h4><ExternalTeamMemberFields member={member} lecturers={data.lecturers || []} onChange={value => updateMember(member.id, value)} /></div>)}
          <Field label="Asal Penyelenggara/Mitra" required><input list="ris-organizer-options" value={inputValue(report.organizerOrigin)} onChange={event => update({ organizerOrigin: event.target.value })} placeholder="Pilih saran atau ketik nama penyelenggara" /></Field>
          <Field label="Sumber Pendanaan" required><input list="ris-funding-options" value={inputValue(report.fundingSource)} onChange={event => update({ fundingSource: event.target.value })} placeholder="Pilih saran atau ketik sumber pendanaan" /></Field>
          <Field label="Nominal Pendanaan" required><input type="text" inputMode="numeric" value={formatFundingAmount(report.fundingAmount)} onChange={event => update({ fundingAmount: fundingDigits(event.target.value) })} placeholder="Contoh: 5.000.000" /></Field>
          <Field label="Mata Uang" required><select value={report.currency} onChange={event => update({ currency: event.target.value })}><option value="IDR">IDR</option><option value="USD">USD</option><option value="EUR">EUR</option></select></Field>

          <h3 className="ris-external-group-title">Metadata Penelitian</h3>
          <Field label="Relasi RIP" required><select value={inputValue(report.metadata.ripRelation)} onChange={event => updateMeta({ ripRelation: event.target.value })}><option value="">Pilih relasi RIP</option>{RIP_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
          <Field label="Target TKT" required><select value={inputValue(report.metadata.tktTarget)} onChange={event => updateMeta({ tktTarget: event.target.value })}>{Array.from({ length: 9 }).map((_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></Field>
          <Field label="Keterlibatan SDG"><label className="ris-toggle-line"><input type="checkbox" checked={Boolean(report.metadata.sdgInvolvement)} onChange={event => updateMeta({ sdgInvolvement: event.target.checked, sdgs: event.target.checked ? report.metadata.sdgs : [] })} /> <span>Penelitian terkait SDG</span></label></Field>
          {report.metadata.sdgInvolvement && (
            <Field label="Pilih SDG" required alignStart>
              <div className="ris-sdg-grid">
                {SDGS.map(item => (
                  <label key={item.id}><input type="checkbox" checked={(report.metadata.sdgs || []).includes(item.code)} onChange={event => {
                    const current = report.metadata.sdgs || [];
                    updateMeta({ sdgs: event.target.checked ? [...current, item.code] : current.filter(code => code !== item.code) });
                  }} /> {item.code}. {item.name}</label>
                ))}
              </div>
            </Field>
          )}
          <Field label="Integrasi Pembelajaran"><label className="ris-toggle-line"><input type="checkbox" checked={Boolean(report.metadata.integrationToTeaching)} onChange={event => updateMeta({ integrationToTeaching: event.target.checked })} /> <span>Digunakan dalam mata kuliah</span></label></Field>
          {report.metadata.integrationToTeaching && (
            <>
              <Field label="Nama Mata Kuliah" required><select value={inputValue(report.metadata.courseName)} onChange={event => updateMeta({ courseName: event.target.value })}><option value="">Pilih mata kuliah</option><option value="Machine Learning">Pembelajaran Mesin</option><option value="Deep Learning">Pembelajaran Mendalam</option><option value="Data Mining">Penambangan Data</option><option value="Research Methodology">Metodologi Penelitian</option></select></Field>
              <Field label="Tahun Akademik" required><AcademicYearSelect value={inputValue(report.metadata.academicYear)} onChange={event => updateMeta({ academicYear: event.target.value })} /></Field>
              <Field label="Bukti Integrasi" required alignStart><FileDrop file={report.metadata.integrationProofFile} accept=".pdf,.docx,.pptx" storagePurpose="external-research" onFile={file => updateMeta({ integrationProofFile: fileMeta(file) })} label="Unggah bukti integrasi pembelajaran" /></Field>
            </>
          )}

        </section>
      )}

      {step === 1 && (
        <section className="ris-form-section">
          <div className="ris-form-section-heading">
            <h2>Langkah 2 - Lampiran</h2>
            <p>Unggah laporan penelitian. Tambahkan berkas pendukung bila diperlukan.</p>
          </div>
          <Field label="Laporan" required alignStart>
            <FileDrop file={reportDocument || null} accept=".pdf,.docx,.xlsx,.pptx" storagePurpose="external-research" onFile={selected => addDocument('report', selected)} label="Unggah Laporan" />
            {reportDocument && <button type="button" className="ris-text-danger" onClick={() => removeDocument(reportDocument.id)}>Hapus berkas</button>}
          </Field>
          <div className="ris-section-title"><h3>Lampiran Tambahan</h3><Button tone="gray" onClick={addOptionalDocument}><Icon name="plus" size={16} />Tambah Lampiran</Button></div>
          {additionalDocuments.map((document, index) => <div className="ris-form-card" key={document.id}>
            <div className="ris-card-heading"><h4>Lampiran {index + 1}</h4><button type="button" className="ris-text-danger" onClick={() => removeDocument(document.id)}>Hapus</button></div>
            <Field label="Nama Lampiran" required><input maxLength="180" value={inputValue(document.label)} onChange={event => renameOptionalDocument(document.id, event.target.value)} placeholder="Contoh: Surat kerja sama" /></Field>
            <Field label="Berkas" required alignStart><FileDrop file={document.fileUrl ? document : null} accept=".pdf,.docx,.xlsx,.pptx" storagePurpose="external-research" onFile={file => uploadOptionalDocument(document.id, file)} label="Unggah Lampiran" /></Field>
          </div>)}
        </section>
      )}

      {step === 2 && (
        <section className="ris-form-section">
          <div className="ris-section-title"><div className="ris-form-section-heading"><h2>Langkah 3 - Luaran</h2><p>Catat luaran yang telah tersedia, kemudian kirim laporan setelah seluruh data wajib lengkap.</p></div><Button tone="blue" onClick={addOutput}>Tambah Luaran</Button></div>
          {(report.outputs || []).map((output, index) => (
            <div key={output.id} className="ris-output-card">
              <div className="ris-card-heading"><h3>Luaran {index + 1}</h3><button type="button" className="ris-text-danger" onClick={() => removeOutput(output.id)}>Hapus</button></div>
              <Field label="Jenis Luaran" required><select value={output.outputType} onChange={event => updateOutput(output.id, { outputType: event.target.value })}>{OUTPUT_TYPE_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
              <Field label="Judul Luaran" required><input value={inputValue(output.title)} onChange={event => updateOutput(output.id, { title: event.target.value })} /></Field>
              <Field label="Tahun Luaran" required><YearSelect value={inputValue(output.year)} onChange={event => updateOutput(output.id, { year: event.target.value })} /></Field>
              <Field label="Deskripsi" alignStart><textarea rows="3" value={inputValue(output.description)} onChange={event => updateOutput(output.id, { description: event.target.value })} /></Field>
              <Field label="Tautan"><input type="url" value={inputValue(output.link)} onChange={event => updateOutput(output.id, { link: event.target.value })} placeholder="https://" /></Field>
              <Field label="Berkas Luaran" alignStart><FileDrop file={output.file} accept=".pdf,.docx,.xlsx,.pptx" storagePurpose="external-research" onFile={file => attachOutputFile(output.id, file)} label="Unggah berkas luaran opsional" /></Field>
            </div>
          ))}
          {(report.outputs || []).length === 0 && <div className="ris-empty-state">Belum ada luaran. Luaran boleh lebih dari satu dan dapat diisi jika sudah tersedia.</div>}
          {validation.valid ? (
            <div className="ris-alert ris-alert-success"><strong>Laporan siap dikirim</strong><span>Seluruh informasi dan lampiran wajib telah lengkap.</span></div>
          ) : (
            <FloatingError message={`Belum siap dikirim: ${validation.errors.map(item => item.message).join(' ')}`} />
          )}
        </section>
      )}

      <div className="ris-bottom-bar">
        <div>{step + 1} dari {STEPS.length}</div>
        <div>
          <Button tone="gray" disabled={step === 0} onClick={() => setStep(value => Math.max(0, value - 1))}>Sebelumnya</Button>
          {step < STEPS.length - 1 && <Button tone="green" onClick={() => setStep(value => Math.min(STEPS.length - 1, value + 1))}>Selanjutnya</Button>}
          {step === STEPS.length - 1 && (archiveMode ? <Button tone="blue" onClick={saveDraft}>Simpan Perubahan</Button> : <Button tone="blue" disabled={!validation.valid || !canSubmitExternalReport(report, user)} onClick={submitReport}>Kirim Laporan</Button>)}
        </div>
      </div>
    </div>
  );
}

ExternalResearchWizardPage.propTypes = { archiveMode: PropTypes.bool, match: PropTypes.object.isRequired };
ExternalResearchWizardPage.defaultProps = { archiveMode: false };
