import { useEffect, useMemo, useState } from 'react';
import { getRates, getPasses, buyPass, getWallet } from '../../api/app';
import { zmw, fmtDateTime, CLASSES } from '../../utils/format';

export default function Passes() {
  const [rates, setRates] = useState({ gates: [] });
  const [wallet, setWallet] = useState(null);
  const [passes, setPasses] = useState([]);
  const [gateId, setGateId] = useState('');
  const [vehicleClass, setVehicleClass] = useState('light');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [r, w, p] = await Promise.all([getRates(), getWallet(), getPasses()]);
      setRates(r); setWallet(w); setPasses(p);
      if (!gateId && r.gates.length) setGateId(r.gates[0].gate_id);
    } catch (e) { setError(e.message); }
  }

  const gate = rates.gates.find((g) => g.gate_id === gateId);
  const tariff = useMemo(
    () => gate?.tariffs.find((t) => t.vehicle_class === vehicleClass),
    [gate, vehicleClass],
  );

  async function handleBuy() {
    setError(null); setNotice(null); setBusy(true);
    try {
      const data = await buyPass({ gate_id: gateId, vehicle_class: vehicleClass });
      setNotice(`Pass purchased — ${zmw(data.amount_paid)} for ${data.gate.name}. `
                + `It will be redeemed automatically at your next passage.`);
      await load();
    } catch (err) {
      setError(err.code === 'INSUFFICIENT_FUNDS'
        ? 'Not enough balance for this pass — top up first.'
        : err.message);
    } finally { setBusy(false); }
  }

  const activeCount = passes.filter((p) => p.status === 'active').length;

  return (
    <div>
      <div className="page-head">
        <h2>Toll passes</h2>
        {wallet && (
          <span className="chip balance" style={{ padding: '8px 14px', fontSize: 13 }}>
            Balance: {zmw(wallet.balance)}
          </span>
        )}
      </div>

      <p className="dash-sub" style={{ marginBottom: 24 }}>
        Pay for a toll in advance. When your vehicle passes that plaza, the pass is
        redeemed automatically — your wallet balance isn't touched.
      </p>

      {error && <div className="error-banner">{error}</div>}
      {notice && (
        <div style={{ background: 'rgba(46,158,107,0.12)', color: 'var(--success)',
                      padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontWeight: 600 }}>
          ✓ {notice}
        </div>
      )}

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-title" style={{ marginBottom: 14 }}>Buy a pass</div>
          <div className="field">
            <label>Toll plaza</label>
            <select value={gateId} onChange={(e) => setGateId(e.target.value)}>
              {rates.gates.map((g) => <option key={g.gate_id} value={g.gate_id}>{g.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Vehicle class</label>
            <div className="seg">
              {(gate?.tariffs || []).map((t) => (
                <button key={t.vehicle_class} type="button"
                        className={vehicleClass === t.vehicle_class ? 'seg-btn active' : 'seg-btn'}
                        onClick={() => setVehicleClass(t.vehicle_class)}>
                  {CLASSES[t.vehicle_class] || t.vehicle_class}
                </button>
              ))}
            </div>
          </div>
          {tariff && (
            <div className="topup-summary">
              This pass costs <strong>{zmw(tariff.fee)}</strong>
              {tariff.discount_type !== 'none' && (
                <> (base {zmw(tariff.base_fee)}, {tariff.discount_type.replace('_', ' ')} discount applied)</>
              )}
            </div>
          )}
          <button className="btn btn-primary" disabled={busy || !tariff}
                  onClick={handleBuy}>
            {busy ? 'Purchasing…' : `Buy pass${tariff ? ` — ${zmw(tariff.fee)}` : ''}`}
          </button>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div className="panel-title">My passes</div>
            <span className="chip paid">{activeCount} active</span>
          </div>
          {passes.length === 0 && <p className="empty">No passes yet.</p>}
          {passes.map((p) => (
            <div key={p.pass_id} className="tx-row">
              <div className="tx-icon">🎟️</div>
              <div className="tx-main">
                <div className="tx-title">{p.gate?.name}</div>
                <div className="tx-sub">
                  {CLASSES[p.vehicle_class] || p.vehicle_class} · bought {fmtDateTime(p.purchased_at)}
                  {p.redeemed_at && ` · redeemed ${fmtDateTime(p.redeemed_at)}`}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="tx-amount">{zmw(p.amount_paid)}</div>
                <span className={`chip ${p.status === 'active' ? 'paid' : 'failed'}`}>{p.status}</span>
              </div>
            </div>
          ))}
        </section>
      </div>

      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-title" style={{ marginBottom: 14 }}>Toll rates</div>
        <div className="rates-table">
          {rates.gates.map((g) => (
            <div key={g.gate_id} className="rates-gate">
              <div className="rates-gate-name">{g.name} <span>{g.route}</span></div>
              {g.tariffs.map((t) => (
                <div key={t.vehicle_class} className="rates-row">
                  <span>{CLASSES[t.vehicle_class] || t.vehicle_class}</span>
                  <span>
                    {zmw(t.fee)}
                    {t.discount_type !== 'none' && (
                      <small style={{ color: 'var(--success)', marginLeft: 6 }}>
                        ({t.discount_type.replace('_', ' ')})
                      </small>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}