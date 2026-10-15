import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { getSummary, getRevenue, getAdminTransactions } from '../../api/admin';
import { zmw, fmtDateTime, timeAgo } from '../../utils/format';

export default function Dashboard() {
  const { me } = useOutletContext();
  const [summary, setSummary] = useState(null);
  const [days, setDays] = useState([]);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    getSummary().then(setSummary).catch(() => {});
    getRevenue({ group_by: 'day' }).then((r) => setDays(r.items.slice(-14))).catch(() => {});
    getAdminTransactions({ limit: 8 }).then((r) => setRecent(r.items)).catch(() => {});
  }, []);

  const max = Math.max(1, ...days.map((d) => d.total_amount));
  const today = days[days.length - 1];
  const yesterday = days[days.length - 2];
  const trend = today && yesterday && yesterday.total_amount > 0
    ? Math.round(((today.total_amount - yesterday.total_amount) / yesterday.total_amount) * 100)
    : null;

  const stats = [
    { label: 'Revenue today', value: summary ? zmw(summary.revenue_today) : '…',
      hint: trend !== null ? `${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend)}% vs yesterday` : 'paid tolls, today',
      good: trend === null || trend >= 0 },
    { label: 'Transactions today', value: summary?.transactions_today ?? '…',
      hint: `${summary?.failed_payments_today ?? 0} failed payments` },
    { label: 'Active vehicles', value: summary?.active_vehicles ?? '…', hint: 'registered on the platform' },
    { label: 'Open violations', value: summary?.open_violations ?? '…', hint: 'awaiting enforcement' },
  ];

  return (
    <div>
      <div className="admin-head">
        <div>
          <h2>Dashboard</h2>
          <p className="dash-sub">NRFA oversight at a glance — welcome back, {me.full_name.split(' ')[0]}.</p>
        </div>
        <a href="/simulator" target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
          🎮 Open Gate Simulator ↗
        </a>
      </div>

      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-hint" style={{ color: s.good === false ? 'var(--error)' : undefined }}>{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <div className="panel-title">Revenue — last {days.length || 14} days</div>
            <Link to="/admin/reports" className="panel-link">Full reports →</Link>
          </div>
          {days.length === 0 && <p className="empty">No paid tolls in this period — run the simulator to generate traffic.</p>}
          <div className="chart">
            {days.map((d) => (
              <div key={d.group} className="chart-col" title={`${d.group}: ${zmw(d.total_amount)} (${d.transaction_count} tolls)`}>
                <div className="chart-bar" style={{ height: `${Math.max(4, (d.total_amount / max) * 100)}%` }} />
                <div className="chart-label">{d.group.slice(5)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div className="panel-title">Latest activity</div>
            <Link to="/admin/transactions" className="panel-link">View all →</Link>
          </div>
          {recent.length === 0 && <p className="empty">No transactions yet.</p>}
          {recent.map((t) => (
            <div key={t.transaction_id} className="tx-row">
              <div className="tx-icon">{t.status === 'paid' ? '🛣️' : '❌'}</div>
              <div className="tx-main">
                <div className="tx-title">{t.gate?.name || 'Plaza'} · {t.vehicle?.plate_number}</div>
                <div className="tx-sub">{fmtDateTime(t.timestamp)} · {timeAgo(t.timestamp)}</div>
              </div>
              <div className={`tx-amount ${t.status}`}>{t.status === 'paid' ? zmw(t.amount) : '—'}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}