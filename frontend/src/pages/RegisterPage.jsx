import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AVATARS = ['🎮','🚀','🔥','💎','🦅','⚡','🎯','🌟','🦁','🐉'];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '', email: '', phone_number: '', password: '', password2: '', avatar: '🎮'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.password2) { setError('Passwords do not match'); return; }
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      const msgs = Object.values(err).flat();
      setError(msgs[0] || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      background: 'radial-gradient(ellipse at 50% 0%, rgba(52,152,219,0.06) 0%, transparent 60%)',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🚀</div>
          <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 26, fontWeight: 900, color: 'var(--accent-red)' }}>
            Join AVIATOR
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Create your account and start winning</p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          {error && <div className="alert alert-error"><i className="bi bi-exclamation-circle me-2"></i>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Avatar picker */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                CHOOSE YOUR AVATAR
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {AVATARS.map(a => (
                  <button key={a} type="button"
                    onClick={() => setForm({ ...form, avatar: a })}
                    style={{
                      fontSize: 22, padding: '4px 8px', background: 'none', border: 'none',
                      borderRadius: 8, cursor: 'pointer',
                      background: form.avatar === a ? 'rgba(230,57,70,0.2)' : 'var(--bg-secondary)',
                      outline: form.avatar === a ? '2px solid var(--accent-red)' : '2px solid transparent',
                      transition: 'all 0.15s',
                    }}>{a}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>USERNAME</label>
              <input className="input-field" type="text" placeholder="Choose a username"
                value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>EMAIL</label>
              <input className="input-field" type="email" placeholder="your@email.com"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>PHONE (M-Pesa)</label>
              <input className="input-field" type="tel" placeholder="254712345678"
                value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>PASSWORD</label>
              <input className="input-field" type="password" placeholder="Min 6 characters"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>CONFIRM PASSWORD</label>
              <input className="input-field" type="password" placeholder="Repeat password"
                value={form.password2} onChange={e => setForm({ ...form, password2: e.target.value })} required />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', padding: 13, marginTop: 4 }}>
              {loading ? 'Creating account...' : 'CREATE ACCOUNT'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 700 }}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}