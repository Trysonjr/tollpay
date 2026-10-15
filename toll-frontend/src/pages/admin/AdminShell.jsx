import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { getMe, logout } from '../../api/auth';
import { initials } from '../../utils/format';

const ADMIN_ROLES = ['admin', 'auditor', 'super_admin'];

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true, roles: ADMIN_ROLES },
  { to: '/admin/transactions', label: 'Transactions', icon: '🧾', roles: ADMIN_ROLES },
  { to: '/admin/reports', label: 'Revenue reports', icon: '📈', roles: ADMIN_ROLES },
  { to: '/admin/audit', label: 'Audit log', icon: '🗂️', roles: ADMIN_ROLES },
  { to: '/admin/tariffs', label: 'Tariffs', icon: '💰', roles: ['admin', 'super_admin'] },
  { to: '/admin/gates', label: 'Gates', icon: '🛑', roles: ['admin', 'super_admin'] },
  { to: '/admin/violations', label: 'Violations', icon: '🚨', roles: ['admin', 'super_admin'] },
  { to: '/admin/users', label: 'Users', icon: '👥', roles: ['super_admin'] },
  { to: '/simulator', label: 'Gate Simulator', icon: '🎮', roles: ADMIN_ROLES, external: true },
];

export default function AdminShell() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null)).finally(() => setReady(true));
  }, []);

  if (!ready) return <div className="admin-loading">Loading…</div>;
  if (!me || !ADMIN_ROLES.includes(me.role)) return <Navigate to="/app" replace />;

  return (
    <>
      <header className="admin-mobile-bar">
        <button
          className={`hamburger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <span className="menu-label">{menuOpen ? 'Close' : 'Menu'}</span>
          <span className="menu-icon">{menuOpen ? '✕' : '☰'}</span>
        </button>
        <span className="admin-side-logo" style={{ padding: 0 }}>Toll<span>Pay</span> <small>Admin</small></span>
      </header>

      <div className="admin-shell">
        <aside className="admin-side">
          <div className="admin-side-logo">Toll<span>Pay</span> <small>Admin</small></div>
          <nav>
            {NAV.filter((n) => n.roles.includes(me.role)).map((n) =>
              n.external ? (
                <a key={n.to} href={n.to} target="_blank" rel="noreferrer">
                  <span>{n.icon}</span> {n.label} <small style={{ marginLeft: 'auto', opacity: 0.6 }}>↗</small>
                </a>
              ) : (
                <NavLink key={n.to} to={n.to} end={n.end}
                         className={({ isActive }) => (isActive ? 'active' : '')}>
                  <span>{n.icon}</span> {n.label}
                </NavLink>
              ),
            )}
          </nav>
          <div className="admin-side-foot">
            <span className="avatar">{initials(me.full_name)}</span>
            <div className="admin-side-user">
              <strong>{me.full_name}</strong>
              <small>{me.role.replace('_', ' ')}</small>
            </div>
            <button className="appbar-logout" onClick={() => { logout(); navigate('/'); }}>
              Log out
            </button>
          </div>
        </aside>
        <main className="admin-main">
          <Outlet context={{ me }} />
        </main>
      </div>

      {menuOpen && <div className="vdrawer-scrim" onClick={() => setMenuOpen(false)} />}

      <div className={`vdrawer vdrawer-admin ${menuOpen ? 'open' : ''}`}>
        <div className="vdrawer-head">
          <span className="avatar">{initials(me.full_name)}</span>
          <div className="vdrawer-name">
            <strong>{me.full_name}</strong>
            <small>{me.role.replace('_', ' ')}</small>
          </div>
          <button className="vdrawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button>
        </div>
        {NAV.filter((n) => n.roles.includes(me.role)).map((n) =>
          n.external ? (
            <a key={n.to} href={n.to} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>
              <span className="vdrawer-icon">{n.icon}</span>
              <span className="vdrawer-text">{n.label}</span>
              <small style={{ marginLeft: 'auto', opacity: 0.6 }}>↗</small>
            </a>
          ) : (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMenuOpen(false)}
                     className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="vdrawer-icon">{n.icon}</span>
              <span className="vdrawer-text">{n.label}</span>
            </NavLink>
          ),
        )}
        <div className="vdrawer-sep" />
        <button className="vdrawer-link-danger" onClick={() => { logout(); navigate('/'); }}>
          <span className="vdrawer-icon">🚪</span>
          <span className="vdrawer-text">Log out</span>
        </button>
      </div>
    </>
  );
}