import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';
import { Link } from 'react-router-dom';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [betHistory, setBetHistory] = useState([]);
  const [tab, setTab] = useState('stats');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userAPI.getBetHistory().then(setBetHistory).catch(() => { }).finally(() => setLoading(false));
  }, []);

  if (!user) return <div style={{ padding: 20, textAlign: 'center' }}>
    <Link to="/login" className="btn-primary">Login to view profile</Link>
  </div>;

  const wins = betHistory.filter(b => b.status === 'won');
  const losses = betHistory.filter(b => b.status === 'lost');
  const winRate = betHistory.length > 0 ? ((wins.length / betHistory.length) * 100).toFixed(1) : 0;
  const bestMultiplier = wins.length > 0 ? Math.max(...wins.map(b => b.cashout_multiplier || 0)) : 0;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px' }}>
      {/* Profile header */}
      <div className="card" style={{ padding: 24, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 60, marginBottom: 8 }}>{user.avatar}</div>
        <h2 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 24, fontWeight: 700 }}>{user.username}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          Member since {new Date(user.created_at).toLocaleDateString()}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 20px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>BALANCE</div>
            <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 20, color: 'var(--accent-green)' }}>
              {Number(user.balance).toFixed(2)} KES
            </div>
          </div>
          <Link to="/deposit" style={{ textDecoration: 'none' }}>
            <button className="btn-green" style={{ height: '100%' }}>
              <i className="bi bi-plus-circle me-2"></i>Deposit
            </button>
          </Link>
          <Link to="/withdraw" style={{ textDecoration: 'none' }}>
            <button className="btn-secondary">
              <i className="bi bi-arrow-up-circle me-2"></i>Withdraw
            </button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total Wagered', value: `${Number(user.total_wagered).toFixed(0)} KES`, icon: 'bi-cash-stack' },
          { label: 'Total Won', value: `${Number(user.total_won).toFixed(0)} KES`, icon: 'bi-trophy', color: 'var(--accent-green)' },
          { label: 'Win Rate', value: `${winRate}%`, icon: 'bi-graph-up' },
          { label: 'Best Multiplier', value: `${bestMultiplier.toFixed(2)}x`, icon: 'bi-rocket', color: 'var(--multiplier-moon)' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <i className={`bi ${s.icon}`} style={{ fontSize: 24, color: s.color || 'var(--accent-blue)' }}></i>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</div>
              <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 18, color: s.color || 'var(--text-primary)' }}>
                {s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bet History */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 16 }}>
          Bet History
        </div>
        {loading ? <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner"></div></div> : (
          <div style={{ overflow: 'auto', maxHeight: 400 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {['Round', 'Bet', 'Cashout', 'Win/Loss', 'Date'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {betHistory.map((b, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '8px 12px' }}>#{b.round}</td>
                    <td style={{ padding: '8px 12px' }}>{Number(b.amount).toFixed(2)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {b.cashout_multiplier
                        ? <span style={{ color: getMultColor(b.cashout_multiplier) }}>{b.cashout_multiplier.toFixed(2)}x</span>
                        : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', color: b.status === 'won' ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
                      {b.status === 'won' ? `+${Number(b.winnings).toFixed(2)}` : b.status === 'lost' ? `-${Number(b.amount).toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                      {new Date(b.placed_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {betHistory.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No bets yet. <Link to="/" style={{ color: 'var(--accent-red)' }}>Play now!</Link>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function getMultColor(m) {
  if (m >= 10) return '#9b59b6';
  if (m >= 5) return '#2ecc71';
  if (m >= 2) return '#f39c12';
  return '#e63946';
}