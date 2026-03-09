import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);

  if (!user?.is_staff) return <Navigate to="/" />;

  useEffect(() => {
    Promise.all([adminAPI.getOverview(), adminAPI.getRecentRounds()])
      .then(([s, r]) => { setStats(s); setRounds(r); })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner"></div></div>;

  const houseEdge = stats?.total_wagered > 0 
    ? ((stats.house_profit / stats.total_wagered) * 100).toFixed(1)
    : 0;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 16px' }}>
      <h1 style={{ fontFamily: 'Rajdhani', fontSize: 28, fontWeight: 900, marginBottom: 20 }}>
        <i className="bi bi-bar-chart-fill me-3" style={{ color: 'var(--accent-red)' }}></i>
        Admin Dashboard
      </h1>

      {/* Overview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {stats && [
          { label: 'Total Users', value: stats.total_users, icon: 'bi-people-fill', color: 'var(--accent-blue)' },
          { label: 'Total Rounds', value: stats.total_rounds, icon: 'bi-airplane', color: 'var(--accent-yellow)' },
          { label: 'Total Bets', value: stats.total_bets, icon: 'bi-cash', color: 'var(--accent-green)' },
          { label: 'Total Wagered', value: `${(stats.total_wagered/1000).toFixed(1)}K`, sub: 'KES', icon: 'bi-cash-stack', color: 'var(--text-primary)' },
          { label: 'Total Won', value: `${(stats.total_won/1000).toFixed(1)}K`, sub: 'KES', icon: 'bi-trophy', color: 'var(--accent-green)' },
          { label: 'House Profit', value: `${(stats.house_profit/1000).toFixed(1)}K`, sub: 'KES', icon: 'bi-bank', color: stats.house_profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' },
          { label: 'House Edge', value: `${houseEdge}%`, icon: 'bi-percent', color: 'var(--accent-purple)' },
        ].map((s, i) => (
          <div key={i} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <i className={`bi ${s.icon}`} style={{ color: s.color, fontSize: 18 }}></i>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</span>
            </div>
            <div style={{ fontFamily: 'Rajdhani', fontWeight: 900, fontSize: 22, color: s.color }}>
              {s.value}
              {s.sub && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>{s.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Recent rounds */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 18 }}>
          Recent Rounds
        </div>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {['Round', 'Crash Point', 'Bets', 'Wagered (KES)', 'Won (KES)', 'House Profit', 'Time'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rounds.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '9px 14px', color: 'var(--text-muted)' }}>#{r.round}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ color: getCrashColor(r.crash_multiplier), fontWeight: 700 }}>
                      {r.crash_multiplier.toFixed(2)}x
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px' }}>{r.bet_count}</td>
                  <td style={{ padding: '9px 14px' }}>{Number(r.total_bets).toFixed(0)}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--accent-green)' }}>{Number(r.total_won).toFixed(0)}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ color: r.house_profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
                      {r.house_profit >= 0 ? '+' : ''}{Number(r.house_profit).toFixed(0)}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: 11 }}>
                    {r.started_at ? new Date(r.started_at).toLocaleTimeString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function getCrashColor(m) {
  if (m >= 10) return '#9b59b6';
  if (m >= 5) return '#2ecc71';
  if (m >= 2) return '#f39c12';
  return '#e63946';
}