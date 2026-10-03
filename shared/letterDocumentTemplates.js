const LETTER_DOCUMENT_TEMPLATES = [
  ['A01', 'research_assignment', 'independent_research', 'A01_Surat_Tugas_Penelitian_Mandiri.docx'],
  ['A02', 'research_assignment', 'domestic_university_collaboration', 'A02_Surat_Tugas_Penelitian_Kerja_Sama_PT_Dalam_Negeri.docx'],
  ['A03', 'research_assignment', 'international_university_collaboration', 'A03_Surat_Tugas_Penelitian_Kerja_Sama_PT_Luar_Negeri.docx'],
  ['A04', 'research_assignment', 'internal_grant', 'A04_Surat_Tugas_Penelitian_Hibah_Internal.docx'],
  ['A05', 'research_assignment', 'government_grant', 'A05_Surat_Tugas_Penelitian_Pemerintah.docx'],
  ['A06', 'research_assignment', 'industry_research', 'A06_Surat_Tugas_Penelitian_Industri.docx'],
  ['A07', 'research_assignment', 'journal', 'A07_Surat_Tugas_Publikasi_Jurnal.docx'],
  ['A08', 'research_assignment', 'proceeding', 'A08_Surat_Tugas_Publikasi_Prosiding.docx'],
  ['A09', 'research_assignment', 'book', 'A09_Surat_Tugas_Publikasi_Buku.docx'],
  ['A10', 'research_assignment', 'scientific_seminar', 'A10_Surat_Tugas_Seminar_Ilmiah.docx'],
  ['A11', 'research_assignment', 'artwork', 'A11_Surat_Tugas_Karya_Seni.docx'],
  ['B01', 'support', 'research_permission', 'B01_Surat_Permohonan_Izin_Penelitian.docx'],
  ['B02', 'support', 'observation', 'B02_Surat_Permohonan_Observasi.docx'],
  ['B03', 'support', 'interview', 'B03_Surat_Permohonan_Wawancara.docx'],
  ['B04', 'support', 'workshop', 'B04_Surat_Permohonan_Workshop.docx'],
  ['B05', 'support', 'fgd', 'B05_Surat_Permohonan_FGD.docx'],
  ['B06', 'support', 'other_research_activity', 'B06_Surat_Permohonan_Kegiatan_Penelitian_Lainnya.docx'],
  ['C01', 'ethics', 'new', 'C01_Permohonan_Klirens_Etik_Baru.docx'],
  ['C02', 'ethics', 'extension', 'C02_Permohonan_Perpanjangan_Klirens_Etik.docx'],
  ['D01', 'travel', 'research_travel', 'D01_Surat_Tugas_Perjalanan_Dinas_Penelitian.docx'],
  ['E01', 'custom', '', 'E01_Surat_Custom.docx'],
].map(([id, type, purpose, file]) => ({
  id, type, purpose, file
}));

const resolveLetterDocumentTemplate = letter => {
  const selected = letter.template && letter.template.sourceId;
  if (selected) {
    const template = LETTER_DOCUMENT_TEMPLATES.find(item => item.id === selected);
    if (!template) throw new Error('Templat Word surat tidak tersedia.');
    return template;
  }
  return LETTER_DOCUMENT_TEMPLATES.find(item => item.type === letter.type && item.purpose === (letter.purpose || ''))
    || LETTER_DOCUMENT_TEMPLATES.find(item => item.id === 'E01');
};

module.exports = { LETTER_DOCUMENT_TEMPLATES, resolveLetterDocumentTemplate };
