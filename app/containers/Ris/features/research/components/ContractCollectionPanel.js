/* eslint-disable object-curly-newline, object-property-newline, react/prop-types */
import React, { useState } from 'react';
import { useRis } from '../../../core/RisContext';
import { fileMeta, formatDate } from '../../../core/data';
import { Button, FileDrop, StatusBadge } from '../../../shared/components/Ui';

const contractStage = contract => {
  if (!contract) return 'awaiting_admin_contract';
  if (contract.lecturerSignedFile || contract.signedFile || ['signed', 'completed'].includes(contract.status || contract.contractStatus)) return 'completed';
  if (contract.sentToLecturerAt || ['awaiting_lecturer_signature', 'sent_to_lecturer'].includes(contract.status || contract.contractStatus)) return 'awaiting_lecturer_signature';
  if (contract.adminSignedFile || ['admin_uploaded', 'ready_to_send'].includes(contract.status || contract.contractStatus)) return 'ready_to_send';
  return 'awaiting_admin_contract';
};

const stageMeta = {
  awaiting_admin_contract: { label: 'Menunggu Kontrak Pengelola', tone: 'yellow' },
  ready_to_send: { label: 'Siap Dikirim ke Dosen', tone: 'blue' },
  awaiting_lecturer_signature: { label: 'Menunggu TTD Dosen', tone: 'yellow' },
  completed: { label: 'Kontrak Selesai', tone: 'green' },
};

const storedFile = file => file && (file.fileUrl || file.risFileUrl || file.url || file.downloadUrl);

const downloadFile = (file, fallbackName) => {
  const url = storedFile(file);
  if (!url) return false;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = (file && file.name) || fallbackName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  return true;
};

