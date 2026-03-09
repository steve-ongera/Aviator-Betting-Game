const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/game/';

// Token management
const getToken = () => localStorage.getItem('access_token');
const getRefreshToken = () => localStorage.getItem('refresh_token');
const setTokens = (access, refresh) => {
  localStorage.setItem('access_token', access);
  if (refresh) localStorage.setItem('refresh_token', refresh);
};
const clearTokens = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // Auto-refresh token on 401
  if (res.status === 401 && getRefreshToken()) {
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh_token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: getRefreshToken() }),
    });
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      setTokens(data.access);
      headers.Authorization = `Bearer ${data.access}`;
      return fetch(`${BASE_URL}${path}`, { ...options, headers });
    } else {
      clearTokens();
      window.location.href = '/login';
      return;
    }
  }
  return res;
}

async function get(path) {
  const res = await request(path);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}

async function post(path, body) {
  const res = await request(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

async function patch(path, body) {
  const res = await request(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

// Auth
export const authAPI = {
  register: (data) => post('/auth/register/', data),
  login: (data) => post('/auth/login/', data),
  logout: () => { clearTokens(); },
  setTokens,
  getToken,
  clearTokens,
  isLoggedIn: () => !!getToken(),
};

// User
export const userAPI = {
  getProfile: () => get('/users/profile/'),
  updateProfile: (data) => patch('/users/update_profile/', data),
  getBetHistory: () => get('/users/bet_history/'),
  getTransactions: () => get('/users/transactions/'),
};

// Game
export const gameAPI = {
  getCurrentRound: () => get('/game/current_round/'),
  getHistory: () => get('/game/history/'),
  getMyActiveBet: () => get('/game/my_active_bet/'),
  placeBet: (data) => post('/game/place_bet/', data),
  cashout: (betId) => post('/game/cashout/', { bet_id: betId }),
};

// Chat
export const chatAPI = {
  getMessages: () => get('/chat/messages/'),
  sendMessage: (message) => post('/chat/send/', { message }),
};

// Payments
export const paymentAPI = {
  deposit: (data) => post('/payments/deposit/', data),
  withdraw: (data) => post('/payments/withdraw/', data),
};

// Admin
export const adminAPI = {
  getOverview: () => get('/admin-stats/overview/'),
  getRecentRounds: () => get('/admin-stats/recent_rounds/'),
};

// WebSocket
export class GameWebSocket {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.ws = null;
    this.reconnectTimer = null;
    this.reconnectDelay = 1000;
  }

  connect() {
    const token = getToken();
    const url = token ? `${WS_URL}?token=${token}` : WS_URL;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('🔌 WebSocket connected');
      this.reconnectDelay = 1000;
    };

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this.onMessage(data);
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    this.ws.onclose = () => {
      console.log('🔌 WebSocket disconnected, reconnecting...');
      this.reconnectTimer = setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 10000);
        this.connect();
      }, this.reconnectDelay);
    };

    this.ws.onerror = (e) => console.error('WS error:', e);
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
  }
}

export default { authAPI, userAPI, gameAPI, chatAPI, paymentAPI, adminAPI };