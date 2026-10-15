import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { API_BASE } from '../config';

export default function SimulatorCamera() {
  const videoRef = useRef(null);
  const redirectTimer = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    api('/dev/edge-cache').then((c) => setVehicles(c.vehicles)).catch(() => {});
    return () => {
      stop();
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sendToCockpit(v) {
    const payload = encodeURIComponent(JSON.stringify(v));
    window.location.href = `/simulator?scan=${payload}&auto=1`;
  }

  async function start() {
    setError(null); setResult(null);
    if (!('BarcodeDetector' in window)) {
      setError('This browser cannot detect QR codes on-device. Use Chrome on Android (or iOS 17+), or tap a sticker below.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const tick = async () => {
        if (!videoRef.current || result) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length) {
            const raw = codes[0].rawValue;
            if (raw.startsWith('TOLLPAY:')) {
              const [, plate, tag] = raw.split(':');
              onRead({ plate, tag });
              return;
            }
          }
        } catch { /* frame not ready */ }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (e) {
      setError(`Camera unavailable: ${e.message}`);
    }
  }

  function onRead(v) {
    setResult(v);
    stop();
    // hands-free: read confirmed → open the cockpit and let it run the whole flow
    redirectTimer.current = setTimeout(() => sendToCockpit(v), 1600);
  }

  function cancelRedirect() {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
  }

  function stop() {
    setScanning(false);
    const s = videoRef.current?.srcObject;
    s?.getTracks().forEach((t) => t.stop());
  }

  return (
    <div className="cg-wrap" style={{ maxWidth: 720 }}>
      <div className="cg-head">
        <div>
          <h2>📷 ANPR Camera Simulator</h2>
          <p className="dash-sub">
            Point your camera at a vehicle's QR plate-sticker. After the read, the gate
            processes the vehicle <strong>hands-free</strong> — identification, payment and barrier.
          </p>
        </div>
        <Link to="/simulator" className="btn btn-light btn-sm">← Cockpit</Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel" style={{ textAlign: 'center' }}>
        <video ref={videoRef} className="cam-view" playsInline muted
               style={{ display: scanning || result ? 'block' : 'none' }} />
        {!scanning && !result && (
          <div className="cam-placeholder">
            <div style={{ fontSize: 44 }}>📷</div>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              Camera ready — scan a QR plate, or tap a sticker below to test.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          {!scanning && !result && <button className="btn btn-primary" onClick={start}>▶ Start camera</button>}
          {scanning && <button className="btn btn-light" onClick={stop}>■ Stop</button>}
          {result && (
            <>
              <button className="btn btn-primary" onClick={() => sendToCockpit(result)}>
                🤖 Process {result.plate} hands-free →
              </button>
              <button className="btn btn-light" onClick={cancelRedirect}>Cancel auto-open</button>
            </>
          )}
        </div>
      </div>

      {result && (
        <div className="cg-alert ok" style={{ marginTop: 16 }}>
          🎯 Read successful — plate <strong>{result.plate}</strong>
          {result.tag ? <> · e-tag <strong>{result.tag}</strong></> : ' · no tag'} — opening gate cockpit…
        </div>
      )}

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-title" style={{ marginBottom: 12 }}>📋 QR plate stickers (print or second screen)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
          {vehicles.map((v) => (
            <div key={v.plate_number} style={{ textAlign: 'center' }}>
              <img src={`${API_BASE}/dev/vehicle-qr/${v.plate_number}`}
                   alt={`QR for ${v.plate_number}`}
                   style={{ width: '100%', borderRadius: 10, background: '#fff', padding: 6 }} />
              <div className="mono" style={{ fontSize: 13, marginTop: 6 }}>{v.plate_number}</div>
              <button className="veh-edit" style={{ marginTop: 4 }}
                      onClick={() => sendToCockpit({ plate: v.plate_number, tag: v.rfid_tag_id })}>
                process hands-free
              </button>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 12 }}>
          TIP: open this page on a second device and show the QR to your phone — a real two-device ANPR demo.
        </p>
      </div>
    </div>
  );
}