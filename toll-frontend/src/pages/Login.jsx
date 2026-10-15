import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { login } from '../api/auth';
import { setTokens } from '../api/client';
import kamanga from '../assets/kamanga.jpg';

export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data = await login(identifier.trim(), password);
      setTokens(data.access_token, data.refresh_token);
      const dest = ['admin', 'auditor', 'super_admin'].includes(data.user.role) ? '/admin' : '/app';
      navigate(dest);
    } catch (err) {
      if (err.code === 'UNVERIFIED_ACCOUNT') {
        if (identifier.includes('@')) {
          setError('Your account is not verified. Log in with your phone number to receive the code.');
        } else {
          navigate('/otp', { state: { phone: identifier.trim() } });
        }
        return;
      }
      setError(err.code === 'INVALID_CREDENTIALS'
        ? 'Wrong phone/email or password.'
        : err.message);
    } finally {
      setBusy(false);
    }
  }

  const demoFill = (id, pw) => { setIdentifier(id); setPassword(pw); };

  return (
    <AuthLayout
      image={kamanga}
      kicker="Welcome back"
      title="Find your fast lane."
      subtitle="Kamanga Toll Plaza — one of the gates TollPay automates. Log in to manage vehicles, top up your wallet and review your toll history."
      bullets={['No stopping at the gate', 'Mobile money top-ups', 'Instant toll receipts']}
    >
      <h2>Welcome back to TollPay!</h2>
      <p className="auth-sub">Log in to your account</p>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="identifier">Phone or email</label>
          <input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                 placeholder="+260971234567" autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="pw-wrap">
            <input id="password" type={showPw ? 'text' : 'password'} value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   autoComplete="current-password" required minLength={8} />
            <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        <button className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="auth-alt">New to TollPay? <Link to="/register">Create an account</Link></p>

      <div className="demo-hint">
        <strong>Demo accounts</strong>
        <button type="button" onClick={() => demoFill('+260977123456', 'password123')}>
          Motorist — +260977123456 / password123
        </button>
        <button type="button" onClick={() => demoFill('+260970000001', 'admin123')}>
          Admin — +260970000001 / admin123
        </button>
      </div>
    </AuthLayout>
  );
}