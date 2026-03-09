#  Aviator Betting Game

A real-time crash betting game like Betika Aviator, built with **Django + Channels** (backend) and **React + Vite** (frontend).

---

##  Architecture

```
aviator/
├── backend/
│   └── aviator_backend/
│       ├── accounts/        # Custom User model
│       ├── game/            # Models, views, serializers, consumers, engine
│       ├── settings.py
│       ├── urls.py
│       └── asgi.py
└── frontend/
    └── src/
        ├── components/      # GameCanvas, BetPanel, LiveBets, LiveChat, ...
        ├── pages/           # MainPage, Login, Register, Profile, Deposit, Admin
        ├── services/api.js  # All API calls + WebSocket
        ├── contexts/        # AuthContext
        └── styles/          # global.css
```

---

##  Quick Setup

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment (optional, defaults to DEBUG=True)
export DEBUG=True
export SECRET_KEY=your-secret-key-here

# Run migrations
python manage.py makemigrations accounts game
python manage.py migrate

# Create admin user
python manage.py createsuperuser

# Start Django server (Terminal 1)
daphne -b 0.0.0.0 -p 8000 aviator_backend.asgi:application

# Start Game Engine (Terminal 2) — REQUIRED
python manage.py run_game_engine
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000
```

---

## 🎮 How It Works

### Game Engine (`game/engine.py`)
- Runs as a separate process via `python manage.py run_game_engine`
- **WAITING phase** (7 seconds): Accepts bets, broadcasts countdown
- **FLYING phase**: Multiplier grows exponentially (`1.0024^(elapsed*100)`)
- **CRASHED**: Crash point pre-determined by house algorithm, all active bets lose

### House Edge Algorithm (`GameRound.generate_crash_multiplier`)
| Probability | Range | Effect |
|-------------|-------|--------|
| 30% | 1.00x – 1.15x | Near-instant crash (house wins) |
| 40% | 1.15x – 2.50x | Low multiplier |
| 20% | 2.50x – 6.00x | Medium multiplier |
| 7%  | 6.00x – 20.0x | High multiplier |
| 3%  | 20.0x – 100x  | Rare big win |

**Estimated house edge: ~15-20%** (configurable in `engine.py`)

### WebSocket Events
- `game_state` → broadcast every tick with current multiplier, bets, countdown
- `bet_placed` → new bet by any user
- `cashout_event` → user cashed out at X multiplier
- `chat_message` → live chat broadcast

---

## 💳 M-Pesa Integration

**DEBUG=True** (development):
- Deposits instantly credit balance
- No real money involved

**DEBUG=False** (production):
- Set env vars:
  ```
  MPESA_CONSUMER_KEY=...
  MPESA_CONSUMER_SECRET=...
  MPESA_SHORTCODE=...
  MPESA_PASSKEY=...
  MPESA_CALLBACK_URL=https://yourdomain.com
  ```
- Uses Safaricom Daraja STK Push API
- Callback URL: `POST /api/payments/mpesa_callback/`

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Register |
| POST | `/api/auth/login/` | Login (returns JWT) |
| GET | `/api/users/profile/` | Current user |
| GET | `/api/game/current_round/` | Active round |
| GET | `/api/game/history/` | Past 50 rounds |
| POST | `/api/game/place_bet/` | Place bet (waiting only) |
| POST | `/api/game/cashout/` | Manual cashout |
| GET | `/api/game/my_active_bet/` | Your current bet |
| GET | `/api/chat/messages/` | Last 50 messages |
| POST | `/api/chat/send/` | Send chat message |
| POST | `/api/payments/deposit/` | Deposit (M-Pesa) |
| POST | `/api/payments/withdraw/` | Withdraw |
| GET | `/api/admin-stats/overview/` | Admin stats |

**WebSocket:** `ws://localhost:8000/ws/game/`

---

## 🔒 Security Notes

- JWT tokens (12h access, 7d refresh with auto-rotation)
- Bets only accepted during `waiting` status
- Balance checked server-side before bet
- All financial operations wrapped in `atomic()` transactions
- Admin endpoints require `is_staff=True`
- Rate limiting: 300 requests/min per user

---

## 📱 Frontend Pages

| Route | Page |
|-------|------|
| `/` | Main game (canvas + bet panel + chat + bets) |
| `/login` | Sign in |
| `/register` | Create account |
| `/profile` | Stats + bet history |
| `/deposit` | Add funds |
| `/withdraw` | Withdraw funds |
| `/admin` | Admin dashboard (staff only) |

---

## 🛠️ Production Checklist

- [ ] Set `DEBUG=False`
- [ ] Use PostgreSQL instead of SQLite
- [ ] Use Redis channel layer (`channels_redis`)
- [ ] Set strong `SECRET_KEY`
- [ ] Configure `ALLOWED_HOSTS`
- [ ] Set up Nginx + SSL
- [ ] Configure M-Pesa production keys
- [ ] Use `gunicorn` or `daphne` with process manager (systemd/supervisor)
- [ ] Run game engine as a service