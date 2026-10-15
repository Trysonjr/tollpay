import { useContext, useEffect, useState } from 'react';
import { AppCtx } from '../AppShell';
import { getOutbox, momoApprove, momoDecline, momoTimeout } from '../../api/app';
import { zmw, PROVIDERS, timeAgo } from '../../utils/format';

export default function FakePhone() {
  const { me } = useContext(AppCtx);
  const [items, setItems] = useState([]);
  const [handled, setHandled] = useState({});
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    const tick = async () => {
      try { setItems(await getOutbox()); } catch { /* dev endpoint unavailable */ }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }, []);

  async function act(ref, verb) {
    if (handled[ref]) return;
    setHandled((h) => ({ ...h, [ref]: verb }));
    try {
      if (verb === 'approve') await momoApprove(ref);
      else if (verb === 'decline') await momoDecline(ref);
      else await momoTimeout(ref);
    } catch { setHandled((h) => ({ ...h, [ref]: undefined })); }
  }

  function copy(text) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const relevant = items.filter((o) => ['otp', 'momo_prompt', 'sms'].includes(o.type)).slice(0, 15);

  return (
    <div className="phone" style={{ margin: '0 auto', maxWidth: 380 }}>
      <div className="phone-head">
        <span>📱 Demo Phone</span>
        <span style={{ opacity: 0.7 }}>{me?.phone_number}</span>
      </div>
      <div className="phone-body" style={{ maxHeight: 520 }}>
        {relevant.length === 0 && (
          <div className="msg"><div className="msg-type">Status</div>No messages yet.</div>
        )}
        {relevant.map((o) => (
          <div key={o.id} className={`msg ${o.type === 'momo_prompt' ? 'msg-prompt' : ''}`}>
            <div className="msg-type">
              {o.type === 'otp' ? 'SMS · Verification code'
                : o.type === 'momo_prompt' ? PROVIDERS[o.payload.provider] || 'Mobile Money'
                : 'SMS'}
              <span style={{ float: 'right', fontWeight: 500, textTransform: 'none' }}>
                {timeAgo(o.created_at)}
              </span>
            </div>

            {o.type === 'otp' && (
              <>
                Your TollPay code: <strong style={{ letterSpacing: 2 }}>{o.payload.code}</strong>
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-light btn-sm" onClick={() => copy(o.payload.code)}>
                    {copied === o.payload.code ? 'Copied ✓' : 'Copy code'}
                  </button>
                </div>
              </>
            )}

            {o.type === 'sms' && <>{o.payload.text}</>}

            {o.type === 'momo_prompt' && (
              <>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  Pay {zmw(o.payload.amount)} to TollPay?
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12.5, marginBottom: 10 }}>
                  Ref {o.payload.reference} · enter your PIN to approve
                </div>
                {handled[o.payload.reference] ? (
                  <span className={`chip ${handled[o.payload.reference] === 'approve' ? 'paid' : 'failed'}`}>
                    {handled[o.payload.reference] === 'approve' ? '✓ Approved' : '✗ Declined'}
                  </span>
                ) : (
                  <div className="msg-actions">
                    <button className="btn btn-primary btn-sm"
                            onClick={() => act(o.payload.reference, 'approve')}>Approve</button>
                    <button className="btn btn-light btn-sm"
                            onClick={() => act(o.payload.reference, 'decline')}>Decline</button>
                    <button className="btn-timeout"
                            onClick={() => act(o.payload.reference, 'timeout')}>simulate timeout</button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid #EDF2F0' }}>
        Development only — in production these are real SMS / mobile-money prompts.
      </div>
    </div>
  );
}