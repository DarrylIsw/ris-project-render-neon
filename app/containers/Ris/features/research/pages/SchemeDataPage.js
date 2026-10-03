/* eslint-disable object-curly-newline, object-property-newline, react/prop-types */
import React from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import ContractCollectionPanel from '../components/ContractCollectionPanel';
import NotificationDot from '../../../shared/components/NotificationDot';
import { getNotificationIndicatorMap } from '../../../shared/workflows/notificationWorkflow';
import MonevPanel from '../components/MonevPanel';
import ResearchReportPanel from '../components/ResearchReportPanel';
import { Button, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import { formatCurrency, formatDate, totalBudget } from '../../../core/data';
import { canManageResearch, getSchemeTitle } from '../../../shared/workflows/workflow';
import { getSchemeDataProgress, getSchemeDataTabs, SCHEME_DATA_TAB } from '../workflows/schemeDataWorkflow';

export default function SchemeDataPage() {
  const { draftId } = useParams();
  const { data, user, markNotificationsRead } = useRis();
  const history = useHistory();
  const location = useLocation();
  const draft = data.drafts.find(item => item.id === draftId);
  const scheme = draft && data.schemes.find(item => item.id === draft.schemeId);
  const requestedTab = new URLSearchParams(location.search).get('tab');
  const tabs = getSchemeDataTabs(user);
  const activeTab = tabs.some(tab => tab.value === requestedTab) ? requestedTab : SCHEME_DATA_TAB.CONTRACT;

  if (!draft || !scheme) return <div className="ris-page"><h1>Penelitian tidak ditemukan</h1></div>;

  const setActiveTab = tab => history.replace(`${location.pathname}?tab=${tab}`);
  const signed = draft.contract && (draft.contract.lecturerSignedFile || draft.contract.signedFile || ['signed', 'completed'].includes(draft.contract.status || draft.contract.contractStatus));
  const managementMode = canManageResearch(user);
  const indicatorPrefix = managementMode ? 'research:funded' : 'submission:funded';
  const indicators = getNotificationIndicatorMap(data, user);
  const progress = getSchemeDataProgress(data, draft, scheme);

  return (
    <div className="ris-page ris-scheme-data-page">
      <PageHeader title={managementMode ? 'Pemantauan Pendataan Skema' : 'Pendataan Skema'} description={(draft.project && draft.project.title) || 'Penelitian didanai'} onBack={() => history.push(`/ris/pengajuan-penelitian-internal/penelitian-didanai${managementMode ? `?tab=${activeTab}` : ''}`)} actions={managementMode ? <Button tone="blue" onClick={() => history.push('/ris/skema')}>Atur Tenggat</Button> : null} />
      {managementMode && <div className="ris-monitoring-banner"><StatusBadge tone="blue">Mode Pemantauan</StatusBadge><span>Kontrak dan laporan milik <strong>{draft.userName || (draft.members && draft.members[0] && draft.members[0].name) || '-'}</strong> dapat dipantau. Pengelola mengirim kontrak bertanda tangan dan menugaskan penilai setelah laporan masuk.</span></div>}
      <section className="ris-scheme-data-summary">
        <div><span>Skema</span><strong>{getSchemeTitle(scheme)}</strong></div>
        {managementMode && <div><span>Ketua Penelitian</span><strong>{draft.userName || (draft.members && draft.members[0] && draft.members[0].name) || '-'}</strong></div>}
        <div><span>Periode Penelitian</span><strong>{formatDate(scheme.startDate)} - {formatDate(scheme.endDate)}</strong></div>
        <div><span>Anggaran Proposal</span><strong>{formatCurrency(totalBudget(draft))}</strong></div>
        <div><span>Status Kontrak</span><strong><StatusBadge tone={signed ? 'green' : 'yellow'}>{signed ? 'Sudah Ditandatangani' : 'Menunggu TTD'}</StatusBadge></strong></div>
      </section>
      <section className="ris-scheme-progress-summary" aria-label="Ringkasan pendataan">
        <div><span>Progres Keseluruhan</span><strong>{progress.percentage}%</strong><small>{progress.completed} dari {progress.required} kebutuhan selesai</small></div>
        <div><span>Monev</span><strong>{progress.monev.completed}/{progress.monev.required}</strong><small>laporan dikirim</small></div>
        <div><span>Laporan Penelitian</span><strong>{progress.reports.completed}/{progress.reports.required}</strong><small>laporan dikirim</small></div>
        <div><span>Laporan Luaran</span><strong>{progress.outputs.completed}/{progress.outputs.required}</strong><small>luaran dikirim</small></div>
      </section>
      <div className={`ris-tabs ris-scheme-data-tabs${managementMode ? ' ris-monitoring-tabs' : ''}`} role="tablist" aria-label="Pendataan penelitian">{tabs.map(tab => {
        const target = `${indicatorPrefix}:${tab.value}`;
        return <button type="button" role="tab" aria-selected={activeTab === tab.value} className={activeTab === tab.value ? 'active' : ''} key={tab.value} onClick={() => { markNotificationsRead(indicators[target] || []); setActiveTab(tab.value); }}>
          {tab.label}<NotificationDot visible={Boolean(indicators[target] && indicators[target].length)} />
        </button>;
      })}</div>
      <div className="ris-scheme-data-content">
        {activeTab === SCHEME_DATA_TAB.CONTRACT && <ContractCollectionPanel draft={draft} managementMode={managementMode} />}
        {activeTab === SCHEME_DATA_TAB.MONEV && <MonevPanel draft={draft} scheme={scheme} managementMode={managementMode} />}
        {activeTab === SCHEME_DATA_TAB.FINAL_REPORT && <ResearchReportPanel draft={draft} scheme={scheme} mode="final" readOnly={managementMode} />}
        {activeTab === SCHEME_DATA_TAB.OUTPUT_REPORT && <ResearchReportPanel draft={draft} scheme={scheme} mode="output" readOnly={managementMode} />}
      </div>
    </div>
  );
}
