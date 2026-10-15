import { useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppCtx } from '../AppShell';
import { initiateTopup, getTopup, getOutbox, momoApprove, momoDecline, getWallet } from '../../api/app';
import { zmw, PROVIDERS } from '../../utils/format';

export default function Topup() {
  const { me, refreshNotifs } = useContext(AppCtx);
  const [amount, setAmount] = useState('');
  const [provider, setProvider] = useState('airtel_money');
  const [phone, setPhone] = useState(me?.phone_number || '');
  const [error, setError] = useState(null);

  const [stage, setStage] = useState('form'); // form | waiting | done | failed
  const [topup, setTopup] = useState(null);
  const [balance, setBalance] = useState(null);
  const [prompt, setPrompt] = useState(null);   // matching outbox entry
  const [handled, setHandled] = useState(false); // approve/decline clicked
  const pollRef = useRef(null);

  useEffect(() => {
    if (me?.phone_number && !phone) setPhone(me.phone_number);
  }, [me]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  async function start(e) {
    e.preventDefault();
    setError(null);
    const ngwee = Math.round(parseFloat(amount) * 100);
    if (!ngwee || ngwee < 100) { setError('Enter at least ZMW 1.00.'); return; }
    try {
      const data = await initiateTopup({
        amount: ngwee, provider,
        phone_number: phone.trim() || undefined,
      });
      setTopup(data);
      setStage('waiting');
      setHandled(false);
      setPrompt(null);
      startPolling(data.topup_id, data.reference);
    } catch (err) {
      setError(err.message);
    }
  }

  function startPolling(topupId, reference) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const [t, outbox] = await Promise.all([getTopup(topupId), getOutbox()]);
        setTopup(t);
        setPrompt(outbox.find((o) => o.type === 'momo_prompt' && o.payload.reference === reference) || null);
        if (t.status === 'completed') {
          clearInterval(pollRef.current);
          setBalance(t.balance);
          setStage('done');
          refreshNotifs();
        } else if (t.status === 'failed') {
          clearInterval(pollRef.current);
          setStage('failed');
        }
      } catch { /* transient */ }
    }, 2000);
  }

  async function act(ref, verb) {
    if (handled) return;
    setHandled(true);
    try {
      if (verb === 'approve') await momoApprove(ref);
      else await momoDecline(ref);
    } catch { setHandled(false); }
    // next poll picks up the status change
  }

  function reset() {
    clearInterval(pollRef.current);
    setStage('form'); setTopup(null); setAmount(''); setPrompt(null);
    setHandled(false); setBalance(null);
  }

  const amtNgwee = Math.round(parseFloat(amount || 0) * 100);

  return (
    <div className="topup-wrap">
      <div className="topup-main">
        <h2 style={{ marginBottom: 4 }}>Top up wallet</h2>
        <p className="dash-sub" style={{ marginBottom: 24 }}>
          Pay with mobile money — approve the prompt on your phone.
        </p>

        {error && <div className="error-banner">{error}</div>}

        {stage === 'form' && (
          <form className="panel" onSubmit={start}>
            <div className="field">
              <label>Amount (ZMW)</label>
              <input type="number" min="1" step="0.01" value={amount}
                     onChange={(e) => setAmount(e.target.value)} placeholder="50.00" required />
            </div>
            <div className="field">
              <label>Provider</label>
              <div className="seg">
                {Object.entries(PROVIDERS).map(([k, label]) => (
                  <button type="button" key={k}
                          className={provider === k ? 'seg-btn active' : 'seg-btn'}
                          onClick={() => setProvider(k)}>{label}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Phone number</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+260971234567" />
            </div>
            <div className="topup-summary">
              You'll top up <strong>{zmw(amtNgwee)}</strong> via {PROVIDERS[provider]}
              {phone.trim() && <> to <strong>{phone.trim()}</strong></>}
            </div>
            <button className="btn btn-primary" disabled={!amtNgwee}>
              Send payment prompt
            </button>
          </form>
        )}

        {stage === 'waiting' && topup && (
          <div className="panel">
            <div className="panel-title" style={{ marginBottom: 6 }}>
              Prompt sent — check your phone
            </div>
            <p className="dash-sub">
              Reference <strong>{topup.reference}</strong> · {zmw(topup.amount)} via {PROVIDERS[topup.provider]} to {topup.phone_number}.
            </p>
            <div className="waiting-dots"><span /><span /><span /></div>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
              This page updates automatically the moment the payment is approved.
            </p>
            <button className="btn btn-light btn-sm" onClick={reset}>Cancel</button>
          </div>
        )}

        {stage === 'done' && (
          <div className="panel" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44 }}>✅</div>
            <div className="panel-title" style={{ fontSize: 20, margin: '8px 0' }}>
              Top-up successful
            </div>
            <p className="dash-sub">
              {zmw(topup.amount)} added{balance !== null && <> — new balance <strong>{zmw(balance)}</strong></>}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
              <button className="btn btn-primary" onClick={reset}>Top up again</button>
              <Link className="btn btn-light" to="/app">Back to dashboard</Link>
            </div>
          </div>
        )}

        {stage === 'failed' && (
          <div className="panel" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44 }}>😕</div>
            <div className="panel-title" style={{ fontSize: 20, margin: '8px 0' }}>
              Payment wasn't completed
            </div>
            <p className="dash-sub">The prompt was declined or timed out. No money was taken.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
              <button className="btn btn-primary" onClick={reset}>Try again</button>
              <Link className="btn btn-light" to="/app">Back to dashboard</Link>
            </div>
          </div>
        )}
      </div>

      {/* Embedded demo phone — the prompt appears here during waiting */}
      <aside className="phone">
        <div className="phone-head">
          <span>📱 Demo Phone</span>
          <span style={{ opacity: 0.7 }}>{me?.phone_number}</span>
        </div>
        <div className="phone-body">
          {stage === 'waiting' && prompt && !handled && (
            <div className="msg msg-prompt">
              <div className="msg-type">{PROVIDERS[prompt.payload.provider] || 'Mobile Money'}</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                Pay {zmw(prompt.payload.amount)} to TollPay?
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12.5, marginBottom: 10 }}>
                Ref {prompt.payload.reference} · enter your PIN to approve
              </div>
              <div className="msg-actions">
                <button className="btn btn-primary btn-sm"
                        onClick={() => act(prompt.payload.reference, 'approve')}>Approve</button>
                <button className="btn btn-light btn-sm"
                        onClick={() => act(prompt.payload.reference, 'decline')}>Decline</button>
              </div>
            </div>
          )}
          {stage === 'waiting' && prompt && handled && (
            <div className="msg">
              <div className="msg-type">Prompt</div>
              Waiting for the network to confirm…
            </div>
          )}
          {stage === 'waiting' && !prompt && (
            <div className="msg">
              <div className="msg-type">Status</div>
              Prompt delivered to your phone…
            </div>
          )}
          {stage === 'form' && (
            <div className="msg">
              <div className="msg-type">Demo Phone</div>
              Simulated messages (OTP codes, payment prompts) appear here during development.
              <div style={{ marginTop: 8 }}>
                <Link to="/app/fake-phone" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                  Open full Demo Phone →
                </Link>
              </div>
            </div>
          )}
          {stage === 'done' && (
            <div className="msg">
              <div className="msg-type">SMS</div>
              Confirmed: {zmw(topup.amount)} added to your TollPay wallet.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}