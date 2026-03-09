import { useState, useEffect, useRef } from 'react';
import { chatAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function LiveChat({ wsRef }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    chatAPI.getMessages().then(data => {
      setMessages([...data].reverse());
    }).catch(() => { });
  }, []);

  // Listen to WS messages
  useEffect(() => {
    if (!wsRef?.current) return;
    const originalOnMessage = wsRef.current._onChatMessage;
    wsRef.current._onChatMessage = (msg) => {
      setMessages(prev => [...prev.slice(-99), msg]);
    };
    return () => { if (wsRef.current) wsRef.current._onChatMessage = originalOnMessage; };
  }, [wsRef]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !user) return;
    setLoading(true);
    try {
      const msg = await chatAPI.sendMessage(input.trim());
      setMessages(prev => [...prev.slice(-99), {
        username: user.username,
        avatar: user.avatar,
        message: msg.message,
        created_at: msg.created_at,
      }]);
      setInput('');
    } catch { }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)'
      }}>
        <i className="bi bi-chat-dots" style={{ color: 'var(--accent-blue)' }}></i>
        Live Chat
        <span style={{
          background: 'var(--accent-blue)', color: 'white',
          borderRadius: 10, padding: '0 6px', fontSize: 10, fontWeight: 700
        }}>LIVE</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            marginBottom: 8,
            animation: 'slideIn 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontSize: 13 }}>{msg.avatar}</span>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: msg.username === user?.username ? 'var(--accent-blue)' : 'var(--accent-yellow)'
              }}>
                {msg.username}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {formatTime(msg.created_at)}
              </span>
            </div>
            <div style={{
              fontSize: 12, color: 'var(--text-secondary)',
              marginLeft: 18, lineHeight: 1.4
            }}>
              {msg.message}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 20 }}>
            No messages yet. Say hi!
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
        {user ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="input-field"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a message..."
              maxLength={200}
              style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}
            />
            <button className="btn-primary" onClick={sendMessage} disabled={loading || !input.trim()}
              style={{ padding: '7px 12px', fontSize: 13 }}>
              <i className="bi bi-send-fill"></i>
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            <a href="/login" style={{ color: 'var(--accent-blue)' }}>Login</a> to chat
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}