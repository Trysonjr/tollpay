import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getGates, createGate } from '../../api/admin';

export default function Gates() {
  const { me } = useOutletContext();
  const [gates, setGates] = useState([]);
  const [name, setName] = useState('');
  const [route, setRoute] = useState('');
  const [newKey, setNewKey] = useState(null);
  const [error, setError] = useState(null);
  const canWrite = ['admin', 'super_admin'].includes(me.role);

  useEffect(() => { getGates().then(setGates).catch((e) => setError(e.message)); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError(null); setNewKey(null);
    try {
      const g = await createGate({ name: name.trim(), route: route.trim() });
      setNewKey(g.api_key);
      setName(''); setRoute('');
      setGates(await getGates());
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Toll gates</h2>
      <p className="dash-sub" style={{ marginBottom: 20 }}>
        Each gate authenticates to the API with its own key. Dev simulator keys: <code>dev-key-&lt;name&gt;</code> for seeded plazas.
      </p>
      {error && <div className="error-banner">{error}</div>}

      {newKey && (
        <div style={{ background: 'rgba(46,158,107,0.12)', padding: '16px', borderRadius: 12, marginBottom: 20 }}>
          <strong style={{ color: 'var(--success)' }}>Gate created — API key (shown ONCE):</strong>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
            <code style={{ background: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>{newKey}</code>
            <button className="btn btn-light btn-sm" onClick={() => navigator.clipboard?.writeText(newKey)}>Copy</button>
          </div>
        </div>
      )}

      {canWrite && (
        <form className="panel" onSubmit={handleCreate} style={{ marginBottom: 20 }}>
          <div className="panel-title" style={{ marginBottom: 12 }}>Add a gate</div>
          <div className="form-grid">
            <div className="field">
              <label>Plaza name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Chilanga Toll Plaza" />
            </div>
            <div className="field">
              <label>Route</label>
              <input value={route} onChange={(e) => setRoute(e.target.value)} required placeholder="Kafue–Mazabuka Road" />
            </div>
          </div>
          <button className="btn btn-primary">Create gate</button>
        </form>
      )}

      <section className="panel">
        <table className="tbl">
          <thead><tr><th>Plaza</th><th>Route</th><th>Status</th></tr></thead>
          <tbody>
            {gates.map((g) => (
              <tr key={g.gate_id}>
                <td><strong>{g.name}</strong></td>
                <td>{g.route}</td>
                <td><span className="chip paid">{g.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}