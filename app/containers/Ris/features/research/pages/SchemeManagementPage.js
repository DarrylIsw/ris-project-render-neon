/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, react/prop-types */
import React, { useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import Icon from '../../../shared/components/Icon';
import ResearchMonitoringWorkspace from '../components/ResearchMonitoringWorkspace';
import { Button, EmptyRow, Field, FloatingError, Modal, PageHeader, StatusBadge } from '../../../shared/components/Ui';
import { formatCurrency, formatDate, STATUS_META, uid } from '../../../core/data';
import {
  STATUS,
  canAssignReviewer,
  canDecideDraft,
  canEditDraft,
  canManageResearch,
  canVerifyDraft,
  draftSchemeId,
  draftStatus,
  getSchemeTitle,
  isManager,
} from '../../../shared/workflows/workflow';
import { deleteResearchSchemeData, getSchemeDeletionError } from '../workflows/schemeCatalogWorkflow';
import {
  getRegistrationState,
  getWindowState,
  REPORT_TYPE,
  REPORT_TYPE_LABEL,
  REPORT_TYPE_OPTIONS,
  sortReportingSchedule,
  toDateTimeInput,
  validateReportingSchedule,
  WINDOW_STATE,
} from '../workflows/reportingWorkflow';

const stateMeta = {
  [WINDOW_STATE.OPEN]: { label: 'Dibuka', tone: 'green' },
  [WINDOW_STATE.UPCOMING]: { label: 'Belum dibuka', tone: 'blue' },
  [WINDOW_STATE.CLOSED]: { label: 'Ditutup', tone: 'red' },
};

const plusDays = days => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateTimeInput(date);
};

const MetricCard = ({ label, value }) => <div><span>{label}</span><strong>{value}</strong></div>;

