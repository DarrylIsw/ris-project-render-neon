/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useHistory } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import Icon from '../../../shared/components/Icon';
import { Button, EmptyRow, Modal } from '../../../shared/components/Ui';
import { formatCurrency } from '../../../core/data';
import { canManageResearch, hasFullAccess } from '../../../shared/workflows/workflow';
import {
  ACTIVITY_STATUS_OPTIONS,
  ACTIVITY_TYPE_OPTIONS,
  EXTERNAL_STATUS,
  RESEARCH_CATEGORY_OPTIONS,
  canAdminReviewExternalReport,
  canArchiveExternalReport,
  canDeleteExternalReport,
  canCreateExternalReport,
  canEditExternalReport,
  externalReportTitle,
  externalStatusMeta,
  getAdminExternalQueue,
  getCategoryMeta,
  getExternalMetrics,
  getVisibleExternalReports,
} from '../workflows/externalResearchWorkflow';

function MetricCard({ label, value }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

MetricCard.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.number.isRequired };

export default function ExternalResearchDashboardPage() {
  const { data, setData, user } = useRis();
  const history = useHistory();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const admin = canManageResearch(user);
  const fullAccess = hasFullAccess(user);
  const createAllowed = canCreateExternalReport(user);
  const visibleReports = fullAccess ? (data.externalResearchReports || []) : (admin ? getAdminExternalQueue(data) : getVisibleExternalReports(data, user));
  const metricsBase = admin ? (data.externalResearchReports || []) : visibleReports;
  const metrics = getExternalMetrics(metricsBase);
  const startReport = () => history.push('/ris/penelitian-eksternal/new');

  const actionFor = report => {
    if (canAdminReviewExternalReport(report, user)) return { label: report.submissionStatus === EXTERNAL_STATUS.SUBMITTED ? 'Nilai' : 'Lanjutkan Penilaian', tone: 'cyan', path: `/ris/penelitian-eksternal/${report.id}/admin` };
    if (canArchiveExternalReport(report, user)) return { label: 'Arsipkan', tone: 'purple', path: `/ris/penelitian-eksternal/${report.id}/admin` };
    if (canEditExternalReport(report, user)) return { label: 'Ubah', tone: 'yellow', path: `/ris/penelitian-eksternal/${report.id}/edit` };
    return { label: 'Detail', tone: 'gray', path: `/ris/penelitian-eksternal/${report.id}/detail` };
  };

  const deleteReport = () => {
    if (!deleteTarget) return;
    setData(current => {
      const currentReport = (current.externalResearchReports || []).find(item => item.id === deleteTarget.id);
      if (!canDeleteExternalReport(currentReport, user)) return current;
      return {
        ...current,
        externalResearchReports: (current.externalResearchReports || []).filter(item => item.id !== currentReport.id),
        notifications: (current.notifications || []).filter(item => !(item.entityType === 'external_research' && item.entityId === currentReport.id)),
      };
    });
    setDeleteTarget(null);
  };

  return (
    <div className="ris-page">
      <div className="ris-page-heading">
        <div>
          <h1>Pelaporan Penelitian Eksternal & Mandiri</h1>
          <p>Mencatat aktivitas riset di luar skema internal: hibah, kerja sama mitra, kerja sama universitas, mandiri, PRO-STEP, dokumen, luaran, SDG, TKT, dan validasi LPPM.</p>
        </div>
        {createAllowed && <div className="ris-heading-actions"><Button onClick={startReport}><Icon name="plus" size={16} />Buat Laporan</Button></div>}
      </div>

      <section className="ris-letter-stats ris-external-stats">
        <MetricCard label="Total Laporan" value={metrics.totalReports} />
        <MetricCard label="Diajukan" value={metrics.submittedReports} />
        <MetricCard label="Sedang Dinilai" value={metrics.underReviewReports} />
        <MetricCard label="Revisi" value={metrics.revisionReports} />
        <MetricCard label="Tervalidasi" value={metrics.validatedReports} />
        <MetricCard label="Arsip" value={metrics.archivedReports} />
        <MetricCard label="Eksternal" value={metrics.externalReports} />
        <MetricCard label="Mandiri" value={metrics.independentReports} />
      </section>

      {admin && (
        <section className="ris-section-spaced">
          <div className="ris-section-title">
            <h2>Pemantauan Statistik Pelaporan</h2>
          </div>
          <div className="ris-breakdown-grid">
            <div className="ris-breakdown-card">
              <h3>Rincian Kategori</h3>
              <p><span>Hibah</span><strong>{metrics.grantReports}</strong></p>
              <p><span>Mitra</span><strong>{metrics.partnerReports}</strong></p>
              <p><span>Universitas</span><strong>{metrics.universityReports}</strong></p>
              <p><span>Mandiri</span><strong>{metrics.independentReports}</strong></p>
            </div>
            <div className="ris-breakdown-card">
              <h3>Metrik Luaran</h3>
              <p><span>Jurnal</span><strong>{metrics.totalJournals}</strong></p>
              <p><span>Buku</span><strong>{metrics.totalBooks}</strong></p>
              <p><span>HKI</span><strong>{metrics.totalHki}</strong></p>
              <p><span>Prototipe</span><strong>{metrics.totalPrototypes}</strong></p>
              <p><span>Prosiding</span><strong>{metrics.totalProceedings}</strong></p>
            </div>
          </div>
        </section>
      )}

      {createAllowed && (
        <section className="ris-section-spaced">
          <div className="ris-section-title"><h2>Jenis Laporan yang Didukung</h2></div>
          <div className="ris-letter-type-grid">
            {RESEARCH_CATEGORY_OPTIONS.map(item => (
              <button key={item.value} type="button" className="ris-letter-type-card" onClick={startReport}>
                <span><Icon name={item.icon} /></span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="ris-section-spaced">
        <div className="ris-section-title">
          <h2>{admin ? 'Antrean Pemantauan Administrator LPPM' : 'Riwayat Laporan Saya'}</h2>
          <div className="ris-external-report-actions">
            {!admin && visibleReports.some(item => item.submissionStatus === EXTERNAL_STATUS.DRAFT) && <span className="ris-badge gray">Draf tersedia</span>}
          </div>
        </div>
        <div className="ris-table-wrap">
          <table className="ris-table ris-action-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Judul Penelitian</th>
                {admin && <th>Dosen</th>}
                <th>Tahun</th>
                <th>Aktivitas</th>
                <th>Kategori</th>
                <th>Pendanaan</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {visibleReports.map((report, index) => {
                const meta = externalStatusMeta(report);
                const category = getCategoryMeta(report.category);
                const action = actionFor(report);
                return (
                  <tr key={report.id}>
                    <td>{index + 1}.</td>
                    <td className="ris-title-cell" title={externalReportTitle(report)}>{externalReportTitle(report)}</td>
                    {admin && <td>{report.userName || report.applicantName || report.userId}</td>}
                    <td>{report.activityYear}</td>
                    <td>{(ACTIVITY_STATUS_OPTIONS.find(item => item.value === report.activityStatus) || {}).label || '-'} / {(ACTIVITY_TYPE_OPTIONS.find(item => item.value === report.activityType) || {}).label || '-'}</td>
                    <td>{category.label}</td>
                    <td>{report.currency || 'IDR'} {formatCurrency(report.fundingAmount).replace('Rp ', '')}</td>
                    <td><span className={`ris-badge ${meta.tone}`}>{meta.label}</span></td>
                    <td><div className="ris-row-actions ris-external-report-row-actions"><button type="button" className={`ris-action ${action.tone}`} onClick={() => history.push(action.path)}>{action.label}</button>{canDeleteExternalReport(report, user) && <button type="button" className="ris-action red" aria-label={`Hapus laporan ${externalReportTitle(report)}`} onClick={() => setDeleteTarget(report)}>Hapus</button>}</div></td>
                  </tr>
                );
              })}
              {visibleReports.length === 0 && <EmptyRow colSpan={admin ? 9 : 8}>{admin ? 'Belum ada laporan yang perlu diproses.' : 'Belum ada laporan eksternal/mandiri.'}</EmptyRow>}
            </tbody>
          </table>
        </div>
      </section>

      {deleteTarget && <Modal title="Hapus Laporan Penelitian Eksternal" width={520} onClose={() => setDeleteTarget(null)}>
        <div className="ris-modal-body">
          <p>Hapus laporan <strong>{externalReportTitle(deleteTarget)}</strong>? Data, catatan lampiran, dan riwayat statusnya akan dihapus dari aplikasi. Tindakan ini tidak dapat dibatalkan.</p>
          <div className="ris-modal-actions"><Button tone="gray" onClick={() => setDeleteTarget(null)}>Batal</Button><Button tone="red" onClick={deleteReport}>Hapus Laporan</Button></div>
        </div>
      </Modal>}

    </div>
  );
}
