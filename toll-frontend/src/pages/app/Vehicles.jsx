import { useEffect, useState } from 'react';
import { getVehicles, addVehicle, updateVehicle } from '../../api/app';
import { CLASSES } from '../../utils/format';

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ plate_number: '', rfid_tag_id: '', vehicle_class: 'light' });
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    try { setVehicles(await getVehicles()); } catch (e) { setError(e.message); }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload = {
        plate_number: form.plate_number.trim(),
        vehicle_class: form.vehicle_class,
      };
      if (form.rfid_tag_id.trim()) payload.rfid_tag_id = form.rfid_tag_id.trim();
      await addVehicle(payload);
      setForm({ plate_number: '', rfid_tag_id: '', vehicle_class: 'light' });
      setAdding(false);
      await refresh();
    } catch (err) {
      const msgs = {
        DUPLICATE_PLATE: 'That plate is already registered.',
        PLATE_INVALID: 'Plate must be 4–10 letters/digits (e.g. ABC1234).',
        DUPLICATE_TAG: 'That e-tag is already registered to a vehicle.',
      };
      setError(msgs[err.code] || err.message);
    } finally { setBusy(false); }
  }

  async function handleSaveEdit(v) {
    setError(null);
    setBusy(true);
    try {
      const payload = {};
      if (edit.vehicle_class && edit.vehicle_class !== v.vehicle_class) payload.vehicle_class = edit.vehicle_class;
      if (edit.rfid_tag_id !== undefined && edit.rfid_tag_id !== v.rfid_tag_id) {
        payload.rfid_tag_id = edit.rfid_tag_id || null;
      }
      if (edit.status && edit.status !== v.status) payload.status = edit.status;
      if (Object.keys(payload).length) await updateVehicle(v.vehicle_id, payload);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err.code === 'DUPLICATE_TAG' ? 'That e-tag belongs to another vehicle.' : err.message);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="page-head">
        <h2>My vehicles</h2>
        <button className="btn btn-primary" onClick={() => setAdding(!adding)}>
          {adding ? 'Cancel' : '+ Add vehicle'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {adding && (
        <form className="panel" onSubmit={handleAdd} style={{ marginBottom: 24 }}>
          <div className="panel-title" style={{ marginBottom: 14 }}>Register a vehicle</div>
          <div className="form-grid">
            <div className="field">
              <label>Plate number</label>
              <input value={form.plate_number}
                     onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
                     placeholder="ABC1234" required />
            </div>
            <div className="field">
              <label>Vehicle class</label>
              <select value={form.vehicle_class}
                      onChange={(e) => setForm({ ...form, vehicle_class: e.target.value })}>
                {Object.entries(CLASSES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>E-tag ID (optional)</label>
              <input value={form.rfid_tag_id}
                     onChange={(e) => setForm({ ...form, rfid_tag_id: e.target.value })}
                     placeholder="TAG-000123" />
            </div>
          </div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Add vehicle'}
          </button>
        </form>
      )}

      {vehicles.length === 0 && !adding && (
        <p className="empty">No vehicles yet. Add one so the gates can identify you.</p>
      )}

      <div className="veh-grid">
        {vehicles.map((v) => (
          <div key={v.vehicle_id} className={`veh-card ${v.status === 'inactive' ? 'veh-off' : ''}`}>
            {editingId === v.vehicle_id ? (
              <>
                <div className="veh-plate">{v.plate_number}</div>
                <div className="field">
                  <label>Class</label>
                  <select value={edit.vehicle_class}
                          onChange={(e) => setEdit({ ...edit, vehicle_class: e.target.value })}>
                    {Object.entries(CLASSES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>E-tag</label>
                  <input value={edit.rfid_tag_id ?? ''}
                         onChange={(e) => setEdit({ ...edit, rfid_tag_id: e.target.value })}
                         placeholder="TAG-000123" />
                </div>
                <div className="field">
                  <label>Status</label>
                  <select value={edit.status}
                          onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary btn-sm" disabled={busy}
                          onClick={() => handleSaveEdit(v)}>Save</button>
                  <button className="btn btn-light btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="veh-plate">{v.plate_number}</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span className="chip balance">{CLASSES[v.vehicle_class]}</span>
                  <span className={`chip ${v.status === 'active' ? 'paid' : 'failed'}`}>{v.status}</span>
                </div>
                <div className="veh-meta">E-tag: {v.rfid_tag_id || '—'}</div>
                <button className="veh-edit" onClick={() => {
                  setEditingId(v.vehicle_id);
                  setEdit({ vehicle_class: v.vehicle_class, rfid_tag_id: v.rfid_tag_id || '', status: v.status });
                }}>Edit</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}