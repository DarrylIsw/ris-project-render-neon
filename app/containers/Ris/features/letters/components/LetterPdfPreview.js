/* eslint-disable react/prop-types */
import React from 'react';
import { Button, FloatingError } from '../../../shared/components/Ui';
import Icon from '../../../shared/components/Icon';
import { letterDocumentGateway } from '../../../core/dataGateway';

export default function LetterPdfPreview({ payload, sourceUrl, title = 'Pratinjau Surat' }) {
  const [url, setUrl] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  const payloadRef = React.useRef(payload);
  const [rendered, setRendered] = React.useState('');
  payloadRef.current = payload;
  const signature = JSON.stringify(payload);
  const initialId = payload && (payload.letterId || (payload.definition || {}).id);

  React.useEffect(() => {
    if (sourceUrl) return undefined;
    let active = true;
    let objectUrl;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const requested = JSON.stringify(payloadRef.current);
    letterDocumentGateway.preview(payloadRef.current, controller.signal).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      setRendered(requested);
    }).catch(value => { if (active && value.name !== 'AbortError') setError(value.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [version, initialId, sourceUrl]);

  const displayed = sourceUrl || url;
  return <section className="ris-letter-pdf-preview">
    <div className="ris-form-section-heading ris-letter-builder-heading"><h2>{title}</h2><div className="ris-row-actions">
      {!sourceUrl && <Button tone="blue" disabled={loading} onClick={() => setVersion(current => current + 1)}><Icon name="document" size={16} />{loading ? 'Memuat PDF...' : 'Perbarui Pratinjau'}</Button>}
      {displayed && !loading && <a className="ris-button ris-button-gray" href={displayed} target="_blank" rel="noopener noreferrer">Buka PDF</a>}
    </div></div>
    <FloatingError message={error} />
    {!sourceUrl && rendered && rendered !== signature && <div className="ris-alert ris-alert-info">Data telah berubah. Perbarui pratinjau untuk melihat isi terbaru.</div>}
    {loading && <div className="ris-empty-state" role="status">Menyiapkan pratinjau dokumen...</div>}
    {displayed && !loading && <iframe className="ris-letter-pdf-frame" title={title} src={`${displayed}#view=FitH`} />}
  </section>;
}
