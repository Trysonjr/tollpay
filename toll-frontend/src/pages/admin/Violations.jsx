import { useEffect, useState } from 'react';
import { getViolations } from '../../api/admin';
import { fmtDateTime } from '../../utils/format';

export default function Violations() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    getViolations({ limit: 50 }).then((d) => setItems(d.items)).catch(() => {});
  }, []);

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Violations</h2>
      <p className="dash-sub" style={{ marginBottom: 20 }}>
        Vehicles that passed without a valid payment outcome — flagged for enforcement.
      </p>
      <section className="panel">
        {items.length === 0 && <p className="empty">No violations recorded. 🎉</p>}
        {items.map((v) => (
          <div key={v.violation_id} className="tx-row">
            <div className="tx-icon">🚨</div>
            <div className="tx-main">
              <div className="tx-title">{v.plate_number}</div>
              <div className="tx-sub">{v.gate?.name} · {fmtDateTime(v.captured_at)}</div>
            </div>
            <span className="chip failed">{v.status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}