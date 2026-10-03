/* eslint-disable object-curly-newline, object-property-newline, react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useRis } from '../../core/RisContext';
import { MANAGER_MODE, ROLE, normalizeRole } from '../workflows/workflow';
import { formatNotificationTime, getNotificationsForUser } from '../workflows/notificationWorkflow';
import Icon from './Icon';
import { Button, Modal } from './Ui';

const countLabel = count => (count > 99 ? '99+' : String(count));

export default function NotificationCenter() {
  const { data, user, markNotificationRead, markNotificationsRead, setManagerMode } = useRis();
  const history = useHistory();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('unread');
  const [dismissedUrgentIds, setDismissedUrgentIds] = useState([]);
  const [clock, setClock] = useState(() => new Date());
  const notifications = useMemo(() => getNotificationsForUser(data, user, clock), [clock, data, user]);
  const unread = notifications.filter(notification => !notification.isRead);
  const visible = (filter === 'unread' ? unread : notifications).slice(0, 60);
  const urgent = unread.find(notification => notification.priority === 'critical' && !dismissedUrgentIds.includes(notification.id));

  useEffect(() => {
    const close = event => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const navigate = notification => {
    markNotificationRead(notification.id);
    setOpen(false);
    if (!notification.actionPath) return;
    const managerAccount = normalizeRole(user && user.role) === ROLE.MANAGER;
    const requestedMode = notification.managerMode === MANAGER_MODE.LECTURER ? MANAGER_MODE.LECTURER : MANAGER_MODE.MANAGEMENT;
    if (managerAccount && notification.managerMode && user.managerMode !== requestedMode) {
      setManagerMode(requestedMode);
      setTimeout(() => history.push(notification.actionPath), 0);
      return;
    }
    history.push(notification.actionPath);
  };

  const acknowledgeUrgent = notification => {
    markNotificationRead(notification.id);
    setDismissedUrgentIds(current => [...current, notification.id]);
  };

  return (
    <>
      <div className="ris-notification-shell" ref={rootRef}>
        <button type="button" className={`ris-notification-trigger ${open ? 'active' : ''}`} aria-label={`${unread.length} notifikasi belum dibaca`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}>
          <Icon name="bell" size={21} />
          {unread.length > 0 && <span>{countLabel(unread.length)}</span>}
        </button>
        {open && <section className="ris-notification-panel" role="dialog" aria-label="Pusat notifikasi">
          <header className="ris-notification-panel-head">
            <div><h2>Notifikasi</h2><p>{unread.length ? `${unread.length} memerlukan perhatian` : 'Semua sudah dibaca'}</p></div>
            {unread.length > 0 && <button type="button" onClick={() => markNotificationsRead(unread.map(notification => notification.id))}>Tandai semua dibaca</button>}
          </header>
          <div className="ris-notification-tabs" role="tablist" aria-label="Filter notifikasi">
            <button type="button" role="tab" aria-selected={filter === 'unread'} className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Belum Dibaca <span>{unread.length}</span></button>
            <button type="button" role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Semua</button>
          </div>
          <div className="ris-notification-list">
            {visible.map(notification => <button type="button" className={`ris-notification-item ${notification.isRead ? 'read' : 'unread'}`} key={notification.id} onClick={() => navigate(notification)}>
              <span className={`ris-notification-icon ${notification.tone}`}><Icon name={notification.icon} size={18} /></span>
              <span className="ris-notification-copy">
                <span className="ris-notification-title-row"><strong>{notification.title}</strong>{!notification.isRead && <i aria-label="Belum dibaca" />}</span>
                <span>{notification.message}</span>
                <small>{formatNotificationTime(notification.createdAt, clock)}{notification.actionLabel ? ` · ${notification.actionLabel}` : ''}</small>
              </span>
              {notification.actionPath && <Icon name="chevronRight" size={16} className="ris-notification-arrow" />}
            </button>)}
            {!visible.length && <div className="ris-notification-empty"><Icon name="check" size={24} /><strong>Tidak ada notifikasi</strong><span>Informasi penting dan pekerjaan yang perlu ditindaklanjuti akan muncul di sini.</span></div>}
          </div>
        </section>}
      </div>

      {urgent && <Modal title={urgent.title} onClose={() => acknowledgeUrgent(urgent)} width={500} className="ris-notification-urgent-modal" closeOnBackdrop={false}>
        <div className="ris-modal-body ris-notification-urgent-body">
          <span className={`ris-notification-urgent-icon ${urgent.tone}`}><Icon name={urgent.icon} size={28} /></span>
          <p>{urgent.message}</p>
          <div className="ris-modal-actions">
            <Button tone="gray" onClick={() => acknowledgeUrgent(urgent)}>Saya Mengerti</Button>
            {urgent.actionPath && <Button tone="blue" onClick={() => { acknowledgeUrgent(urgent); navigate(urgent); }}>{urgent.actionLabel || 'Buka Sekarang'}</Button>}
          </div>
        </div>
      </Modal>}
    </>
  );
}

export function ToastHost() {
  const { toasts, dismissToast } = useRis();
  return <div className="ris-toast-region" aria-live="polite" aria-atomic="false">{toasts.map(toast => <div className={`ris-toast ${toast.tone}${toast.exiting ? ' is-exiting' : ''}`} role={toast.tone === 'error' ? 'alert' : 'status'} key={toast.id}>
    <span className="ris-toast-icon"><Icon name={toast.tone === 'success' ? 'check' : toast.tone === 'error' ? 'warning' : 'info'} size={18} /></span>
    <span><strong>{toast.title}</strong>{toast.message && <small>{toast.message}</small>}</span>
    <button type="button" aria-label="Tutup notifikasi" onClick={() => dismissToast(toast.id)}><Icon name="close" size={16} /></button>
  </div>)}</div>;
}
