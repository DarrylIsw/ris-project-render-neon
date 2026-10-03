/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React, { useMemo, useState } from 'react';
import { useRis } from '../../../core/RisContext';
import Icon from '../../../shared/components/Icon';
import LogbookEvidenceField, { LogbookEvidenceLinks } from '../components/LogbookEvidenceField';
import { Button, EmptyRow, FloatingError, Modal } from '../../../shared/components/Ui';
import { uid } from '../../../core/data';
import { canReportResearch, getSchemeTitle } from '../../../shared/workflows/workflow';
import { outputDefinitionLabel } from '../workflows/schemeConfiguration';

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

export default function LogbookPage() {
  const { data, setData, user } = useRis();
  const researches = data.drafts.filter(item => canReportResearch(item, user));
  const [researchId, setResearchId] = useState(researches[0] ? researches[0].id : '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const research = researches.find(item => item.id === researchId);
  const entries = useMemo(() => data.logbooks.filter(item => item.researchId === researchId), [data.logbooks, researchId]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setError(''); setModalOpen(true); };
  const openEdit = entry => { setEditingId(entry.id); setForm(entry); setError(''); setModalOpen(true); };
  const save = () => {
    if (uploading) return;
    if (!form.date || !form.startTime || !form.endTime || !form.description.trim()) { setError('Tanggal, waktu, dan deskripsi wajib diisi.'); return; }
    const entry = { ...form, id: editingId || uid('log'), researchId, fileCount: form.evidenceFiles ? form.evidenceFiles.length : form.fileCount };
    setData(current => ({ ...current, logbooks: editingId ? current.logbooks.map(item => (item.id === editingId ? entry : item)) : [...current.logbooks, entry] }));
    setModalOpen(false);
  };
  const remove = id => setData(current => ({ ...current, logbooks: current.logbooks.filter(item => item.id !== id) }));

  return <div className="ris-page"><h1>Logbook</h1><div className="ris-research-picker"><label>Judul penelitian</label><select value={researchId} onChange={event => setResearchId(event.target.value)}><option value="">-- Pilih Penelitian --</option>{researches.map(item => <option key={item.id} value={item.id}>{item.project.title}</option>)}</select><Button type="button" tone="blue">Cari</Button></div>
    {research && <div className="ris-logbook-info"><p><span>Skema Penelitian</span>{getSchemeTitle(data.schemes.find(item => item.id === research.schemeId))}</p><p><span>Luaran Wajib</span>{(research.outputs || []).filter(output => output.type === 'wajib').map(outputDefinitionLabel).join(', ') || '-'}</p><Button type="button" tone="blue" pill onClick={openAdd}>Tambah Kegiatan Baru <Icon name="plus" size={13} /></Button></div>}
    <div className="ris-table-wrap"><table className="ris-table"><thead><tr><th>No.</th><th>Tanggal</th><th>Waktu Mulai</th><th>Waktu Selesai</th><th>Total Jam</th><th>Deskripsi Kegiatan</th><th>Bukti Kegiatan</th><th>Aksi</th></tr></thead><tbody>{entries.map((entry, index) => <tr key={entry.id}><td>{index + 1}.</td><td>{displayDate(entry.date)}</td><td>{entry.startTime}</td><td>{entry.endTime}</td><td>{hours(entry)}</td><td className="ris-description-cell">{entry.description}</td><td><LogbookEvidenceLinks entry={entry} /></td><td><button type="button" className="ris-action blue" onClick={() => openEdit(entry)}>Edit</button><button type="button" className="ris-action red" onClick={() => remove(entry.id)}>Hapus</button></td></tr>)}{entries.length === 0 && <EmptyRow colSpan={8}>Belum ada entri logbook.</EmptyRow>}</tbody></table></div>
    {modalOpen && <Modal title={editingId ? 'Edit Kegiatan' : 'Tambah Kegiatan Baru'} onClose={() => setModalOpen(false)}><div className="ris-modal-body"><FloatingError message={error} /><div className="ris-field"><label>Tanggal <span className="ris-required">*</span></label><div className="ris-field-control"><input type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} /></div></div><div className="ris-field"><label>Waktu Mulai <span className="ris-required">*</span></label><div className="ris-field-control"><input type="time" value={form.startTime} onChange={event => setForm({ ...form, startTime: event.target.value })} /></div></div><div className="ris-field"><label>Waktu Selesai <span className="ris-required">*</span></label><div className="ris-field-control"><input type="time" value={form.endTime} onChange={event => setForm({ ...form, endTime: event.target.value })} /></div></div><div className="ris-field ris-field-start"><label>Deskripsi Kegiatan <span className="ris-required">*</span></label><div className="ris-field-control"><textarea rows="4" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Deskripsikan kegiatan..." /></div></div><div className="ris-field"><label>Bukti Kegiatan</label><div className="ris-field-control"><LogbookEvidenceField files={form.evidenceFiles || []} onChange={evidenceFiles => setForm(current => ({ ...current, evidenceFiles, fileCount: evidenceFiles.length }))} onBusy={setUploading} onError={setError} /></div></div><div className="ris-modal-actions"><Button type="button" tone="gray" onClick={() => setModalOpen(false)}>Batal</Button><Button type="button" tone="blue" disabled={uploading} onClick={save}>Simpan</Button></div></div></Modal>}
  </div>;
}
