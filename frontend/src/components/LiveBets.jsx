export default function LiveBets({ bets = [], history = [] }) {
  const [tab, setTab] = useState('all');
  const { useState } = window.React || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 12px' }}>
        {['all', 'history'].map(t => (
          <button key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'none', border: 'none', color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              padding: '10px 14px', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 700 : 400,
              borderBottom: tab === t ? '2px solid var(--accent-red)' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.2s',
            }}>
            {t === 'all' ? `All Bets (${bets.length})` : 'Round History'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {tab === 'all' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th style={{ padding: '6px 0', textAlign: 'left' }}>Player</th>
                <th style={{ padding: '6px 0', textAlign: 'right' }}>Bet</th>
                <th style={{ padding: '6px 0', textAlign: 'right' }}>Cashout</th>
                <th style={{ padding: '6px 0', textAlign: 'right' }}>Win</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((bet, i) => (
                <tr key={bet.id || i} style={{ borderTop: '1px solid var(--border-light)', animation: 'fadeIn 0.3s ease' }}>
                  <td style={{ padding: '5px 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 14 }}>{bet.avatar}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{maskUsername(bet.username)}</span>
                  </td>
                  <td style={{ padding: '5px 0', textAlign: 'right', color: 'var(--text-primary)' }}>
                    {Number(bet.amount).toFixed(0)}
                  </td>
                  <td style={{ padding: '5px 0', textAlign: 'right' }}>
                    {bet.cashout_multiplier ? (
                      <span style={{ color: getMultColor(bet.cashout_multiplier), fontWeight: 700 }}>
                        {bet.cashout_multiplier.toFixed(2)}x
                      </span>
                    ) : bet.status === 'lost' ? (
                      <span style={{ color: 'var(--multiplier-low)' }}>—</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '5px 0', textAlign: 'right' }}>
                    {bet.status === 'won' ? (
                      <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                        {Number(bet.winnings).toFixed(0)}
                      </span>
                    ) : bet.status === 'lost' ? (
                      <span style={{ color: 'var(--multiplier-low)' }}>—</span>
                    ) : null}
                  </td>
                </tr>
              ))}
              {bets.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                  No bets yet
                </td></tr>
              )}
            </tbody>
          </table>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 8 }}>
            {history.map((h, i) => {
              let cls = 'low';
              if (h.multiplier >= 10) cls = 'moon';
              else if (h.multiplier >= 5) cls = 'high';
              else if (h.multiplier >= 2) cls = 'mid';
              return (
                <span key={i} className={`mult-badge ${cls}`} style={{ fontSize: 13, padding: '4px 10px' }}>
                  {h.multiplier.toFixed(2)}x
                </span>
              );
            })}
            {history.length === 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No history yet</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
function getMultColor(m) {
  if (m >= 10) return '#9b59b6';
  if (m >= 5) return '#2ecc71';
  if (m >= 2) return '#f39c12';
  return '#e63946';
}
function maskUsername(name = '') {
  if (name.length <= 3) return name;
  return name[0] + '***' + name[name.length - 1];
}