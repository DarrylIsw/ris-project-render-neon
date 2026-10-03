/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState
} from 'react';
import PropTypes from 'prop-types';
import { serverDataGateway } from './dataGateway';
import { appendWorkflowNotifications, inferMutationToast } from '../shared/workflows/notificationWorkflow';
import { MANAGER_MODE, ROLE, normalizeRole } from '../shared/workflows/workflow';
import {
  getStoredUiLocale, normalizeUiLocale, persistUiLocale, UI_LOCALE
} from '../shared/i18n/uiLanguage';

const MODE_KEY = 'ris-manager-mode';
const isDataConflict = error => Boolean(error && (error.code === 'DATA_CONFLICT' || error.status === 409));

const normalizeManagerMode = (account, requestedMode) => {
  if (normalizeRole(account && account.role) !== ROLE.MANAGER) return null;
  return requestedMode === MANAGER_MODE.LECTURER ? MANAGER_MODE.LECTURER : MANAGER_MODE.MANAGEMENT;
};

const storedMode = () => {
  try { return window.sessionStorage.getItem(MODE_KEY); } catch (error) { return null; }
};

const RisContext = createContext(null);

export function RisProvider({ children }) {
  const [data, setDataState] = useState(null);
  const [user, setUserState] = useState(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [toasts, setToasts] = useState([]);
  const toastTimersRef = useRef(new Map());
  const toastSignatureIdsRef = useRef(new Map());
  const toastIdSignaturesRef = useRef(new Map());
  const previousDataRef = useRef(null);
  const dataRef = useRef(null);
  const versionRef = useRef(0);
  const queueRef = useRef(Promise.resolve());
  const queueGenerationRef = useRef(0);
  const suppressToastRef = useRef(false);
  const serverMutationRef = useRef(false);

  useEffect(() => {
    let active = true;
    const boot = async () => {
      try {
        const session = await serverDataGateway.session();
        if (!active) return;
        if (session.user) {
          const loaded = await serverDataGateway.loadData();
          if (!active) return;
          versionRef.current = loaded.version;
          dataRef.current = loaded.data;
          suppressToastRef.current = true;
          setDataState(loaded.data);
          setUserState({ ...session.user, uiLocale: getStoredUiLocale(session.user.id, session.user.uiLocale), managerMode: normalizeManagerMode(session.user, storedMode()) });
        }
      } catch (error) {
        if (active) setLoadError(error.message || 'Server tidak dapat dihubungi.');
      } finally {
        if (active) setReady(true);
      }
    };
    boot();
    return () => { active = false; };
  }, []);

  const dismissToast = useCallback(id => {
    const timer = toastTimersRef.current.get(id);
    if (timer) clearTimeout(timer);
    const signature = toastIdSignaturesRef.current.get(id);
    if (signature && toastSignatureIdsRef.current.get(signature) === id) toastSignatureIdsRef.current.delete(signature);
    toastIdSignaturesRef.current.delete(id);
    const removalTimer = setTimeout(() => {
      setToasts(current => current.filter(toast => toast.id !== id));
      toastTimersRef.current.delete(id);
    }, 180);
    toastTimersRef.current.set(id, removalTimer);
    setToasts(current => current.map(toast => (toast.id === id ? { ...toast, exiting: true } : toast)));
  }, []);

  const showToast = useCallback(toast => {
    const tone = toast.tone || 'info';
    const title = toast.title || 'Pemberitahuan';
    const message = toast.message || '';
    const signature = JSON.stringify([tone, title, message]);
    const existingId = toastSignatureIdsRef.current.get(signature);
    if (existingId) return existingId;
    const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nextToast = {
      id,
      tone,
      title,
      message,
      exiting: false,
    };
    toastSignatureIdsRef.current.set(signature, id);
    toastIdSignaturesRef.current.set(id, signature);
    setToasts(current => [...current.slice(-2), nextToast]);
    const timer = setTimeout(() => dismissToast(id), toast.duration || (nextToast.tone === 'error' ? 7000 : 4500));
    toastTimersRef.current.set(id, timer);
    return id;
  }, [dismissToast]);

  useEffect(() => () => {
    toastTimersRef.current.forEach(timer => clearTimeout(timer));
    toastTimersRef.current.clear();
    toastSignatureIdsRef.current.clear();
    toastIdSignaturesRef.current.clear();
  }, []);

  useEffect(() => {
    if (loadError) showToast({ tone: 'error', title: 'Terjadi gangguan pada server', message: loadError, duration: 7000 });
  }, [loadError, showToast]);

  useEffect(() => {
    const previous = previousDataRef.current;
    previousDataRef.current = data;
    if (suppressToastRef.current) {
      suppressToastRef.current = false;
      return;
    }
    if (!user || !previous || previous === data) return;
    const toast = inferMutationToast(previous, data, user);
    if (toast) showToast(toast);
  }, [data, showToast, user]);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = user ? normalizeUiLocale(user.uiLocale) : UI_LOCALE.ID;
  }, [user]);

  const setData = (updater, options = {}) => {
    if (serverMutationRef.current) {
      const error = new Error('Tunggu proses dokumen selesai sebelum mengubah data.');
      showToast({ title: 'Proses sedang berjalan', message: error.message });
      return Promise.resolve({ ok: false, error });
    }
    const current = dataRef.current;
    if (!current || !user) return Promise.resolve({ ok: false, error: new Error('Sesi belum siap. Muat ulang halaman.') });
    const optimistic = options.optimistic !== false;
    const applyUpdate = source => appendWorkflowNotifications(source, typeof updater === 'function' ? updater(source) : updater, user);
    const enriched = optimistic ? applyUpdate(current) : null;
    if (optimistic) {
      dataRef.current = enriched;
      setDataState(enriched);
    }
    const generation = queueGenerationRef.current;
    queueRef.current = queueRef.current.then(async () => {
      if (generation !== queueGenerationRef.current) return { ok: false, error: new Error('Data telah berubah. Coba simpan kembali.') };
      const source = optimistic ? current : dataRef.current;
      let payload = optimistic ? enriched : applyUpdate(source);
      let saved;
      try {
        saved = await serverDataGateway.saveData(payload, versionRef.current);
      } catch (error) {
        // Replaying functional updates once avoids rejecting a valid user action after a concurrent state change.
        if (!isDataConflict(error) || typeof updater !== 'function') throw error;
        const refreshed = await serverDataGateway.loadData();
        versionRef.current = refreshed.version;
        payload = applyUpdate(refreshed.data);
        saved = await serverDataGateway.saveData(payload, versionRef.current);
      }
      versionRef.current = saved.version;
      if (dataRef.current === enriched || dataRef.current === payload || (!optimistic && dataRef.current === source)) {
        dataRef.current = saved.data;
        suppressToastRef.current = true;
        setDataState(saved.data);
      }
      return { ok: true };
    }).catch(async error => {
      if (generation !== queueGenerationRef.current) return { ok: false, error };
      queueGenerationRef.current += 1;
      showToast({ tone: 'error', title: 'Data belum tersimpan', message: error.message });
      try {
        const refreshed = await serverDataGateway.loadData();
        versionRef.current = refreshed.version;
        dataRef.current = refreshed.data;
        suppressToastRef.current = true;
        setDataState(refreshed.data);
      } catch (reloadError) {
        setLoadError(reloadError.message || 'Server tidak dapat dihubungi.');
      }
      return { ok: false, error };
    });
    return queueRef.current;
  };

  const runServerMutation = async action => {
    if (serverMutationRef.current) throw new Error('Proses lain sedang berjalan.');
    serverMutationRef.current = true;
    const pending = queueRef.current;
    const generation = queueGenerationRef.current;
    const operation = (async () => {
      try {
        await pending;
        if (generation !== queueGenerationRef.current) throw new Error('Perubahan sebelumnya gagal disimpan. Periksa data lalu coba kembali.');
        const saved = await action();
        versionRef.current = saved.version;
        dataRef.current = saved.data;
        suppressToastRef.current = true;
        setDataState(saved.data);
        return saved;
      } catch (error) {
        try {
          const loaded = await serverDataGateway.loadData();
          versionRef.current = loaded.version;
          dataRef.current = loaded.data;
          suppressToastRef.current = true;
          setDataState(loaded.data);
        } catch (reloadError) { /* Keep the original operation error available to the caller. */ }
        throw error;
      } finally {
        serverMutationRef.current = false;
      }
    })();
    queueRef.current = operation.catch(() => {});
    return operation;
  };

  const markNotificationRead = notificationId => {
    if (!notificationId) return;
    setData(current => ({
      ...current,
      notifications: (current.notifications || []).map(notification => ([notification.id, notification.notificationId].includes(notificationId) ? { ...notification, isRead: true, readAt: new Date().toISOString() } : notification)),
      notificationReadIds: [...new Set([...(current.notificationReadIds || []), notificationId])],
    }));
  };

  const markNotificationsRead = notificationIds => {
    const ids = [...new Set((notificationIds || []).filter(Boolean))];
    if (!ids.length) return;
    setData(current => ({
      ...current,
      notifications: (current.notifications || []).map(notification => (ids.some(id => [notification.id, notification.notificationId].includes(id)) ? { ...notification, isRead: true, readAt: new Date().toISOString() } : notification)),
      notificationReadIds: [...new Set([...(current.notificationReadIds || []), ...ids])],
    }));
  };

  const login = async (email, password, remember, code) => {
    try {
      const session = await serverDataGateway.login(email, password, remember, code);
      if (session.requiresMfa) return session;
      const loaded = await serverDataGateway.loadData();
      versionRef.current = loaded.version;
      dataRef.current = loaded.data;
      suppressToastRef.current = true;
      setDataState(loaded.data);
      setUserState({ ...session.user, uiLocale: getStoredUiLocale(session.user.id, session.user.uiLocale), managerMode: normalizeManagerMode(session.user, MANAGER_MODE.MANAGEMENT) });
      return true;
    } catch (error) {
      if (error.status === 401) return false;
      throw error;
    }
  };

  const logout = async () => {
    await queueRef.current;
    try { await serverDataGateway.logout(); } catch (error) { /* Session may already have expired. */ }
    setUserState(null);
    setDataState(null);
    dataRef.current = null;
  };

  const setManagerMode = managerMode => {
    if (!user || normalizeRole(user.role) !== ROLE.MANAGER) return;
    const next = { ...user, managerMode: normalizeManagerMode(user, managerMode) };
    try { window.sessionStorage.setItem(MODE_KEY, next.managerMode); } catch (error) { /* UI preference only. */ }
    setUserState(next);
  };

  const setUiLocale = requestedLocale => {
    const uiLocale = normalizeUiLocale(requestedLocale);
    if (!user || user.uiLocale === uiLocale) return;
    persistUiLocale(user.id, uiLocale);
    setUserState(current => ({ ...current, uiLocale }));
    if (typeof document !== 'undefined') document.documentElement.lang = uiLocale;
  };

  const value = useMemo(() => ({
    data, setData, runServerMutation, user, login, logout, changePassword: credentials => serverDataGateway.changePassword(credentials), setManagerMode, setUiLocale, dataGatewayKind: serverDataGateway.kind,
    toasts, showToast, dismissToast, markNotificationRead, markNotificationsRead
  }), [data, dismissToast, showToast, toasts, user]);

  if (!ready) return <div className="ris-page-loading" role="status">Memuat data...</div>;
  return <RisContext.Provider value={value}>{loadError ? <div className="ris-page"><button type="button" onClick={() => window.location.reload()}>Coba Lagi</button></div> : children}</RisContext.Provider>;
}

RisProvider.propTypes = { children: PropTypes.node.isRequired };

export const useRis = () => useContext(RisContext);
