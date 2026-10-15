import { Link } from 'react-router-dom';

export default function AuthLayout({ image, kicker, title, subtitle, bullets, actions, imgPosition, children }) {
  return (
    <div className="auth-page">
      <aside className={imgPosition ? `auth-brand auth-img-${imgPosition}` : 'auth-brand'}>
        <img src={image} alt="" aria-hidden="true" />
        <div className="auth-brand-overlay" />
        <div className="auth-brand-content">
          <Link to="/" className="auth-logo">Toll<span>Pay</span></Link>
          <p className="kicker" style={{ color: 'var(--mist)' }}>{kicker}</p>
          <h2 className="auth-brand-title">{title}</h2>
          {subtitle && <p className="auth-brand-sub">{subtitle}</p>}
          {bullets && (
            <ul className="auth-bullets">
              {bullets.map((b) => <li key={b}>{b}</li>)}
            </ul>
          )}
          {actions && actions.length > 0 && (
            <div className="auth-actions">
              {actions.map((a) => (
                <Link key={a.label} to={a.to} className={a.solid ? 'btn btn-light' : 'btn btn-outline'}>
                  {a.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </aside>
      <main className="auth-form-panel">
        <div className="auth-form">
          <Link to="/" className="auth-back">← Back to home</Link>
          {children}
        </div>
      </main>
    </div>
  );
}