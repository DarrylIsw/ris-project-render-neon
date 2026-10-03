/* eslint-disable object-curly-newline, react/prop-types */
import React from 'react';
import { Field } from '../../../shared/components/Ui';

export default function LetterFormFields({ fields, values, onChange }) {
  return <>{fields.map(field => {
    const common = { value: values[field.key] === undefined ? '' : values[field.key], onChange: event => onChange(field.key, event.target.value), placeholder: field.placeholder || '' };
    let control;
    if (field.type === 'textarea') control = <textarea {...common} rows="4" />;
    else if (field.type === 'select') control = <select {...common}><option value="">Pilih</option>{(field.options || []).map(option => <option key={String(option.value || option)} value={option.value || option}>{option.label || option}</option>)}</select>;
    else control = <input {...common} type={field.type || 'text'} step={field.type === 'number' ? 'any' : undefined} />;
    return <Field key={field.key} label={field.label} required={field.required} hint={field.helpText || ''} alignStart={field.type === 'textarea'}>{control}</Field>;
  })}</>;
}
