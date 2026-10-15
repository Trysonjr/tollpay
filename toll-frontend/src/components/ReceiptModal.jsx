import { zmw, fmtDateTime, CLASSES, PAY_LABELS } from '../utils/format';

export default function ReceiptModal({ tx, onClose }) {
  if (!tx) return null;
  const ref = tx.transaction_id.slice(0, 8).toUpperCase();

  const row = (label, value) => (
    <div className="rc-row" key={label}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );

  return (
    <div className="modal-overlay no-print" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="receipt receipt-print">
          <div className="rc-head">
            <div className="rc-logo">Toll<span>Pay</span></div>
            <div className="rc-title">OFFICIAL TOLL RECEIPT</div>
          </div>

          <div className="rc-ref">
            <div className="rc-ref-label">Receipt ID</div>
            <div className="rc-ref-value">{ref}</div>
          </div>

          {row('Date & time', fmtDateTime(tx.timestamp))}
          {row('Toll plaza', tx.gate?.name || '—')}
          {row('Vehicle', `${tx.vehicle?.plate_number || '—'} · ${CLASSES[tx.vehicle_class] || tx.vehicle_class || ''}`)}
          {row('Base fare', zmw(tx.base_fee ?? tx.amount))}
          {tx.discount_amount > 0 && row(`Discount (${(tx.discount_type || '').replace('_', ' ')})`, `− ${zmw(tx.discount_amount)}`)}
          {row('Amount paid', zmw(tx.amount))}
          {row('Payment method', PAY_LABELS[tx.payment_method] || tx.payment_method)}
          {row('Status', tx.status === 'paid' ? 'PAID ✓' : tx.status.toUpperCase())}
          {row('Recorded via', tx.source === 'offline_sync' ? 'Offline sync' : 'Live gate')}

          <div className="rc-foot">
            Keep this receipt for your records.<br />
            Full reference: {tx.transaction_id}
          </div>
        </div>

        <div className="modal-actions no-print">
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            ⬇ Print / Save as PDF
          </button>
          <button className="btn btn-light btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}