export default function ContractCollectionPanel({ draft, managementMode }) {
  const { setData, user } = useRis();
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const contract = draft.contract || { status: 'unsigned' };
  const stage = contractStage(contract);
  const adminContract = contract.adminSignedFile;
  const lecturerContract = contract.lecturerSignedFile || contract.signedFile || contract.signedContractFile;
  const downloadAdminContract = () => {
    if (!downloadFile(adminContract, 'kontrak-penelitian-ditandatangani-pengelola.pdf')) setError('Berkas kontrak belum tersedia untuk diunduh. Unggah ulang kontrak bila masalah tetap terjadi.');
  };
  const downloadLecturerContract = () => {
    if (!downloadFile(lecturerContract, 'kontrak-penelitian-ditandatangani-dosen.pdf')) setError('Berkas kontrak bertanda tangan dosen belum tersedia untuk diunduh.');
  };
  const saveAdminContract = () => {
    if (!file) {
      setError('Pilih kontrak yang sudah ditandatangani pengelola.');
      return;
    }
    const now = new Date().toISOString();
    setData(current => ({
      ...current,
      drafts: current.drafts.map(item => (item.id === draft.id ? {
        ...item,
        contract: {
          ...contract,
          status: 'admin_uploaded', contractStatus: 'admin_uploaded',
          adminSignedFile: fileMeta(file), adminSignedAt: now, adminSignedBy: user.id,
          sentToLecturerAt: null, sentToLecturerBy: null,
        },
      } : item)),
    }));
    setFile(null);
    setError('');
  };
  const sendToLecturer = () => {
    if (!adminContract) {
      setError('Unggah dan simpan kontrak bertanda tangan pengelola terlebih dahulu.');
      return;
    }
    const now = new Date().toISOString();
    setData(current => ({
      ...current,
      drafts: current.drafts.map(item => (item.id === draft.id ? {
        ...item,
        contract: { ...contract, status: 'awaiting_lecturer_signature', contractStatus: 'awaiting_lecturer_signature', sentToLecturerAt: now, sentToLecturerBy: user.id },
      } : item)),
    }));
    setError('');
  };
  const submitLecturerContract = () => {
    if (!file) {
      setError('Pilih kontrak yang sudah Anda tandatangani.');
      return;
    }
    const signedAt = new Date().toISOString();
    const signedFile = fileMeta(file);
    setData(current => ({
      ...current,
      drafts: current.drafts.map(item => (item.id === draft.id ? {
        ...item,
        contract: {
          ...contract,
          status: 'completed', contractStatus: 'completed', lecturerSignedFile: signedFile, lecturerSignedAt: signedAt, lecturerSignedBy: user.id,
          signedFile, signedContractFile: signedFile, uploadedBy: user.id, signedAt,
        },
      } : item)),
    }));
    setFile(null);
    setError('');
  };

  const meta = stageMeta[stage];
  const isWaitingForLecturer = stage === 'awaiting_lecturer_signature';
  return (
    <section className="ris-scheme-data-panel">
      <div className="ris-section-title"><div><h2>Pengumpulan Kontrak untuk Tanda Tangan</h2><p className="ris-muted">{managementMode ? 'Unggah kontrak yang telah ditandatangani pengelola, kirim ke dosen, lalu terima kembali kontrak bertanda tangan dosen.' : 'Kontrak akan tersedia setelah dikirim oleh pengelola. Unduh, tanda tangani di luar sistem, lalu unggah kembali dalam format PDF.'}</p></div><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></div>

      {managementMode && stage !== 'completed' && <React.Fragment><div className="ris-contract-upload-area"><div className="ris-section-title"><div><h3>{adminContract ? 'Perbarui Kontrak Bertanda Tangan Pengelola' : 'Unggah Kontrak Bertanda Tangan Pengelola'}</h3><p className="ris-muted">Unggah PDF yang sudah ditandatangani pengelola sebelum mengirimkannya kepada dosen.</p></div>{file && <Button tone="gray" onClick={() => { setFile(null); setError(''); }}>Atur Ulang</Button>}</div><FileDrop file={file} accept=".pdf" maxSize={10 * 1024 * 1024} storagePurpose="contracts" onError={setError} onFile={setFile} label="Pilih kontrak bertanda tangan pengelola" /><div className="ris-panel-actions"><Button disabled={!file} onClick={saveAdminContract}>Simpan Kontrak</Button></div></div>
        {adminContract && <div className="ris-contract-instruction"><div><strong>Kontrak bertanda tangan pengelola</strong><span>{adminContract.name || 'kontrak-penelitian.pdf'}</span></div><div className="ris-contract-actions"><Button type="button" tone="gray" onClick={downloadAdminContract}>Unduh Kontrak</Button><Button type="button" tone="blue" onClick={sendToLecturer}>{isWaitingForLecturer ? 'Kirim Ulang ke Dosen' : 'Kirim ke Dosen'}</Button></div></div>}
      </React.Fragment>}

      {!managementMode && !isWaitingForLecturer && stage !== 'completed' && <div className="ris-empty-state">Kontrak bertanda tangan pengelola belum tersedia. Anda akan menerima notifikasi ketika kontrak siap diunduh.</div>}
      {!managementMode && (isWaitingForLecturer || stage === 'completed') && <div className="ris-contract-instruction"><div><strong>Kontrak penelitian dari pengelola</strong><span>{(adminContract && adminContract.name) || 'kontrak-penelitian.pdf'}</span></div><Button type="button" tone="blue" onClick={downloadAdminContract}>Unduh Kontrak</Button></div>}
      {!managementMode && isWaitingForLecturer && <div className="ris-contract-upload-area"><div className="ris-section-title"><div><h3>Unggah Kontrak Bertanda Tangan</h3><p className="ris-muted">Pastikan kontrak sudah ditandatangani sebelum diunggah. PDF maksimal 10 MB.</p></div>{file && <Button tone="gray" onClick={() => { setFile(null); setError(''); }}>Atur Ulang</Button>}</div><FileDrop file={file} accept=".pdf" maxSize={10 * 1024 * 1024} storagePurpose="contracts" onError={setError} onFile={setFile} label="Pilih kontrak bertanda tangan" /><div className="ris-panel-actions"><Button disabled={!file} onClick={submitLecturerContract}>Kirim Kontrak ke Pengelola</Button></div></div>}
      {stage === 'completed' && <div className="ris-alert ris-alert-success"><strong>{managementMode ? 'Kontrak bertanda tangan dosen telah diterima.' : 'Kontrak bertanda tangan Anda telah diterima pengelola.'}</strong><span>Berkas: {(lecturerContract && lecturerContract.name) || '-'}</span><small>Ditandatangani dosen: {formatDate(contract.lecturerSignedAt || contract.signedAt)}</small>{managementMode && <Button type="button" tone="gray" onClick={downloadLecturerContract}>Unduh Kontrak Dosen</Button>}</div>}
      {error && <p className="ris-inline-error">{error}</p>}
    </section>
  );
}

ContractCollectionPanel.defaultProps = { managementMode: false };
