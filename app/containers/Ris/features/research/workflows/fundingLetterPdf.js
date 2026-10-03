import { jsPDF } from 'jspdf/dist/jspdf.umd.min.js';
import { formatCurrency, totalBudget } from '../../../core/data';
import { getSchemeTitle } from '../../../shared/workflows/workflow';

const dateLabel = value => new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'long', year: 'numeric'
}).format(new Date(value || Date.now()));

const safeText = value => String(value || '-').replace(/[^\x20-\x7E]/g, ' ');

const downloadFundingLetterPdf = (draft, scheme) => {
  const letter = draft.fundingLetter || {};
  const decision = draft.decision || {};
  const PdfDocument = jsPDF;
  const doc = new PdfDocument({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 24;
  const contentWidth = pageWidth - (margin * 2);
  const applicant = (draft.members || [])[0] || {};
  const signerName = letter.signerName || decision.signerName || 'Pejabat LPPM';
  const signerRole = letter.signerRole || decision.signerRole || 'Pejabat Penandatangan';

  doc.setProperties({
    title: `Surat Penetapan Pendanaan - ${safeText(draft.project && draft.project.title)}`,
    subject: 'Penetapan pendanaan penelitian internal',
    author: 'Research Innovation and Sustainability',
    creator: 'RIS UMN',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('UNIVERSITAS MULTIMEDIA NUSANTARA', pageWidth / 2, 22, { align: 'center' });
  doc.setFontSize(10);
  doc.text('LEMBAGA PENELITIAN DAN PENGABDIAN KEPADA MASYARAKAT', pageWidth / 2, 29, { align: 'center' });
  doc.setLineWidth(0.6);
  doc.line(margin, 34, pageWidth - margin, 34);
  doc.setLineWidth(0.2);
  doc.line(margin, 35.5, pageWidth - margin, 35.5);

  doc.setFontSize(13);
  doc.text('SURAT PENETAPAN PENDANAAN PENELITIAN', pageWidth / 2, 49, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Nomor: ${safeText(letter.number || `SPP-${draft.id}`)}`, pageWidth / 2, 56, { align: 'center' });

  let y = 70;
  const paragraph = text => {
    const lines = doc.splitTextToSize(safeText(text), contentWidth);
    doc.text(lines, margin, y, { align: 'justify', maxWidth: contentWidth, lineHeightFactor: 1.45 });
    y += (lines.length * 5.5) + 4;
  };
  paragraph('Berdasarkan hasil verifikasi administrasi, penilaian reviewer, dan keputusan final pengelola penelitian, proposal berikut ditetapkan sebagai penelitian yang didanai:');

  const rows = [
    ['Judul Penelitian', draft.project && draft.project.title],
    ['Ketua Peneliti', applicant.name || draft.userName],
    ['NIDN', applicant.nidn],
    ['Skema', getSchemeTitle(scheme)],
    ['Nilai Pendanaan', formatCurrency(totalBudget(draft))],
    ['Tanggal Keputusan', dateLabel(letter.issuedAt || decision.decidedAt)],
  ];
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(safeText(label), margin, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(safeText(value), contentWidth - 48);
    doc.text(lines, margin + 48, y);
    y += Math.max(7, lines.length * 5);
  });

  y += 4;
  paragraph('Pendanaan dilaksanakan sesuai ketentuan skema, kontrak penelitian, jadwal pelaksanaan, dan kewajiban pelaporan yang berlaku. Surat ini dapat digunakan sebagai bukti resmi penetapan pendanaan di dalam sistem RIS.');

  const signatureY = Math.max(y + 8, 190);
  doc.text(`Tangerang, ${dateLabel(letter.signedAt || decision.decidedAt)}`, pageWidth - margin, signatureY, { align: 'right' });
  doc.setDrawColor(38, 112, 171);
  doc.roundedRect(pageWidth - margin - 69, signatureY + 7, 69, 38, 2, 2);
  doc.setTextColor(38, 112, 171);
  doc.setFont('helvetica', 'bold');
  doc.text('DITANDATANGANI SECARA ELEKTRONIK', pageWidth - margin - 34.5, signatureY + 15, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(safeText(signerName), pageWidth - margin - 34.5, signatureY + 29, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(safeText(signerRole), pageWidth - margin - 34.5, signatureY + 35, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  doc.text(`Dokumen RIS: ${safeText(draft.id)} | Penandatangan: ${safeText(letter.signedBy || decision.decidedBy || decision.managerId)}`, margin, 281);

  doc.save(letter.fileName || `surat-penetapan-pendanaan-${draft.id}.pdf`);
};

export default downloadFundingLetterPdf;
