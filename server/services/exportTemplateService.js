const fs = require('fs');
const path = require('path');

const templateRoot = path.join(__dirname, '..', 'templates', 'export');
const templates = {
  'researcher-profiles': 'Template_Profil_Peneliti.csv',
  'archive-users': 'Template_Arsip_Pengguna.csv',
  'archive-research': 'Template_Arsip_Penelitian.csv',
};

const parseCsvRow = line => {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else value += character;
  }
  values.push(value);
  return values;
};

const csvCell = value => {
  let text = value == null ? '' : String(value);
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const getCsvTemplate = templateId => {
  const name = templates[templateId];
  if (!name) return null;
  return fs.readFileSync(path.join(templateRoot, name), 'utf8').replace(/^\uFEFF/, '').trimEnd();
};

const renderCsv = (templateId, rows) => {
  const template = getCsvTemplate(templateId);
  if (!template) return null;
  const headers = parseCsvRow(template.split(/\r?\n/, 1)[0]);
  const allowed = new Set(headers);
  const contentRows = rows.map(row => {
    const unexpected = Object.keys(row).find(key => !allowed.has(key));
    if (unexpected) throw Object.assign(new Error('Kolom ekspor tidak sesuai dengan templat.'), { status: 400 });
    return headers.map(header => csvCell(row[header])).join(',');
  });
  return `\uFEFF${[headers.map(csvCell).join(','), ...contentRows].join('\r\n')}\r\n`;
};

module.exports = { getCsvTemplate, renderCsv };
