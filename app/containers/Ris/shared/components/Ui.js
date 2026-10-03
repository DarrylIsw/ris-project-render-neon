/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React from 'react';
import PropTypes from 'prop-types';
import { useRis } from '../../core/RisContext';
import Icon from './Icon';

export function FloatingError({ message }) {
  const { showToast } = useRis();
  const activeRef = React.useRef(false);

  React.useEffect(() => {
    if (!message) {
      activeRef.current = false;
      return;
    }
    if (activeRef.current) return;
    activeRef.current = true;
    showToast({ tone: 'error', title: 'Terjadi kesalahan', message, duration: 7000 });
  }, [message, showToast]);

  return null;
}

FloatingError.propTypes = { message: PropTypes.string };
FloatingError.defaultProps = { message: '' };

export function PageHeader({ title, description, actions, onBack }) {
  return (
    <div className="ris-page-heading">
      <div className="ris-page-heading-main">
        {onBack && <PageBack onClick={onBack} />}
        <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
      </div>
      {actions && <div className="ris-heading-actions">{actions}</div>}
    </div>
  );
}

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  actions: PropTypes.node,
  onBack: PropTypes.func,
};
PageHeader.defaultProps = { description: '', actions: null, onBack: null };

export function StatusBadge({ children, tone }) {
  return <span className={`ris-badge ${tone}`}>{children}</span>;
}

StatusBadge.propTypes = { children: PropTypes.node.isRequired, tone: PropTypes.string };
StatusBadge.defaultProps = { tone: 'gray' };

