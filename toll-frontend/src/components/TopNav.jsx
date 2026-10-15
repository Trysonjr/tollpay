import { useContext, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AppCtx } from '../pages/AppShell';
import { logout } from '../api/auth';
import { initials } from '../utils/format';

const tabs = [
  { to: '/app', label: 'Home', icon: '🏠', end: true },
  { to: '/app/vehicles', label: 'Vehicles', icon: '🚗' },
  { to: '/app/topup', label: 'Top up', icon: '💳' },
  { to: '/app/history', label: 'History', icon: '🧾' },
];

const drawerLinks = [
  { to: '/app/passes', label: 'Toll passes', icon: '🎟️' },
  { to: '/app/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/app/fake-phone', label: 'Demo phone', icon: '📱' },
];

export default function TopNav() {
  const navigate = useNavigate();
  const { me, notifications, refreshNotifs } = useContext(AppCtx);
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      <header className="appbar">
        <div className="appbar-inner">
          <NavLink to="/app" className="appbar-logo">Toll<span>Pay</span></NavLink>
          <nav className="appbar-links">
            {tabs.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}
                       className={({ isActive }) => (isActive ? 'active' : '')}>
                {l.label}
              </NavLink>
            ))}
            <NavLink to="/app/passes" className={({ isActive }) => (isActive ? 'active' : '')}>
              Passes
            </NavLink>
          </nav>
          <div className="appbar-spacer" />
          <button className="bell" onClick={refreshNotifs} title="Notifications">
            🔔
            {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <NavLink to="/app/notifications" className="appbar-user" title="Notifications">
            <span className="avatar">{initials(me?.full_name)}</span>
            <span className="appbar-name">{me?.full_name?.split(' ')[0]}</span>
          </NavLink>
          <button className="appbar-logout" onClick={() => { logout(); navigate('/'); }}>
            Log out
          </button>

          <button
            className={`hamburger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span className="menu-label">{menuOpen ? 'Close' : 'Menu'}</span>
            <span className="menu-icon">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </header>

      {/* scrim: tap anywhere outside the menu to close */}
      {menuOpen && <div className="vdrawer-scrim" onClick={() => setMenuOpen(false)} />}

      {/* vertical menu — slides down BELOW the bar, own close button */}
      <div className={`vdrawer ${menuOpen ? 'open' : ''}`}>
        <div className="vdrawer-head">
          <span className="avatar">{initials(me?.full_name)}</span>
          <div className="vdrawer-name">
            <strong>{me?.full_name}</strong>
            <small>Motorist</small>
          </div>
          <button className="vdrawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button>
        </div>
        {drawerLinks.map((l) => (
          <NavLink key={l.to} to={l.to} onClick={() => setMenuOpen(false)}
                   className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="vdrawer-icon">{l.icon}</span>
            <span className="vdrawer-text">{l.label}</span>
            {l.to === '/app/notifications' && unread > 0 && (
              <span className="badge" style={{ position: 'static', marginLeft: 'auto' }}>{unread}</span>
            )}
          </NavLink>
        ))}
        <div className="vdrawer-sep" />
        <button className="vdrawer-link-danger" onClick={() => { logout(); navigate('/'); }}>
          <span className="vdrawer-icon">🚪</span>
          <span className="vdrawer-text">Log out</span>
        </button>
      </div>

      <nav className="bottom-tabs">
        {tabs.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}
                   className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="tab-icon">{l.icon}</span>
            <span className="tab-label">{l.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}