import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { API_BASE } from '../config';
import { zmw, CLASSES, PROVIDERS } from '../utils/format';

const QUEUE_KEY = 'toll_sim_queue';
const RATES = { none: 0, frequent_user: 0.1, local_user: 0.5, exempt: 1 };
const EMOJI = { motorcycle: '🏍️', light: '🚗', medium: '🚚', heavy: '🚛' };

const LANES = ['Lane 1 · Express E-Tag', 'Lane 2 · Self-Service', 'Lane 3 · Commercial', 'Lane 4 · Multi-Axle'];

const norm = (p) => (p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const providerFromPhone = (phone = '') => {
  const p = phone.replace(/\D/g, '').slice(-9, -7);
  return { 97: 'airtel_money', 77: 'airtel_money', 96: 'mtn_momo', 76: 'mtn_momo', 95: 'zamtel_kwacha', 75: 'zamtel_kwacha' }[p] || 'airtel_money';
};
const randPlate = () =>
  Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('')
  + Math.floor(1000 + Math.random() * 9000);

export default function Simulator() {
  const [gates, setGates] = useState([]);
  const [gateId, setGateId] = useState('');
  const [lane, setLane] = useState(LANES[0]);
  const [plate, setPlate] = useState('ABC1234');
  const [cache, setCache] = useState({ vehicles: [], tariffs: [] });

  const [phase, setPhase] = useState('idle');
  const [tele, setTele] = useState(null);
  const [stageVeh, setStageVeh] = useState(null);
  const [vehReject, setVehReject] = useState(false);
  const [conf, setConf] = useState(null);
  const [rfid, setRfid] = useState(null);
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);

  const [barrier, setBarrier] = useState({ open: false, countdown: null });
  const [vehExit, setVehExit] = useState(false);
  const barrierTimer = useRef(null);

  const [momo, setMomo] = useState(null);
  const [showMomo, setShowMomo] = useState(false);

  const [offline, setOffline] = useState(false);
  const [queue, setQueue] = useState(() => JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'));
  const [running, setRunning] = useState(false);
  const [feed, setFeed] = useState([]);
  const [error, setError] = useState(null);

  // hands-free mode (armed by a camera scan)
  const [autoMode, setAutoMode] = useState(false);
  const momoAutoRef = useRef(false);

  useEffect(() => {
    api('/dev/gates').then((g) => {
      setGates(g);
      const katuba = g.find((x) => x.name.toLowerCase().includes('katuba'));
      setGateId(katuba?.gate_id || g[0]?.gate_id || '');
    }).catch(() => {});
    api('/dev/edge-cache').then(setCache).catch(() => {});
    return () => { if (barrierTimer.current) clearInterval(barrierTimer.current); };
  }, []);

  // receive a camera scan → prefill + arm hands-free
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scan = params.get('scan');
    if (scan) {
      try {
        const v = JSON.parse(scan);
        const p = norm(v.plate || '');
        setPlate(p);
        // pre-stage the vehicle as KNOWN (the cache + arrive() confirm the details)
        setStageVeh({ plate: p, vehicle_class: 'light', unregistered: false, pending: true });
        if (params.get('auto') === '1') {
          setAutoMode(true);
          momoAutoRef.current = true;
        }
        window.history.replaceState({}, '', '/simulator');
      } catch { /* ignore bad param */ }
    }
  }, []);

  const gate = gates.find((g) => g.gate_id === gateId);
  const gateKey = (g) => `dev-key-${g.name.toLowerCase().split(' ')[0]}`;

  async function gateCall(path, g, body, method = 'POST') {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Gate-Id': g.gate_id, 'X-Gate-Key': gateKey(g) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.code || 'GATE_ERROR');
    return json.data;
  }

  function persistQueue(q) { setQueue(q); localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }

  function addFeed(row) {
    setFeed((f) => [{ time: new Date().toLocaleTimeString(), plaza: gate?.name, lane, ...row }, ...f].slice(0, 40));
  }

  function barrierSequence(seconds = 4) {
    if (barrierTimer.current) clearInterval(barrierTimer.current);
    setBarrier({ open: true, countdown: seconds });
    setTimeout(() => setVehExit(true), 700);
    let left = seconds;
    barrierTimer.current = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(barrierTimer.current);
        setBarrier({ open: false, countdown: null });
        setVehExit(false);
        setStageVeh(null);
        setPhase((ph) => (ph === 'done' ? 'idle' : ph));
      } else {
        setBarrier((b) => ({ ...b, countdown: left }));
      }
    }, 1000);
  }

  function rejectVehicle() {
    setVehReject(true);
    setTimeout(() => { setVehReject(false); setStageVeh(null); }, 1200);
  }

  const cachedVehicle = () => cache.vehicles.find((x) => norm(x.plate_number) === norm(plate));
  const tariffFor = (v) => v && cache.tariffs.find((t) => t.gate_id === gateId && t.vehicle_class === v.vehicle_class);

  const PRESETS = [
    ...cache.vehicles.map((v) => {
      const t = cache.tariffs.find((x) => x.gate_id === gateId && x.vehicle_class === v.vehicle_class);
      const fee = t ? Math.round(t.base_fee * (1 - RATES[t.discount_type || 'none'])) : null;
      const behavior = fee == null
        ? 'no tariff at this plaza'
        : (v.balance >= fee ? 'pays from balance' : 'MoMo fallback');
      return { icon: EMOJI[v.vehicle_class] || '🚗', plate: v.plate_number,
               label: `${v.plate_number} · ${v.owner} · ${zmw(v.balance)} · ${behavior}` };
    }),
    { icon: '❓', plate: 'UNREG 999', label: 'UNREG 999 · unregistered → violation' },
  ];

  const preview = (() => {
    if (!plate.trim()) return 'Type a plate or pick a registered vehicle.';
    const v = cachedVehicle();
    if (!v) return 'Unregistered plate — will be directed to the manual lane.';
    const t = tariffFor(v);
    if (!t) return `No tariff for ${CLASSES[v.vehicle_class]} at this plaza.`;
    const fee = Math.round(t.base_fee * (1 - RATES[t.discount_type || 'none']));
    return `${v.owner} · ${CLASSES[v.vehicle_class]} · fee ${zmw(fee)} here · balance ${zmw(v.balance)}`;
  })();

  function applyPreset(p) {
    setPlate(p.plate);
    setAutoMode(false);
    setPhase('idle'); setTele(null); setStageVeh(null); setRfid(null); setAlert(null);
    setVehExit(false); setVehReject(false); setError(null);
  }

  function arrive() {
    if (!gate || !plate.trim() || running) return;
    setError(null); setAlert(null); setRfid(null); setVehExit(false); setVehReject(false); setTele(null);
    setPhase('scanning');
    const known = cachedVehicle();
    setStageVeh({ plate: norm(plate), vehicle_class: known?.vehicle_class, unregistered: !known });
    setTimeout(() => {
      setConf((96 + Math.random() * 3.7).toFixed(1));
      const v = cachedVehicle();
      const t = tariffFor(v);
      if (v && t) {
        setTele({ ...v, plate: v.plate_number, tag: v.rfid_tag_id,
                  baseFee: t.base_fee, discount: t.discount_type,
                  fee: Math.round(t.base_fee * (1 - RATES[t.discount_type || 'none'])) });
        setStageVeh({ plate: v.plate_number, vehicle_class: v.vehicle_class, unregistered: false });
        setPhase('detected');
      } else if (v) {
        setTele({ ...v, plate: v.plate_number, tag: v.rfid_tag_id,
                  baseFee: null, discount: 'none', fee: null });
        setAlert({ kind: 'err', text: `No tariff configured for ${CLASSES[v.vehicle_class]} at ${gate.name} — manual lane.` });
        setPhase('manual');
      } else {
        setTele({ plate: norm(plate), unregistered: true });
        setPhase('unregistered');
      }
    }, 1600);
  }

  function scanRfid() {
    if (phase !== 'detected' || rfid || !tele) return;
    setRfid(tele.tag ? { ok: true, tag: tele.tag } : { ok: false, tag: null });
  }

  function handleDecision(d) {
    setAutoMode(false);
    if (d.decision !== 'momo_pending') momoAutoRef.current = false;
    if (d.decision === 'open') {
      const method = d.payment_method === 'prepaid_pass' ? 'Toll pass'
                   : d.payment_method === 'mobile_money' ? 'MoMo' : 'Balance';
      addFeed({ ref: d.transaction_id, plate: d.vehicle?.plate_number || tele?.plate,
                amount: d.amount, method, status: 'paid', note: d.reason });
      setTele((t) => (t ? { ...t, balance: d.balance_after ?? t.balance } : t));
      setAlert({ kind: 'ok', text: d.reason === 'PASS_REDEEMED'
        ? 'Prepaid toll pass redeemed — balance untouched!'
        : d.reason === 'EXEMPT' ? 'Exempt vehicle — barrier opening, no charge.'
        : `Toll settled: ${zmw(d.amount)} deducted from balance. Barrier opening.` });
      barrierSequence(4);
      setPhase('done');
    } else if (d.decision === 'momo_pending') {
      setMomo({ ref: d.payment_reference, amount: d.amount, owner: tele?.owner,
                phone: tele?.phone, provider: PROVIDERS[providerFromPhone(tele?.phone)] });
      setShowMomo(true);
      setPhase('momo');
      setAlert({ kind: 'info', text: `Mobile-money prompt ${d.payment_reference} pushed to ${tele?.owner}'s phone (${tele?.phone}).` });
    } else {
      rejectVehicle();
      if (d.reason === 'VEHICLE_NOT_FOUND' && gate) {
        gateCall('/gate/violations', gate,
                 { plate_number: tele?.plate, captured_at: new Date().toISOString() })
          .then(() => setAlert((a) => (a ? { ...a, text: a.text + ' Violation filed for enforcement.' } : a)))
          .catch(() => {});
      }
      addFeed({ ref: null, plate: tele?.plate, amount: null, method: 'Manual lane',
                status: 'failed', note: d.reason });
      setAlert({ kind: 'err', text: `Vehicle directed to the MANUAL LANE — ${d.reason.replace(/_/g, ' ').toLowerCase()}.` });
      setPhase('manual');
    }
  }

  async function payOnline() {
    if (!['detected', 'unregistered'].includes(phase) || !gate || busy) return;
    setBusy(true);
    try {
      const d = await gateCall('/gate/transactions', gate, {
        transaction_id: crypto.randomUUID(),
        captured_at: new Date().toISOString(),
        plate_number: tele?.plate,
        rfid_tag_id: rfid?.ok ? tele.tag : null,
      });
      handleDecision(d);
    } catch (e) {
      setError(e.message);
      setAlert({ kind: 'err', text: `Gate API error: ${e.message}` });
      setPhase('manual');
    } finally { setBusy(false); }
  }

  function payOffline() {
    if (phase !== 'detected' || !gate) return;
    setAutoMode(false);
    const amount = tele.baseFee;
    const entry = {
      transaction_id: crypto.randomUUID(), gate_id: gateId,
      plate_number: tele.plate, rfid_tag_id: rfid?.ok ? tele.tag : null,
      captured_at: new Date().toISOString(), amount,
    };
    persistQueue([...queue, entry]);
    addFeed({ ref: entry.transaction_id, plate: tele.plate, amount,
              method: 'Queued (offline)', status: 'queued', note: 'stored in edge queue' });
    setAlert({ kind: 'ok', text: `Barrier opened OFFLINE — ${zmw(amount)} queued locally. It settles on sync.` });
    barrierSequence(4);
    setPhase('done');
  }

  async function momoAct(verb) {
    if (!momo || !gate) return;
    setShowMomo(false);
    try {
      await api(`/mock/momo/${momo.ref}/${verb}`, { method: 'POST' });
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const p = await gateCall(`/gate/payments/${momo.ref}`, gate, null, 'GET');
        if (p.status === 'approved') {
          addFeed({ ref: p.transaction_id, plate: tele?.plate, amount: p.amount,
                    method: 'MoMo', status: 'paid', note: 'approved on phone' });
          setAlert({ kind: 'ok', text: `Mobile money approved — ${zmw(p.amount)} settled. Barrier opening.` });
          barrierSequence(4); setPhase('done');
          return;
        }
        if (p.status === 'declined' || p.status === 'timeout') {
          addFeed({ ref: null, plate: tele?.plate, amount: momo.amount, method: 'MoMo',
                    status: 'failed', note: `MOMO_${p.status.toUpperCase()}` });
          setAlert({ kind: 'err', text: `Motorist ${p.status === 'declined' ? 'declined' : 'did not answer'} the prompt — manual lane.` });
          rejectVehicle();
          setPhase('manual');
          return;
        }
      }
    } catch (e) { setError(e.message); }
  }

  async function sync() {
    if (!queue.length || !gates.length) return;
    const byGate = {};
    queue.forEach((q) => { (byGate[q.gate_id] = byGate[q.gate_id] || []).push(q); });
    for (const [gid, entries] of Object.entries(byGate)) {
      const g = gates.find((x) => x.gate_id === gid);
      if (!g) continue;
      try {
        const res = await gateCall('/gate/transactions/sync', g, {
          transactions: entries.map((e) => ({
            transaction_id: e.transaction_id, plate_number: e.plate_number,
            rfid_tag_id: e.rfid_tag_id, captured_at: e.captured_at, amount: e.amount,
          })),
        });
        res.results.forEach((r) => addFeed({
          ref: r.transaction_id, plate: '(queue)', amount: null, method: 'Offline sync',
          status: r.status, note: `${r.result}${r.reason ? ' · ' + r.reason : ''}` }));
      } catch (e) {
        addFeed({ ref: null, plate: '(queue)', amount: null, method: 'Offline sync', status: 'failed', note: e.message });
      }
    }
    persistQueue([]);
  }

  async function autopilot(count = 10) {
    if (running || !gate || !cache.vehicles.length) return;
    setRunning(true);
    for (let i = 0; i < count; i++) {
      const target = Math.random() < 0.15
        ? { plate_number: randPlate(), rfid_tag_id: null }
        : (() => { const v = cache.vehicles[Math.floor(Math.random() * cache.vehicles.length)];
                   return { plate_number: v.plate_number, rfid_tag_id: v.rfid_tag_id }; })();
      const known = cache.vehicles.find((v) => v.plate_number === target.plate_number);
      setVehExit(false); setVehReject(false);
      setStageVeh({ plate: target.plate_number, vehicle_class: known?.vehicle_class,
                    unregistered: !known });
      await new Promise((r) => setTimeout(r, 450));
      try {
        const d = await gateCall('/gate/transactions', gate, {
          transaction_id: crypto.randomUUID(), captured_at: new Date().toISOString(),
          plate_number: target.plate_number, rfid_tag_id: target.rfid_tag_id });
        if (d.decision === 'open') {
          addFeed({ ref: d.transaction_id, plate: d.vehicle?.plate_number || target.plate_number,
                    amount: d.amount, method: d.payment_method === 'prepaid_pass' ? 'Toll pass' : 'Balance',
                    status: 'paid', note: d.reason });
          barrierSequence(2);
        } else if (d.decision === 'momo_pending') {
          if (Math.random() < 0.8) {
            await api(`/mock/momo/${d.payment_reference}/approve`, { method: 'POST' });
            await new Promise((r) => setTimeout(r, 500));
            const p = await gateCall(`/gate/payments/${d.payment_reference}`, gate, null, 'GET');
            if (p.status === 'approved') {
              addFeed({ ref: p.transaction_id, plate: target.plate_number, amount: p.amount,
                        method: 'MoMo', status: 'paid', note: 'approved' });
              barrierSequence(2);
            }
          } else {
            await api(`/mock/momo/${d.payment_reference}/decline`, { method: 'POST' });
            rejectVehicle();
            addFeed({ ref: null, plate: target.plate_number, amount: d.amount,
                      method: 'MoMo', status: 'failed', note: 'declined' });
          }
        } else {
          rejectVehicle();
          addFeed({ ref: null, plate: target.plate_number, amount: null,
                    method: 'Manual lane', status: 'failed', note: d.reason });
        }
      } catch { /* skip vehicle */ }
      await new Promise((r) => setTimeout(r, 800));
    }
    setRunning(false);
    setStageVeh(null);
  }

  // 🤖 hands-free engine: waits for the EDGE CACHE before arriving,
  // then: arrive → RFID → pay → auto-approve MoMo if needed
  useEffect(() => {
    if (!autoMode) return;
    if (phase === 'idle' && plate && gates.length > 0 && cache.vehicles.length > 0) {
      const t = setTimeout(() => arrive(), 500);
      return () => clearTimeout(t);
    }
    if (phase === 'detected' && !rfid) {
      const t = setTimeout(() => scanRfid(), 800);
      return () => clearTimeout(t);
    }
    if (phase === 'detected' && rfid) {
      const t = setTimeout(() => {
        setAutoMode(false);
        if (offline) payOffline(); else payOnline();
      }, 1100);
      return () => clearTimeout(t);
    }
    if (phase === 'unregistered') {
      const t = setTimeout(() => { setAutoMode(false); payOnline(); }, 1500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, phase, rfid, plate, gates, offline, cache.vehicles.length]);

  useEffect(() => {
    if (phase === 'momo' && momoAutoRef.current && momo) {
      const t = setTimeout(() => { momoAutoRef.current = false; momoAct('approve'); }, 2600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, momo]);

  const canArrive = ['idle', 'manual'].includes(phase) && !running;
  const insufficient = tele && tele.fee != null && tele.balance != null && tele.balance < tele.fee;

  return (
    <div className="cg-wrap">
      <div className="cg-head">
        <div>
          <h2>🎮 Tollgate Simulation Cockpit</h2>
          <p className="dash-sub">
            The edge controller, visualized — vehicle identification, payment verification and barrier control. No hardware required.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="chip balance">Hardware simulation mode</span>
          <Link to="/admin" className="btn btn-light btn-sm">← Admin portal</Link>
        </div>
      </div>

      <div className="cg-presets">
        <span className="hint">Demo presets:</span>
        {PRESETS.map((p) => (
          <button key={p.plate} className="cg-preset" onClick={() => applyPreset(p)}>
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {autoMode && (
        <div className="cg-alert info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="auto-dot">🤖</span>
          <span style={{ flex: 1 }}><strong>Hands-free mode</strong> — vehicle will be identified, verified and charged automatically…</span>
          <button className="btn btn-light btn-sm" onClick={() => setAutoMode(false)}>✋ Stop</button>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div className="cg-grid">
        {/* ---- Left: lane controller ---- */}
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">🎚️ Tollgate lane controller</div>
            <span className="chip balance">Operator cockpit</span>
          </div>

          <div className="field">
            <label>Toll plaza</label>
            <select value={gateId} onChange={(e) => setGateId(e.target.value)}>
              {gates.map((g) => <option key={g.gate_id} value={g.gate_id}>{g.name}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Active lane</label>
            <select value={lane} onChange={(e) => setLane(e.target.value)}>
              {LANES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>

          <div className="field">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Vehicle registration</span>
              <span className="chip balance">📷 ANPR sim</span>
            </label>
            <input className="cg-plate-input" value={plate}
                   onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="ABC 1234" />
            <select style={{ marginTop: 8 }} value=""
                    onChange={(e) => e.target.value && setPlate(e.target.value)}>
              <option value="">— or pick a registered vehicle —</option>
              {cache.vehicles.map((v) => (
                <option key={v.plate_number} value={v.plate_number}>
                  {v.plate_number} · {CLASSES[v.vehicle_class]} · {v.owner}
                </option>
              ))}
            </select>
            <a href="/simulator/camera" className="btn btn-light btn-sm"
               style={{ marginTop: 10, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
              📷 Scan a plate with your camera
            </a>
          </div>

          <div className="topup-summary" style={{ margin: '4px 0 16px' }}>{preview}</div>

          <div style={{ display: 'grid', gap: 10 }}>
            <button className="btn btn-primary btn-lg" onClick={arrive}
                    disabled={!canArrive || !plate.trim()}>
              🚗 Vehicle Arrives
            </button>
            <button className="btn btn-light" onClick={scanRfid}
                    disabled={phase !== 'detected' || !!rfid}>
              📡 Simulate RFID / E-Tag Scan
            </button>
            <label className="sim-toggle">
              <input type="checkbox" checked={offline} onChange={(e) => setOffline(e.target.checked)} />
              📶 Offline mode (network down at the gate)
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {queue.length > 0 && (
                <button className="btn btn-light btn-sm" onClick={sync}>☁️ Sync {queue.length} queued</button>
              )}
              <button className="btn btn-light btn-sm" onClick={() => autopilot(10)} disabled={running}>
                {running ? 'Running…' : '⚡ Autopilot ×10'}
              </button>
            </div>
          </div>
        </div>

        {/* ---- Right: stage + telemetry ---- */}
        <div>
          <div className="cg-stage">
            <div className="cg-stage-top">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="cg-cam"><span className="rec">●</span> LANE CAM — LIVE</span>
                <span style={{ fontSize: 12.5, color: 'var(--mist)' }}>
                  {gate?.name} · {lane}{offline ? ' · OFFLINE' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {barrier.countdown !== null && (
                  <span className="cg-countdown">auto-closing in {barrier.countdown}s</span>
                )}
                <span className={`cg-status-badge ${barrier.open ? 'open' : 'closed'}`}>
                  {barrier.open ? 'OPEN' : 'CLOSED'}
                </span>
              </div>
            </div>

            <div className="cg-road">
              {phase === 'scanning' && !running && <div className="cg-laser" />}
              <div className="cg-dashline" />
              {stageVeh && (
                <div className={`cg-veh ${phase === 'scanning' && !running ? 'arriving' : ''} ${vehExit ? 'exit' : ''} ${vehReject ? 'rejected' : ''}`}>
                  <div className="cg-car-flip" style={{ fontSize: 42, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.5))' }}>
                    {stageVeh.unregistered ? '❓' : EMOJI[stageVeh.vehicle_class] || '🚗'}
                  </div>
                  <div className="cg-plate-badge">{stageVeh.plate}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
                    {stageVeh.unregistered ? 'Unregistered' : CLASSES[stageVeh.vehicle_class]}
                  </div>
                </div>
              )}
              <div className="cg-tlight">
                <div className={`cg-bulb red ${barrier.open ? '' : 'on'}`} />
                <div className={`cg-bulb green ${barrier.open ? 'on' : ''}`} />
              </div>
              <div className="cg-pole" />
              <div className={`cg-arm ${barrier.open ? 'up' : ''}`} />
            </div>
          </div>

          {tele && (
            <section className="panel" style={{ marginTop: 20 }}>
              <div className="panel-head">
                <div className="panel-title">🪪 Toll account &amp; sensor telemetry</div>
                {!tele.unregistered && <span className="chip balance">ANPR confidence: {conf}%</span>}
              </div>

              {tele.unregistered ? (
                <div className="cg-alert err">
                  Plate <strong className="mono">{tele.plate}</strong> is not registered on the platform.
                  The vehicle will be directed to the manual lane, and a violation record can be filed
                  for enforcement.
                </div>
              ) : (
                <>
                  <div className="tele-grid">
                    <div className="tele-item"><small>Plate</small><div className="tele-big mono">{tele.plate}</div></div>
                    <div className="tele-item"><small>Classification</small><div>{CLASSES[tele.vehicle_class]}</div></div>
                    <div className="tele-item"><small>Toll tariff</small><div className="tele-big ok">{tele.fee != null ? zmw(tele.fee) : '—'}</div></div>
                    <div className="tele-item"><small>Registered owner</small><div>{tele.owner}</div></div>
                    <div className="tele-item"><small>Account</small><div className="mono">{tele.account}</div></div>
                    <div className="tele-item"><small>Windshield e-tag</small><div className="mono">{tele.tag || 'none'}</div></div>
                    <div className="tele-item"><small>Balance (edge snapshot)</small><div className="tele-big ok">{tele.balance != null ? zmw(tele.balance) : '—'}</div></div>
                    <div className="tele-item"><small>Motorist phone</small><div className="mono">{tele.phone}</div></div>
                  </div>

                  {rfid && (
                    <div className="cg-rfid">
                      📡 {rfid.ok
                        ? `E-Tag verified: ${rfid.tag} — matches ANPR plate (dual-mode cross-check passed)`
                        : 'No e-tag detected — proceeding on ANPR-only identification'}
                    </div>
                  )}
                </>
              )}

              {alert && <div className={`cg-alert ${alert.kind}`}>{alert.text}</div>}

              {phase === 'detected' && (
                <div style={{ display: 'grid', gap: 10 }}>
                  {offline ? (
                    <button className="btn btn-primary btn-lg btn-pulse" onClick={payOffline}>
                      ⚡ Verify &amp; Deduct Toll Fee (Offline Queue)
                    </button>
                  ) : insufficient ? (
                    <button className="btn btn-primary btn-lg btn-pulse" onClick={payOnline} disabled={busy}>
                      📱 Request Mobile Money Payment (balance insufficient)
                    </button>
                  ) : (
                    <button className="btn btn-primary btn-lg btn-pulse" onClick={payOnline} disabled={busy}>
                      ⚡ Verify &amp; Deduct Toll Fee (E-Tag / Balance)
                    </button>
                  )}
                  {tele.discount && tele.discount !== 'none' && (
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>
                      Includes {Math.round(RATES[tele.discount] * 100)}% {tele.discount.replace('_', ' ')} discount
                      (base fare {zmw(tele.baseFee)}).
                    </p>
                  )}
                </div>
              )}

              {phase === 'unregistered' && (
                <button className="btn btn-lg" style={{ background: 'var(--error)', color: '#fff' }}
                        onClick={payOnline} disabled={busy}>
                  🚧 Direct to Manual Lane &amp; File Violation
                </button>
              )}

              {phase === 'momo' && (
                <button className="btn btn-primary" onClick={() => setShowMomo(true)}>
                  📱 Show mobile-money prompt again
                </button>
              )}
            </section>
          )}
        </div>
      </div>

      {/* ---- Transaction feed ---- */}
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head">
          <div className="panel-title">🧾 Transactions generated by this simulation</div>
          <Link to="/admin/transactions" className="panel-link">View all in admin portal →</Link>
        </div>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr><th>Time</th><th>Ref</th><th>Plate</th><th>Plaza · Lane</th><th>Amount</th><th>Method</th><th>Status</th><th>Note</th></tr>
            </thead>
            <tbody>
              {feed.length === 0 && (
                <tr><td colSpan={8} className="empty">No passages yet — click “Vehicle Arrives” or scan a plate.</td></tr>
              )}
              {feed.map((r, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: 12 }}>{r.time}</td>
                  <td><code>{r.ref ? r.ref.slice(0, 8).toUpperCase() : '—'}</code></td>
                  <td><strong>{r.plate}</strong></td>
                  <td>{r.plaza} · {r.lane.split(' ·')[0]}</td>
                  <td>{r.amount != null ? zmw(r.amount) : '—'}</td>
                  <td>{r.method}</td>
                  <td><span className={`chip ${r.status === 'paid' ? 'paid' : r.status === 'queued' ? 'pending' : 'failed'}`}>{r.status}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Simulated phone (momo modal) ---- */}
      {showMomo && momo && (
        <div className="modal-overlay" onClick={() => setShowMomo(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="msg-type">📱 Simulated mobile-money prompt — {momo.owner}'s phone</div>
            <div style={{ fontWeight: 800, fontSize: 19, margin: '10px 0 4px' }}>
              Pay {zmw(momo.amount)} to TollPay?
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 18, lineHeight: 1.6 }}>
              {momo.provider} · {momo.phone} · ref <strong>{momo.ref}</strong><br />
              This is the USSD push the motorist receives while at the gate.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={() => momoAct('approve')}>✓ Approve (PIN correct)</button>
              <button className="btn btn-light" onClick={() => momoAct('decline')}>✗ Decline</button>
              <button className="btn-timeout" onClick={() => momoAct('timeout')}>simulate no response</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}