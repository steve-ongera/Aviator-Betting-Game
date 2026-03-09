import { useState, useEffect } from 'react';
import { gameAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function BetPanel({ gameState, onBetPlaced, onCashout }) {
  const { user, refreshUser } = useAuth();
  const [amount, setAmount] = useState('100');
  const [autoCashout, setAutoCashout] = useState('');
  const [useAuto, setUseAuto] = useState(false);
  const [activeBet, setActiveBet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const status = gameState?.status || 'waiting';
  const currentMult = gameState?.current_multiplier || 1.0;

  // Poll for active bet
  useEffect(() => {
    const fetchBet = async () => {
      if (!user) return;
      try {
        const data = await gameAPI.getMyActiveBet();
        setActiveBet(data.bet);
      } catch { }
    };
    fetchBet();
  }, [user, gameState?.round_number]);

  const handlePlaceBet = async () => {
    if (!user) { setMsg({ type: 'error', text: 'Please login to bet' }); return; }
    setLoading(true);
    setMsg(null);
    try {
      const payload = { amount: parseFloat(amount) };
      if (useAuto && autoCashout) payload.auto_cashout = parseFloat(autoCashout);
      const res = await gameAPI.placeBet(payload);
      setActiveBet({ id: res.bet_id, amount: res.amount, status: 'active' });
      refreshUser();
      setMsg({ type: 'success', text: `Bet of KES ${amount} placed!` });
      if (onBetPlaced) onBetPlaced(res);
    } catch (err) {
      setMsg({ type: 'error', text: err?.error || 'Failed to place bet' });
    } finally {
      setLoading(false);
    }
  };

  const handleCashout = async () => {
    if (!activeBet) return;
    setLoading(true);
    try {
      const res = await gameAPI.cashout(activeBet.id);
      setActiveBet(null);
      refreshUser();
      setMsg({ type: 'success', text: `Cashed out at ${res.multiplier.toFixed(2)}x! Won KES ${res.winnings.toFixed(2)}` });
      if (onCashout) onCashout(res);
    } catch (err) {
      setMsg({ type: 'error', text: err?.error || 'Cashout failed' });
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [10, 50, 100, 500, 1000, 5000];

  const canBet = status === 'waiting' && !activeBet && user;
  const canCashout = status === 'flying' && activeBet?.status === 'active';

  return (
    <div style={{ padding: '12px', height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {msg && (
        <div className={`alert alert-${msg.type}`} style={{ fontSize: 12, padding: '8px 12px' }}>
          {msg.text}
        </div>
      )}

      {/* Amount Input */}
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
          BET AMOUNT (KES)
        </label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn-secondary" style={{ padding: '8px 10px', fontSize: 12 }}
            onClick={() => setAmount(v => Math.max(10, parseFloat(v) / 2).toString())}>½</button>
          <input
            className="input-field"
            type="number"
            min="10"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ textAlign: 'center', fontWeight: 700, fontSize: 16 }}
          />
          <button className="btn-secondary" style={{ padding: '8px 10px', fontSize: 12 }}
            onClick={() => setAmount(v => (parseFloat(v) * 2).toString())}>2x</button>
        </div>
      </div>

      {/* Quick amounts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {quickAmounts.map(q => (
          <button key={q} className="btn-secondary"
            style={{ padding: '5px', fontSize: 12, fontWeight: 700 }}
            onClick={() => setAmount(q.toString())}>
            {q >= 1000 ? `${q/1000}K` : q}
          </button>
        ))}
      </div>

      {/* Auto cashout */}
      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={useAuto} onChange={e => setUseAuto(e.target.checked)}
            style={{ accentColor: 'var(--accent-red)' }} />
          Auto Cashout at
        </label>
        {useAuto && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <input
              className="input-field"
              type="number"
              min="1.01"
              step="0.1"
              placeholder="e.g. 2.00"
              value={autoCashout}
              onChange={e => setAutoCashout(e.target.value)}
              style={{ textAlign: 'center' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>x</span>
          </div>
        )}
      </div>

      {/* Action button */}
      <div style={{ marginTop: 'auto' }}>
        {canCashout ? (
          <button
            className="btn-green"
            style={{ width: '100%', padding: '14px', fontSize: 18, letterSpacing: 1 }}
            onClick={handleCashout}
            disabled={loading}
          >
            <div style={{ fontSize: 12, marginBottom: 2, opacity: 0.8 }}>CASHOUT</div>
            <div style={{ fontWeight: 900 }}>{currentMult.toFixed(2)}x</div>
            {activeBet && (
              <div style={{ fontSize: 11, opacity: 0.7 }}>
                ≈ KES {(parseFloat(activeBet.amount) * currentMult).toFixed(2)}
              </div>
            )}
          </button>
        ) : activeBet && status === 'waiting' ? (
          <div style={{
            width: '100%', padding: '12px', textAlign: 'center',
            background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.3)',
            borderRadius: 8, color: 'var(--accent-green)', fontSize: 13
          }}>
            <i className="bi bi-check-circle me-2"></i>
            Bet placed: KES {parseFloat(activeBet.amount).toFixed(2)}
          </div>
        ) : (
          <button
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: 16, letterSpacing: 1 }}
            onClick={handlePlaceBet}
            disabled={loading || !canBet}
          >
            {loading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div>
              : status === 'flying' ? 'Round in progress...'
              : !user ? 'Login to Bet'
              : 'PLACE BET'}
          </button>
        )}
      </div>

      {/* Balance */}
      {user && (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          Balance: <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
            KES {Number(user.balance).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}