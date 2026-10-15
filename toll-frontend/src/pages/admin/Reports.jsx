import { useEffect, useState } from 'react';
import { getRevenue } from '../../api/admin';
import { zmw, downloadCsv } from '../../utils/format';

export default function Reports() {
  const [groupBy, setGroupBy] = useState('gate');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState({ items: [] });
  const max = Math.max(1, ...data.items.map((i) => i.total_amount));

  useEffect(() => {
    getRevenue({ group_by: groupBy, from: from || undefined, to: to || undefined })
      .then(setData).catch(() => setData({ items: [] }));
  }, [groupBy, from, to]);

  function exportCsv() {
    downloadCsv(`tollpay-revenue-by-${groupBy}.csv`, [
      [groupBy, 'Transactions', 'Total (ZMW)'],
      ...data.items.map((i) => [i.group, i.transaction_count, (i.total_amount / 100).toFixed(2)]),
    ]);
  }

  const totalRevenue = data.items.reduce((s, i) => s + i.total_amount, 0);
  const totalCount = data.items.reduce((s, i) => s + i.transaction_count, 0);

  return (
    <div>
      <div className="page-head">
        <h2>Revenue reports</h2>
        <button className="btn btn-light btn-sm" onClick={exportCsv} disabled={!data.items.length}>⬇ Export CSV</button>
      </div>

      <div className="panel" style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Group by</label>
          <div className="seg">
            {[['gate', 'Plaza'], ['vehicle_class', 'Class'], ['day', 'Day']].map(([k, label]) => (
              <button key={k} type="button"
                      className={groupBy === k ? 'seg-btn active' : 'seg-btn'}
                      onClick={() => setGroupBy(k)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card hero">
          <div className="stat-label">Total revenue (period)</div>
          <div className="stat-value">{zmw(totalRevenue)}</div>
          <div className="stat-hint" style={{ color: 'var(--mist)' }}>paid tolls only</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Paid tolls</div>
          <div className="stat-value">{totalCount}</div>
          <div className="stat-hint">across {data.items.length} {groupBy === 'day' ? 'days' : groupBy === 'gate' ? 'plazas' : 'classes'}</div>
        </div>
      </div>

      <section className="panel">
        {data.items.length === 0 && <p className="empty">No paid tolls in this period.</p>}
        {data.items.map((i) => (
          <div key={i.group} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 5 }}>
              <strong>{i.group}</strong>
              <span>{zmw(i.total_amount)} · {i.transaction_count} tolls</span>
            </div>
            <div style={{ background: '#EDF2F0', borderRadius: 8, height: 14 }}>
              <div style={{
                width: `${(i.total_amount / max) * 100}%`, height: '100%',
                background: 'linear-gradient(90deg, var(--primary), var(--slate))', borderRadius: 8,
              }} />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}