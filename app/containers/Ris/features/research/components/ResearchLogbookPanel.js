/* eslint-disable object-curly-newline, object-property-newline, react/prop-types */
import React, { useMemo, useState } from 'react';
import { useRis } from '../../../core/RisContext';
import { uid } from '../../../core/data';
import Icon from '../../../shared/components/Icon';
import LogbookEvidenceField, { LogbookEvidenceLinks } from './LogbookEvidenceField';
import { Button, EmptyRow, FloatingError, Modal } from '../../../shared/components/Ui';

const emptyForm = {
  date: '', startTime: '', endTime: '', description: '', fileCount: 0, evidenceFiles: []
};

const displayDate = value => (value ? value.split('-').reverse().join('/') : '-');
const hours = entry => {
  if (!entry.startTime || !entry.endTime) return 0;
  const [startHour, startMinute] = entry.startTime.split(':').map(Number);
  const [endHour, endMinute] = entry.endTime.split(':').map(Number);
  return Math.max(0, Math.round((endHour * 60 + endMinute - startHour * 60 - startMinute) / 60));
};

export default function ResearchLogbookPanel({ draft, readOnly }) {
  const { data, setData } = useRis();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const entries = useMemo(() => data.logbooks.filter(item => item.researchId === draft.id), [data.logbooks, draft.id]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };
  const openEdit = entry => {
    setEditingId(entry.id);
    setForm(entry);
    setError('');
    setModalOpen(true);
  };
  const save = () => {
    if (uploading) return;
    if (!form.date || !form.startTime || !form.endTime || !form.description.trim()) {
      setError('Tanggal, waktu, dan deskripsi wajib diisi.');
      return;
    }
    if (form.endTime <= form.startTime) {
      setError('Waktu selesai harus lebih lambat dari waktu mulai.');
      return;
    }
    const entry = { ...form, id: editingId || uid('log'), researchId: draft.id, fileCount: form.evidenceFiles ? form.evidenceFiles.length : form.fileCount };
    setData(current => ({
      ...current,
      logbooks: editingId
        ? current.logbooks.map(item => (item.id === editingId ? entry : item))
        : [...current.logbooks, entry],
    }));
    setModalOpen(false);
  };
  const remove = id => setData(current => ({ ...current, logbooks: current.logbooks.filter(item => item.id !== id) }));

  return (
    <section className="ris-scheme-data-panel">
      <div className="ris-section-title"><div><h2>Catatan Kegiatan Penelitian</h2><p className="ris-muted">{readOnly ? 'Riwayat aktivitas penelitian yang dicatat oleh ketua penelitian.' : 'Catat aktivitas operasional penelitian sehari-hari beserta durasi dan buktinya.'}</p></div>{!readOnly && <Button type="button" tone="blue" onClick={openAdd}><Icon name="plus" size={15} />Tambah Kegiatan</Button>}</div>
      <div className="ris-table-wrap"><table className="ris-table"><thead><tr><th>No.</th><th>Tanggal</th><th>Mulai</th><th>Selesai</th><th>Total Jam</th><th>Deskripsi Kegiatan</th><th>Bukti</th>{!readOnly && <th>Aksi</th>}</tr></thead><tbody>
        {entries.map((entry, index) => <tr key={entry.id}><td>{index + 1}.</td><td>{displayDate(entry.date)}</td><td>{entry.startTime}</td><td>{entry.endTime}</td><td>{hours(entry)}</td><td className="ris-description-cell">{entry.description}</td><td><LogbookEvidenceLinks entry={entry} /></td>{!readOnly && <td><div className="ris-row-actions"><button type="button" className="ris-action blue" onClick={() => openEdit(entry)}>Ubah</button><button type="button" className="ris-action red" onClick={() => remove(entry.id)}>Hapus</button></div></td>}</tr>)}
        {entries.length === 0 && <EmptyRow colSpan={readOnly ? 7 : 8}>Belum ada catatan kegiatan.</EmptyRow>}
      </tbody></table></div>
      {modalOpen && <Modal title={editingId ? 'Ubah Kegiatan' : 'Tambah Kegiatan'} onClose={() => setModalOpen(false)}><div className="ris-modal-body"><FloatingError message={error} /><div className="ris-form-grid two"><div className="ris-field"><label>Tanggal <span className="ris-required">*</span></label><div className="ris-field-control"><input type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} /></div></div><div /><div className="ris-field"><label>Waktu Mulai <span className="ris-required">*</span></label><div className="ris-field-control"><input type="time" value={form.startTime} onChange={event => setForm({ ...form, startTime: event.target.value })} /></div></div><div className="ris-field"><label>Waktu Selesai <span className="ris-required">*</span></label><div className="ris-field-control"><input type="time" value={form.endTime} min={form.startTime || undefined} onChange={event => setForm({ ...form, endTime: event.target.value })} /></div></div></div><div className="ris-field ris-field-start"><label>Deskripsi Kegiatan <span className="ris-required">*</span></label><div className="ris-field-control"><textarea rows="4" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Deskripsikan kegiatan penelitian..." /></div></div><div className="ris-field"><label>Bukti Kegiatan</label><div className="ris-field-control"><LogbookEvidenceField files={form.evidenceFiles || []} onChange={evidenceFiles => setForm(current => ({ ...current, evidenceFiles, fileCount: evidenceFiles.length }))} onBusy={setUploading} onError={setError} /></div></div><div className="ris-modal-actions"><Button tone="gray" onClick={() => setModalOpen(false)}>Batal</Button><Button tone="blue" disabled={uploading} onClick={save}>Simpan</Button></div></div></Modal>}
    </section>
  );
}

ResearchLogbookPanel.defaultProps = { readOnly: false };
