/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, react/prop-types */
import React, { useMemo, useState } from 'react';
import { Redirect, useHistory } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import Icon from '../../../shared/components/Icon';
import { Button, Modal, StatusBadge } from '../../../shared/components/Ui';
import { STATUS_META, formatCurrency, formatDate } from '../../../core/data';
import {
  STATUS,
  canEditDraft,
  canManageResearch,
  draftStatus,
  getSchemeDescription,
  getSchemeMaximumBudget,
  getSchemeTitle,
  isEligibleForScheme,
  isOpenScheme,
} from '../../../shared/workflows/workflow';
import {
  canDeleteProposalDraft,
  deleteProposalDraftData,
  getSchemeCatalogMetrics,
  partitionSchemeCatalog,
} from '../workflows/schemeCatalogWorkflow';
import {
  normalizeSchemeAttachmentRequirements,
  normalizeSchemeOutputOptions,
  outputDefinitionLabel,
} from '../workflows/schemeConfiguration';
import { REPORT_TYPE_LABEL, sortReportingSchedule } from '../workflows/reportingWorkflow';

const MetricCard = ({ label, value }) => <div><span>{label}</span><strong>{value}</strong></div>;

const SECTION_META = {
  drafts: {
    title: 'Draft Tersimpan',
    description: 'Lanjutkan proposal yang belum dikirim.',
  },
  applications: {
    title: 'Pengajuan Saya',
    description: 'Pantau proposal yang sudah dikirim dan keputusan pendanaannya.',
  },
  eligible: {
    title: 'Skema Eligible',
    description: 'Skema aktif yang dapat Anda daftarkan.',
  },
  catalog: {
    title: 'Katalog Skema Lainnya',
    description: 'Skema yang tidak sesuai eligibility atau sedang tidak menerima pendaftaran.',
  },
};

const draftMeta = draft => STATUS_META[draftStatus(draft)] || { label: 'Pengajuan', tone: 'gray' };

const SchemeState = ({ scheme, draft, user }) => {
  if (draft) {
    const meta = draftMeta(draft);
    return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
  }
  if (!isOpenScheme(scheme)) return <StatusBadge tone="gray">Pendaftaran Ditutup</StatusBadge>;
  if (!isEligibleForScheme(scheme, user)) return <StatusBadge tone="yellow">Tidak Eligible</StatusBadge>;
  return <StatusBadge tone="green">Pendaftaran Dibuka</StatusBadge>;
};

