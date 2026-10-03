/* eslint-disable object-curly-newline, object-property-newline, react/prop-types */
import React from 'react';
import PropTypes from 'prop-types';
import { Field, YearSelect } from '../../../shared/components/Ui';
import {
  BOOK_TYPE_OPTIONS,
  EXPECTED_OUTPUT_FORM_OPTIONS,
  HKI_TYPE_OPTIONS,
  JOURNAL_LEVEL_OPTIONS,
  OUTPUT_CATEGORY_OPTIONS,
  PROCEEDING_TYPE_OPTIONS,
  PUBLICATION_TYPE_OPTIONS,
} from '../workflows/schemeConfiguration';

const SelectOptions = ({ options }) => options.map(item => <option key={item.value} value={item.value}>{item.label}</option>);

export default function OutputDefinitionFields({
  definition, onChange, locked, includeName, includeDescription
}) {
  const update = (key, value) => onChange({ ...definition, [key]: value });
  return (
    <div className="ris-output-definition-fields">
      {includeName && <Field label="Nama Pilihan Luaran" required><input disabled={locked} value={definition.name || ''} onChange={event => update('name', event.target.value)} placeholder="Contoh: Artikel Jurnal Scopus Q2" /></Field>}
      <Field label="Kategori" required><select disabled={locked} value={definition.category || ''} onChange={event => update('category', event.target.value)}><option value="">-- Pilih Kategori --</option><SelectOptions options={OUTPUT_CATEGORY_OPTIONS} /></select></Field>
      {definition.category === 'jurnal' && <React.Fragment>
        <Field label="Target Level Jurnal" required><select disabled={locked} value={definition.journalTargetLevel || ''} onChange={event => update('journalTargetLevel', event.target.value)}><option value="">-- Pilih --</option><SelectOptions options={JOURNAL_LEVEL_OPTIONS} /></select></Field>
        <Field label="Target Indeks Jurnal" required><input disabled={locked} value={definition.journalIndexTarget || ''} onChange={event => update('journalIndexTarget', event.target.value)} placeholder="Contoh: SINTA 2 atau Scopus Q1" /></Field>
        <Field label="Jenis Publikasi" required><select disabled={locked} value={definition.publicationType || ''} onChange={event => update('publicationType', event.target.value)}><option value="">-- Pilih --</option><SelectOptions options={PUBLICATION_TYPE_OPTIONS} /></select></Field>
        {definition.publicationType === 'internasional' && <Field label="Kuartil" required><select disabled={locked} value={definition.targetQuartile || ''} onChange={event => update('targetQuartile', event.target.value)}><option value="">-- Pilih --</option>{['Q1', 'Q2', 'Q3', 'Q4'].map(item => <option key={item} value={item}>{item}</option>)}</select></Field>}
      </React.Fragment>}
      {definition.category === 'prosiding' && <React.Fragment>
        <Field label="Jenis Prosiding" required><select disabled={locked} value={definition.proceedingType || ''} onChange={event => update('proceedingType', event.target.value)}><option value="">-- Pilih --</option><SelectOptions options={PROCEEDING_TYPE_OPTIONS} /></select></Field>
        <Field label="Target Indeks" required><input disabled={locked} value={definition.indexTarget || ''} onChange={event => update('indexTarget', event.target.value)} placeholder="Contoh: Scopus atau IEEE Xplore" /></Field>
      </React.Fragment>}
      {definition.category === 'buku' && <React.Fragment>
        <Field label="Jenis Buku" required><select disabled={locked} value={definition.bookType || ''} onChange={event => update('bookType', event.target.value)}><option value="">-- Pilih --</option><SelectOptions options={BOOK_TYPE_OPTIONS} /></select></Field>
        <Field label="Target Penerbit" required><input disabled={locked} value={definition.publisherTarget || ''} onChange={event => update('publisherTarget', event.target.value)} placeholder="Contoh: Springer atau penerbit nasional" /></Field>
        <Field label="Rencana ISBN"><input disabled={locked} value={definition.isbnPlan || ''} onChange={event => update('isbnPlan', event.target.value)} placeholder="Opsional" /></Field>
      </React.Fragment>}
      {definition.category === 'hki' && <React.Fragment>
        <Field label="Jenis HKI" required><select disabled={locked} value={definition.hkiType || ''} onChange={event => update('hkiType', event.target.value)}><option value="">-- Pilih --</option><SelectOptions options={HKI_TYPE_OPTIONS} /></select></Field>
        <Field label="Target Tahun Pendaftaran" required><YearSelect disabled={locked} value={definition.targetRegistrationYear || ''} onChange={event => update('targetRegistrationYear', event.target.value)} /></Field>
      </React.Fragment>}
      {definition.category === 'produk_prototipe' && <React.Fragment>
        <Field label="Jenis Produk" required><input disabled={locked} value={definition.productType || ''} onChange={event => update('productType', event.target.value)} placeholder="Contoh: Aplikasi atau alat kesehatan" /></Field>
        <Field label="Target TKT" required><select disabled={locked} value={definition.targetTkt || ''} onChange={event => update('targetTkt', event.target.value)}><option value="">-- Pilih --</option><option value="none">None</option>{Array.from({ length: 9 }, (_, index) => index + 1).map(item => <option key={item} value={item}>TKT {item}</option>)}</select></Field>
        <Field label="Bentuk Output" required><select disabled={locked} value={definition.expectedOutputForm || ''} onChange={event => update('expectedOutputForm', event.target.value)}><option value="">-- Pilih --</option><SelectOptions options={EXPECTED_OUTPUT_FORM_OPTIONS} /></select></Field>
      </React.Fragment>}
      {definition.category === 'other' && <Field label="Jenis Luaran Lainnya" required><input disabled={locked} value={definition.otherOutputType || ''} onChange={event => update('otherOutputType', event.target.value)} placeholder="Tuliskan jenis luaran" /></Field>}
      {includeDescription && <div className="ris-output-description-field"><Field label="Deskripsi" required alignStart><textarea rows="3" value={definition.description || ''} onChange={event => update('description', event.target.value)} placeholder="Jelaskan target dan karakteristik luaran..." /></Field></div>}
    </div>
  );
}

SelectOptions.propTypes = { options: PropTypes.array.isRequired };
OutputDefinitionFields.propTypes = {
  definition: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  locked: PropTypes.bool,
  includeName: PropTypes.bool,
  includeDescription: PropTypes.bool,
};
OutputDefinitionFields.defaultProps = {
  locked: false,
  includeName: false,
  includeDescription: true,
};
