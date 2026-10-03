import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { uploadLocalFile } from '../core/dataGateway';

export function LogbookEvidenceLinks({ entry }) {
  const files = entry.evidenceFiles || [];
  if (files.length) return <div className="ris-logbook-evidence-links">{files.map(file => <a key={file.id} href={file.fileUrl} target="_blank" rel="noopener noreferrer">{file.name}</a>)}</div>;
  return entry.fileCount ? <span>{entry.fileCount} berkas lama</span> : <span>-</span>;
}

LogbookEvidenceLinks.propTypes = { entry: PropTypes.object.isRequired };

export default function LogbookEvidenceField({
  files, onChange, onBusy, onError
}) {
  const [uploading, setUploading] = useState(false);
  const selectFiles = async event => {
    const input = event.target;
    const selected = Array.from(input.files || []);
    input.value = '';
    if (!selected.length) return;
    setUploading(true);
    onBusy(true);
    onError('');
    const added = [];
    try {
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        if (file.size > 20 * 1048576) throw new Error(`Ukuran ${file.name} melebihi 20 MB.`);
        const result = await uploadLocalFile(file, 'reports'); // eslint-disable-line no-await-in-loop
        added.push({
          id: result.id,
          storedFileId: result.id,
          fileUrl: result.fileUrl,
          name: file.name,
          size: file.size,
          type: file.type,
        });
      }
    } catch (error) {
      onError(error.message || 'Bukti kegiatan gagal diunggah.');
    } finally {
      if (added.length) onChange([...files, ...added]);
      setUploading(false);
      onBusy(false);
    }
  };

  return <div className="ris-logbook-evidence-field">
    <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" disabled={uploading} onChange={selectFiles} />
    {uploading && <span role="status">Mengunggah bukti...</span>}
    {files.length > 0 && <ul>{files.map(file => <li key={file.id}><a href={file.fileUrl} target="_blank" rel="noopener noreferrer">{file.name}</a><button type="button" disabled={uploading} onClick={() => onChange(files.filter(item => item.id !== file.id))} aria-label={`Hapus ${file.name} dari catatan`}>Hapus</button></li>)}</ul>}
  </div>;
}

LogbookEvidenceField.propTypes = {
  files: PropTypes.array,
  onChange: PropTypes.func.isRequired,
  onBusy: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
};
LogbookEvidenceField.defaultProps = { files: [] };
