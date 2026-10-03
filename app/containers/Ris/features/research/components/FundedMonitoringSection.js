/* eslint-disable object-curly-newline, object-property-newline, react/prop-types, prefer-template */
import React, { useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import { formatDate } from '../../../core/data';
import { fundedMonitoringRow, MONITORING_STATUS } from '../workflows/fundedMonitoringWorkflow';
import { getFundedResearches, SCHEME_DATA_TAB } from '../workflows/schemeDataWorkflow';
import Icon from '../../../shared/components/Icon';
import { Button, EmptyRow, StatusBadge } from '../../../shared/components/Ui';

const labels = {
  [SCHEME_DATA_TAB.CONTRACT]: 'Pengumpulan Kontrak',
  [SCHEME_DATA_TAB.MONEV]: 'Monev',
  [SCHEME_DATA_TAB.FINAL_REPORT]: 'Laporan Akhir',
  [SCHEME_DATA_TAB.OUTPUT_REPORT]: 'Laporan Luaran',
};

export default function FundedMonitoringSection({ tab }) {
  const { data, user } = useRis();
  const history = useHistory();
  const [search, setSearch] = useState('');
  const [schemeId, setSchemeId] = useState('all');
  const [year, setYear] = useState('all');
  const [status, setStatus] = useState('all');
  const [review, setReview] = useState('all');
  const isContract = tab === SCHEME_DATA_TAB.CONTRACT;
  const isMonev = tab === SCHEME_DATA_TAB.MONEV;
  const rows = useMemo(() => getFundedResearches(data, user).map(draft => fundedMonitoringRow(data, draft, tab)), [data, user, tab]);
  const schemes = [...new Map(rows.map(row => [row.scheme.id, row.schemeTitle])).entries()];
  const years = [...new Set(rows.map(row => row.year))].sort().reverse();
  const visible = rows.filter(row => (
    [(row.draft.project && row.draft.project.title) || '', row.ownerName, row.schemeTitle].join(' ').toLowerCase().includes(search.trim().toLowerCase())
    && (schemeId === 'all' || row.scheme.id === schemeId)
    && (year === 'all' || row.year === year)
    && (status === 'all' || row.status === status)
    && (review === 'all' || (review === 'pending' && row.pendingReviews > 0)
      || (review === 'complete' && row.reviewCount > 0 && !row.pendingReviews)
      || (review === 'unassigned' && !row.reviewCount))
  ));
  const complete = rows.filter(row => row.status === 'complete').length;
  const pending = rows.filter(row => ['pending', 'overdue'].includes(row.status)).length;
  const overdue = rows.filter(row => row.status === 'overdue').length;
  const pendingReviews = rows.reduce((sum, row) => sum + row.pendingReviews, 0);
  const hasFilters = search || schemeId !== 'all' || year !== 'all' || status !== 'all' || review !== 'all';
  const reset = () => { setSearch(''); setSchemeId('all'); setYear('all'); setStatus('all'); setReview('all'); };
  const open = row => history.push('/ris/penelitian-didanai/' + row.draft.id + '/pendataan?tab=' + tab);

  return <section aria-label={labels[tab]}>
    <section className="ris-letter-stats ris-funded-stats" aria-label={'Statistik ' + labels[tab]}>
      <div><span>Total Penelitian</span><strong>{rows.length}</strong></div>
      <div><span>{isContract ? 'Sudah Ditandatangani' : 'Kebutuhan Lengkap'}</span><strong>{complete}</strong></div>
      <div><span>{isContract ? 'Menunggu Tanda Tangan' : 'Belum Lengkap'}</span><strong>{pending}</strong></div>
      {!isContract && <div><span>Tenggat Terlewati</span><strong>{overdue}</strong></div>}
      {!isContract && <div><span>Penilaian Tertunda</span><strong>{pendingReviews}</strong></div>}
    </section>
    <section className="ris-list-filters ris-funded-stage-filters" aria-label={'Filter ' + labels[tab]}>
      <div className="ris-search"><Icon name="search" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari judul, skema, atau ketua..." aria-label={'Cari ' + labels[tab]} /></div>
      <select value={schemeId} onChange={event => setSchemeId(event.target.value)} aria-label="Filter skema"><option value="all">Semua skema</option>{schemes.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select>
      <select value={year} onChange={event => setYear(event.target.value)} aria-label="Filter tahun"><option value="all">Semua tahun</option>{years.map(value => <option value={value} key={value}>{value}</option>)}</select>
      <select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filter kelengkapan"><option value="all">Semua status</option>{Object.entries(MONITORING_STATUS).filter(([value]) => !isContract || ['pending', 'complete'].includes(value)).map(([value, meta]) => <option value={value} key={value}>{isContract ? (value === 'complete' ? 'Sudah ditandatangani' : 'Menunggu tanda tangan') : meta.label}</option>)}</select>
      {!isContract && <select value={review} onChange={event => setReview(event.target.value)} aria-label="Filter penilaian"><option value="all">Semua penilaian</option><option value="unassigned">Belum ditugaskan</option><option value="pending">Menunggu penilaian</option><option value="complete">Penilaian selesai</option></select>}
      {hasFilters && <button type="button" className="ris-filter-reset" onClick={reset}>Atur ulang filter</button>}
    </section>
    <div className="ris-section-title ris-funded-stage-heading"><div><h2>{labels[tab]}</h2><span className="ris-section-count">{visible.length}</span></div>{!isContract && <Button tone="gray" onClick={() => history.push('/ris/skema')}>Atur Tenggat Skema</Button>}</div>
    <div className="ris-table-wrap"><table className="ris-table ris-action-table ris-funded-stage-table">
      <thead><tr><th>No.</th><th>Penelitian</th><th>Tahun</th><th>{isContract ? 'Berkas Kontrak' : isMonev ? 'Hasil Monev' : 'Laporan Masuk'}</th><th>{isContract ? 'Tanggal Tanda Tangan' : 'Tenggat Berikutnya'}</th><th>Status</th>{!isContract && <th>Penilaian</th>}<th>Aksi</th></tr></thead>
      <tbody>{visible.map((row, index) => {
        const meta = MONITORING_STATUS[row.status];
        const file = row.contract.lecturerSignedFile || row.contract.signedFile || row.contract.signedContractFile || row.contract.adminSignedFile;
        return <tr key={row.draft.id}>
          <td>{index + 1}.</td>
          <td><div className="ris-proposal-stack"><strong>{(row.draft.project && row.draft.project.title) || 'Penelitian tanpa judul'}</strong><span>{row.ownerName}</span><small>{row.schemeTitle}</small></div></td>
          <td>{row.year}</td>
          <td>{isContract ? ((file && file.name) || 'Belum ada berkas') : isMonev ? <React.Fragment><strong>{row.monevComplete}/{row.monevRequired}</strong><small className="ris-table-secondary">Monev dikirim</small></React.Fragment> : <React.Fragment><strong>{row.reportsComplete}/{row.reportsRequired}</strong><small className="ris-table-secondary">{tab === SCHEME_DATA_TAB.OUTPUT_REPORT ? 'luaran dikirim' : 'laporan dikirim'}</small></React.Fragment>}</td>
          <td>{formatDate(isContract ? row.contract.signedAt : row.deadline)}</td>
          <td><StatusBadge tone={meta.tone}>{isContract ? (row.signed ? 'Sudah Ditandatangani' : 'Menunggu TTD') : meta.label}</StatusBadge></td>
          {!isContract && <td><StatusBadge tone={row.pendingReviews ? 'orange' : row.reviewCount ? 'green' : 'gray'}>{row.pendingReviews ? row.pendingReviews + ' tertunda' : row.reviewCount ? 'Selesai' : 'Belum ditugaskan'}</StatusBadge><small className="ris-table-secondary">{row.reviewCount} penugasan</small></td>}
          <td><button type="button" className="ris-action blue" onClick={() => open(row)}>{isContract ? 'Lihat Kontrak' : isMonev ? 'Lihat Monev' : 'Lihat Laporan'}</button></td>
        </tr>;
      })}{!visible.length && <EmptyRow colSpan={isContract ? 7 : 8}>{rows.length ? 'Tidak ada penelitian yang sesuai filter.' : 'Belum ada penelitian yang didanai.'}</EmptyRow>}</tbody>
    </table></div>
  </section>;
}
