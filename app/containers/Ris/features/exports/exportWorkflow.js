export default async function downloadCsvFromTemplate(templateId, rows) {
  const response = await fetch('/api/exports/csv', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, rows }),
  });
  if (!response.ok) {
    let message = 'Ekspor CSV gagal dibuat.';
    try {
      const result = await response.json();
      message = result.message || message;
    } catch (error) {
      // The server may return a non-JSON error response.
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || `${templateId}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
