import { useState } from 'react';
import { paymentAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

function PaymentForm({ type }) {
  const { user, refreshUser } = useAuth();
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState(user?.phone_number || '');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const isDeposit = type === 'deposit';
  const quickAmounts = isDeposit ? [100, 500, 1000, 2500, 5000, 10000] : [500, 1000, 2000, 5000];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const fn = isDeposit ? paymentAPI.deposit : paymentAPI.withdraw;
      const res = await fn({ amount: parseFloat(amount), phone_number: phone });
      setMsg({ type: 'success', text: res.message });
      if (res.balance !== undefined) refreshUser();
      setAmount('');
    } catch (err) {
      setMsg({ type: 'error', text: err?.error || 'Transaction failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>
            {isDeposit ? '💰' : '🏧'}
          </div>
          <h1 style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 26, fontWeight: 900 }}>
            {isDeposit ? 'Deposit Funds' : 'Withdraw Funds'}
          </h1>
          {user && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Balance: <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                KES {Number(user.balance).toFixed(2)}
              </span>
            </p>
          )}
        </div>

        <div className="card" style={{ padding: 24 }}>
          {msg && (
            <div className={`alert alert-${msg.type}`}>
              <i className={`bi ${msg.type === 'success' ? 'bi-check-circle' : 'bi-exclamation-circle'} me-2`}></i>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                AMOUNT (KES)
              </label>
              <input className="input-field" type="number" min={isDeposit ? 10 : 100}
                placeholder={isDeposit ? 'Min KES 10' : 'Min KES 100'}
                value={amount} onChange={e => setAmount(e.target.value)} required
                style={{ fontSize: 20, textAlign: 'center', fontWeight: 700 }} />
            </div>

            {/* Quick amounts */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${quickAmounts.length > 4 ? 3 : 2}, 1fr)`, gap: 6 }}>
              {quickAmounts.map(q => (
                <button key={q} type="button" className="btn-secondary"
                  onClick={() => setAmount(q.toString())}
                  style={{ padding: '6px', fontWeight: 700, fontSize: 13 }}>
                  {q >= 1000 ? `${q / 1000}K` : q}
                </button>
              ))}
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                M-PESA PHONE NUMBER
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: '8px 0 0 8px', padding: '10px 12px', fontSize: 13,
                  color: 'var(--text-secondary)', borderRight: 'none',
                }}>+254</span>
                <input className="input-field" type="tel" placeholder="7XXXXXXXX"
                  value={phone} onChange={e => setPhone(e.target.value)} required
                  style={{ borderRadius: '0 8px 8px 0' }} />
              </div>
            </div>

            {/* M-Pesa info */}
            <div className="alert alert-info" style={{ fontSize: 11 }}>
              <i className="bi bi-info-circle me-2"></i>
              {isDeposit
                ? 'An STK push will be sent to your phone. Enter your M-Pesa PIN to complete.'
                : 'Funds will be sent to your M-Pesa within 5 minutes.'}
            </div>

            <button className={isDeposit ? 'btn-green' : 'btn-primary'} type="submit" disabled={loading}
              style={{ width: '100%', padding: 13, fontSize: 16 }}>
              {loading ? 'Processing...' : isDeposit ? '💳 Deposit Now' : '📤 Withdraw Now'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to="/profile" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>
              ← Back to profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DepositPage() { return <PaymentForm type="deposit" />; }
export function WithdrawPage() { return <PaymentForm type="withdraw" />; }