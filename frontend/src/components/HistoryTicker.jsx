export default function HistoryTicker({ history = [] }) {
  if (!history.length) return null;

  return (
    <div style={{
      display: 'flex', gap: 5, overflowX: 'auto', padding: '6px 12px',
      background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
      scrollbarWidth: 'none',
    }}>
      {history.slice(0, 25).map((h, i) => {
        let cls = 'low';
        if (h.multiplier >= 10) cls = 'moon';
        else if (h.multiplier >= 5) cls = 'high';
        else if (h.multiplier >= 2) cls = 'mid';
        return (
          <span key={i} className={`mult-badge ${cls}`} style={{
            whiteSpace: 'nowrap', fontSize: 11, padding: '3px 8px',
            opacity: i === 0 ? 1 : 0.7 + (0.3 * (1 - i / 25))
          }}>
            {h.multiplier.toFixed(2)}x
          </span>
        );
      })}
    </div>
  );
}