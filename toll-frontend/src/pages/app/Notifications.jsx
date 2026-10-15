import { useContext, useEffect, useState } from 'react';
import { AppCtx } from '../AppShell';
import { markNotificationRead } from '../../api/app';
import { timeAgo } from '../../utils/format';

export default function Notifications() {
  const { notifications, refreshNotifs } = useContext(AppCtx);
  const [tapping, setTapping] = useState(null);

  async function tap(n) {
    if (n.read) return;
    setTapping(n.notification_id);
    try {
      await markNotificationRead(n.notification_id);
      refreshNotifs();
    } finally { setTapping(null); }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Notifications</h2>
      <p className="dash-sub" style={{ marginBottom: 24 }}>Tap a notification to mark it read.</p>
      <section className="panel">
        {notifications.length === 0 && <p className="empty">Nothing yet.</p>}
        {notifications.map((n) => (
          <div key={n.notification_id} className="tx-row"
               style={{ alignItems: 'flex-start', cursor: n.read ? 'default' : 'pointer', opacity: n.read ? 0.65 : 1 }}
               onClick={() => tap(n)}>
            <div className="tx-icon">
              {n.type === 'receipt' ? '🧾' : n.type === 'topup' ? '➕' : n.type === 'low_balance' ? '⚠️' : '🔔'}
            </div>
            <div className="tx-main">
              <div className="tx-title" style={{ fontWeight: n.read ? 500 : 800 }}>{n.title}</div>
              <div className="tx-sub">{n.body}</div>
              <div className="tx-sub" style={{ marginTop: 4 }}>{timeAgo(n.created_at)}</div>
            </div>
            {!n.read && <span className="dot" />}
          </div>
        ))}
      </section>
    </div>
  );
}