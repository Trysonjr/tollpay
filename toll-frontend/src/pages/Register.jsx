import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { register } from '../api/auth';
import abala from '../assets/abala.jpg';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '', phone_number: '+260', email: '', password: '',
    account_type: 'individual', organization_name: '',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (form.account_type === 'fleet' && !form.organization_name.trim()) {
      setError('Organization name is required for fleet accounts.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        phone_number: form.phone_number.trim(),
        password: form.password,
        account_type: form.account_type,
      };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.account_type === 'fleet') payload.organization_name = form.organization_name.trim();
      await register(payload);
      navigate('/otp', { state: { phone: payload.phone_number } });
    } catch (err) {
      const msgs = {
        DUPLICATE_PHONE: 'That phone number is already registered — try logging in.',
        DUPLICATE_EMAIL: 'That email is already registered.',
      };
      setError(msgs[err.code] || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      image={abala}
      imgPosition="bottom"
      kicker="Join for free"
      title="The last toll queue you'll ever wait in."
      subtitle="Every vehicle in this picture stops to pay. Yours won't. Create an account, register your vehicle, and drive through."
      bullets={['Free to create', 'Works with Airtel, MTN and Zamtel', 'Your toll history, always at hand']}
      actions={[
        { label: 'How it works', to: '/' },
        { label: 'Log in', to: '/login', solid: true },
      ]}
    >
      <h2>Create new account</h2>
      <p className="auth-sub">It takes less than five minutes</p>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Full name</label>
          <input value={form.full_name} onChange={set('full_name')} required minLength={2} placeholder="Tryson Banda" />
        </div>
        <div className="field">
          <label>Phone number</label>
          <input value={form.phone_number} onChange={set('phone_number')} required placeholder="+260971234567" />
        </div>
        <div className="field">
          <label>Email (optional)</label>
          <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={form.password} onChange={set('password')} required minLength={8} placeholder="At least 8 characters" />
        </div>

        <div className="field">
          <label>Account type</label>
          <div className="seg">
            {['individual', 'fleet'].map((t) => (
              <button type="button" key={t}
                      className={form.account_type === t ? 'seg-btn active' : 'seg-btn'}
                      onClick={() => setForm({ ...form, account_type: t })}>
                {t === 'individual' ? 'Individual' : 'Fleet / Organization'}
              </button>
            ))}
          </div>
        </div>

        {form.account_type === 'fleet' && (
          <div className="field">
            <label>Organization name</label>
            <input value={form.organization_name} onChange={set('organization_name')} placeholder="Banda Haulage Ltd" />
          </div>
        )}

        <button className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="auth-alt">Already a member? <Link to="/login">Log in</Link></p>
    </AuthLayout>
  );
}