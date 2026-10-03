const assert = require('assert');
const fs = require('fs');
const PizZip = require('pizzip');
const { DOMParser } = require('@xmldom/xmldom');
const { LETTER_DOCUMENT_TEMPLATES, resolveLetterDocumentTemplate } = require('../../shared/letterDocumentTemplates');
const {
  buildDocumentValues, renderLetterDocx, renderLetterPdf, getTemplateCatalog, findLibreOffice
} = require('../../server/services/letterDocumentService');
const { fingerprint } = require('../../server/controllers/letterDocumentController');

const baseLetter = () => ({
  id: 'letter-test',
  type: 'support',
  purpose: 'interview',
  applicant: {
    name: 'Dr. Budi Santoso', identifier: '0312048501', program: 'Sistem Informasi', faculty: 'Teknik dan Informatika'
  },
  template: {
    values: {
      letterPlace: 'Tangerang', signerName: 'Nama Pejabat Pengujian', signerTitle: 'Kepala RIS', letterDate: '2026-10-01'
    }
  },
  autoFill: { researchTitle: 'Penelitian Sistem Informasi', researchYear: 2026 },
  generated: { letterNumber: '0099/SP-RIS/LPPM/10/2026' },
  templateFields: [{ key: 'recipientInstitution', label: 'Instansi Tujuan', type: 'text' }, { key: 'customNote', label: 'Keterangan Khusus', type: 'textarea' }],
  form: { recipientInstitution: 'Mitra Akademik', customNote: 'Informasi khusus dari dosen & mitra\nBaris kedua' },
});
const content = bytes => {
  const zip = new PizZip(bytes);
  const document = new DOMParser().parseFromString(zip.file('word/document.xml').asText(), 'text/xml');
  return { zip, document, text: Array.from(document.getElementsByTagName('w:t')).map(node => node.textContent).join(' ') };
};

describe('Word letter document integration', () => {
  it('resolves all 21 templates, fills their tokens and preserves header/logo assets', () => {
    const catalog = getTemplateCatalog();
    assert.strictEqual(catalog.length, 21);
    LETTER_DOCUMENT_TEMPLATES.forEach(item => {
      assert.strictEqual(resolveLetterDocumentTemplate(item).id, item.id);
      const letter = { ...baseLetter(), type: item.type, purpose: item.purpose };
      catalog.find(entry => entry.id === item.id).placeholders.forEach(key => {
        if (!['letterDate', 'letterPlace', 'signerName', 'signerTitle', 'letterNumber'].includes(key)) letter.form[key] = `Isi ${key}`;
      });
      const rendered = content(renderLetterDocx(letter));
      assert.ok(rendered.text.includes('Dr. Budi Santoso'), item.id);
      assert.ok(rendered.text.includes('0099/SP-RIS'), item.id);
      assert.ok(!rendered.text.includes('{{'), item.id);
      assert.ok(rendered.zip.file('word/header1.xml'), item.id);
      assert.ok(rendered.zip.file(/^word\/media\//).length >= 2, item.id);
      assert.ok(rendered.document.getElementsByTagName('w:cantSplit').length > 0, item.id);
    });
  });

  it('maps known fields in place, appends unknown fields once and safely escapes input', () => {
    const letter = baseLetter();
    letter.form.customNote += '\nLiteral {{applicantName}} <b>tetap data</b>';
    const rendered = content(renderLetterDocx(letter));
    assert.strictEqual((rendered.text.match(/Keterangan Khusus:/g) || []).length, 1);
    assert.ok(rendered.text.includes('Informasi khusus dari dosen & mitra'));
    assert.ok(rendered.text.includes('Literal {{applicantName}} <b>tetap data</b>'));
    assert.ok(!rendered.text.includes('Instansi Tujuan:'));
    assert.ok(rendered.text.indexOf('Informasi Tambahan') < rendered.text.indexOf('Atas perhatian'));
  });

  it('removes empty optional rows, formats dates and protects system values', () => {
    const letter = baseLetter();
    letter.form.applicantName = 'Nama palsu';
    letter.form.signerName = 'Pejabat palsu';
    letter.form.activityStartDate = '2026-10-03';
    const values = buildDocumentValues(letter);
    assert.strictEqual(values.applicantName, 'Dr. Budi Santoso');
    assert.strictEqual(values.signerName, 'Nama Pejabat Pengujian');
    assert.ok(values.activityStartDate.includes('Oktober'));
    const rendered = content(renderLetterDocx(letter));
    assert.ok(!rendered.text.includes('Tanggal Selesai'));
    assert.ok(!rendered.text.includes('{{recipientName}}'));
    assert.throws(() => renderLetterDocx({ ...letter, template: { values: {} } }), /Lengkapi/);
    assert.throws(() => renderLetterDocx({ ...letter, template: { sourceId: '../evil' } }), /tidak tersedia/);
  });

  it('uses the custom Word template and interpolates custom body fields without duplication', () => {
    const letter = baseLetter();
    letter.type = 'custom';
    letter.purpose = '';
    letter.definitionName = 'Surat Keterangan Khusus';
    letter.template.values.customContent = 'Dengan ini menyatakan: {{customNote}}';
    const rendered = content(renderLetterDocx(letter));
    assert.ok(rendered.text.includes('Surat Keterangan Khusus'));
    assert.ok(rendered.text.includes('Dengan ini menyatakan: Informasi khusus'));
    assert.ok(!rendered.text.includes('Keterangan Khusus:'));
  });

  it('keeps generation fingerprints stable across PostgreSQL JSON key ordering', () => {
    const letter = baseLetter();
    const reordered = { ...letter, form: { customNote: letter.form.customNote, recipientInstitution: letter.form.recipientInstitution } };
    assert.strictEqual(fingerprint(letter), fingerprint(reordered));
    assert.notStrictEqual(fingerprint(letter), fingerprint({ ...letter, form: { ...letter.form, customNote: 'Berubah' } }));
  });

  it('converts Word to a genuine PDF when LibreOffice is installed', async function pdfTest() {
    this.timeout(120000);
    if (process.platform === 'win32' && !fs.existsSync(findLibreOffice())) this.skip();
    const pdf = await renderLetterPdf(baseLetter());
    assert.strictEqual(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
    assert.ok(pdf.length > 10000);
  });
});
