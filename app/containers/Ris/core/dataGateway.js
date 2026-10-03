import { createInitialData, normalizeRisData } from './data';

export const STORAGE_KEYS = {
  data: 'ris-prototype-data-v3',
  session: 'ris-prototype-session-v1',
};

const LEGACY_DATA_KEYS = [
  'ris-react-module-four-data-v2',
  'ris-react-module-one-data-v1',
  'ris-react-module-two-data-v1',
  'ris-react-module-three-data-v1',
  'ris-react-module-four-data-v1',
];

const LEGACY_SESSION_KEYS = [
  'ris-react-session-v5',
  'ris-react-session',
  'ris-react-session-v1',
  'ris-react-session-v2',
  'ris-react-session-v3',
  'ris-react-session-v4',
];

const browserStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch (error) {
    return null;
  }
};

const parseStoredValue = value => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

export const createLocalDataGateway = (storage = browserStorage()) => {
  const read = key => {
    try {
      return storage ? parseStoredValue(storage.getItem(key)) : null;
    } catch (error) {
      return null;
    }
  };

  const write = (key, value) => {
    try {
      if (storage) storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  };

  const remove = key => {
    try {
      if (storage) storage.removeItem(key);
    } catch (error) {
      // Storage can be disabled or full; the application still works in memory.
    }
  };

  const readFirst = keys => keys.reduce((found, key) => found || read(key), null);
  const removeMany = keys => keys.forEach(remove);

  const loadData = () => {
    const stored = read(STORAGE_KEYS.data) || readFirst(LEGACY_DATA_KEYS);
    const normalized = normalizeRisData(stored || createInitialData());
    write(STORAGE_KEYS.data, normalized);
    removeMany(LEGACY_DATA_KEYS);
    return normalized;
  };

  const saveData = value => {
    const normalized = normalizeRisData(value || createInitialData());
    write(STORAGE_KEYS.data, normalized);
    return normalized;
  };

  const resetData = () => saveData(createInitialData());

  const loadSession = () => {
    const session = read(STORAGE_KEYS.session) || readFirst(LEGACY_SESSION_KEYS);
    if (session) write(STORAGE_KEYS.session, session);
    removeMany(LEGACY_SESSION_KEYS);
    return session;
  };

  const saveSession = session => {
    write(STORAGE_KEYS.session, session);
    return session;
  };

  const clearSession = () => {
    remove(STORAGE_KEYS.session);
    removeMany(LEGACY_SESSION_KEYS);
  };

  return {
    kind: 'prototype-local',
    loadData,
    saveData,
    resetData,
    loadSession,
    saveSession,
    clearSession,
  };
};

export const prototypeDataGateway = createLocalDataGateway();

const request = async (path, options = {}) => {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error((body && body.message) || 'Koneksi ke server gagal.');
    error.status = response.status;
    error.code = body && body.code;
    throw error;
  }
  return body;
};

export const serverDataGateway = {
  kind: 'postgresql',
  session: () => request('/api/auth/session'),
  login: (email, password, remember, code) => request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email, password, remember, ...(code ? { code } : {})
    }),
  }),
  changePassword: credentials => request('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  loadData: () => request('/api/ris/state'),
  saveData: (data, version) => request('/api/ris/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, version }),
  }),
};

export const uploadLocalFile = (file, storagePurpose = 'reports') => request('/api/files', {
  method: 'POST',
  headers: {
    'Content-Type': file.type || 'application/octet-stream',
    'X-File-Name': encodeURIComponent(file.name),
    'X-File-Purpose': storagePurpose,
  },
  body: file,
});

export const letterDocumentGateway = {
  templates: () => request('/api/letters/templates'),
  generate: id => request(`/api/letters/${encodeURIComponent(id)}/generate-pdf`, { method: 'POST' }),
  publish: (id, fileId, notes) => request(`/api/letters/${encodeURIComponent(id)}/publish-signed`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId, notes }),
  }),
  preview: async (body, signal) => {
    const response = await fetch('/api/letters/preview', {
      method: 'POST',
      credentials: 'same-origin',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Pratinjau PDF gagal dimuat.');
    }
    return response.blob();
  },
};

export const letterRequestGateway = {
  submit: payload => request('/api/letters/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),
};

export const letterPdfUrl = (letter, inline = false) => `/api/letters/${encodeURIComponent(letter.id)}/pdf${inline ? '?inline=1' : ''}`;
