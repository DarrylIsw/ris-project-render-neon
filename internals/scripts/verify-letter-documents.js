/* eslint-disable no-await-in-loop, no-console */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { getTemplateCatalog, renderLetterPdf } = require('../../server/services/letterDocumentService');

const execute = promisify(execFile);
const main = async () => {
  const output = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ris-letter-visual-'));
  console.log(`Output: ${output}`);
  const requested = process.argv.slice(2);
  const sources = getTemplateCatalog().filter(source => !requested.length || requested.includes(source.id));
  if (!sources.length) throw new Error('No matching letter templates.');
  for (const source of sources) { // eslint-disable-line no-restricted-syntax
    const form = Object.fromEntries(source.placeholders.map(key => [key, `Data ${key}`]));
    Object.assign(form, {
      researchTitle: 'Pengembangan Sistem Informasi Penelitian Terintegrasi',
      researchYear: 2026,
      researchDuration: 'Januari - Desember 2026',
      researchLocation: 'Tangerang',
      researchScheme: 'Penelitian Dosen Pemula',
      researchRole: 'Ketua Penelitian',
      researchTeam: 'Dr. Budi Santoso, Dr. Andini Prameswari',
      recipientName: 'Pimpinan Instansi',
      recipientInstitution: 'Mitra Akademik',
      activityPurpose: 'Pengumpulan data penelitian dan pengembangan kerja sama akademik.',
      activityStartDate: '2026-10-01',
      activityEndDate: '2026-10-30',
      catatanPengujian: 'Isian kustom ini ditambahkan oleh admin melalui form builder dan diisi oleh dosen.',
    });
    const letter = {
      id: `visual-${source.id}`,
      type: source.type,
      purpose: source.purpose,
      definitionName: source.name,
      template: {
        sourceId: source.id,
        values: {
          letterPlace: 'Tangerang', letterDate: '2026-10-01', signerName: 'Pejabat Pengujian', signerTitle: 'Kepala RIS'
        }
      },
      applicant: {
        name: 'Dr. Budi Santoso', identifier: '0312048501', email: 'dosen@example.test', program: 'Sistem Informasi', faculty: 'Teknik dan Informatika', applicantRole: 'Dosen'
      },
      generated: { letterNumber: `0001/${source.id}/RIS/10/2026` },
      templateFields: [{ key: 'catatanPengujian', label: 'Catatan Tambahan', type: 'textarea' }],
      form,
    };
    const pdf = path.join(output, `${source.id}.pdf`);
    await fs.promises.writeFile(pdf, await renderLetterPdf(letter));
    await execute('pdftoppm', ['-r', '90', '-png', pdf, path.join(output, source.id)], { windowsHide: true });
    const extracted = await execute('pdftotext', [pdf, '-'], { windowsHide: true });
    if (extracted.stdout.includes('{{')) throw new Error(`${source.id}: unresolved placeholder`);
    if (!extracted.stdout.includes('Catatan Tambahan')) throw new Error(`${source.id}: custom field not rendered`);
    console.log(`${source.id}: PDF, image render, placeholders and custom fields verified`);
  }
};
main().catch(error => { console.error(error); process.exitCode = 1; });
