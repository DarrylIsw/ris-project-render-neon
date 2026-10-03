/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, react/prop-types */
import React from 'react';
import PropTypes from 'prop-types';
import { useHistory } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import {
  Button, EmptyRow, Field, FileDrop, FloatingError, PageBack, StatusBadge
} from '../../../shared/components/Ui';
import LetterFormFields from '../components/LetterFormFields';
import LetterPdfPreview from '../components/LetterPdfPreview';
import LetterDocumentSettings from '../components/LetterDocumentSettings';
import { letterDocumentGateway, letterPdfUrl } from '../../../core/dataGateway';
import { formatDate, uid } from '../../../core/data';
import {
  LETTER_FORM_FIELD_TYPES,
  LETTER_STATUS,
  canAdminReviewLetter,
  canConfigureLetterForm,
  canDownloadFinalLetter,
  canEditLetter,
  canPrepareLetterPdf,
  canPublishSignedLetter,
  createLetterFieldKey,
  getDefaultLetterTemplate,
  getLetterPurposeMeta,
  getLetterResearchTitle,
  getLetterTypeMeta,
  letterStatusMeta,
  transitionLetterStatus,
  updateLetterHistory,
  validateLetterTemplateFields,
  validateLetterApplicantData,
} from '../workflows/letterWorkflow';

const AUTO_FILL_LABELS = {
  applicantName: 'Nama Pemohon', applicantIdentifier: 'NIDN/NIP', applicantEmail: 'Email', studyProgram: 'Program Studi', faculty: 'Fakultas', researchTitle: 'Judul Penelitian', researchYear: 'Tahun Penelitian', researchScheme: 'Skema Penelitian', researchRole: 'Peran Penelitian'
};

function InfoRows({ rows }) {
  return <dl className="ris-info-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === undefined || value === null || value === '' ? '-' : String(value)}</dd></div>)}</dl>;
}

InfoRows.propTypes = { rows: PropTypes.array.isRequired };

const normalizeBuilderFields = fields => (fields || []).map(field => ({
  ...field,
  optionsText: field.optionsText !== undefined ? field.optionsText : (field.options || []).map(option => option.label || option.value || option).join('\n'),
}));

const publishedFields = fields => fields.map(field => ({
  id: field.id,
  key: field.key,
  label: String(field.label || '').trim(),
  type: field.type,
  required: Boolean(field.required),
  placeholder: String(field.placeholder || '').trim(),
  helpText: String(field.helpText || '').trim(),
  options: field.type === 'select' ? String(field.optionsText || '').split('\n').map(value => value.trim()).filter(Boolean) : [],
}));

const downloadFinal = letter => {
  window.location.assign(letterPdfUrl(letter));
};

