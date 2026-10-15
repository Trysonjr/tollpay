import { createContext, useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import TopNav from '../components/TopNav';
import { getMe } from '../api/auth';
import { getNotifications } from '../api/app';
import { getToken } from '../api/client';

export const AppCtx = createContext({ me: null, notifications: [], refreshNotifs: () => {} });

export default function AppShell() {
  const [me, setMe] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const refreshNotifs = useCallback(() => {
    getNotifications().then(setNotifications).catch(() => {});
  }, []);

  useEffect(() => {
    getMe().then(setMe).catch(() => {});
    refreshNotifs();
    const t = setInterval(refreshNotifs, 15000); // live badge
    return () => clearInterval(t);
  }, [refreshNotifs]);

  if (!getToken()) return <Navigate to="/login" replace />;

  return (
    <AppCtx.Provider value={{ me, notifications, refreshNotifs }}>
      <div className="app-shell">
        <TopNav />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </AppCtx.Provider>
  );
}