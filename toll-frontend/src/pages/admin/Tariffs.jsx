import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getTariffs, updateTariff, createTariff } from '../../api/admin';
import { zmw, CLASSES } from '../../utils/format';

export default function Tariffs() {
  const { me } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const canWrite = ['admin', 'super_admin'].includes(me.role);

  useEffect(() => { load(); }, []);
  async function load() {
    try { setRows(await getTariffs()); } catch (e) { setError(e.message); }
  }

  async function save(t) {
    setError(null); setNotice(null);
    try {
      await updateTariff(t.tariff_id, {
        base_fee: Math.round(parseFloat(form.base_fee) * 100),
        discount_type: form.discount_type,
      });
      setEditId(null);
      setNotice(`Tariff updated for ${t.gate_name} / ${CLASSES[t.vehicle_class]}. The next vehicle pays the new fee.`);
      await load();
    } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Tariffs</h2>
      <p className="dash-sub" style={{ marginBottom: 20 }}>
        Base fees and discounts per plaza and vehicle class. Changes apply to the very next passage.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {notice && (
        <div style={{ background: 'rgba(46,158,107,0.12)', color: 'var(--success)',
                      padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontWeight: 600 }}>✓ {notice}</div>
      )}

      <section className="panel">
        <table className="tbl">
          <thead>
            <tr><th>Plaza</th><th>Class</th><th>Base fee</th><th>Discount</th><th>Effective fee</th><th />canWrite && </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const fee = t.base_fee - Math.round(t.base_fee *
                ({ none: 0, frequent_user: 0.1, local_user: 0.5, exempt: 1 }[t.discount_type] || 0));
              return (
                <tr key={t.tariff_id}>
                  <td>{t.gate_name}</td>
                  <td>{CLASSES[t.vehicle_class] || t.vehicle_class}</td>
                  {editId === t.tariff_id ? (
                    <>
                      <td><input className="tbl-input" type="number" step="0.01"
                                 value={form.base_fee}
                                 onChange={(e) => setForm({ ...form, base_fee: e.target.value })} /></td>
                      <td>
                        <select className="tbl-input" value={form.discount_type}
                                onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
                          {['none', 'frequent_user', 'local_user', 'exempt'].map((d) => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
                        </select>
                      </td>
                      <td />
                      <td className="tbl-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => save(t)}>Save</button>
                        <button className="btn btn-light btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{zmw(t.base_fee)}</td>
                      <td>{t.discount_type.replace('_', ' ')}</td>
                      <td><strong>{zmw(fee)}</strong></td>
                      {canWrite && (
                        <td className="tbl-actions">
                          <button className="veh-edit" onClick={() => {
                            setEditId(t.tariff_id);
                            setForm({ base_fee: (t.base_fee / 100).toFixed(2), discount_type: t.discount_type });
                          }}>Edit</button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}