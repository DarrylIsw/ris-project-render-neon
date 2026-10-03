/* eslint-disable object-curly-newline, react/prop-types */
import React from 'react';
import { useHistory } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import { Button, EmptyRow, StatusBadge } from '../../../shared/components/Ui';
import Icon from '../../../shared/components/Icon';
import { formatDate } from '../../../core/data';
import { canManageLetters } from '../../../shared/workflows/workflow';
import { LETTER_STATUS, LETTER_STATUS_META, canCreateLetter, canDeleteLetter, canEditLetter, getLettersOwnedByUser, getLetterResearchTitle, getLetterTitle, letterStatusMeta } from '../workflows/letterWorkflow';
import { letterPdfUrl } from '../../../core/dataGateway';

const downloadFinal = letter => {
  window.location.assign(letterPdfUrl(letter));
};

export default function LetterDashboardPage() {
  const { data, setData, user } = useRis();
  const history = useHistory();
  const management = canManageLetters(user);
  const letters = management ? (data.letterRequests || []) : getLettersOwnedByUser(data, user);
  const [status, setStatus] = React.useState('all');
  const [kind, setKind] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const kinds = [...new Set(letters.map(getLetterTitle))].sort((a, b) => a.localeCompare(b));
  const visible = letters.filter(letter => (status === 'all' || letter.status === status)
    && (kind === 'all' || getLetterTitle(letter) === kind)
    && [getLetterTitle(letter), getLetterResearchTitle(letter, data), (letter.applicant || {}).name].some(value => String(value).toLowerCase().includes(search.trim().toLowerCase())))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const count = statuses => letters.filter(item => statuses.includes(item.status)).length;
  const remove = letter => {
    if (!canDeleteLetter(letter, user) || !window.confirm('Hapus draft surat ini? Isian draft akan dihapus.')) return;
    setData(current => ({ ...current, letterRequests: current.letterRequests.filter(item => item.id !== letter.id || !canDeleteLetter(item, user)) }));
  };

  return <div className="ris-page ris-workspace-page ris-letter-page">
    <div className="ris-page-heading"><div><h1>Pengajuan Surat</h1></div><div className="ris-heading-actions">{management && <><Button tone="blue" onClick={() => history.push('/ris/pengajuan-surat/jenis')}><Icon name="document" size={16} />Kelola Template</Button><Button onClick={() => history.push('/ris/pengajuan-surat/jenis?buat=1')}><Icon name="plus" size={16} />Buat Surat</Button></>}{canCreateLetter(user) && <Button onClick={() => history.push('/ris/pengajuan-surat/new')}><Icon name="plus" size={16} />Buat Pengajuan</Button>}</div></div>
    <section className="ris-letter-stats">
      <div><span>Total Pengajuan</span><strong>{letters.length}</strong></div>
      <div><span>Draft</span><strong>{count([LETTER_STATUS.DRAFT, LETTER_STATUS.DRAFT_REVISION])}</strong></div>
      <div><span>Menunggu Verifikasi</span><strong>{count([LETTER_STATUS.SUBMITTED, LETTER_STATUS.DATA_SUBMITTED, LETTER_STATUS.PRECHECKED])}</strong></div>
      <div><span>Perlu Dilengkapi</span><strong>{count([LETTER_STATUS.REVISION_REQUIRED, LETTER_STATUS.DATA_REQUIRED])}</strong></div>
      <div><span>Menunggu Penerbitan</span><strong>{count([LETTER_STATUS.APPROVED])}</strong></div>
      <div><span>Selesai</span><strong>{count([LETTER_STATUS.GENERATED])}</strong></div>
    </section>
    <section className="ris-section-spaced">
      <div className="ris-section-title"><h2>{management ? 'Daftar Pengajuan Surat' : 'Riwayat Pengajuan Surat'}</h2></div>
      <div className="ris-letter-filterbar">
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari surat, pemohon, atau penelitian" aria-label="Cari pengajuan surat" />
        <select aria-label="Filter jenis surat" value={kind} onChange={event => setKind(event.target.value)}><option value="all">Semua Jenis Surat</option>{kinds.map(name => <option key={name}>{name}</option>)}</select>
        <select aria-label="Filter status surat" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Semua Status</option>{Object.entries(LETTER_STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select>
      </div>
      <div className="ris-table-wrap"><table className="ris-table ris-action-table"><thead><tr><th>No.</th><th>Jenis Surat</th>{management && <th>Pemohon</th>}<th>Keterkaitan Penelitian</th><th>Diperbarui</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
        {visible.map((letter, index) => {
          const meta = letterStatusMeta(letter);
          const editable = canEditLetter(letter, user);
          const path = `/ris/pengajuan-surat/${letter.id}/${management ? 'admin' : (editable ? 'edit' : 'detail')}`;
          return <tr key={letter.id}><td>{index + 1}.</td><td className="ris-proposal-cell"><strong>{getLetterTitle(letter)}</strong><small>{letter.generated ? letter.generated.letterNumber : letter.id}</small></td>{management && <td>{(letter.applicant || {}).name || '-'}</td>}<td>{getLetterResearchTitle(letter, data)}</td><td>{formatDate(letter.updatedAt || letter.createdAt)}</td><td><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td><td><div className="ris-row-actions"><button type="button" className="ris-action blue" onClick={() => history.push(path)}>{management && letter.status === LETTER_STATUS.APPROVED ? 'Terbitkan' : (management && [LETTER_STATUS.SUBMITTED, LETTER_STATUS.DATA_SUBMITTED, LETTER_STATUS.PRECHECKED].includes(letter.status) ? 'Verifikasi' : (editable ? 'Lanjutkan' : 'Lihat'))}</button>{canDeleteLetter(letter, user) && <button type="button" className="ris-action red" onClick={() => remove(letter)}>Hapus Draft</button>}{letter.status === LETTER_STATUS.GENERATED && <button type="button" className="ris-action green" onClick={() => downloadFinal(letter)}>Unduh Surat</button>}</div></td></tr>;
        })}
        {!visible.length && <EmptyRow colSpan={management ? 7 : 6}>Tidak ada pengajuan yang sesuai filter.</EmptyRow>}
      </tbody></table></div>
    </section>
  </div>;
}
