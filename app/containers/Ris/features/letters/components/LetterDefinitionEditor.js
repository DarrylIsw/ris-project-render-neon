/* eslint-disable object-curly-newline, react/prop-types */
import React from 'react';
import { Button, EmptyRow, Field } from '../../../shared/components/Ui';
import Icon from '../../../shared/components/Icon';
import LetterFormFields from './LetterFormFields';
import LetterDocumentSettings from './LetterDocumentSettings';
import LetterPdfPreview from './LetterPdfPreview';
import { uid } from '../../../core/data';
import { LETTER_FORM_FIELD_TYPES, LETTER_TYPES, createLetterFieldKey, getLetterPurposeOptions } from '../workflows/letterWorkflow';

export default function LetterDefinitionEditor({ value, onChange, master }) {
  const [tab, setTab] = React.useState('fields');
  const [preview, setPreview] = React.useState({});
  const patch = values => onChange({ ...value, ...values });
  const fieldPatch = (id, values) => patch({ fields: value.fields.map(field => (field.id === id ? { ...field, ...values } : field)) });
  const addField = () => patch({ fields: [...value.fields, { id: uid('letter-field'), key: createLetterFieldKey('isian', value.fields), label: '', type: 'text', required: false, options: [] }] });
  const move = (index, direction) => {
    const fields = [...value.fields];
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    [fields[index], fields[target]] = [fields[target], fields[index]];
    patch({ fields });
  };
  return <>
    {!master && <section className="ris-section-spaced">
      <Field label="Nama Jenis Surat" required><input value={value.name} onChange={event => patch({ name: event.target.value })} /></Field>
      <Field label="Deskripsi" alignStart><textarea rows="2" value={value.description} onChange={event => patch({ description: event.target.value })} /></Field>
      <Field label="Kategori"><select value={value.type} onChange={event => patch({ type: event.target.value, purpose: (getLetterPurposeOptions(event.target.value)[0] || {}).value || '', template: { ...value.template, sourceId: null } })}>{LETTER_TYPES.map(type => <option key={type.value} value={type.value}>{type.value === 'custom' ? 'Surat Kustom / Lainnya' : type.label}</option>)}</select></Field>
      {value.type !== 'custom' && <Field label="Subkategori"><select value={value.purpose} onChange={event => patch({ purpose: event.target.value, template: { ...value.template, sourceId: null } })}>{getLetterPurposeOptions(value.type).map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field>}
    </section>}
    <div className="ris-letter-editor-tabs" role="tablist" aria-label="Editor template surat">
      {[['fields', 'Isian Formulir'], ['preview', 'Pratinjau Dosen'], ['content', 'Templat dan PDF']].map(([key, label]) => <button key={key} id={`letter-editor-tab-${key}`} type="button" role="tab" aria-controls="letter-editor-panel" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}
    </div>
    <section id="letter-editor-panel" role="tabpanel" aria-labelledby={`letter-editor-tab-${tab}`}>
      {tab === 'fields' && <>
        <div className="ris-form-section-heading ris-letter-builder-heading"><h2>{master ? 'Isian Umum Master Template' : 'Isian Surat'}</h2><Button tone="blue" onClick={addField}><Icon name="plus" size={16} />Tambah Isian</Button></div>
        <div className="ris-table-wrap"><table className="ris-table ris-letter-fields-table"><thead><tr><th>No.</th><th>Nama Isian</th><th>Tipe Data</th><th>Wajib</th><th>Pengaturan</th><th>Aksi</th></tr></thead><tbody>
          {value.fields.map((field, index) => <tr key={field.id}>
            <td>{index + 1}.</td>
            <td><input aria-label={`Nama isian ${index + 1}`} value={field.label} onChange={event => fieldPatch(field.id, { label: event.target.value })} placeholder="Nama informasi" /></td>
            <td><select aria-label={`Tipe data isian ${index + 1}`} value={field.type} onChange={event => fieldPatch(field.id, { type: event.target.value })}>{LETTER_FORM_FIELD_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></td>
            <td><input aria-label={`Isian ${index + 1} wajib diisi`} type="checkbox" checked={Boolean(field.required)} onChange={event => fieldPatch(field.id, { required: event.target.checked })} /></td>
            <td><details open={field.type === 'select' ? true : undefined}><summary>Detail Isian {index + 1}</summary><div className="ris-letter-field-settings">
              <label htmlFor={`key-${field.id}`}>Variabel Templat</label><input id={`key-${field.id}`} value={field.key} onChange={event => fieldPatch(field.id, { key: event.target.value })} />
              <label htmlFor={`hint-${field.id}`}>Keterangan</label><input id={`hint-${field.id}`} value={field.helpText || ''} onChange={event => fieldPatch(field.id, { helpText: event.target.value })} />
              <label htmlFor={`placeholder-${field.id}`}>Contoh Isian</label><input id={`placeholder-${field.id}`} value={field.placeholder || ''} onChange={event => fieldPatch(field.id, { placeholder: event.target.value })} />
              {field.type === 'select' && <><label htmlFor={`options-${field.id}`}>Pilihan (satu per baris)</label><textarea id={`options-${field.id}`} rows="4" value={(field.options || []).map(option => option.label || option).join('\n')} onChange={event => fieldPatch(field.id, { options: event.target.value.split('\n') })} /></>}
            </div></details></td>
            <td><div className="ris-row-actions">
              <button type="button" className="ris-action gray" disabled={index === 0} title="Pindahkan ke atas" aria-label={`Pindahkan isian ${index + 1} ke atas`} onClick={() => move(index, -1)}><span className="ris-letter-move-up"><Icon name="chevron" size={16} /></span></button>
              <button type="button" className="ris-action gray" disabled={index === value.fields.length - 1} title="Pindahkan ke bawah" aria-label={`Pindahkan isian ${index + 1} ke bawah`} onClick={() => move(index, 1)}><Icon name="chevron" size={16} /></button>
              <button type="button" className="ris-action red" title="Hapus isian" aria-label={`Hapus isian ${index + 1}`} onClick={() => patch({ fields: value.fields.filter(item => item.id !== field.id) })}><Icon name="trash" size={16} /></button>
            </div></td>
          </tr>)}
          {!value.fields.length && <EmptyRow colSpan={6}>Belum ada isian.</EmptyRow>}
        </tbody></table></div>
      </>}
      {tab === 'preview' && <div className="ris-letter-form-preview"><h2>{value.name || 'Surat Baru'}</h2><div className="ris-letter-research-summary"><div><span>Nama Pemohon</span><strong>Nama Dosen</strong></div><div><span>Program Studi</span><strong>Program Studi Pemohon</strong></div></div><LetterFormFields fields={value.fields.map((field, index) => ({ ...field, label: field.label || `Isian ${index + 1}` }))} values={preview} onChange={(key, next) => setPreview(current => ({ ...current, [key]: next }))} /></div>}
      {tab === 'content' && <div className="ris-section-spaced">
        <LetterDocumentSettings value={value} onChange={template => patch({ template })} onAddFields={additions => patch({ fields: [...value.fields, ...additions.map(field => ({ ...field, id: uid('letter-field') }))] })} />
        <LetterPdfPreview payload={{ definition: value, values: preview }} />
      </div>}
    </section>
  </>;
}
