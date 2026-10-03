/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { NavLink, useHistory, useLocation } from 'react-router-dom';
import { useRis } from '../../core/RisContext';
import Icon from './Icon';
import {
  canAccessExternalResearch,
  canAccessArchive,
  canAccessLetters,
  canAccessResearchSubmission,
  canAccessResearcherProfiles,
  canAccessSchemeManagement,
  getRoleLabel,
  isManagerAccount,
  MANAGER_MODE,
} from '../workflows/workflow';
import { hasFundedResearch } from '../../features/research/workflows/schemeDataWorkflow';
import NotificationCenter from './NotificationCenter';
import NotificationDot from './NotificationDot';
import { getNotificationIndicatorMap } from '../workflows/notificationWorkflow';
import UiLanguageLayer, { UI_LOCALE } from '../i18n/uiLanguage';

const SIDEBAR_COLLAPSE_KEY = 'ris-sidebar-collapsed';

const initialSidebarCollapsed = () => {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === 'true';
  } catch (error) {
    return false;
  }
};

export default function Layout({ children }) {
  const { data, user, logout, setManagerMode, setUiLocale, markNotificationsRead } = useRis();
  const history = useHistory();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed);
  const profileRef = useRef(null);
  const shellRef = useRef(null);
  const externalAcknowledgementRef = useRef('');
  const researchMenuAvailable = canAccessSchemeManagement(user);
  const submissionMenuAvailable = canAccessResearchSubmission(user) && !researchMenuAvailable;
  const fundedMenuAvailable = submissionMenuAvailable && hasFundedResearch(data, user);
  const researchPathActive = location.pathname.startsWith('/ris/skema')
    || (researchMenuAvailable && location.pathname.startsWith('/ris/pengajuan-penelitian-internal'))
    || (researchMenuAvailable && location.pathname.startsWith('/ris/penelitian-didanai'));
  const submissionPathActive = location.pathname.startsWith('/ris/pengajuan-penelitian-internal')
    || location.pathname.startsWith('/ris/penelitian-didanai');
  const managerAccount = isManagerAccount(user);
  const notificationIndicators = useMemo(() => getNotificationIndicatorMap(data, user), [data, user]);
  const acknowledgeTarget = target => markNotificationsRead(notificationIndicators[target] || []);

  useEffect(() => {
    if (!location.pathname.startsWith('/ris/penelitian-eksternal')) {
      externalAcknowledgementRef.current = '';
      return;
    }
    const notificationIds = notificationIndicators['menu:external'] || [];
    if (!notificationIds.length) return;
    const signature = notificationIds.slice().sort().join('|');
    if (externalAcknowledgementRef.current === signature) return;
    externalAcknowledgementRef.current = signature;
    markNotificationsRead(notificationIds);
  }, [location.pathname, markNotificationsRead, notificationIndicators]);

  useEffect(() => {
    const close = event => {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (researchMenuAvailable && researchPathActive) setResearchOpen(true);
  }, [researchMenuAvailable, researchPathActive]);

  useEffect(() => {
    if (fundedMenuAvailable && submissionPathActive) setSubmissionOpen(true);
  }, [fundedMenuAvailable, submissionPathActive]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, String(sidebarCollapsed));
    } catch (error) {
      // The layout remains usable when browser storage is unavailable.
    }
  }, [sidebarCollapsed]);

  const signOut = async () => {
    await logout();
    history.replace('/login');
  };

  const switchManagerMode = mode => {
    setManagerMode(mode);
    setMobileOpen(false);
    setResearchOpen(false);
    setSubmissionOpen(false);
    history.push('/ris');
  };

  const toggleDesktopSidebar = () => {
    setProfileOpen(false);
    setSidebarCollapsed(value => !value);
  };

  const toggleSubmissionMenu = () => {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      setSubmissionOpen(true);
      return;
    }
    setSubmissionOpen(value => !value);
  };

  const toggleResearchMenu = () => {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      setResearchOpen(true);
      return;
    }
    setResearchOpen(value => !value);
  };

  const item = (to, icon, label, exact = false, relatedPaths = [], target = '') => (
    <NavLink exact={exact} to={to} className="ris-nav-item" activeClassName="active" isActive={(match, currentLocation) => Boolean(match) || relatedPaths.some(path => currentLocation.pathname.startsWith(path))} onClick={() => { setMobileOpen(false); if (target) acknowledgeTarget(target); }} aria-label={label} title={sidebarCollapsed ? label : undefined}>
      <Icon name={icon} /> <span>{label}</span><NotificationDot visible={Boolean(target && notificationIndicators[target] && notificationIndicators[target].length)} />
    </NavLink>
  );

  return (
    <div ref={shellRef} className={`ris-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <UiLanguageLayer locale={user.uiLocale || UI_LOCALE.ID} rootRef={shellRef} />
      <header className="ris-header">
        <img src="/images/ris/ris-logo.png" alt="RIS Logo" className="ris-header-logo" />
        <NotificationCenter />
      </header>
      <div className="ris-body">
        <aside id="ris-sidebar" className={`ris-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'open' : ''}`}>
          <button type="button" className="ris-sidebar-toggle ris-sidebar-desktop-toggle" onClick={toggleDesktopSidebar} aria-label={sidebarCollapsed ? 'Buka menu utama' : 'Tutup menu utama'} title={sidebarCollapsed ? 'Buka menu utama' : 'Tutup menu utama'} aria-expanded={!sidebarCollapsed} aria-controls="ris-sidebar"><Icon name="menu" size={22} /></button>
          <button type="button" className="ris-sidebar-toggle ris-sidebar-mobile-toggle" onClick={() => setMobileOpen(value => !value)} aria-label={mobileOpen ? 'Tutup menu utama' : 'Buka menu utama'} title={mobileOpen ? 'Tutup menu utama' : 'Buka menu utama'} aria-expanded={mobileOpen} aria-controls="ris-sidebar"><Icon name="menu" size={22} /></button>
          <div className="ris-sidebar-content">
            {managerAccount && <div className="ris-manager-mode" role="group" aria-label="Mode akses Manajer">
              <span>Mode akses</span>
              <div>
                <button type="button" className={user.managerMode !== MANAGER_MODE.LECTURER ? 'active' : ''} aria-label="Mode Manajemen" title={sidebarCollapsed ? 'Mode Manajemen' : undefined} aria-pressed={user.managerMode !== MANAGER_MODE.LECTURER} onClick={() => switchManagerMode(MANAGER_MODE.MANAGEMENT)}><Icon name="layers" size={15} /><span>Manajemen</span></button>
                <button type="button" className={user.managerMode === MANAGER_MODE.LECTURER ? 'active' : ''} aria-label="Mode Dosen" title={sidebarCollapsed ? 'Mode Dosen' : undefined} aria-pressed={user.managerMode === MANAGER_MODE.LECTURER} onClick={() => switchManagerMode(MANAGER_MODE.LECTURER)}><Icon name="user" size={15} /><span>Dosen</span></button>
              </div>
            </div>}
            {item('/ris', 'dashboard', 'Dashboard', true)}
            {submissionMenuAvailable && !fundedMenuAvailable && item('/ris/pengajuan-penelitian-internal', 'document', 'Pengajuan Penelitian Internal', false, ['/ris/pengajuan-penelitian-internal/daftar-skema'], 'menu:submission')}
            {fundedMenuAvailable && <button type="button" className={`ris-nav-item ris-nav-button ${submissionPathActive ? 'active' : ''}`} onClick={toggleSubmissionMenu} aria-label="Pengajuan Penelitian Internal" title={sidebarCollapsed ? 'Pengajuan Penelitian Internal' : undefined} aria-expanded={submissionOpen} aria-controls="ris-submission-subnav">
              <Icon name="document" /><span>Pengajuan Penelitian Internal</span><Icon name="chevron" size={16} className={submissionOpen ? 'rotate' : ''} /><NotificationDot visible={Boolean((sidebarCollapsed || !submissionOpen) && notificationIndicators['menu:submission'] && notificationIndicators['menu:submission'].length)} />
            </button>}
            {fundedMenuAvailable && submissionOpen && (
              <div id="ris-submission-subnav" className="ris-subnav">
                <NavLink to="/ris/pengajuan-penelitian-internal/daftar-skema" activeClassName="active" onClick={() => { setMobileOpen(false); acknowledgeTarget('submission:catalog'); }}>Daftar Skema<NotificationDot visible={Boolean(notificationIndicators['submission:catalog'] && notificationIndicators['submission:catalog'].length)} /></NavLink>
                <NavLink to="/ris/pengajuan-penelitian-internal/penelitian-didanai" activeClassName="active" onClick={() => { setMobileOpen(false); }}>
                  Penelitian Didanai<NotificationDot visible={Boolean(!location.pathname.startsWith('/ris/pengajuan-penelitian-internal/penelitian-didanai') && notificationIndicators['submission:funded'] && notificationIndicators['submission:funded'].length)} />
                </NavLink>
              </div>
            )}
            {researchMenuAvailable && <button type="button" className={`ris-nav-item ris-nav-button ${researchPathActive ? 'active' : ''}`} onClick={toggleResearchMenu} aria-label="Manajemen Penelitian" title={sidebarCollapsed ? 'Manajemen Penelitian' : undefined} aria-expanded={researchOpen} aria-controls="ris-research-subnav">
              <Icon name="layers" /><span>Manajemen Penelitian</span><Icon name="chevron" size={16} className={researchOpen ? 'rotate' : ''} /><NotificationDot visible={Boolean((sidebarCollapsed || !researchOpen) && notificationIndicators['menu:research'] && notificationIndicators['menu:research'].length)} />
            </button>}
            {researchMenuAvailable && researchOpen && (
              <div id="ris-research-subnav" className="ris-subnav">
                <NavLink exact to="/ris/skema" activeClassName="active" onClick={() => { setMobileOpen(false); acknowledgeTarget('research:schemes'); }}>Daftar Skema<NotificationDot visible={Boolean(notificationIndicators['research:schemes'] && notificationIndicators['research:schemes'].length)} /></NavLink>
                <NavLink to="/ris/skema/pengajuan" activeClassName="active" onClick={() => { setMobileOpen(false); }}>
                  Pemantauan Penelitian<NotificationDot visible={Boolean(!location.pathname.startsWith('/ris/skema/pengajuan') && notificationIndicators['research:monitoring'] && notificationIndicators['research:monitoring'].length)} />
                </NavLink>
                <NavLink to="/ris/pengajuan-penelitian-internal/penelitian-didanai" activeClassName="active" onClick={() => { setMobileOpen(false); }}>
                  Pemantauan Penelitian Didanai<NotificationDot visible={Boolean(!location.pathname.startsWith('/ris/pengajuan-penelitian-internal/penelitian-didanai') && notificationIndicators['research:funded'] && notificationIndicators['research:funded'].length)} />
                </NavLink>
              </div>
            )}
            {canAccessLetters(user) && item('/ris/pengajuan-surat', 'mail', 'Pengajuan Surat', false, [], 'menu:letters')}
            {canAccessResearcherProfiles(user) && item('/ris/profil-peneliti', 'user', 'Manajemen Informasi Peneliti', false, [], 'menu:profiles')}
            {canAccessExternalResearch(user) && item('/ris/penelitian-eksternal', 'report', 'Pelaporan Penelitian Eksternal')}
            {canAccessArchive(user) && item('/ris/arsip', 'archive', 'Arsip', false, [], 'menu:archive')}
          </div>
          <div className="ris-sidebar-account" ref={profileRef}>
            {profileOpen && <div className="ris-profile-menu" role="menu">
              <div className="ris-profile-menu-identity"><strong>{user.name}</strong><span>{user.email}</span><small>{getRoleLabel(user)}</small></div>
              <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); setMobileOpen(false); history.push('/ris/profil-saya'); }}><Icon name="user" size={17} />Profil Saya</button>
              <div className="ris-language-switcher" role="group" aria-label="Bahasa antarmuka" data-ui-translation-skip>
                <span>Bahasa</span>
                <div>
                  <button type="button" aria-pressed={user.uiLocale !== UI_LOCALE.EN} onClick={() => setUiLocale(UI_LOCALE.ID)}>ID</button>
                  <button type="button" aria-pressed={user.uiLocale === UI_LOCALE.EN} onClick={() => setUiLocale(UI_LOCALE.EN)}>EN</button>
                </div>
              </div>
              <button type="button" role="menuitem" className="danger" onClick={signOut}><Icon name="logout" size={17} />Log out</button>
            </div>}
            <button type="button" className="ris-sidebar-account-button" onClick={() => setProfileOpen(value => !value)} aria-label="Menu akun" title={sidebarCollapsed ? `${user.name} - Menu akun` : undefined} aria-haspopup="menu" aria-expanded={profileOpen}>
              <span className="ris-sidebar-avatar"><Icon name="user" size={20} /></span>
              <span className="ris-sidebar-account-copy"><strong>{user.name}</strong><small>{getRoleLabel(user)}</small></span>
              <Icon name="chevron" size={16} className={profileOpen ? 'rotate' : ''} />
            </button>
          </div>
        </aside>
        {mobileOpen && <button type="button" aria-label="Tutup menu" className="ris-sidebar-overlay" onClick={() => setMobileOpen(false)} />}
        <main className="ris-main">{children}</main>
      </div>
    </div>
  );
}

Layout.propTypes = { children: PropTypes.node.isRequired };
