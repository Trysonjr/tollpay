import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppCtx } from '../AppShell';
import { getWallet, getTransactions, getVehicles } from '../../api/app';
import { zmw, timeAgo, fmtDateTime, parseUtc, initials, CLASSES } from '../../utils/format';

export default function Home() {
  const { me, notifications, refreshNotifs } = useContext(AppCtx);
  const [wallet, setWallet] = useState(null);
  const [txs, setTxs] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  async function load() {
    try {
      const [w, t, v] = await Promise.all([
        getWallet(),
        getTransactions({ limit: 50 }),
        getVehicles(),
      ]);
      setWallet(w); setTxs(t.items); setVehicles(v);
      refreshNotifs();
    } catch {/* keep last good state on transient errors */}
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000); // live receipts appear while you watch
    return () => clearInterval(timer);
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const thisMonth = txs.filter((t) => {
    const d = parseUtc(t.timestamp);
    return t.status === 'paid' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthCount = thisMonth.length;
  const monthSpend = thisMonth.reduce((s, t) => s + t.amount, 0);

  const recent = txs.filter((t) => t.status === 'paid').slice(0, 6);
  const lowBalance = wallet && wallet.balance < wallet.low_balance_threshold;
  const notifPreview = notifications.slice(0, 4);

  return (
    <div>
      <div className="dash-greet">
        <div>
          <h2 className="dash-hello">{greeting}{me ? `, ${me.full_name.split(' ')[0]}` : ''} 👋</h2>
          <p className="dash-sub">Here's your tolling at a glance.</p>
        </div>
        <Link to="/app/topup" className="btn btn-primary">Top up wallet</Link>
      </div>

      {lowBalance && (
        <div className="error-banner" style={{ background: 'rgba(196,67,59,0.08)' }}>
          ⚠️ Your balance is low ({wallet && zmw(wallet.balance)}). Top up to keep using the automated lane.
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card hero">
          <div className="stat-label">Wallet balance</div>
          <div className="stat-value">{wallet ? zmw(wallet.balance) : '…'}</div>
          <div className="stat-hint" style={{ color: 'var(--mist)' }}>
            Available for automatic toll payment
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Tolls this month</div>
          <div className="stat-value">{monthCount}</div>
          <div className="stat-hint">{zmw(monthSpend)} spent</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Vehicles</div>
          <div className="stat-value">{vehicles.filter((v) => v.status === 'active').length}</div>
          <div className="stat-hint">
            {vehicles.filter((v) => v.status === 'active').slice(0, 2)
              .map((v) => v.plate_number).join(' · ') || 'None yet'}
          </div>
        </div>

        <div className="stat-card" style={{ display: 'grid', alignContent: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="avatar" style={{ width: 44, height: 44, fontSize: 17 }}>
              {initials(me?.full_name)}
            </span>
            <div>
              <div style={{ fontWeight: 800 }}>{me?.full_name || '…'}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                {me?.role === 'motorist' ? 'Motorist' : me?.role}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <div className="panel-title">Recent tolls</div>
            <Link to="/app/history" className="panel-link">View all →</Link>
          </div>
          {recent.length === 0 && (
            <p className="empty">No tolls yet — drive through a plaza (or run the simulator) and receipts appear here live.</p>
          )}
          {recent.map((t) => (
            <div key={t.transaction_id} className="tx-row">
              <div className="tx-icon">🛣️</div>
              <div className="tx-main">
                <div className="tx-title">{t.gate?.name || 'Toll plaza'}</div>
                <div className="tx-sub">
                  {t.vehicle?.plate_number} · {CLASSES[t.vehicle_class] || t.vehicle_class} · {fmtDateTime(t.timestamp)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={`tx-amount ${t.status}`}>{zmw(t.amount)}</div>
                <span className={`chip ${t.payment_method === 'mobile_money' ? 'momo' : 'balance'}`}>
                  {t.payment_method === 'mobile_money' ? 'MoMo' : 'Balance'}
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div className="panel-title">Notifications</div>
            <Link to="/app/notifications" className="panel-link">View all →</Link>
          </div>
          {notifPreview.length === 0 && <p className="empty">Nothing yet.</p>}
          {notifPreview.map((n) => (
            <div key={n.notification_id} className="tx-row" style={{ alignItems: 'flex-start' }}>
              <div className="tx-icon">{n.type === 'receipt' ? '🧾' : n.type === 'topup' ? '➕' : n.type === 'low_balance' ? '⚠️' : '🔔'}</div>
              <div className="tx-main">
                <div className="tx-title" style={{ fontWeight: n.read ? 500 : 800 }}>
                  {n.title}
                </div>
                <div className="tx-sub">{n.body}</div>
                <div className="tx-sub" style={{ marginTop: 4 }}>{timeAgo(n.created_at)}</div>
              </div>
              {!n.read && <span className="dot" />}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}