export default function SchemeManagementPage() {
  const {
    data, setData, showToast, user
  } = useRis();
  const history = useHistory();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [schemeState, setSchemeState] = useState('all');
  const [schemeYear, setSchemeYear] = useState('all');
  const [proposalStatus, setProposalStatus] = useState('all');
  const [proposalScheme, setProposalScheme] = useState('all');
  const [registrationScheme, setRegistrationScheme] = useState(null);
  const [registrationEnd, setRegistrationEnd] = useState('');
  const [scheduleScheme, setScheduleScheme] = useState(null);
  const [scheduleDraft, setScheduleDraft] = useState([]);
  const [error, setError] = useState('');
  const [deletingScheme, setDeletingScheme] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const activeTab = location.pathname.endsWith('/pengajuan') || new URLSearchParams(location.search).get('tab') === 'submissions' ? 'submissions' : 'schemes';
  const normalizedSearch = search.trim().toLowerCase();
  const allSchemes = useMemo(() => (data.schemes || []).filter(scheme => !scheme.deletedAt), [data.schemes]);
  const schemeYears = useMemo(() => [...new Set(allSchemes.map(scheme => scheme.year || String(scheme.startDate || '').slice(0, 4)).filter(Boolean))].sort((a, b) => Number(b) - Number(a)), [allSchemes]);
  const schemes = useMemo(() => allSchemes.filter(scheme => getSchemeTitle(scheme).toLowerCase().includes(normalizedSearch)
    && (schemeState === 'all' || getRegistrationState(scheme) === schemeState)
    && (schemeYear === 'all' || String(scheme.year || String(scheme.startDate || '').slice(0, 4)) === schemeYear)), [allSchemes, normalizedSearch, schemeState, schemeYear]);
  const proposalPool = useMemo(() => (data.drafts || []).filter(draft => {
    if (draftStatus(draft) === STATUS.ARCHIVED) return false;
    if (!isManager(user) && draftStatus(draft) === STATUS.DRAFT) return false;
    return true;
  }), [data.drafts, user]);
  const proposals = useMemo(() => proposalPool.filter(draft => {
    const scheme = (data.schemes || []).find(item => item.id === draft.schemeId);
    const haystack = `${(draft.project && draft.project.title) || ''} ${draft.userName || ''} ${getSchemeTitle(scheme)}`.toLowerCase();
    return haystack.includes(normalizedSearch)
      && (proposalStatus === 'all' || draftStatus(draft) === proposalStatus)
      && (proposalScheme === 'all' || draft.schemeId === proposalScheme);
  }), [proposalPool, data.schemes, normalizedSearch, proposalStatus, proposalScheme]);
  const schemeMetrics = useMemo(() => ({
    total: allSchemes.length,
    open: allSchemes.filter(scheme => getRegistrationState(scheme) === WINDOW_STATE.OPEN).length,
    upcoming: allSchemes.filter(scheme => getRegistrationState(scheme) === WINDOW_STATE.UPCOMING).length,
    closed: allSchemes.filter(scheme => getRegistrationState(scheme) === WINDOW_STATE.CLOSED).length,
  }), [allSchemes]);
  const proposalMetrics = useMemo(() => ({
    total: proposalPool.length,
    submitted: proposalPool.filter(draft => draftStatus(draft) === STATUS.SUBMITTED).length,
    review: proposalPool.filter(draft => [STATUS.UNDER_REVIEW, STATUS.REVIEWED].includes(draftStatus(draft))).length,
    revision: proposalPool.filter(draft => draftStatus(draft) === STATUS.REVISION).length,
    funded: proposalPool.filter(draft => draftStatus(draft) === STATUS.FUNDED).length,
  }), [proposalPool]);

  if (activeTab === 'submissions') return <ResearchMonitoringWorkspace />;

  const schemeForDraft = draft => (data.schemes || []).find(item => item.id === draft.schemeId);
  const proposalAction = draft => {
    if (canVerifyDraft(draft, user)) return { label: 'Verifikasi', tone: 'cyan', path: `/ris/pengajuan-penelitian-internal/${draft.id}/verifikasi` };
    if (canDecideDraft(draft, user)) return { label: 'Lihat & Putuskan', tone: 'cyan', path: `/ris/pengajuan-penelitian-internal/${draft.id}/buat-keputusan` };
    if (canAssignReviewer(draft, user)) return { label: draftStatus(draft) === STATUS.SUBMITTED ? 'Pilih Reviewer' : 'Atur Reviewer', tone: 'blue', path: `/ris/pengajuan-penelitian-internal/${draft.id}/pemilihan-reviewer` };
    if (canEditDraft(draft, user)) return { label: 'Lanjutkan', tone: 'yellow', path: `/ris/pengajuan-penelitian-internal/scheme/${draft.schemeId}` };
    return { label: 'Lihat', tone: 'gray', path: `/ris/pengajuan-penelitian-internal/${draft.id}/preview` };
  };

  const openRegistration = scheme => {
    setRegistrationScheme(scheme);
    setRegistrationEnd(getRegistrationState(scheme) === WINDOW_STATE.CLOSED ? plusDays(14) : toDateTimeInput(scheme.registrationEndDate));
    setError('');
  };

  const saveRegistration = () => {
    if (!registrationEnd || new Date(registrationEnd) <= new Date()) {
      setError('Deadline baru harus melewati waktu saat ini.');
      return;
    }
    const changedAt = new Date().toISOString();
    setData(current => ({
      ...current,
      schemes: current.schemes.map(scheme => (scheme.id === registrationScheme.id ? {
        ...scheme,
        status: 'open',
        schemeStatus: 'open',
        registrationEndDate: registrationEnd,
        registrationReopenHistory: [...(scheme.registrationReopenHistory || []), { previousEndAt: scheme.registrationEndDate || null, newEndAt: registrationEnd, changedAt, changedBy: user.id }],
        updatedAt: changedAt,
      } : scheme)),
    }));
    setRegistrationScheme(null);
    showToast({ tone: 'success', title: 'Deadline tersimpan', message: 'Periode pendaftaran skema berhasil diperbarui.' });
  };

  const openSchedule = scheme => {
    setScheduleScheme(scheme);
    setScheduleDraft(sortReportingSchedule(scheme.reportingSchedule).map(period => ({ ...period, extensions: [...(period.extensions || [])] })));
    setError('');
  };

  const updatePeriod = (id, key, value) => setScheduleDraft(current => current.map(period => (period.id === id ? { ...period, [key]: value } : period)));
  const updatePeriodType = (id, type) => setScheduleDraft(current => current.map(period => {
    if (period.id !== id) return period;
    const count = current.filter(item => item.id !== id && item.type === type).length + 1;
    return { ...period, type, label: type === REPORT_TYPE.INTERIM ? `${REPORT_TYPE_LABEL[type]} Periode ${count}` : REPORT_TYPE_LABEL[type] };
  }));
  const addPeriod = () => {
    const count = scheduleDraft.filter(period => period.type === REPORT_TYPE.INTERIM).length + 1;
    setScheduleDraft(current => [...current, { id: uid('report-interim'), type: REPORT_TYPE.INTERIM, label: `Monev Periode ${count}`, openAt: toDateTimeInput(new Date()), dueAt: plusDays(30), extensions: [] }]);
  };
  const removePeriod = id => setScheduleDraft(current => current.filter(period => period.id !== id));
  const reopenPeriod = id => {
    const changedAt = new Date().toISOString();
    setScheduleDraft(current => current.map(period => (period.id === id ? {
      ...period,
      openAt: toDateTimeInput(new Date()),
      dueAt: plusDays(14),
      extensions: [...(period.extensions || []), { previousDueAt: period.dueAt || null, reopenedAt: changedAt, reopenedBy: user.id }],
    } : period)));
  };

  const saveSchedule = () => {
    const scheduleError = validateReportingSchedule(scheduleDraft);
    if (scheduleError) {
      setError(scheduleError);
      return;
    }
    const changedAt = new Date().toISOString();
    setData(current => ({
      ...current,
      schemes: current.schemes.map(scheme => (scheme.id === scheduleScheme.id ? { ...scheme, reportingSchedule: sortReportingSchedule(scheduleDraft), reportingScheduleUpdatedAt: changedAt, reportingScheduleUpdatedBy: user.id } : scheme)),
    }));
    setScheduleScheme(null);
    showToast({ tone: 'success', title: 'Jadwal tersimpan', message: 'Jadwal pelaporan skema berhasil diperbarui.' });
  };

  const deletionBlocked = deletingScheme ? getSchemeDeletionError(data, deletingScheme.id) : '';
  const deleteScheme = () => {
    try {
      setData(current => deleteResearchSchemeData(current, deletingScheme.id, user, uid));
      setDeletingScheme(null);
      showToast({ tone: 'success', title: 'Skema dihapus', message: 'Proposal terkait tetap tersimpan di Arsip.' });
    } catch (failure) {
      setDeleteError(failure.message);
    }
  };

  return (
    <div className="ris-page ris-workspace-page">
      {deletingScheme && <Modal title="Hapus Skema" onClose={() => setDeletingScheme(null)}><div className="ris-modal-body">
        <p className="ris-modal-intro">{getSchemeTitle(deletingScheme)}</p>
        {deletionBlocked || deleteError ? <FloatingError message={deletionBlocked || deleteError} /> : <p>Skema akan dihapus dari daftar aktif. {(data.drafts || []).filter(draft => draftSchemeId(draft) === deletingScheme.id).length} proposal dan draf terkait akan dipindahkan ke Arsip beserta seluruh lampirannya.</p>}
        <div className="ris-modal-actions"><Button tone="gray" onClick={() => setDeletingScheme(null)}>Batal</Button><Button tone="red" disabled={Boolean(deletionBlocked)} onClick={deleteScheme}><Icon name="trash" size={16} />Hapus Skema</Button></div>
      </div></Modal>}
      <PageHeader
        title={activeTab === 'schemes' ? 'Daftar Skema Penelitian' : 'Pengajuan Penelitian'}
        description={activeTab === 'schemes' ? 'Kelola skema, periode pendaftaran, dan jadwal pelaporan penelitian.' : 'Verifikasi pengajuan, tugaskan beberapa penilai, dan tetapkan keputusan pendanaan.'}
        actions={activeTab === 'schemes' && <Button onClick={() => history.push('/ris/skema/create')}><Icon name="plus" size={17} />Buat Skema</Button>}
      />
      <section className="ris-letter-stats ris-research-stats">
        {activeTab === 'schemes' ? <React.Fragment><MetricCard label="Total Skema" value={schemeMetrics.total} /><MetricCard label="Pendaftaran Dibuka" value={schemeMetrics.open} /><MetricCard label="Akan Dibuka" value={schemeMetrics.upcoming} /><MetricCard label="Pendaftaran Ditutup" value={schemeMetrics.closed} /></React.Fragment> : <React.Fragment><MetricCard label="Total Pengajuan" value={proposalMetrics.total} /><MetricCard label="Menunggu Verifikasi" value={proposalMetrics.submitted} /><MetricCard label="Proses Penilaian" value={proposalMetrics.review} /><MetricCard label="Perlu Revisi" value={proposalMetrics.revision} /><MetricCard label="Sudah Didanai" value={proposalMetrics.funded} /></React.Fragment>}
      </section>
      <section className="ris-list-filters" aria-label={activeTab === 'schemes' ? 'Filter skema' : 'Filter pengajuan'}>
        <div className="ris-search"><Icon name="search" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={activeTab === 'schemes' ? 'Cari skema...' : 'Cari judul atau pengaju...'} aria-label={activeTab === 'schemes' ? 'Cari skema' : 'Cari pengajuan penelitian'} /></div>
        {activeTab === 'schemes' ? <React.Fragment><select value={schemeState} onChange={event => setSchemeState(event.target.value)} aria-label="Status pendaftaran"><option value="all">Semua status</option><option value={WINDOW_STATE.OPEN}>Dibuka</option><option value={WINDOW_STATE.UPCOMING}>Belum dibuka</option><option value={WINDOW_STATE.CLOSED}>Ditutup</option></select><select value={schemeYear} onChange={event => setSchemeYear(event.target.value)} aria-label="Tahun skema"><option value="all">Semua tahun</option>{schemeYears.map(year => <option key={year} value={year}>{year}</option>)}</select></React.Fragment> : <React.Fragment><select value={proposalStatus} onChange={event => setProposalStatus(event.target.value)} aria-label="Status pengajuan"><option value="all">Semua status</option>{Object.values(STATUS).map(status => <option value={status} key={status}>{(STATUS_META[status] || {}).label || status}</option>)}</select><select value={proposalScheme} onChange={event => setProposalScheme(event.target.value)} aria-label="Skema pengajuan"><option value="all">Semua skema</option>{allSchemes.map(scheme => <option value={scheme.id} key={scheme.id}>{getSchemeTitle(scheme)}</option>)}</select></React.Fragment>}
        {(search || (activeTab === 'schemes' ? schemeState !== 'all' || schemeYear !== 'all' : proposalStatus !== 'all' || proposalScheme !== 'all')) && <button type="button" className="ris-filter-reset" onClick={() => { setSearch(''); setSchemeState('all'); setSchemeYear('all'); setProposalStatus('all'); setProposalScheme('all'); }}>Atur ulang filter</button>}
      </section>
      {activeTab === 'schemes' && <div className="ris-table-wrap"><table className="ris-table ris-action-table"><thead><tr><th>Skema</th><th>Periode Penelitian</th><th>Maksimum Anggaran</th><th>Pendaftaran</th><th>Tenggat Pendaftaran</th><th>Jadwal Laporan</th><th>Aksi</th></tr></thead><tbody>
        {schemes.map(scheme => {
          const registration = stateMeta[getRegistrationState(scheme)];
          return <tr key={scheme.id}><td className="ris-title-cell"><strong>{getSchemeTitle(scheme)}</strong></td><td>{formatDate(scheme.startDate)} - {formatDate(scheme.endDate)}</td><td>{Number(scheme.maximumBudget) > 0 ? formatCurrency(scheme.maximumBudget) : '-'}</td><td><StatusBadge tone={registration.tone}>{registration.label}</StatusBadge></td><td>{scheme.registrationEndDate ? new Date(scheme.registrationEndDate).toLocaleString('id-ID') : '-'}</td><td>{(scheme.reportingSchedule || []).length} laporan</td><td><div className="ris-row-actions"><button type="button" className={`ris-action ${getRegistrationState(scheme) === WINDOW_STATE.CLOSED ? 'green' : 'yellow'}`} onClick={() => openRegistration(scheme)}>{getRegistrationState(scheme) === WINDOW_STATE.CLOSED ? 'Buka kembali' : 'Perpanjang'}</button><button type="button" className="ris-action blue" onClick={() => openSchedule(scheme)}>Atur laporan</button>{canManageResearch(user) && <button type="button" className="ris-action red" onClick={() => { setDeletingScheme(scheme); setDeleteError(''); }}><Icon name="trash" size={14} />Hapus</button>}</div></td></tr>;
        })}
        {schemes.length === 0 && <EmptyRow colSpan={7}>Tidak ada skema yang sesuai.</EmptyRow>}
      </tbody></table></div>}

      {activeTab === 'submissions' && <div className="ris-table-wrap"><table className="ris-table ris-action-table"><thead><tr><th>No.</th><th>Judul Penelitian</th><th>Pengaju</th><th>Skema</th><th>Tanggal Pengajuan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
        {proposals.map((draft, index) => {
          const action = proposalAction(draft);
          const meta = STATUS_META[draftStatus(draft)] || STATUS_META.draft;
          return <tr key={draft.id}><td>{index + 1}.</td><td className="ris-title-cell">{(draft.project && draft.project.title) || 'Tanpa judul'}</td><td>{draft.userName || '-'}</td><td>{getSchemeTitle(schemeForDraft(draft))}</td><td>{formatDate(draft.submittedAt || draft.updatedAt)}</td><td><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td><td><button type="button" className={`ris-action ${action.tone}`} onClick={() => history.push(action.path)}>{action.label}</button></td></tr>;
        })}
        {proposals.length === 0 && <EmptyRow colSpan={7}>Tidak ada pengajuan penelitian yang sesuai.</EmptyRow>}
      </tbody></table></div>}

      {registrationScheme && <Modal title="Buka Pendaftaran Skema" onClose={() => setRegistrationScheme(null)}><div className="ris-modal-body"><p className="ris-modal-intro">{getSchemeTitle(registrationScheme)}</p><FloatingError message={error} /><Field label="Tenggat Baru" required><input type="datetime-local" value={registrationEnd} onChange={event => setRegistrationEnd(event.target.value)} /></Field><div className="ris-modal-actions"><Button tone="gray" onClick={() => setRegistrationScheme(null)}>Batal</Button><Button onClick={saveRegistration}>Simpan Tenggat</Button></div></div></Modal>}

      {scheduleScheme && <Modal title="Atur Jadwal Pelaporan" width={1080} onClose={() => setScheduleScheme(null)}><div className="ris-modal-body ris-schedule-modal"><div className="ris-section-title"><div><strong>{getSchemeTitle(scheduleScheme)}</strong><p className="ris-muted">Perubahan berlaku untuk semua penelitian yang berjalan dalam skema ini.</p></div><Button tone="blue" onClick={addPeriod}><Icon name="plus" size={16} />Tambah Jadwal</Button></div><FloatingError message={error} /><div className={`ris-schedule-requirement ${scheduleDraft.filter(period => period.type === REPORT_TYPE.FINAL).length === 1 ? 'complete' : 'pending'}`}><Icon name={scheduleDraft.some(period => period.type === REPORT_TYPE.FINAL) ? 'check' : 'document'} size={17} /><span>{scheduleDraft.some(period => period.type === REPORT_TYPE.FINAL) ? 'Laporan Final sudah tersedia' : 'Laporan Final belum ditambahkan'}</span></div>{scheduleDraft.length === 0 && <div className="ris-empty-state ris-schedule-empty">Belum ada jadwal pelaporan.</div>}{scheduleDraft.map(period => {
        const window = stateMeta[getWindowState(period)];
        return <div className="ris-schedule-editor-row" key={period.id}><Field label="Jenis" required><select value={period.type} onChange={event => updatePeriodType(period.id, event.target.value)}>{REPORT_TYPE_OPTIONS.map(item => <option key={item.value} value={item.value} disabled={item.value === REPORT_TYPE.FINAL && scheduleDraft.some(existing => existing.id !== period.id && existing.type === REPORT_TYPE.FINAL)}>{item.label}</option>)}</select></Field><Field label="Nama Periode" required><input value={period.label} onChange={event => updatePeriod(period.id, 'label', event.target.value)} /></Field><Field label="Dibuka" required><input type="datetime-local" value={period.openAt} onChange={event => updatePeriod(period.id, 'openAt', event.target.value)} /></Field><Field label="Tenggat" required><input type="datetime-local" value={period.dueAt} onChange={event => updatePeriod(period.id, 'dueAt', event.target.value)} /></Field><div className="ris-row-actions"><StatusBadge tone={window.tone}>{window.label}</StatusBadge>{getWindowState(period) === WINDOW_STATE.CLOSED && <button type="button" className="ris-action green" onClick={() => reopenPeriod(period.id)}>Buka kembali</button>}<button type="button" className="ris-action red" onClick={() => removePeriod(period.id)}>Hapus</button></div></div>;
      })}<div className="ris-modal-actions"><Button tone="gray" onClick={() => setScheduleScheme(null)}>Batal</Button><Button onClick={saveSchedule}>Simpan Jadwal</Button></div></div></Modal>}
    </div>
  );
}
