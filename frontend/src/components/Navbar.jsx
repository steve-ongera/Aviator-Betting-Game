import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <i className="bi bi-airplane-fill" style={{ fontSize: 20 }}></i>
        <span>AVIATOR</span>
      </Link>

      <div className="navbar-actions">
        {user ? (
          <>
            <div className="balance-chip">
              <i className="bi bi-wallet2" style={{ fontSize: 13 }}></i>
              <span>{Number(user.balance).toFixed(2)}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>KES</span>
            </div>
            <Link to="/deposit" style={{ textDecoration: 'none' }}>
              <button className="btn-green" style={{ padding: '6px 12px', fontSize: 13 }}>
                <i className="bi bi-plus-lg me-1"></i>
                <span className="hide-mobile">Deposit</span>
              </button>
            </Link>
            <Link to="/profile" style={{ textDecoration: 'none' }}>
              <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }}>
                <span style={{ fontSize: 16 }}>{user.avatar}</span>
                <span className="hide-mobile" style={{ marginLeft: 4 }}>{user.username}</span>
              </button>
            </Link>
            <button className="btn-secondary" onClick={handleLogout} style={{ padding: '6px 10px', fontSize: 13 }}>
              <i className="bi bi-box-arrow-right"></i>
            </button>
          </>
        ) : (
          <>
            <Link to="/login">
              <button className="btn-secondary" style={{ padding: '6px 14px' }}>Login</button>
            </Link>
            <Link to="/register">
              <button className="btn-primary" style={{ padding: '6px 14px' }}>Register</button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}