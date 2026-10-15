import { useEffect, useState } from 'react';
import { getAuditLog } from '../../api/admin';
import { fmtDateTime } from '../../utils/format';

export default function Audit() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { load(1); }, []);
  async function load(p) {
    const data = await getAuditLog({ page: p, limit: 25 });
    setItems(p === 1 ? data.items : [...items, ...data.items]);
    setPage(p); setTotal(data.pagination.total);
  }

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Audit log</h2>
      <p className="dash-sub" style={{ marginBottom: 20 }}>
        Every administrative action is recorded automatically — who did what, and when.
      </p>
      <section className="panel">
        {items.length === 0 && <p className="empty">No admin actions recorded yet.</p>}
        {items.map((l) => (
          <div key={l.log_id} className="tx-row">
            <div className="tx-icon">🗂️</div>
            <div className="tx-main">
              <div className="tx-title">{l.action}</div>
              <div className="tx-sub">
                {l.user ? `${l.user.full_name} (${l.user.role.replace('_', ' ')})` : 'system'}
                {l.target ? ` · ${l.target}` : ''}
              </div>
            </div>
            <div className="tx-sub">{fmtDateTime(l.created_at)}</div>
          </div>
        ))}
        {items.length < total && (
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