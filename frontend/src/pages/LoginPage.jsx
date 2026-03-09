import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form);
      navigate('/');
    } catch (err) {
      setError(err?.error || err?.detail || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      background: 'radial-gradient(ellipse at 50% 0%, rgba(230,57,70,0.08) 0%, transparent 60%)',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontSize: 48, marginBottom: 8,
            animation: 'float 3s ease-in-out infinite',
          }}>✈️</div>
          <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 28, fontWeight: 900, color: 'var(--accent-red)' }}>
            AVIATOR
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sign in to place your bets</p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 22, marginBottom: 20, textAlign: 'center' }}>
            Welcome Back
          </h2>

          {error && <div className="alert alert-error"><i className="bi bi-exclamation-circle me-2"></i>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>USERNAME</label>
              <input className="input-field" type="text" placeholder="Enter username"
                value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                required autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>PASSWORD</label>
              <input className="input-field" type="password" placeholder="Enter password"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                required />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', padding: 13, marginTop: 4 }}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, display: 'inline-block' }}></span>
                : 'SIGN IN'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 700 }}>
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}