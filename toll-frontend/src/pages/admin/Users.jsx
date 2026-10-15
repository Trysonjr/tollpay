import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getUsers, createUser, setUserStatus } from '../../api/admin';
import { fmtDateTime, initials } from '../../utils/format';

export default function Users() {
  const { me } = useOutletContext();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ full_name: '', phone_number: '+260', email: '', password: '', role: 'admin' });
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    const data = await getUsers({ limit: 50 });
    setItems(data.items);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(null); setNotice(null);
    try {
      const u = await createUser({
        ...form,
        email: form.email.trim() || undefined,
      });
      setNotice(`${u.full_name} created as ${u.role.replace('_', ' ')}.`);
      setForm({ full_name: '', phone_number: '+260', email: '', password: '', role: 'admin' });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.code === 'DUPLICATE_PHONE' ? 'That phone number is already registered.' : err.message);
    }
  }

  async function toggle(u) {
    setError(null); setNotice(null);
    try {
      await setUserStatus(u.user_id, u.status === 'active' ? 'suspended' : 'active');
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <div className="page-head">
        <h2>Platform users</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Create operator'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && (
        <div style={{ background: 'rgba(46,158,107,0.12)', color: 'var(--success)',
                      padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontWeight: 600 }}>✓ {notice}</div>
      )}

      {showForm && (
        <form className="panel" onSubmit={handleCreate} style={{ marginBottom: 20 }}>
          <div className="panel-title" style={{ marginBottom: 12 }}>New operator account</div>
          <div className="form-grid">
            <div className="field">
              <label>Full name</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} required placeholder="+260…" />
            </div>
            <div className="field">
              <label>Email (optional)</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="admin">Admin</option>
                <option value="auditor">Auditor</option>
                <option value="super_admin">Super admin</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary">Create account</button>
        </form>
      )}

      <section className="panel">
        <table className="tbl">
          <thead><tr><th>User</th><th>Role</th><th>Joined</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.user_id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{initials(u.full_name)}</span>
                    <div>
                      <strong>{u.full_name}</strong>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.phone_number}</div>
                    </div>
                  </div>
                </td>
                <td><span className="chip balance">{u.role.replace('_', ' ')}</span></td>
                <td>{fmtDateTime(u.created_at)}</td>
                <td><span className={`chip ${u.status === 'active' ? 'paid' : 'failed'}`}>{u.status}</span></td>
                <td className="tbl-actions">
                  {u.user_id !== me.user_id && (
                    <button className="veh-edit" onClick={() => toggle(u)}
                            style={{ color: u.status === 'active' ? 'var(--error)' : 'var(--success)' }}>
                      {u.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}