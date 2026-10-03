/* eslint-disable no-param-reassign */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { execFile } = require('child_process');
const { promisify } = require('util');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const { LETTER_DOCUMENT_TEMPLATES, resolveLetterDocumentTemplate } = require('../../shared/letterDocumentTemplates');
const manifest = require('../templates/letters/form_builder_fields.json');

const execute = promisify(execFile);
const templatesRoot = path.resolve(__dirname, '../templates/letters');
const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const tokens = value => (String(value).match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g) || []).map(token => token.replace(/[{}\s]/g, ''));
const textOf = node => Array.from(node.getElementsByTagName('w:t')).map(item => item.textContent).join('');
const fail = (message, status = 422) => Object.assign(new Error(message), { status });
const scalar = value => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(scalar).join(', ');
  if (typeof value === 'object') return Object.values(value).map(scalar).filter(Boolean).join(', ');
  return String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').slice(0, 20000); // eslint-disable-line no-control-regex
};
const displayValue = (key, value, type) => {
  const text = scalar(value);
  if ((type === 'date' || /Date$/.test(key)) && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T12:00:00`);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return text;
};

const getTemplateCatalog = () => LETTER_DOCUMENT_TEMPLATES.map(item => {
  const info = manifest.find(entry => entry.file === item.file);
  return { ...item, name: info.interest, placeholders: info.placeholders.map(token => token.replace(/[{}]/g, '')) };
});

const buildDocumentValues = (letter, options = {}) => {
  const applicant = letter.applicant || {};
  const metadata = (letter.template || {}).values || {};
  const supplied = { ...(letter.autoFill || {}), ...(letter.form || {}) };
  const values = Object.fromEntries(Object.entries(supplied).map(([key, value]) => [key, displayValue(key, value, ((letter.templateFields || []).find(field => field.key === key) || {}).type)]));
  Object.assign(values, {
    applicantName: scalar(applicant.name || supplied.applicantName),
    applicantIdentifier: scalar(applicant.identifier || supplied.applicantIdentifier),
    applicantEmail: scalar(applicant.email || supplied.applicantEmail),
    applicantRole: scalar(applicant.applicantRole || supplied.applicantRole || 'Dosen'),
    faculty: scalar(applicant.faculty || supplied.faculty),
    studyProgram: scalar(applicant.program || supplied.studyProgram),
    letterNumber: scalar((letter.generated || {}).letterNumber || (options.preview ? 'DRAF - BELUM DITERBITKAN' : '')),
    letterDate: displayValue('letterDate', metadata.letterDate || new Date().toISOString().slice(0, 10)),
    letterPlace: scalar(metadata.letterPlace || process.env.LETTER_PLACE || ''),
    signerName: scalar(metadata.signerName || process.env.LETTER_SIGNER_NAME || ''),
    signerTitle: scalar(metadata.signerTitle || process.env.LETTER_SIGNER_TITLE || ''),
    customLetterTitle: scalar(letter.definitionName || letter.customName || (letter.template || {}).name || 'Surat Keterangan'),
  });
  if (!values.activityStartDate) values.activityStartDate = values.activityDate || '';
  if (!values.researchLocation) values.researchLocation = values.activityLocation || '';
  if (!values.activityName) values.activityName = values.eventName || '';
  if (!values.eventDatetime) values.eventDatetime = values.activityDate || '';
  if (metadata.customContent) values.customContent = scalar(metadata.customContent).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => scalar(values[key]));
  else if (!values.customContent) values.customContent = values.activityPurpose || '';
  return values;
};

const addCustomInformation = (document, fields, values, templateKeys) => {
  const extra = fields.filter(field => !templateKeys.has(field.key) && scalar(values[field.key]).trim());
  if (!extra.length) return;
  const body = document.getElementsByTagName('w:body')[0];
  const closing = Array.from(body.childNodes).find(node => node.nodeName === 'w:p' && /^(Demikian|Atas perhatian)\b/.test(textOf(node).trim()))
    || Array.from(body.childNodes).find(node => node.nodeType === 1 && textOf(node).includes('{{letterPlace}}'));
  const anchor = closing || document.getElementsByTagName('w:sectPr')[0];
  const lines = ['Informasi Tambahan', ...extra.map(field => `${field.label}: ${scalar(values[field.key])}`)];
  lines.forEach((line, index) => {
    const paragraph = document.createElementNS(ns, 'w:p');
    const properties = document.createElementNS(ns, 'w:pPr');
    const spacing = document.createElementNS(ns, 'w:spacing');
    spacing.setAttributeNS(ns, 'w:after', '100');
    properties.appendChild(spacing);
    paragraph.appendChild(properties);
    const run = document.createElementNS(ns, 'w:r');
    if (index === 0) {
      const format = document.createElementNS(ns, 'w:rPr');
      format.appendChild(document.createElementNS(ns, 'w:b'));
      run.appendChild(format);
    }
    const key = `__extraInfo${index}`;
    values[key] = scalar(line);
    const text = document.createElementNS(ns, 'w:t');
    text.appendChild(document.createTextNode(`{{${key}}}`));
    run.appendChild(text);
    paragraph.appendChild(run);
    body.insertBefore(paragraph, anchor || null);
  });
};

const keepSignatureTogether = document => {
  Array.from(document.getElementsByTagName('w:p')).filter(paragraph => /^(Demikian|Atas perhatian)\b/.test(textOf(paragraph).trim())).forEach(paragraph => {
    let properties = Array.from(paragraph.childNodes).find(node => node.nodeName === 'w:pPr');
    if (!properties) {
      properties = document.createElementNS(ns, 'w:pPr');
      paragraph.insertBefore(properties, paragraph.firstChild);
    }
    properties.appendChild(document.createElementNS(ns, 'w:keepNext'));
  });
  Array.from(document.getElementsByTagName('w:tr')).filter(row => textOf(row).includes('{{signerName}}')).forEach(row => {
    let properties = Array.from(row.childNodes).find(node => node.nodeName === 'w:trPr');
    if (!properties) {
      properties = document.createElementNS(ns, 'w:trPr');
      row.insertBefore(properties, row.firstChild);
    }
    properties.appendChild(document.createElementNS(ns, 'w:cantSplit'));
  });
};

const renderLetterDocx = (letter, options = {}) => {
  const template = resolveLetterDocumentTemplate(letter);
  const values = buildDocumentValues(letter, options);
  if (!options.preview) {
    const missing = ['letterNumber', 'letterPlace', 'signerName', 'signerTitle'].filter(key => !values[key].trim());
    if (missing.length) throw fail('Lengkapi nomor surat, tempat penerbitan, nama, dan jabatan penandatangan sebelum membuat PDF.');
  }
  const zip = new PizZip(fs.readFileSync(path.join(templatesRoot, template.file)));
  const xml = zip.file('word/document.xml').asText();
  const document = new DOMParser().parseFromString(xml, 'text/xml');
  const templateKeys = new Set(tokens(textOf(document)));
  tokens(((letter.template || {}).values || {}).customContent || '').forEach(key => templateKeys.add(key));
  // Optional, empty data rows are removed without changing the fixed Word layout.
  Array.from(document.getElementsByTagName('w:tr')).forEach(row => {
    const keys = tokens(textOf(row));
    if (keys.length && keys.every(key => !scalar(values[key]).trim())) row.parentNode.removeChild(row);
  });
  addCustomInformation(document, letter.templateFields || [], values, templateKeys);
  // Keep the date, title, signing space and signer on the same page.
  keepSignatureTogether(document);
  zip.file('word/document.xml', new XMLSerializer().serializeToString(document));
  const doc = new Docxtemplater(zip, {
    delimiters: { start: '{{', end: '}}' },
    paragraphLoop: true,
    linebreaks: true,
    parser: tag => ({ get: scope => (Object.prototype.hasOwnProperty.call(scope, tag.trim()) ? scope[tag.trim()] : '') }),
    nullGetter: () => '',
  });
  doc.render(values);
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};

const findLibreOffice = () => {
  if (process.env.LIBREOFFICE_PATH) return process.env.LIBREOFFICE_PATH;
  const windowsPath = path.join(process.env.ProgramFiles || 'C:/Program Files', 'LibreOffice/program/soffice.exe');
  const userPath = path.join(process.env.LOCALAPPDATA || os.homedir(), 'RIS/LibreOffice/program/soffice.exe');
  if (process.platform === 'win32') return [windowsPath, userPath].find(candidate => fs.existsSync(candidate)) || 'soffice';
  return 'soffice';
};

let conversions = 0;
const renderLetterPdf = async (letter, options = {}) => {
  if (conversions >= 2) throw fail('Konversi PDF sedang sibuk. Coba kembali sebentar lagi.', 503);
  conversions += 1;
  let temporary;
  try {
    const docx = renderLetterDocx(letter, options);
    temporary = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ris-letter-'));
    const input = path.join(temporary, 'surat.docx');
    await fs.promises.writeFile(input, docx);
    await execute(findLibreOffice(), [
      `-env:UserInstallation=${pathToFileURL(path.join(temporary, 'profile')).href}`,
      '--headless', '--convert-to', 'pdf:writer_pdf_Export', '--outdir', temporary, input,
    ], { timeout: 90000, windowsHide: true, maxBuffer: 1024 * 1024 });
    const pdf = await fs.promises.readFile(path.join(temporary, 'surat.pdf'));
    if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Invalid PDF conversion');
    return pdf;
  } catch (error) {
    if (error.status) throw error;
    if (error.code === 'ENOENT') throw fail('Konversi Word ke PDF belum tersedia. Pasang LibreOffice di server atau atur LIBREOFFICE_PATH.', 503);
    throw fail('Surat belum dapat dikonversi ke PDF. Periksa templat atau coba kembali.', 422);
  } finally {
    conversions -= 1;
    if (temporary) await fs.promises.rm(temporary, { recursive: true, force: true });
  }
};

module.exports = {
  getTemplateCatalog, buildDocumentValues, renderLetterDocx, renderLetterPdf, findLibreOffice
};