export default function SchemesPage() {
  const { data, setData, user } = useRis();
  const history = useHistory();
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [year, setYear] = useState('all');
  const [detailItem, setDetailItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const metrics = useMemo(() => getSchemeCatalogMetrics(data, user), [data, user]);
  const schemeYears = useMemo(() => [...new Set((data.schemes || []).filter(scheme => !scheme.deletedAt).map(scheme => scheme.year || String(scheme.startDate || '').slice(0, 4)).filter(Boolean))].sort((left, right) => Number(right) - Number(left)), [data.schemes]);
  const filteredSchemes = useMemo(() => (data.schemes || []).filter(scheme => {
    if (scheme.deletedAt) return false;
    const text = `${getSchemeTitle(scheme)} ${getSchemeDescription(scheme)}`.toLowerCase();
    const matchesSearch = text.includes(search.trim().toLowerCase());
    const matchesYear = year === 'all' || String(scheme.year || String(scheme.startDate || '').slice(0, 4)) === year;
    return matchesSearch && matchesYear;
  }), [data.schemes, search, year]);
  const sections = useMemo(() => partitionSchemeCatalog(filteredSchemes, data, user), [data, filteredSchemes, user]);
  const visibleSectionKeys = sectionFilter === 'all' ? Object.keys(SECTION_META) : [sectionFilter];
  const visibleCount = visibleSectionKeys.reduce((total, key) => total + sections[key].length, 0);

  if (canManageResearch(user)) return <Redirect to="/ris/skema/pengajuan" />;

  const openWizard = item => history.push(`/ris/pengajuan-penelitian-internal/scheme/${item.scheme.id}`);
  const openPreview = item => history.push(`/ris/pengajuan-penelitian-internal/${item.draft.id}/preview`);
  const primaryAction = item => {
    if (item.draft && canEditDraft(item.draft, user)) {
      return {
        label: draftStatus(item.draft) === STATUS.REVISION ? 'Edit' : 'Lanjutkan',
        tone: 'blue',
        onClick: () => openWizard(item),
      };
    }
    if (item.draft) return { label: 'Lihat Pengajuan', tone: 'blue', onClick: () => openPreview(item) };
    if (isOpenScheme(item.scheme) && isEligibleForScheme(item.scheme, user)) return { label: 'Daftar', tone: 'green', onClick: () => openWizard(item) };
    return null;
  };
  const requestDelete = item => {
    setDetailItem(null);
    setDeleteItem(item);
  };
  const deleteDraft = () => {
    if (!deleteItem || !canDeleteProposalDraft(deleteItem.draft, user)) return;
    setData(current => deleteProposalDraftData(current, deleteItem.draft));
    setDeleteItem(null);
  };

  const renderActions = (item, context) => {
    const primary = primaryAction(item);
    const deletable = canDeleteProposalDraft(item.draft, user);
    return (
      <div className={`ris-scheme-card-actions ris-scheme-card-actions-${context}`}>
        {context === 'card'
          ? <Button tone="gray" className="ris-scheme-detail-button" onClick={() => setDetailItem(item)}><Icon name="document" size={16} />Detail</Button>
          : <Button tone="gray" onClick={() => setDetailItem(null)}><Icon name="back" size={16} />Kembali</Button>}
        <div>
          {deletable && <Button tone="red" onClick={() => requestDelete(item)}>Hapus Draft</Button>}
          {primary && <Button tone={primary.tone} onClick={primary.onClick}>{primary.label}</Button>}
        </div>
      </div>
    );
  };

  const renderCard = item => (
    <article className="ris-scheme-catalog-card" key={item.scheme.id}>
      <div className="ris-scheme-card-content">
        <SchemeState scheme={item.scheme} draft={item.draft} user={user} />
        <h3>{getSchemeTitle(item.scheme)}</h3>
        <p>{getSchemeDescription(item.scheme) || 'Deskripsi skema belum tersedia.'}</p>
        <dl><div><dt>Tanggal mulai</dt><dd>{formatDate(item.scheme.startDate)}</dd></div></dl>
      </div>
      {renderActions(item, 'card')}
    </article>
  );

  return (
    <div className="ris-page ris-scheme-catalog-page">
      <div className="ris-page-heading">
        <div>
          <h1>Daftar Skema Penelitian Internal</h1>
          <p>Temukan skema yang sesuai, lanjutkan draft, dan pantau pengajuan penelitian Anda.</p>
        </div>
      </div>

      <section className="ris-letter-stats ris-research-stats" aria-label="Ringkasan skema">
        <MetricCard label="Skema Dibuka" value={metrics.opened} />
        <MetricCard label="Sesuai Eligibility" value={metrics.eligible} />
        <MetricCard label="Pengajuan Saya" value={metrics.applications} />
        <MetricCard label="Siap Didaftar" value={metrics.ready} />
        <MetricCard label="Sudah Didanai" value={metrics.funded} />
      </section>

      <section className="ris-list-filters" aria-label="Filter skema">
        <div className="ris-search"><Icon name="search" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari judul atau deskripsi skema..." aria-label="Cari skema" /></div>
        <select value={sectionFilter} onChange={event => setSectionFilter(event.target.value)} aria-label="Bagian katalog"><option value="all">Semua bagian</option><option value="drafts">Draft tersimpan</option><option value="applications">Pengajuan saya</option><option value="eligible">Skema eligible</option><option value="catalog">Katalog lainnya</option></select>
        <select value={year} onChange={event => setYear(event.target.value)} aria-label="Tahun skema"><option value="all">Semua tahun</option>{schemeYears.map(item => <option key={item} value={item}>{item}</option>)}</select>
        {(search || sectionFilter !== 'all' || year !== 'all') && <button type="button" className="ris-filter-reset" onClick={() => { setSearch(''); setSectionFilter('all'); setYear('all'); }}>Reset filter</button>}
      </section>

      <div className="ris-scheme-catalog">
        {visibleSectionKeys.map(key => sections[key].length > 0 && (
          <section className={`ris-scheme-catalog-section ris-scheme-section-${key}`} key={key}>
            <div className="ris-scheme-section-heading"><div><h2>{SECTION_META[key].title}</h2><p>{SECTION_META[key].description}</p></div><span>{sections[key].length}</span></div>
            <div className="ris-scheme-card-grid">{sections[key].map(renderCard)}</div>
          </section>
        ))}
        {visibleCount === 0 && <div className="ris-empty-state">Tidak ada skema yang sesuai dengan filter.</div>}
      </div>

      {detailItem && (
        <Modal title={getSchemeTitle(detailItem.scheme)} onClose={() => setDetailItem(null)} width={860} className="ris-scheme-detail-modal" closeOnBackdrop={false}>
          <div className="ris-modal-body">
            <div className="ris-scheme-detail-summary">
              <SchemeState scheme={detailItem.scheme} draft={detailItem.draft} user={user} />
              <p>{getSchemeDescription(detailItem.scheme) || 'Deskripsi skema belum tersedia.'}</p>
            </div>
            <dl className="ris-scheme-detail-grid">
              <div><dt>Periode penelitian</dt><dd>{formatDate(detailItem.scheme.startDate)} - {formatDate(detailItem.scheme.endDate)}</dd></div>
              <div><dt>Periode pendaftaran</dt><dd>{formatDate(detailItem.scheme.registrationStartDate)} - {formatDate(detailItem.scheme.registrationEndDate)}</dd></div>
              <div><dt>Maksimum anggaran</dt><dd>{getSchemeMaximumBudget(detailItem.scheme) > 0 ? formatCurrency(getSchemeMaximumBudget(detailItem.scheme)) : '-'}</dd></div>
              <div><dt>Eligibility akun</dt><dd>{isEligibleForScheme(detailItem.scheme, user) ? 'Memenuhi kriteria' : 'Tidak memenuhi kriteria'}</dd></div>
            </dl>
            <section className="ris-scheme-detail-section"><h4>Luaran Wajib yang Tersedia</h4><ul>{normalizeSchemeOutputOptions(detailItem.scheme).map(output => <li key={output.id}>{outputDefinitionLabel(output)}</li>)}</ul></section>
            <section className="ris-scheme-detail-section"><h4>Jadwal Pelaporan</h4><div className="ris-scheme-detail-list">{sortReportingSchedule(detailItem.scheme.reportingSchedule).map(period => <div key={period.id}><strong>{period.label || REPORT_TYPE_LABEL[period.type]}</strong><span>{formatDate(period.openAt)} - {formatDate(period.dueAt)}</span></div>)}</div></section>
            <section className="ris-scheme-detail-section"><h4>Lampiran yang Diminta</h4><ul>{normalizeSchemeAttachmentRequirements(detailItem.scheme).map(attachment => <li key={attachment.id}>{attachment.name}</li>)}</ul></section>
            {renderActions(detailItem, 'modal')}
          </div>
        </Modal>
      )}

      {deleteItem && (
        <Modal title="Hapus Draft Proposal" onClose={() => setDeleteItem(null)} width={500}>
          <div className="ris-modal-body">
            <p>Draft untuk <strong>{getSchemeTitle(deleteItem.scheme)}</strong> beserta data formulirnya akan dihapus. Tindakan ini tidak dapat dibatalkan.</p>
            <div className="ris-modal-actions"><Button tone="gray" onClick={() => setDeleteItem(null)}>Batal</Button><Button tone="red" onClick={deleteDraft}>Hapus Draft</Button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
