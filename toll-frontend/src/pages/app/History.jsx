import { useEffect, useState } from 'react';
import { getVehicles, getTransactions } from '../../api/app';
import { zmw, fmtDateTime, CLASSES, PAY_LABELS, downloadCsv } from '../../utils/format';
import ReceiptModal from '../../components/ReceiptModal';

export default function History() {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => { getVehicles().then(setVehicles).catch(() => {}); }, []);
  useEffect(() => { load(1); }, [vehicleId]);

  async function load(p) {
    setLoading(true);
    try {
      const data = await getTransactions({ page: p, limit: 20, vehicle_id: vehicleId || undefined });
      setItems(p === 1 ? data.items : [...items, ...data.items]);
      setPage(p);
      setTotal(data.pagination.total);
    } finally { setLoading(false); }
  }

  function exportCsv() {
    downloadCsv(`tollpay-history-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Date', 'Reference', 'Gate', 'Plate', 'Class', 'Base fare (ZMW)',
       'Discount (ZMW)', 'Amount (ZMW)', 'Method', 'Status'],
      ...items.map((t) => [
        fmtDateTime(t.timestamp),
        t.transaction_id.slice(0, 8).toUpperCase(),
        t.gate?.name || '', t.vehicle?.plate_number || '',
        CLASSES[t.vehicle_class] || t.vehicle_class,
        ((t.base_fee ?? 0) / 100).toFixed(2),
        ((t.discount_amount || 0) / 100).toFixed(2),
        (t.amount / 100).toFixed(2),
        PAY_LABELS[t.payment_method] || t.payment_method,
        t.status,
      ]),
    ]);
  }

  return (
    <div>
      <div className="page-head">
        <h2>Toll history</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="filter-select">
            <option value="">All vehicles</option>
            {vehicles.map((v) => <option key={v.vehicle_id} value={v.vehicle_id}>{v.plate_number}</option>)}
          </select>
          <button className="btn btn-light btn-sm" onClick={exportCsv} disabled={!items.length}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      <section className="panel">
        {items.length === 0 && !loading && (
          <p className="empty">No tolls recorded yet{vehicleId ? ' for this vehicle' : ''}.</p>
        )}
        {items.map((t) => (
          <div key={t.transaction_id} className="tx-row tx-click" title="View receipt"
               onClick={() => setReceipt(t)}>
            <div className="tx-icon">{t.status === 'paid' ? '🛣️' : '❌'}</div>
            <div className="tx-main">
              <div className="tx-title">{t.gate?.name || 'Toll plaza'}</div>
              <div className="tx-sub">
                {t.vehicle?.plate_number} · {CLASSES[t.vehicle_class] || t.vehicle_class} · {fmtDateTime(t.timestamp)}
              </div>
              <div className="tx-sub" style={{ marginTop: 2 }}>
                Ref {t.transaction_id.slice(0, 8).toUpperCase()} · {t.source === 'offline_sync' ? 'offline sync' : 'online'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={`tx-amount ${t.status}`}>{t.status === 'paid' ? zmw(t.amount) : '—'}</div>
              <span className={`chip ${t.payment_method === 'mobile_money' ? 'momo'
                               : t.payment_method === 'prepaid_pass' ? 'pass' : 'balance'}`}>
                {PAY_LABELS[t.payment_method] || 'Balance'}
              </span>
            </div>
          </div>
        ))}
        {loading && <p className="empty">Loading…</p>}
        {items.length < total && !loading && (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button className="btn btn-light btn-sm" onClick={() => load(page + 1)}>
              Load more ({items.length}/{total})
            </button>
          </div>
        )}
      </section>

      <ReceiptModal tx={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}