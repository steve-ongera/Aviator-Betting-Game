import { useState, useEffect, useRef, useCallback } from 'react';
import GameCanvas from '../components/GameCanvas';
import BetPanel from '../components/BetPanel';
import LiveBets from '../components/LiveBets';
import LiveChat from '../components/LiveChat';
import HistoryTicker from '../components/HistoryTicker';
import { GameWebSocket, gameAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function MainPage() {
  const { user } = useAuth();
  const [gameState, setGameState] = useState({ status: 'waiting', current_multiplier: 1.0, countdown: 7 });
  const [bets, setBets] = useState([]);
  const [history, setHistory] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const wsRef = useRef(null);
  const [mobileTab, setMobileTab] = useState('game'); // 'game' | 'bets' | 'chat'

  const handleWsMessage = useCallback((data) => {
    switch (data.type) {
      case 'game_state':
        setGameState({
          status: data.status,
          current_multiplier: data.current_multiplier || 1.0,
          countdown: data.countdown || 0,
          round_number: data.round_number,
        });
        if (data.bets) setBets(data.bets);
        if (data.history) setHistory(data.history);
        break;
      case 'bet_placed':
        setBets(prev => {
          const exists = prev.find(b => b.id === data.bet_id);
          if (exists) return prev;
          return [...prev, {
            id: data.bet_id,
            username: data.username,
            avatar: data.avatar,
            amount: data.amount,
            status: 'active',
          }];
        });
        break;
      case 'cashout_event':
        setBets(prev => prev.map(b =>
          b.username === data.username && b.status === 'active'
            ? { ...b, cashout_multiplier: data.multiplier, winnings: data.winnings, status: 'won' }
            : b
        ));
        break;
      case 'chat_message':
        setChatMessages(prev => [...prev.slice(-99), data]);
        break;
    }
  }, []);

  useEffect(() => {
    const ws = new GameWebSocket(handleWsMessage);
    ws.connect();
    wsRef.current = ws;

    // Load initial history
    gameAPI.getHistory().then(h => setHistory(h)).catch(() => { });

    return () => ws.disconnect();
  }, [handleWsMessage]);

  // When crashed, clear bets after 3s
  useEffect(() => {
    if (gameState.status === 'crashed') {
      const t = setTimeout(() => setBets([]), 3500);
      return () => clearTimeout(t);
    }
  }, [gameState.status, gameState.round_number]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

      {/* History Ticker */}
      <HistoryTicker history={history} />

      {/* Main layout */}
      <div style={{
        flex: 1, display: 'grid', overflow: 'hidden',
        gridTemplateColumns: '1fr 280px',
        gridTemplateRows: '1fr 220px',
        gap: 0,
      }} className="desktop-grid">

        {/* Game Canvas */}
        <div style={{
          background: '#0a0d14',
          borderRight: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          position: 'relative',
          minHeight: 280,
        }}>
          <GameCanvas gameState={gameState} />
        </div>

        {/* Right: Chat (top) + Bet Panel (bottom) */}
        <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border)' }}>
          {/* Bet Panel */}
          <div style={{
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-card)',
          }}>
            <BetPanel gameState={gameState} />
          </div>
          {/* Chat */}
          <div style={{ flex: 1, overflow: 'hidden', background: 'var(--bg-secondary)' }}>
            <LiveChat externalMessages={chatMessages} wsRef={wsRef} />
          </div>
        </div>

        {/* Bottom: Live Bets */}
        <div style={{ background: 'var(--bg-secondary)', overflow: 'hidden' }}>
          <LiveBets bets={bets} history={history} />
        </div>

        {/* Bottom-right: empty or stats */}
        <div style={{
          background: 'var(--bg-card)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderLeft: '1px solid var(--border)',
        }}>
          <RoundStats gameState={gameState} bets={bets} />
        </div>
      </div>

      {/* Mobile Layout */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-grid {
            grid-template-columns: 1fr !important;
            grid-template-rows: 260px 200px 1fr !important;
          }
          .mobile-tab-bar { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-tab-bar { display: none !important; }
        }
      `}</style>

      {/* Mobile tab bar */}
      <div className="mobile-tab-bar" style={{
        display: 'none',
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        zIndex: 50,
      }}>
        {[
          { id: 'game', icon: 'bi-airplane-fill', label: 'Game' },
          { id: 'bets', icon: 'bi-people-fill', label: 'Bets' },
          { id: 'chat', icon: 'bi-chat-dots-fill', label: 'Chat' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setMobileTab(tab.id)}
            style={{
              flex: 1, padding: '10px 0', background: 'none', border: 'none',
              color: mobileTab === tab.id ? 'var(--accent-red)' : 'var(--text-muted)',
              fontSize: 11, cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2,
            }}>
            <i className={`bi ${tab.icon}`} style={{ fontSize: 18 }}></i>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RoundStats({ gameState, bets }) {
  const totalBet = bets.reduce((s, b) => s + parseFloat(b.amount || 0), 0);
  const totalWon = bets.filter(b => b.status === 'won').reduce((s, b) => s + parseFloat(b.winnings || 0), 0);

  return (
    <div style={{ padding: 12, width: '100%' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
        Round #{gameState.round_number || '—'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatBox label="Bets" value={bets.length} />
        <StatBox label="Wagered" value={`${totalBet.toFixed(0)}`} sub="KES" />
        <StatBox label="Won" value={`${totalWon.toFixed(0)}`} sub="KES" color="var(--accent-green)" />
        <StatBox label="Status" value={gameState.status?.toUpperCase()}
          color={gameState.status === 'flying' ? 'var(--accent-green)' : gameState.status === 'crashed' ? 'var(--accent-red)' : 'var(--accent-blue)'} />
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px',
      border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, color: color || 'var(--text-primary)', fontSize: 15 }}>
        {value} {sub && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sub}</span>}
      </div>
    </div>
  );
}