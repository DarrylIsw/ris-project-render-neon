/* eslint-disable react/prop-types, object-curly-newline */
import React from 'react';
import { Button, Field, FloatingError } from '../../../shared/components/Ui';
import { letterDocumentGateway } from '../../../core/dataGateway';
import { resolveLetterDocumentTemplate } from '../../../../../../shared/letterDocumentTemplates';
import { getLetterFieldLabel } from '../workflows/letterWorkflow';

const systemKeys = new Set(['applicantName', 'applicantIdentifier', 'applicantEmail', 'applicantRole', 'studyProgram', 'faculty', 'letterNumber', 'letterDate', 'letterPlace', 'signerName', 'signerTitle', 'customLetterTitle']);

export default function LetterDocumentSettings({ value, onChange, onAddFields }) {
  const [catalog, setCatalog] = React.useState([]);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    letterDocumentGateway.templates().then(result => { if (active) setCatalog(result.templates); })
      .catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, []);
  const template = value.template || {};
  const metadata = template.values || {};
  let sourceId;
  try { sourceId = resolveLetterDocumentTemplate(value).id; } catch (reason) { sourceId = ''; }
  const selected = catalog.find(item => item.id === sourceId);
  const update = patch => onChange({ ...template, ...patch });
  const fields = value.fields || value.templateFields || [];
  const missing = selected ? selected.placeholders.filter(key => !systemKeys.has(key) && !fields.some(field => field.key === key)) : [];
  return <div className="ris-letter-document-settings">
    <FloatingError message={error} />
    <Field label="Templat Word"><select value={sourceId} onChange={event => update({ sourceId: event.target.value })} disabled={!catalog.length}>
      {!catalog.length && <option value={sourceId}>Memuat templat...</option>}
      {catalog.map(item => <option key={item.id} value={item.id}>{item.id} - {item.name}</option>)}
    </select></Field>
    <div className="ris-letter-builder-grid">
      {[['letterPlace', 'Tempat Penerbitan', 'text'], ['letterDate', 'Tanggal Surat', 'date'], ['signerName', 'Nama Penandatangan', 'text'], ['signerTitle', 'Jabatan Penandatangan', 'text']].map(([key, label, type]) => <Field label={label} key={key} required={key !== 'letterDate'}><input type={type} value={metadata[key] || ''} onChange={event => update({ values: { ...metadata, [key]: event.target.value } })} /></Field>)}
    </div>
    {sourceId === 'E01' && <Field label="Isi Surat Kustom" alignStart><textarea rows="6" value={metadata.customContent || ''} onChange={event => update({ values: { ...metadata, customContent: event.target.value } })} /></Field>}
    {onAddFields && missing.length > 0 && <Button tone="blue" onClick={() => onAddFields(missing.map(key => ({ key, label: getLetterFieldLabel(key), type: /Date$/.test(key) ? 'date' : (/Year$/.test(key) ? 'number' : (/Content|Purpose|Team|Schedule/.test(key) ? 'textarea' : 'text')), required: false, options: [] })))}>Tambahkan Isian Templat</Button>}
  </div>;
}