export default function LetterDetailPage({ match, mode }) {
  const { data, setData, runServerMutation, user } = useRis();
  const history = useHistory();
  const letter = (data.letterRequests || []).find(item => item.id === match.params.letterId);
  const initialTemplate = letter && letter.template ? letter.template : (letter ? getDefaultLetterTemplate(letter) : { name: '', content: '' });
  const [templateName, setTemplateName] = React.useState(initialTemplate.name || '');
  const [documentTemplate, setDocumentTemplate] = React.useState(initialTemplate);
  const [fields, setFields] = React.useState(() => normalizeBuilderFields((letter && letter.templateFields) || []));
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [formValues, setFormValues] = React.useState((letter && letter.form) || {});
  const [applicantValues, setApplicantValues] = React.useState((letter && letter.applicant) || {});
  const [autoFillValues, setAutoFillValues] = React.useState((letter && letter.autoFill) || {});
  const [signedUpload, setSignedUpload] = React.useState(null);
  const [working, setWorking] = React.useState(false);

  React.useEffect(() => {
    setFormValues((letter && letter.form) || {});
    setApplicantValues((letter && letter.applicant) || {});
    setAutoFillValues((letter && letter.autoFill) || {});
    setDocumentTemplate(letter && letter.template ? letter.template : initialTemplate);
  }, [letter && letter.id, letter && letter.updatedAt]);

  React.useEffect(() => {
    if (!letter || letter.status !== LETTER_STATUS.FORM_DESIGN) return;
    const template = letter.template || getDefaultLetterTemplate(letter);
    setTemplateName(template.name || '');
    setDocumentTemplate(template);
    setFields(normalizeBuilderFields(letter.templateFields || []));
  }, [letter && letter.id, letter && letter.status]);

  if (!letter) return <div className="ris-page"><h1>Surat tidak ditemukan</h1><Button tone="gray" onClick={() => history.push('/ris/pengajuan-surat')}>Kembali</Button></div>;

  const meta = letterStatusMeta(letter);
  const type = getLetterTypeMeta(letter.type);
  const purpose = letter.customName || getLetterPurposeMeta(letter.type, letter.purpose).label;
  const applicant = letter.applicant || {};

  const withAdminEdits = item => {
    if (mode !== 'admin' || !canAdminReviewLetter(item, user)) return item;
    const editedApplicant = { ...item.applicant, ...applicantValues };
    const editedAutoFill = { ...item.autoFill, ...autoFillValues, applicantName: editedApplicant.name, applicantIdentifier: editedApplicant.identifier, applicantEmail: editedApplicant.email, studyProgram: editedApplicant.program, faculty: editedApplicant.faculty };
    const changed = JSON.stringify(item.form || {}) !== JSON.stringify(formValues)
      || JSON.stringify(item.applicant || {}) !== JSON.stringify(editedApplicant)
      || JSON.stringify(item.autoFill || {}) !== JSON.stringify(editedAutoFill)
      || JSON.stringify(item.template || {}) !== JSON.stringify(documentTemplate);
    return {
      ...item, applicant: editedApplicant,
      applicants: (item.applicants || []).map((value, index) => (index === 0 ? { ...value, ...applicantValues } : value)),
      autoFill: editedAutoFill,
      form: formValues,
      template: documentTemplate,
      formEditedBy: changed ? user.id : item.formEditedBy,
      generated: changed && item.generated && item.generated.draftFileUrl
        ? { ...item.generated, draftFileUrl: null, draftFileId: null, sourceFingerprint: null }
        : item.generated,
      updatedAt: new Date().toISOString(),
    };
  };

  const changeStatus = (nextStatus, changes, note) => {
    setData(current => ({
      ...current,
      letterRequests: (current.letterRequests || []).map(item => {
        if (item.id !== letter.id) return item;
        const transitioned = transitionLetterStatus(withAdminEdits(item), nextStatus, changes);
        return transitioned ? updateLetterHistory(transitioned, nextStatus, note, user) : item;
      }),
    }));
  };

  const saveAdminData = () => {
    setData(current => ({ ...current, letterRequests: (current.letterRequests || []).map(item => (item.id === letter.id ? withAdminEdits(item) : item)) }));
    setSignedUpload(null);
    setSuccess('Data surat berhasil diperbarui.');
  };

  const addReview = (decision, reviewNotes) => ({
    reviews: [...(letter.reviews || []), { id: uid('letter-review'), letterId: letter.id, reviewerId: user.id, decision, notes: reviewNotes, reviewedAt: new Date().toISOString() }],
  });

  const acceptRequest = () => {
    const template = letter.template || getDefaultLetterTemplate(letter);
    changeStatus(LETTER_STATUS.FORM_DESIGN, { template, acceptedAt: new Date().toISOString(), acceptedBy: user.id, ...addReview('accepted', notes || 'Permintaan surat diterima.') }, notes || 'Permintaan diterima. Admin menyiapkan template dan kebutuhan data.');
    setSuccess('Permintaan diterima. Form builder siap digunakan.');
  };

  const rejectRequest = () => {
    const reviewNotes = notes.trim() || 'Permintaan surat ditolak oleh pengelola.';
    changeStatus(LETTER_STATUS.REJECTED, addReview('rejected', reviewNotes), reviewNotes);
    setSuccess('Permintaan surat ditolak.');
  };

  const addField = () => {
    const key = createLetterFieldKey('field', fields);
    setFields(current => [...current, { id: uid('letter-field'), key, label: '', type: 'text', required: true, placeholder: '', helpText: '', optionsText: '' }]);
  };

  const updateField = (fieldId, patch) => setFields(current => current.map(field => {
    if (field.id !== fieldId) return field;
    const next = { ...field, ...patch };
    return next;
  }));

  const publishForm = () => {
    const configuredFields = publishedFields(fields);
    const validation = [
      ...(!templateName.trim() ? ['Nama template wajib diisi.'] : []),
      ...(configuredFields.length === 0 ? ['Tambahkan minimal satu field untuk diisi lecturer.'] : []),
      ...validateLetterTemplateFields(configuredFields),
    ];
    if (validation.length) {
      setError(validation.join(' '));
      return;
    }
    setError('');
    changeStatus(LETTER_STATUS.DATA_REQUIRED, {
      template: { ...documentTemplate, name: templateName.trim(), content: documentTemplate.content || 'Templat Word RIS' },
      templateFields: configuredFields,
      configuredAt: new Date().toISOString(),
      configuredBy: user.id,
    }, 'Template dan kebutuhan data telah diterbitkan untuk dilengkapi lecturer.');
    setSuccess('Form berhasil dikirim ke lecturer.');
  };

  const requestRevision = () => {
    const reviewNotes = notes.trim() || 'Data perlu diperbaiki sebelum surat dapat diterbitkan.';
    changeStatus(LETTER_STATUS.REVISION_REQUIRED, addReview('revision', reviewNotes), reviewNotes);
    setSuccess('Permintaan perbaikan dikirim ke lecturer.');
  };

  const notifyAccepted = () => {
    const validation = validateLetterApplicantData({ ...letter, form: formValues });
    if (validation.length) {
      setError(validation.join(' '));
      return;
    }
    changeStatus(LETTER_STATUS.APPROVED, addReview('approved', notes.trim() || 'Pengajuan diterima dan surat sedang disiapkan.'), 'Pengajuan diterima. Surat akan diterbitkan setelah selesai diproses.');
    setSuccess('Pemberitahuan penerimaan dikirim kepada dosen.');
  };

  const generateDraftPdf = async () => {
    if (!canPrepareLetterPdf(letter, user) || working) return;
    setWorking(true);
    setError('');
    try {
      setData(current => ({ ...current, letterRequests: current.letterRequests.map(item => (item.id === letter.id ? withAdminEdits(item) : item)) }));
      await runServerMutation(() => letterDocumentGateway.generate(letter.id));
      setSuccess('PDF draf tersedia untuk diunduh dan ditandatangani.');
    } catch (uploadError) { setError(uploadError.message || 'PDF gagal dibuat.'); } finally { setWorking(false); }
  };

  const publishSignedPdf = async () => {
    if (!canPublishSignedLetter(letter, user) || !signedUpload || working) return;
    if (!/\.pdf$/i.test(signedUpload.name) || !signedUpload.risFileUrl) {
      setError('Unggah surat bertanda tangan dalam format PDF.');
      return;
    }
    setWorking(true);
    setError('');
    try {
      if (JSON.stringify(withAdminEdits(letter).form) !== JSON.stringify(letter.form)
        || JSON.stringify(documentTemplate) !== JSON.stringify(letter.template)
        || JSON.stringify(applicantValues) !== JSON.stringify(letter.applicant)
        || JSON.stringify(autoFillValues) !== JSON.stringify(letter.autoFill)) {
        throw new Error('Simpan koreksi dan buat kembali PDF sebelum menerbitkan surat.');
      }
      await runServerMutation(() => letterDocumentGateway.publish(letter.id, signedUpload.risFileId, notes.trim()));
      setSignedUpload(null);
      setSuccess('Surat final diterbitkan. Dosen akan menerima notifikasi dan dapat mengunduh PDF.');
    } catch (publishError) { setError(publishError.message); } finally { setWorking(false); }
  };

  return (
    <div className="ris-page ris-workspace-page ris-letter-detail-page">
      <fieldset className="ris-letter-operation-fields" disabled={working}>
        <PageBack onClick={() => history.push('/ris/pengajuan-surat')} />
        <div className="ris-page-heading"><div><h1>{mode === 'admin' ? 'Proses Pengajuan Surat' : 'Detail Pengajuan Surat'}</h1><p>{getLetterResearchTitle(letter, data)}</p></div><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></div>
        <FloatingError message={error} />
        {success && <div className="ris-alert ris-alert-success">{success}</div>}

        <div className="ris-letter-overview-grid">
          <section className="ris-form-card"><h2>Permintaan Surat</h2><InfoRows rows={[['ID Pengajuan', letter.id], ['Jenis Surat', type.label], ['Subkategori / Nama Surat', purpose], ['Tanggal Pengajuan', formatDate(letter.submittedAt || letter.createdAt)]]} /></section>
          <section className="ris-form-card"><h2>Pemohon</h2><InfoRows rows={[['Nama', applicant.name], ['NIDN/NIP', applicant.identifier], ['Email', applicant.email], ['Program Studi', applicant.program], ['Fakultas', applicant.faculty]]} /></section>
        </div>

        <section className="ris-form-card ris-letter-autofill-card">
          <div className="ris-form-section-heading"><h2>Data Terisi Otomatis</h2><p>Data ini menjadi konteks dasar template dan tidak perlu diketik ulang oleh lecturer.</p></div>
          <InfoRows rows={Object.entries(letter.autoFill || {}).map(([key, value]) => [AUTO_FILL_LABELS[key] || key, value])} />
        </section>

        {mode === 'admin' && letter.status === LETTER_STATUS.SUBMITTED && !letter.definitionId && <section className="ris-decision-box">
          <div className="ris-form-section-heading"><h2>Verifikasi Permintaan</h2><p>Terima permintaan untuk mulai menyusun template dan field, atau tolak dengan alasan yang jelas.</p></div>
          <Field label="Catatan Pengelola" alignStart><textarea rows="4" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Catatan penerimaan atau alasan penolakan" /></Field>
          <div className="ris-align-right"><Button tone="red" onClick={rejectRequest}>Tolak Permintaan</Button><Button tone="green" onClick={acceptRequest}>Terima & Susun Form</Button></div>
        </section>}

        {mode === 'admin' && canConfigureLetterForm(letter, user) && <section className="ris-letter-builder">
          <div className="ris-form-section-heading"><h2>Templat Surat</h2></div>
          <div className="ris-form-card">
            <Field label="Nama Template" required><input value={templateName} onChange={event => setTemplateName(event.target.value)} /></Field>
            <LetterDocumentSettings value={{ ...letter, template: documentTemplate, templateFields: fields }} onChange={setDocumentTemplate} onAddFields={additions => setFields(current => [...current, ...normalizeBuilderFields(additions.map(field => ({ ...field, id: uid('letter-field') })))])} />
          </div>
          <div className="ris-form-section-heading ris-letter-builder-heading"><div><h2>Form untuk Lecturer</h2><p>Tambahkan field yang belum tersedia dari data otomatis.</p></div><Button tone="blue" onClick={addField}>Tambah Field</Button></div>
          <div className="ris-letter-builder-list">
            {fields.map((field, index) => <div className="ris-form-card ris-letter-builder-row" key={field.id}>
              <div className="ris-card-heading"><h3>Field {index + 1}</h3><button type="button" className="ris-action red" onClick={() => setFields(current => current.filter(item => item.id !== field.id))}>Hapus</button></div>
              <div className="ris-letter-builder-grid">
                <Field label="Nama Field" required><input value={field.label} onChange={event => updateField(field.id, { label: event.target.value })} placeholder="Contoh: Nama Instansi Tujuan" /></Field>
                <Field label="Variabel Templat" required><input value={field.key} onChange={event => updateField(field.id, { key: event.target.value })} /></Field>
                <Field label="Tipe Input" required><select value={field.type} onChange={event => updateField(field.id, { type: event.target.value })}>{LETTER_FORM_FIELD_TYPES.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field>
                <Field label="Placeholder"><input value={field.placeholder} onChange={event => updateField(field.id, { placeholder: event.target.value })} /></Field>
                <Field label="Petunjuk"><input value={field.helpText} onChange={event => updateField(field.id, { helpText: event.target.value })} /></Field>
              </div>
              {field.type === 'select' && <Field label="Daftar Pilihan" required alignStart hint="Satu pilihan per baris."><textarea rows="4" value={field.optionsText} onChange={event => updateField(field.id, { optionsText: event.target.value })} /></Field>}
              <label className="ris-check-row"><input type="checkbox" checked={field.required} onChange={event => updateField(field.id, { required: event.target.checked })} /><span>Wajib diisi lecturer</span></label>
            </div>)}
            {fields.length === 0 && <div className="ris-empty-state">Belum ada field tambahan. Tambahkan minimal satu field.</div>}
          </div>
          <LetterPdfPreview title="Pratinjau Templat" payload={{ letterId: letter.id, letter: { template: { ...documentTemplate, name: templateName }, templateFields: publishedFields(fields) } }} />
          <div className="ris-align-right"><Button tone="green" onClick={publishForm}>Kirim Form ke Lecturer</Button></div>
        </section>}

        {letter.template && <section className="ris-form-card ris-letter-template-summary">
          <div className="ris-form-section-heading"><h2>{letter.template.name}</h2><p>{(letter.templateFields || []).length} field tambahan disiapkan oleh pengelola.</p></div>
          <div className="ris-table-wrap"><table className="ris-table"><thead><tr><th>No.</th><th>Field</th><th>Tipe</th><th>Wajib</th><th>Data Lecturer</th></tr></thead><tbody>{(letter.templateFields || []).map((field, index) => <tr key={field.id || field.key}><td>{index + 1}.</td><td>{field.label}</td><td>{(LETTER_FORM_FIELD_TYPES.find(item => item.value === field.type) || {}).label || field.type}</td><td>{field.required ? 'Ya' : 'Tidak'}</td><td>{(letter.form || {})[field.key] || '-'}</td></tr>)}{(!letter.templateFields || letter.templateFields.length === 0) && <EmptyRow colSpan={5}>Belum ada field tambahan.</EmptyRow>}</tbody></table></div>
        </section>}

        {mode === 'admin' && canAdminReviewLetter(letter, user) && <section className="ris-form-card">
          <div className="ris-form-section-heading"><h2>Koreksi Data Surat</h2><p>Perubahan di sini berlaku untuk pengajuan surat ini saja.</p></div>
          <div className="ris-letter-builder-grid">
            {[['name', 'Nama Pemohon'], ['identifier', 'NIDN/NIP'], ['email', 'Email Pemohon'], ['program', 'Program Studi'], ['faculty', 'Fakultas']].map(([key, label]) => <Field key={key} label={label}><input value={applicantValues[key] || ''} onChange={event => setApplicantValues(current => ({ ...current, [key]: event.target.value }))} /></Field>)}
          </div>
          <LetterFormFields fields={letter.templateFields || []} values={formValues} onChange={(key, value) => setFormValues(current => ({ ...current, [key]: value }))} />
          <LetterDocumentSettings value={{ ...letter, template: documentTemplate }} onChange={setDocumentTemplate} />
          {Object.keys(autoFillValues).filter(key => ['researchTitle', 'researchYear', 'researchScheme', 'researchRole'].includes(key)).length > 0 && <div className="ris-letter-builder-grid">
            {Object.keys(autoFillValues).filter(key => ['researchTitle', 'researchYear', 'researchScheme', 'researchRole'].includes(key)).map(key => <Field key={key} label={AUTO_FILL_LABELS[key]}><input type={key === 'researchYear' ? 'number' : 'text'} value={autoFillValues[key] || ''} onChange={event => setAutoFillValues(current => ({ ...current, [key]: event.target.value }))} /></Field>)}
          </div>}
          <div className="ris-align-right"><Button tone="blue" onClick={saveAdminData}>Simpan Koreksi</Button></div>
        </section>}

        {mode === 'admin' && letter.template && ![LETTER_STATUS.GENERATED, LETTER_STATUS.FORM_DESIGN].includes(letter.status) && <LetterPdfPreview payload={{ letterId: letter.id, letter: { ...letter, template: documentTemplate, form: formValues, applicant: applicantValues, autoFill: autoFillValues } }} />}
        {canDownloadFinalLetter(letter, user) && <LetterPdfPreview title="Surat Terbit" sourceUrl={letterPdfUrl(letter, true)} />}

        {mode === 'admin' && canAdminReviewLetter(letter, user) && letter.status !== LETTER_STATUS.APPROVED && (letter.definitionId || letter.status !== LETTER_STATUS.SUBMITTED) && <section className="ris-decision-box">
          <div className="ris-form-section-heading"><h2>Verifikasi Data</h2><p>Pengajuan yang diterima akan diberitahukan kepada dosen sebelum surat diterbitkan.</p></div>
          <Field label="Catatan Verifikasi" alignStart><textarea rows="4" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Catatan perbaikan atau finalisasi" /></Field>
          <div className="ris-align-right"><Button tone="amber" onClick={requestRevision}>Minta Perbaikan</Button><Button tone="red" onClick={rejectRequest}>Tolak</Button><Button tone="green" onClick={notifyAccepted}>Terima dan Beri Notifikasi</Button></div>
        </section>}

        {mode === 'admin' && canPrepareLetterPdf(letter, user) && <section className="ris-decision-box">
          <div className="ris-form-section-heading"><h2>Penerbitan Surat</h2><p>Buat PDF, unduh untuk tanda tangan di luar sistem, lalu unggah hasil yang sudah ditandatangani.</p></div>
          <div className="ris-align-right"><Button tone="blue" disabled={working} onClick={generateDraftPdf}>{working ? 'Membuat PDF...' : 'Buat PDF Surat'}</Button>{letter.generated && letter.generated.draftFileUrl && <a className="ris-button ris-button-gray" href={letter.generated.draftFileUrl} target="_blank" rel="noopener noreferrer">Unduh PDF Draf</a>}</div>
          {canPublishSignedLetter(letter, user) && <>
            <Field label="PDF Bertanda Tangan" alignStart><FileDrop file={signedUpload} accept=".pdf" maxSize={20 * 1024 * 1024} storagePurpose="letters" label="Unggah PDF yang sudah ditandatangani" onFile={setSignedUpload} onError={setError} /></Field>
            <div className="ris-align-right"><Button tone="green" disabled={!signedUpload || working} onClick={publishSignedPdf}>Kirim Surat Final ke Dosen</Button></div>
          </>}
        </section>}

        <section className="ris-form-card"><h2>Riwayat Proses</h2><div className="ris-timeline">{(letter.history || []).map(item => <div key={`${item.status}-${item.at}`}><b>{letterStatusMeta({ status: item.status }).label}</b><span>{formatDate(item.at)}</span><p>{item.note}</p></div>)}</div></section>

        <div className="ris-bottom-bar"><div>{letter.generated && letter.generated.letterNumber ? `Nomor surat: ${letter.generated.letterNumber}` : 'Surat belum diterbitkan.'}</div><div>{canEditLetter(letter, user) && <Button tone="orange" onClick={() => history.push(`/ris/pengajuan-surat/${letter.id}/edit`)}>Input Data</Button>}{canDownloadFinalLetter(letter, user) && <Button tone="green" onClick={() => downloadFinal(letter)}>Unduh Surat PDF</Button>}</div></div>
      </fieldset>
    </div>
  );
}

LetterDetailPage.propTypes = { match: PropTypes.object.isRequired, mode: PropTypes.string };
LetterDetailPage.defaultProps = { mode: 'detail' };
