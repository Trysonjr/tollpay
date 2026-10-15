import { useEffect, useState } from 'react';
import { getAdminTransactions, getGates } from '../../api/admin';
import { zmw, fmtDateTime, CLASSES, PAY_LABELS, downloadCsv } from '../../utils/format';

export default function Transactions() {
  const [gates, setGates] = useState([]);
  const [filters, setFilters] = useState({ gate_id: '', status: '', from: '', to: '' });
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getGates().then(setGates).catch(() => {}); }, []);
  useEffect(() => { load(1); }, [filters]);

  async function load(p) {
    setLoading(true);
    try {
      const data = await getAdminTransactions({ ...filters, page: p, limit: 25 });
      setItems(p === 1 ? data.items : [...items, ...data.items]);
      setPage(p); setTotal(data.pagination.total);
    } finally { setLoading(false); }
  }

  function exportCsv() {
    downloadCsv(`tollpay-admin-transactions-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Date', 'Reference', 'Gate', 'Plate', 'Class', 'Amount (ZMW)', 'Method', 'Status', 'Source'],
      ...items.map((t) => [
        fmtDateTime(t.timestamp), t.transaction_id.slice(0, 8).toUpperCase(),
        t.gate?.name || '', t.vehicle?.plate_number || '',
        CLASSES[t.vehicle_class] || '', (t.amount / 100).toFixed(2),
        PAY_LABELS[t.payment_method] || '', t.status, t.source,
      ]),
    ]);
  }

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <div>
      <div className="page-head">
        <h2>All transactions</h2>
        <button className="btn btn-light btn-sm" onClick={exportCsv} disabled={!items.length}>⬇ Export CSV</button>
      </div>

      <div className="panel" style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0, minWidth: 180 }}>
          <label>Gate</label>
          <select value={filters.gate_id} onChange={set('gate_id')}>
            <option value="">All gates</option>
            {gates.map((g) => <option key={g.gate_id} value={g.gate_id}>{g.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 130 }}>
          <label>Status</label>
          <select value={filters.status} onChange={set('status')}>
            <option value="">All</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>From</label>
          <input type="date" value={filters.from} onChange={set('from')} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>To</label>
          <input type="date" value={filters.to} onChange={set('to')} />
        </div>
      </div>

      <section className="panel">
        <table className="tbl">
          <thead>
            <tr><th>Date</th><th>Reference</th><th>Gate</th><th>Vehicle</th><th>Amount</th><th>Method</th><th>Status</th></tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.transaction_id}>
                <td>{fmtDateTime(t.timestamp)}</td>
                <td><code>{t.transaction_id.slice(0, 8).toUpperCase()}</code></td>
                <td>{t.gate?.name}</td>
                <td>{t.vehicle?.plate_number} <small style={{ color: 'var(--text-muted)' }}>{CLASSES[t.vehicle_class] || ''}</small></td>
                <td><strong>{zmw(t.amount)}</strong></td>
                <td>{PAY_LABELS[t.payment_method] || t.payment_method}</td>
                <td><span className={`chip ${t.status}`}>{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="empty">Loading…</p>}
        {!loading && items.length === 0 && <p className="empty">No transactions match these filters.</p>}
        {items.length < total && !loading && (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button className="btn btn-light btn-sm" onClick={() => load(page + 1)}>
              Load more ({items.length}/{total})
            </button>
          </div>
        )}
      </section>
    </div>
  );
}