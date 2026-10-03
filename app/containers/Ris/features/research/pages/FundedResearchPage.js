/* eslint-disable object-curly-newline, object-property-newline, react/prop-types */
import React, { useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import Icon from '../../../shared/components/Icon';
import NotificationDot from '../../../shared/components/NotificationDot';
import { getNotificationIndicatorMap } from '../../../shared/workflows/notificationWorkflow';
import FundedMonitoringSection from '../components/FundedMonitoringSection';
import { EmptyRow, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import { formatDate } from '../../../core/data';
import { canManageResearch, getSchemeDescription, getSchemeTitle } from '../../../shared/workflows/workflow';
import { FUNDED_MONITORING_TABS, getFundedResearches, getSchemeDataProgress, SCHEME_DATA_TAB } from '../workflows/schemeDataWorkflow';

const reviewProgress = (data, draftId) => {
  const targetIds = [
    ...(data.monevRecords || []).filter(item => item.researchId === draftId && item.status === 'submitted').map(item => item.id),
    ...(data.internalReports || []).filter(item => item.researchId === draftId && ['submitted', 'under_review', 'accepted'].includes(item.status)).map(item => item.id),
  ];
  const assignments = (data.fundedReviewAssignments || []).filter(item => targetIds.includes(item.targetId) && item.status !== 'revoked');
  const completed = assignments.filter(item => item.status === 'submitted').length;
  return { targets: targetIds.length, assignments: assignments.length, completed, pending: assignments.length - completed };
};

export default function FundedResearchPage() {
  const { data, user, markNotificationsRead } = useRis();
  const history = useHistory();
  const location = useLocation();
  const managementMode = canManageResearch(user);
  const indicators = useMemo(() => getNotificationIndicatorMap(data, user), [data, user]);
  const requested = new URLSearchParams(location.search).get('tab');
  const activeTab = FUNDED_MONITORING_TABS.some(tab => tab.value === requested) ? requested : 'overview';
  if (!managementMode) return <FundedResearchOverview />;
  return <div className="ris-page ris-workspace-page ris-funded-research-page">
    <PageHeader title="Pemantauan Penelitian Didanai" description="Pantau pengumpulan kontrak, evaluasi berkala, laporan akhir, dan realisasi luaran penelitian." />
    <div className="ris-tabs ris-scheme-data-tabs" role="tablist" aria-label="Pemantauan penelitian didanai">
      {FUNDED_MONITORING_TABS.map(tab => {
        const target = `research:funded:${tab.value}`;
        return <button type="button" key={tab.value} id={'funded-tab-'.concat(tab.value)} role="tab" aria-selected={activeTab === tab.value} aria-controls="funded-monitoring-content" className={activeTab === tab.value ? 'active' : ''} onClick={() => { markNotificationsRead(indicators[target] || []); history.push(location.pathname.concat('?tab=', tab.value)); }}>
          {tab.label}<NotificationDot visible={Boolean(indicators[target] && indicators[target].length)} />
        </button>;
      })}
    </div>
    <div id="funded-monitoring-content" role="tabpanel" aria-labelledby={'funded-tab-'.concat(activeTab)}>
      {activeTab === 'overview' ? <FundedResearchOverview embedded /> : <FundedMonitoringSection key={activeTab} tab={activeTab} />}
    </div>
  </div>;
}

function FundedResearchOverview({ embedded = false }) {
  const { data, user } = useRis();
  const history = useHistory();
  const managementMode = canManageResearch(user);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [schemeFilter, setSchemeFilter] = useState('all');
  const [contractFilter, setContractFilter] = useState('all');
  const [progressFilter, setProgressFilter] = useState('all');
  const funded = useMemo(() => getFundedResearches(data, user), [data, user]);
  const researchRows = useMemo(() => funded.map(draft => {
    const scheme = data.schemes.find(item => item.id === draft.schemeId) || {};
    const owner = (data.systemUsers || []).find(item => item.id === draft.userId);
    return {
      draft, scheme,
      ownerName: (owner && owner.name) || draft.userName || '-',
      progress: getSchemeDataProgress(data, draft, scheme),
      review: reviewProgress(data, draft.id),
    };
  }), [data, funded]);
  const owners = useMemo(() => [...new Map(researchRows.map(row => [row.draft.userId, row.ownerName])).entries()].sort((left, right) => left[1].localeCompare(right[1])), [researchRows]);
  const schemes = useMemo(() => [...new Map(researchRows.map(row => [row.scheme.id, getSchemeTitle(row.scheme)])).entries()].sort((left, right) => left[1].localeCompare(right[1])), [researchRows]);
  const visible = useMemo(() => researchRows.filter(row => {
    const normalized = search.trim().toLowerCase();
    const matchesSearch = `${row.draft.project && row.draft.project.title} ${getSchemeTitle(row.scheme)} ${getSchemeDescription(row.scheme)} ${row.ownerName}`.toLowerCase().includes(normalized);
    return matchesSearch
      && (ownerFilter === 'all' || row.draft.userId === ownerFilter)
      && (schemeFilter === 'all' || row.scheme.id === schemeFilter)
      && (contractFilter === 'all' || (contractFilter === 'signed' ? row.progress.contractComplete : !row.progress.contractComplete))
      && (progressFilter === 'all' || row.progress.status === progressFilter);
  }), [contractFilter, ownerFilter, progressFilter, researchRows, schemeFilter, search]);
  const filtersActive = search || ownerFilter !== 'all' || schemeFilter !== 'all' || contractFilter !== 'all' || progressFilter !== 'all';
  const signedCount = researchRows.filter(row => row.progress.contractComplete).length;
  const activeCount = researchRows.filter(row => row.progress.status === 'in_progress').length;
  const completeCount = researchRows.filter(row => row.progress.status === 'complete').length;
  const pendingReviewCount = researchRows.reduce((sum, row) => sum + row.review.pending, 0);

  const resetFilters = () => { setSearch(''); setOwnerFilter('all'); setSchemeFilter('all'); setContractFilter('all'); setProgressFilter('all'); };
  const openData = row => history.push(`/ris/penelitian-didanai/${row.draft.id}/pendataan?tab=${SCHEME_DATA_TAB.CONTRACT}`);

  return (
    <div className={embedded ? 'ris-funded-overview' : 'ris-page ris-workspace-page ris-funded-research-page'}>
      {!embedded && <PageHeader title={managementMode ? 'Pemantauan Penelitian Didanai' : 'Penelitian Didanai'} description={managementMode ? 'Pantau kontrak, hasil Monev, laporan, penugasan penilai, dan luaran seluruh penelitian yang didanai.' : 'Kelola kontrak dan laporan serta lihat hasil Monev dan penilaian untuk penelitian Anda.'} />}
      {funded.length > 0 && <section className="ris-letter-stats ris-funded-stats"><div><span>Total Penelitian</span><strong>{funded.length}</strong></div><div><span>Kontrak Ditandatangani</span><strong>{signedCount}</strong></div><div><span>Sedang Berjalan</span><strong>{activeCount}</strong></div><div><span>Review Tertunda</span><strong>{pendingReviewCount}</strong></div><div><span>Pendataan Lengkap</span><strong>{completeCount}</strong></div></section>}
      {funded.length > 0 && <section className={`ris-list-filters ${managementMode ? 'ris-funded-management-filter' : 'ris-funded-filter'}`} aria-label="Filter penelitian didanai"><div className="ris-search"><Icon name="search" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={managementMode ? 'Cari judul, skema, atau ketua...' : 'Cari judul penelitian atau skema...'} aria-label="Cari penelitian didanai" /></div>{managementMode && <select value={ownerFilter} onChange={event => setOwnerFilter(event.target.value)} aria-label="Filter ketua penelitian"><option value="all">Semua ketua</option>{owners.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select>}{managementMode && <select value={schemeFilter} onChange={event => setSchemeFilter(event.target.value)} aria-label="Filter skema"><option value="all">Semua skema</option>{schemes.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select>}<select value={contractFilter} onChange={event => setContractFilter(event.target.value)} aria-label="Filter status kontrak"><option value="all">Semua kontrak</option><option value="signed">Sudah ditandatangani</option><option value="pending">Menunggu kontrak</option></select><select value={progressFilter} onChange={event => setProgressFilter(event.target.value)} aria-label="Filter progres pendataan"><option value="all">Semua progres</option><option value="not_started">Belum dimulai</option><option value="in_progress">Sedang berjalan</option><option value="complete">Pendataan lengkap</option></select>{filtersActive && <button type="button" className="ris-filter-reset" onClick={resetFilters}>Atur ulang filter</button>}</section>}
      <div className="ris-table-wrap"><table className="ris-table ris-action-table ris-funded-monitoring-table"><thead><tr><th>No.</th><th>Penelitian</th><th>Periode</th><th>Kontrak</th><th>Monev</th><th>Laporan Akhir</th><th>Luaran</th><th>Penilai</th><th>Aksi</th></tr></thead><tbody>{visible.map((row, index) => <tr key={row.draft.id}><td>{index + 1}.</td><td><div className="ris-proposal-stack"><strong>{(row.draft.project && row.draft.project.title) || 'Penelitian tanpa judul'}</strong><span>{row.ownerName}</span><small>{getSchemeTitle(row.scheme)}</small></div></td><td>{formatDate(row.scheme.startDate)}<small className="ris-table-secondary">s.d. {formatDate(row.scheme.endDate)}</small></td><td><StatusBadge tone={row.progress.contractComplete ? 'green' : 'yellow'}>{row.progress.contractComplete ? 'Selesai' : 'Menunggu TTD'}</StatusBadge></td><td><strong>{row.progress.monev.completed}/{row.progress.monev.required}</strong><small className="ris-table-secondary">Monev dikirim</small></td><td><strong>{row.progress.reports.completed}/{row.progress.reports.required}</strong><small className="ris-table-secondary">laporan masuk</small></td><td><strong>{row.progress.outputs.completed}/{row.progress.outputs.required}</strong><small className="ris-table-secondary">luaran masuk</small></td><td><StatusBadge tone={row.review.pending ? 'orange' : row.review.completed ? 'green' : 'gray'}>{row.review.pending ? `${row.review.pending} tertunda` : row.review.completed ? `${row.review.completed} selesai` : 'Belum ditugaskan'}</StatusBadge><small className="ris-table-secondary">{row.review.assignments} penugasan</small></td><td><button type="button" className="ris-action blue" onClick={() => openData(row)}>{managementMode ? 'Pantau Detail' : 'Buka Pendataan'}</button></td></tr>)}{visible.length === 0 && <EmptyRow colSpan={9}>{funded.length ? 'Tidak ada penelitian yang sesuai filter.' : 'Belum ada penelitian yang disetujui dan didanai.'}</EmptyRow>}</tbody></table></div>
    </div>
  );
}
