import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { verifyOtp, resendOtp } from '../api/auth';
import { api, setTokens } from '../api/client';
import lanes from '../assets/lanes.jpg';

const ERRORS = {
  INVALID_OTP: 'That code is incorrect — check the digits and try again.',
  OTP_EXPIRED: 'That code has expired. Send a new one.',
  OTP_MAX_ATTEMPTS: 'Too many wrong attempts. Send a new code.',
  OTP_RESEND_TOO_SOON: 'Please wait before requesting another code.',
  RATE_LIMITED: 'Too many requests — wait a minute and try again.',
};

export default function Otp() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [params] = useSearchParams();
  const phone = state?.phone || params.get('phone') || '';

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const inputs = useRef([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  if (!phone) return <Navigate to="/register" replace />;

  async function submit(codeStr) {
    setBusy(true);
    setError(null);
    try {
      const data = await verifyOtp(phone, codeStr);
      setTokens(data.access_token, data.refresh_token);
      navigate('/app');
    } catch (err) {
      setError(ERRORS[err.code] || err.message);
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  function setDigit(i, val) {
    const clean = val.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[i] = '';
      setDigits(next);
      return;
    }
    const next = [...digits];
    clean.split('').forEach((d, k) => { if (i + k < 6) next[i + k] = d; });
    setDigits(next);
    inputs.current[Math.min(i + clean.length, 5)]?.focus();
    const joined = next.join('');
    if (joined.length === 6 && !joined.includes('')) submit(joined);
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    try {
      await resendOtp(phone);
      setCountdown(60);
      setNotice('A new code has been sent.');
      setDigits(['', '', '', '', '', '']);
    } catch (err) {
      setError(ERRORS[err.code] || err.message);
      if (err.code === 'OTP_RESEND_TOO_SOON') setCountdown(60);
    }
  }

  async function fetchDevCode() {
    try {
      const items = await api('/dev/outbox');
      const otp = items.find((o) => o.type === 'otp' && o.to === phone);
      if (otp) {
        setDigits(otp.payload.code.split(''));
        setNotice(`Dev autofill: ${otp.payload.code}`);
      } else {
        setNotice('No code found in the outbox for this phone yet.');
      }
    } catch {
      setNotice('Dev helper unavailable.');
    }
  }

  return (
   <AuthLayout
  image={lanes}
  kicker="One last step"
      title="Verify your phone."
      subtitle="We sent a 6-digit code by SMS. Enter it below to activate your account."
    >
      <h2>Enter the code</h2>
      <p className="auth-sub">Sent to <strong>{phone}</strong></p>

      {error && <div className="error-banner">{error}</div>}
      {notice && (
        <div style={{ background: 'rgba(46,158,107,0.12)', color: 'var(--success)',
                      padding: '10px 14px', borderRadius: 10, fontSize: 14, marginBottom: 16 }}>
          {notice}
        </div>
      )}

      <div className="otp-row">
        {digits.map((d, i) => (
          <input key={i} ref={(el) => (inputs.current[i] = el)}
                 className="otp-box" inputMode="numeric" maxLength={6}
                 value={d}
                 onChange={(e) => setDigit(i, e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
                 }}
                 onPaste={(e) => {
                   e.preventDefault();
                   setDigit(0, e.clipboardData.getData('text'));
                 }}
                 disabled={busy} />
        ))}
      </div>

      <button className="btn btn-primary auth-submit" disabled={busy || digits.join('').length !== 6}
              onClick={() => submit(digits.join(''))}>
        {busy ? 'Verifying…' : 'Verify'}
      </button>

      <p className="auth-alt">
        {countdown > 0
          ? `Resend code in ${countdown}s`
          : <>Didn't get the code? <button type="button" onClick={handleResend}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)',
                       font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>
              Resend</button></>}
      </p>

      <div className="demo-hint">
        <strong>Dev helper</strong>
        <button type="button" onClick={fetchDevCode}>Fetch code from outbox &amp; autofill</button>
      </div>

      <p className="auth-alt"><Link to="/register">← Change phone number</Link></p>
    </AuthLayout>
  );
}