export function Field({
  label, required, children, alignStart, controlId, error, hint
}) {
  const generatedId = React.useId();
  const inputId = controlId || `ris-field-${generatedId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const labelable = React.isValidElement(children)
    && ((typeof children.type === 'string' && ['input', 'select', 'textarea'].includes(children.type))
      || [YearSelect, AcademicYearSelect].includes(children.type));
  const describedBy = [hint ? hintId : '', error ? errorId : '', labelable && children.props['aria-describedby']].filter(Boolean).join(' ') || undefined;
  const control = labelable ? React.cloneElement(children, {
    id: children.props.id || inputId,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : children.props['aria-invalid'],
    'aria-required': required || undefined,
  }) : children;
  return (
    <div className={`ris-field ${alignStart ? 'ris-field-start' : ''}`}>
      <label htmlFor={labelable ? (children.props.id || inputId) : undefined}>{label}{required && <span className="ris-required" aria-hidden="true"> *</span>}</label>
      <div className="ris-field-control">
        {control}
        {hint && <small id={hintId} className="ris-field-hint">{hint}</small>}
        {error && <small id={errorId} className="ris-field-error" role="alert">{error}</small>}
      </div>
    </div>
  );
}

Field.propTypes = {
  label: PropTypes.string.isRequired, required: PropTypes.bool, children: PropTypes.node.isRequired, alignStart: PropTypes.bool, controlId: PropTypes.string, error: PropTypes.string, hint: PropTypes.string
};
Field.defaultProps = { required: false, alignStart: false, controlId: '', error: '', hint: '' };

export function Button({
  children, tone, pill, className, ...props
}) {
  const classes = ['ris-button', `ris-button-${tone}`, pill ? 'ris-pill' : '', className].filter(Boolean).join(' ');
  return <button type="button" className={classes} {...props}>{children}</button>;
}

Button.propTypes = {
  children: PropTypes.node.isRequired, tone: PropTypes.string, pill: PropTypes.bool, className: PropTypes.string
};
Button.defaultProps = { tone: 'green', pill: false, className: '' };

const buildYearOptions = (minimum, maximum) => Array.from(
  { length: Math.max(0, maximum - minimum + 1) },
  (_, index) => maximum - index
);

export function YearSelect({
  value, onChange, disabled, min, max, placeholder, ...props
}) {
  const years = buildYearOptions(min, max);
  return (
    <select value={value || ''} onChange={onChange} disabled={disabled} {...props}>
      <option value="">{placeholder}</option>
      {years.map(year => <option value={year} key={year}>{year}</option>)}
    </select>
  );
}

YearSelect.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), onChange: PropTypes.func.isRequired, disabled: PropTypes.bool, min: PropTypes.number, max: PropTypes.number, placeholder: PropTypes.string
};
YearSelect.defaultProps = {
  value: '', disabled: false, min: 2000, max: new Date().getFullYear() + 10, placeholder: 'Pilih tahun'
};

export function AcademicYearSelect({
  value, onChange, disabled, startOffset, endOffset, ...props
}) {
  const currentYear = new Date().getFullYear();
  const years = buildYearOptions(currentYear + startOffset, currentYear + endOffset);
  return (
    <select value={value || ''} onChange={onChange} disabled={disabled} {...props}>
      <option value="">Pilih tahun akademik</option>
      {years.map(year => {
        const academicYear = `${year}/${year + 1}`;
        return <option value={academicYear} key={academicYear}>{academicYear}</option>;
      })}
    </select>
  );
}

AcademicYearSelect.propTypes = {
  value: PropTypes.string, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool, startOffset: PropTypes.number, endOffset: PropTypes.number
};
AcademicYearSelect.defaultProps = { value: '', disabled: false, startOffset: -5, endOffset: 5 };

const monthFormatter = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const formatMonth = value => {
  if (!/^\d{4}-\d{2}$/.test(String(value || ''))) return '';
  const [year, month] = value.split('-').map(Number);
  return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
};

export const formatMonthRange = (start, end) => {
  const startLabel = formatMonth(start);
  const endLabel = formatMonth(end);
  if (!startLabel || !endLabel) return '';
  return `${startLabel} - ${endLabel}`;
};

export function MonthRangeInput({
  start, end, onChange, disabled
}) {
  const update = (key, value) => {
    const nextStart = key === 'start' ? value : start;
    const nextEnd = key === 'end' ? value : end;
    onChange({ start: nextStart, end: nextEnd, label: formatMonthRange(nextStart, nextEnd) });
  };
  return (
    <div className="ris-month-range">
      <div><span>Mulai</span><input type="month" value={start || ''} onChange={event => update('start', event.target.value)} disabled={disabled} aria-label="Bulan mulai" /></div>
      <span className="ris-month-range-separator" aria-hidden="true">sampai</span>
      <div><span>Selesai</span><input type="month" min={start || undefined} value={end || ''} onChange={event => update('end', event.target.value)} disabled={disabled} aria-label="Bulan selesai" /></div>
    </div>
  );
}

MonthRangeInput.propTypes = {
  start: PropTypes.string, end: PropTypes.string, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool
};
MonthRangeInput.defaultProps = { start: '', end: '', disabled: false };

export function PageBack({ onClick }) {
  return <button type="button" className="ris-back" onClick={onClick} aria-label="Kembali"><Icon name="back" /></button>;
}

PageBack.propTypes = { onClick: PropTypes.func.isRequired };

export function Modal({
  title, children, onClose, width, className, closeOnBackdrop
}) {
  const modalRef = React.useRef(null);
  const closeRef = React.useRef(onClose);
  const titleId = `ris-modal-${React.useId()}`;

  React.useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    const previousFocus = document.activeElement;
    const modal = modalRef.current;
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    const focusFirst = () => {
      const first = modal && modal.querySelector(focusableSelector);
      if (first) first.focus();
      else if (modal) modal.focus();
    };
    const frame = window.requestAnimationFrame(focusFirst);
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !modal) return;
      const focusable = [...modal.querySelectorAll(focusableSelector)];
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus && previousFocus.focus) previousFocus.focus();
    };
  }, []);

  return (
    <div className={`ris-modal-backdrop ${className ? `${className}-backdrop` : ''}`} role="presentation" onMouseDown={event => { if (closeOnBackdrop && event.target === event.currentTarget) onClose(); }}>
      <div ref={modalRef} className={`ris-modal ${className}`} style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex="-1">
        <div className="ris-modal-head"><h3 id={titleId}>{title}</h3><button type="button" onClick={onClose} aria-label="Tutup"><Icon name="close" /></button></div>
        {children}
      </div>
    </div>
  );
}

Modal.propTypes = {
  title: PropTypes.string.isRequired, children: PropTypes.node.isRequired, onClose: PropTypes.func.isRequired, width: PropTypes.number, className: PropTypes.string, closeOnBackdrop: PropTypes.bool
};
Modal.defaultProps = { width: 560, className: '', closeOnBackdrop: true };

export function FileDrop({
  file, accept, onFile, onPrepare, label, maxSize, onError, storagePurpose
}) {
  const ris = useRis();
  const inputRef = React.useRef(null);
  const [validationError, setValidationError] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const descriptionId = `ris-file-${React.useId()}`;
  const openPicker = () => {
    if (inputRef.current) inputRef.current.click();
  };
  const selectFile = async selected => {
    if (!selected) return;
    const allowedExtensions = String(accept || '').split(',').map(item => item.trim()).filter(item => item.startsWith('.'))
      .map(item => item.slice(1));
    const extension = String(selected.name || '').split('.').pop().toLowerCase();
    let message = '';
    if (allowedExtensions.length && !allowedExtensions.includes(extension)) message = `Format file .${extension || '-'} tidak diizinkan.`;
    else if (maxSize && Number(selected.size || 0) > maxSize) message = `Ukuran file maksimal ${(maxSize / 1048576).toFixed(1)} MB.`;
    setValidationError(message);
    if (message) {
      onError(message);
      if (ris && ris.showToast) ris.showToast({ tone: 'error', title: 'Upload gagal', message });
      return;
    }
    setUploading(true);
    try {
      const prepared = onPrepare ? await onPrepare(selected) : undefined;
      const response = await fetch('/api/files', {
        method: 'POST', credentials: 'same-origin',
        headers: {
          'Content-Type': selected.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(selected.name),
          'X-File-Purpose': storagePurpose,
        },
        body: selected,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unggah berkas gagal.');
      Object.defineProperties(selected, {
        risFileUrl: { value: result.fileUrl },
        risFileId: { value: result.id },
      });
      onFile(selected, prepared);
    } catch (uploadError) {
      setValidationError(uploadError.message);
      onError(uploadError.message);
      if (ris && ris.showToast) ris.showToast({ tone: 'error', title: 'Unggah gagal', message: uploadError.message });
    } finally {
      setUploading(false);
    }
  };
  const handleDrop = event => {
    event.preventDefault();
    selectFile(event.dataTransfer.files[0]);
  };
  const handleKeyDown = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };
  return (
    <div>
      <div className="ris-file-drop" role="button" tabIndex={0} aria-label={label} aria-describedby={descriptionId} onClick={openPicker} onKeyDown={handleKeyDown} onDragOver={event => event.preventDefault()} onDrop={handleDrop}>
        <strong>{uploading ? 'Mengunggah...' : label}</strong><span id={descriptionId}>Tarik dan letakkan file di sini</span>
        <input ref={inputRef} type="file" accept={accept} hidden aria-label={label} onChange={event => { selectFile(event.target.files[0]); if (inputRef.current) inputRef.current.value = ''; }} />
      </div>
      {validationError && <small className="ris-field-error" role="alert">{validationError}</small>}
      {file && <div className="ris-file-meta"><span>Nama File</span><b>{file.name}</b></div>}
      {file && <div className="ris-file-meta"><span>Ukuran File</span><b>{`${(file.size / 1048576).toFixed(1)} MB`}</b></div>}
    </div>
  );
}

FileDrop.propTypes = {
  file: PropTypes.object, accept: PropTypes.string, onFile: PropTypes.func.isRequired, onPrepare: PropTypes.func, label: PropTypes.string, maxSize: PropTypes.number, onError: PropTypes.func, storagePurpose: PropTypes.string
};
FileDrop.defaultProps = { file: null, accept: '', label: 'Pilih file atau tarik ke area ini', maxSize: 0, onError: () => {}, onPrepare: null, storagePurpose: 'misc' };

export function EmptyRow({ colSpan, children }) {
  return <tr><td className="ris-empty" colSpan={colSpan}>{children}</td></tr>;
}

EmptyRow.propTypes = { colSpan: PropTypes.number.isRequired, children: PropTypes.node.isRequired };
