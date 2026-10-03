/* eslint-disable object-curly-newline, react/prop-types */
import React from 'react';
import { Prompt, useHistory, useLocation } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import { Button, EmptyRow, FloatingError, Modal, PageBack, StatusBadge } from '../../../shared/components/Ui';
import Icon from '../../../shared/components/Icon';
import LetterDefinitionEditor from '../components/LetterDefinitionEditor';
import { formatDate, uid } from '../../../core/data';
import { LETTER_TYPES } from '../workflows/letterWorkflow';
import {
  createLetterDefinitionFromMaster, createLetterMasterTemplate, deleteLetterDefinition,
  getEditableLetterDefinition, letterDefinitionStatus, saveLetterDefinition, saveLetterMasterTemplate,
} from '../workflows/letterCatalogWorkflow';

const STATUS_META = { draft: { label: 'Draft', tone: 'gray' }, published: { label: 'Diterbitkan', tone: 'green' }, inactive: { label: 'Nonaktif', tone: 'orange' } };

export default function LetterCatalogPage() {
  const { data, setData, user } = useRis();
  const history = useHistory();
  const location = useLocation();
  const [editing, setEditing] = React.useState(null);
  const [baseline, setBaseline] = React.useState('');
  const [master, setMaster] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [category, setCategory] = React.useState('all');
  const dirty = Boolean(editing && JSON.stringify(editing) !== baseline);
  const definitions = (data.letterDefinitions || []).filter(item => !item.deletedAt);
  const visible = definitions.filter(item => (status === 'all' || (status === 'pending' ? Boolean(item.pendingDraft) : letterDefinitionStatus(item) === status))
    && (category === 'all' || item.type === category)
    && `${item.name} ${item.description || ''} ${(item.pendingDraft || {}).name || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const start = (definition, isMaster = false) => {
    const value = getEditableLetterDefinition(definition);
    setEditing(value);
    setBaseline(JSON.stringify(value));
    setMaster(isMaster);
    setError('');
    setSuccess('');
  };
  React.useEffect(() => {
    if (new URLSearchParams(location.search).get('buat') === '1') {
      start(createLetterDefinitionFromMaster(data, uid));
      history.replace('/ris/pengajuan-surat/jenis');
    }
  }, [location.search]);
  React.useEffect(() => {
    if (!dirty) return undefined;
    const warn = event => {
      event.preventDefault();
      // eslint-disable-next-line no-param-reassign
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const close = () => {
    if (saving) return;
    if (dirty && !window.confirm('Perubahan belum disimpan. Batalkan perubahan?')) return;
    setEditing(null);
    setError('');
  };
  const save = async mode => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await setData(current => (master
        ? saveLetterMasterTemplate(current, editing, user)
        : saveLetterDefinition(current, { ...editing, template: { ...editing.template, name: editing.name } }, user, mode)));
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setEditing(null);
      setSuccess(master ? 'Master template disimpan. Surat baru akan menggunakan isian ini.' : ({ draft: 'Draft template disimpan. Perubahan belum dipublikasikan kepada dosen.', publish: 'Template diterbitkan dan tersedia untuk pengajuan baru dosen.', inactive: 'Template dinonaktifkan. Pengajuan yang sudah ada tetap tersimpan.' })[mode]);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const remove = () => {
    try {
      setData(current => deleteLetterDefinition(current, deleting.id, user));
      setDeleting(null);
      setEditing(null);
      setError('');
      setSuccess('Template dihapus dari daftar jenis surat. Pengajuan yang sudah ada tetap tersimpan.');
    } catch (err) { setDeleting(null); setError(err.message); }
  };

  return <div className="ris-page ris-workspace-page ris-letter-page ris-letter-catalog-page">
    <Prompt when={dirty || saving} message="Perubahan template belum disimpan. Tinggalkan halaman?" />
    <PageBack onClick={() => (editing ? close() : history.push('/ris/pengajuan-surat'))} />
    <div className="ris-page-heading"><div><h1>{editing ? (master ? 'Master Template Surat' : 'Form Builder Surat') : 'Template Surat'}</h1></div>{!editing && <div className="ris-heading-actions"><Button tone="gray" onClick={() => start(data.letterMasterTemplate || createLetterMasterTemplate(), true)}>Master Template</Button><Button onClick={() => start(createLetterDefinitionFromMaster(data, uid))}><Icon name="plus" size={16} />Buat Surat</Button></div>}</div>
    <FloatingError message={error} />
    {success && <div role="status" className="ris-alert ris-alert-success">{success}</div>}
    {!editing && <>
      <section className="ris-letter-stats ris-letter-catalog-stats"><div><span>Total Template</span><strong>{definitions.length}</strong></div><div><span>Diterbitkan</span><strong>{definitions.filter(item => item.active).length}</strong></div><div><span>Draft</span><strong>{definitions.filter(item => letterDefinitionStatus(item) === 'draft').length}</strong></div><div><span>Perubahan Draft</span><strong>{definitions.filter(item => item.pendingDraft).length}</strong></div><div><span>Nonaktif</span><strong>{definitions.filter(item => letterDefinitionStatus(item) === 'inactive').length}</strong></div></section>
      <div className="ris-letter-filterbar"><input aria-label="Cari template surat" placeholder="Cari nama atau deskripsi surat" value={search} onChange={event => setSearch(event.target.value)} /><select aria-label="Filter status template" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Semua Status</option>{Object.entries(STATUS_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}<option value="pending">Memiliki Perubahan Draft</option></select><select aria-label="Filter kategori template" value={category} onChange={event => setCategory(event.target.value)}><option value="all">Semua Kategori</option>{LETTER_TYPES.map(item => <option key={item.value} value={item.value}>{item.value === 'custom' ? 'Surat Kustom / Lainnya' : item.label}</option>)}</select></div>
      <div className="ris-table-wrap"><table className="ris-table ris-action-table"><thead><tr><th>No.</th><th>Jenis Surat</th><th>Isian</th><th>Pengajuan</th><th>Diperbarui</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{visible.map((item, index) => {
        const meta = STATUS_META[letterDefinitionStatus(item)];
        const count = (data.letterRequests || []).filter(letter => letter.definitionId === item.id).length;
        return <tr key={item.id}><td>{index + 1}.</td><td className="ris-proposal-cell"><strong>{item.name || 'Surat tanpa nama'}</strong><small>{item.description || 'Surat kustom'}</small><small>Versi {item.version}</small></td><td>{item.fields.length}</td><td>{count}</td><td>{item.updatedAt ? formatDate(item.updatedAt) : '-'}</td><td><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>{item.pendingDraft && <small className="ris-table-subline">Ada perubahan draft</small>}</td><td><div className="ris-row-actions"><button type="button" className="ris-action blue" onClick={() => start(item)}>{letterDefinitionStatus(item) === 'draft' || item.pendingDraft ? 'Lanjutkan Draft' : 'Edit'}</button><button type="button" className="ris-action red" onClick={() => setDeleting(item)}>Hapus</button></div></td></tr>;
      })}{!visible.length && <EmptyRow colSpan={7}>Tidak ada template yang sesuai filter.</EmptyRow>}</tbody></table></div>
    </>}
    {editing && <>
      <fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}><LetterDefinitionEditor key={`${master ? 'master' : 'letter'}-${editing.id}`} value={editing} onChange={setEditing} master={master} /></fieldset>
      <div className="ris-bottom-bar"><div>{saving ? 'Menyimpan template...' : dirty ? 'Perubahan belum disimpan' : (master ? `Master template versi ${editing.version}` : editing.name || 'Surat baru')}</div><div><Button tone="gray" disabled={saving} onClick={close}>Batal</Button>{master ? <Button disabled={saving} onClick={() => save('publish')}>Simpan Master Template</Button> : <><Button tone="blue" disabled={saving} onClick={() => save('draft')}>Simpan Draft</Button>{editing.active && <Button tone="gray" disabled={saving} onClick={() => save('inactive')}>Simpan Nonaktif</Button>}<Button disabled={saving} onClick={() => save('publish')}>Simpan dan Terbitkan</Button></>}</div></div>
    </>}
    {deleting && <Modal title="Hapus Template Surat" width={520} onClose={() => setDeleting(null)}><p>Hapus <strong>{deleting.name || 'surat tanpa nama'}</strong> dari jenis surat yang tersedia untuk dosen? Pengajuan dan surat yang sudah terbit tidak ikut dihapus.</p><div className="ris-align-right"><Button tone="gray" onClick={() => setDeleting(null)}>Batal</Button><Button tone="red" onClick={remove}>Hapus Template</Button></div></Modal>}
  </div>;
}
