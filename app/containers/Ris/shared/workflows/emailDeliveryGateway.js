/* eslint-disable no-await-in-loop */
import { RIS_ENDPOINTS } from '../../core/constants';

const STATUS_CACHE_MS = 5 * 60 * 1000;
const BATCH_SIZE = 100;
let cachedStatus = null;
let cachedAt = 0;

const headersFor = user => ({
  'Content-Type': 'application/json',
  'x-user-id': user.id,
  'x-user-role': user.role || '',
});

const canUseApi = () => typeof window !== 'undefined' && typeof window.fetch === 'function';

const readStatus = async user => {
  if (!canUseApi() || !user || !user.id) return { active: false };
  if (cachedStatus && Date.now() - cachedAt < STATUS_CACHE_MS) return cachedStatus;
  try {
    const response = await window.fetch(RIS_ENDPOINTS.emailStatus, {
      method: 'GET',
      headers: headersFor(user),
      credentials: 'same-origin',
    });
    if (!response.ok) return { active: false };
    cachedStatus = await response.json();
    cachedAt = Date.now();
    return cachedStatus;
  } catch (error) {
    return { active: false };
  }
};

const batchesOf = records => {
  const batches = [];
  for (let index = 0; index < records.length; index += BATCH_SIZE) {
    batches.push(records.slice(index, index + BATCH_SIZE));
  }
  return batches;
};

export const syncOptionalEmailOutbox = async (records, user) => {
  if (!Array.isArray(records) || !records.length || !user) return { active: false, accepted: 0 };
  const status = await readStatus(user);
  if (!status.active) return { ...status, accepted: 0 };
  const pending = records.filter(record => record && ['queued', 'cancelled'].includes(record.status || 'queued'));
  if (!pending.length) return { ...status, accepted: 0 };

  try {
    let accepted = 0;
    let cancelled = 0;
    const batches = batchesOf(pending);
    for (let index = 0; index < batches.length; index += 1) {
      const response = await window.fetch(RIS_ENDPOINTS.emailOutbox, {
        method: 'POST',
        headers: headersFor(user),
        credentials: 'same-origin',
        body: JSON.stringify({ records: batches[index] }),
      });
      if (!response.ok) break;
      const result = await response.json();
      accepted += Number(result.accepted || 0);
      cancelled += Number(result.cancelled || 0);
    }
    return { ...status, accepted, cancelled };
  } catch (error) {
    return { ...status, accepted: 0, degraded: true };
  }
};

export const clearEmailDeliveryStatusCache = () => {
  cachedStatus = null;
  cachedAt = 0;
};
