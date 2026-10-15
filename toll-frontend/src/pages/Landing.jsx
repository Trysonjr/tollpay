import HeroScene from '../components/HeroScene';
import Reveal from '../components/Reveal';
import katuba from '../assets/katuba.jpg';
import lanes from '../assets/lanes.jpg';

export default function Landing() {
  return (
    <div>
      {/* 1 — Nav */}
      <nav style={{ background: 'var(--darkest)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
          <a href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 20 }}>
            Toll<span style={{ color: 'var(--accent)' }}>Pay</span>
            <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 10, opacity: 0.7 }}>
              Zambia's automated tolling platform
            </span>
          </a>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="/login" className="btn btn-outline" style={{ padding: '8px 20px' }}>Log in</a>
            <a href="/register" className="btn btn-primary" style={{ padding: '8px 20px' }}>Get started</a>
          </div>
        </div>
      </nav>

      {/* 2 — Hero */}
      <header style={{
        background: 'linear-gradient(160deg, var(--primary) 0%, var(--slate) 100%)',
        color: '#fff', textAlign: 'center', padding: '90px 24px 100px',
      }}>
        <div className="container">
          <Reveal>
            <p className="kicker" style={{ color: 'var(--accent)' }}>Automated toll collection</p>
          </Reveal>
          <Reveal delay={100}>
            <h1>Pass through the toll gate<br />without stopping.</h1>
          </Reveal>
          <Reveal delay={200}>
            <p style={{ fontSize: 18, maxWidth: 560, margin: '20px auto 0', opacity: 0.9 }}>
              TollPay identifies your vehicle automatically, deducts the toll from your
              wallet, and opens the barrier — before you even reach it.
            </p>
          </Reveal>

          <Reveal delay={320}><HeroScene /></Reveal>

          <Reveal delay={450}>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginTop: 40 }}>
              <a href="/register" className="btn btn-primary">Create your account</a>
              <a href="#how-it-works" className="btn btn-outline">How it works</a>
            </div>
          </Reveal>
        </div>
      </header>

      {/* 3 — Problem */}
      <section className="section">
        <div className="container">
          <Reveal>
            <p className="kicker">The problem</p>
            <h2 style={{ marginBottom: 40 }}>Toll queues are costing Zambia time and money.</h2>
          </Reveal>

          <Reveal delay={120}>
            <div className="img-banner">
              <img src={lanes} alt="Vehicles queuing at RFID and cash toll lanes" />
              <div className="img-caption">
                Today's plazas: vehicles queue at RFID and cash lanes, and every
                transaction needs a stop, a tap, or cash.
              </div>
            </div>
          </Reveal>

          <div className="grid-3">
            {[
              { icon: '🚗', title: 'Long queues', text: 'Every vehicle must stop or slow to a halt at the booth — lanes jam during holidays and month-end travel.' },
              { icon: '💵', title: 'Cash handling risk', text: 'Manual collection invites errors, under-declaration and pilferage — and makes reconciliation slow.' },
              { icon: '📄', title: 'No visibility', text: "Motorists can't review their toll history; administrators lack real-time revenue and traffic data." },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 120}>
                <div className="card">
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{c.icon}</div>
                  <h3 style={{ marginBottom: 8, fontSize: 18 }}>{c.title}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>{c.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4 — Solution */}
      <section className="section section-dark">
        <div className="container">
          <Reveal>
            <p className="kicker">The solution</p>
            <h2 style={{ marginBottom: 40, color: '#fff' }}>One platform. Every journey settled automatically.</h2>
          </Reveal>
          <div className="grid-3">
            {[
              { icon: '📷', title: 'Dual identification', text: 'ANPR cameras read your plate while RFID verifies your e-tag — two checks, no stopping, under 2 seconds.' },
              { icon: '📱', title: 'Mobile money built in', text: 'Top up with Airtel Money, MTN MoMo or Zamtel Kwacha. Low balance? Approve the toll right from your phone.' },
              { icon: '📶', title: 'Works offline', text: 'If the network drops, the gate queues your transaction locally and settles it the moment connectivity returns.' },
              { icon: '🧾', title: 'Instant receipts', text: 'Every passage generates a receipt and notification with a unique transaction ID you can trace.' },
              { icon: '🚌', title: 'Fleet accounts', text: 'Manage many vehicles under one organizational profile with a shared balance.' },
              { icon: '🔒', title: 'Secure by design', text: 'Payments encrypted in transit, role-based admin access, and a full audit trail of every action.' },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 90}>
                <div className="card" style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'none' }}>
                  <div style={{ fontSize: 30, marginBottom: 10 }}>{f.icon}</div>
                  <h3 style={{ marginBottom: 8, fontSize: 18, color: 'var(--mist)' }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 5 — How it works */}
      <section className="section section-soft" id="how-it-works">
        <div className="container">
          <Reveal>
            <p className="kicker">How it works</p>
            <h2 style={{ marginBottom: 40 }}>Three steps. Zero stopping.</h2>
          </Reveal>
          <div className="grid-3">
            {[
              { n: '1', title: 'Register', text: 'Create your account, add your vehicle and its plate number or e-tag.' },
              { n: '2', title: 'Top up', text: 'Load your wallet with mobile money — or let TollPay prompt you at the gate if funds run low.' },
              { n: '3', title: 'Drive through', text: 'The gate identifies you, settles the toll and opens the barrier — all before you arrive.' },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 140}>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)',
                    color: 'var(--darkest)', fontWeight: 800, fontSize: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 14px',
                  }}>{s.n}</div>
                  <h3 style={{ marginBottom: 8, fontSize: 18 }}>{s.title}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={150}>
            <div className="img-banner" style={{ marginTop: 40, marginBottom: 0 }}>
              <img src={katuba} alt="Katuba Toll Plaza" />
              <div className="img-caption">
                Katuba Toll Plaza, Lusaka–Kabwe Road — one of the plazas in this
                system's demo data. TollPay extends, rather than replaces, the NRFA's
                existing E-Toll infrastructure.
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 6 — Final CTA + footer */}
      <section className="section" style={{ textAlign: 'center', background: 'var(--bg)' }}>
        <div className="container">
          <Reveal>
            <h2 style={{ marginBottom: 16 }}>Ready to skip the queue?</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 17 }}>
              Set up your account in under five minutes.
            </p>
          </Reveal>
          <Reveal delay={150}>
            <a href="/register" className="btn btn-primary">Get started — it's free</a>
          </Reveal>
        </div>
      </section>

      <footer style={{ background: 'var(--darkest)', color: 'var(--mist)', padding: '32px 24px', fontSize: 14 }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <strong style={{ color: '#fff' }}>Toll<span style={{ color: 'var(--accent)' }}>Pay</span></strong> — extending Zambia's E-Toll infrastructure.
          </div>
          <div style={{ opacity: 0.7 }}>
            Mini Project · Tryson Banda · {new Date().getFullYear()}
          </div>
        </div>
      </footer>
    </div>
  );
}