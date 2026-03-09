# ✈️ Aviator Betting Game — Full Architecture

> A real-time crash betting game inspired by Betika Aviator.
> Built with **Django + Django Channels** (backend) and **React + Vite** (frontend).
> Supports M-Pesa payments, live WebSocket gameplay, JWT auth, and an admin dashboard.

---

## 📁 Full Project Structure

```
aviator/
│
├── README.md
│
├── backend/
│   ├── requirements.txt
│   └── aviator_backend/                  ← Django project root
│       ├── __init__.py
│       ├── settings.py                   ← All config (JWT, CORS, Channels, M-Pesa)
│       ├── urls.py                       ← Root URL: /admin/ + /api/ → game/urls.py
│       ├── asgi.py                       ← ASGI entry: HTTP + WebSocket routing
│       │
│       ├── accounts/                     ← Custom user app
│       │   ├── __init__.py
│       │   └── models.py                 ← CustomUser (balance, phone, avatar, stats)
│       │
│       └── game/                         ← Core game app
│           ├── __init__.py
│           ├── models.py                 ← GameRound, Bet, ChatMessage, Transaction
│           ├── serializers.py            ← DRF serializers for all models
│           ├── views.py                  ← ViewSets: Auth, User, Game, Chat, Payment, Admin
│           ├── consumers.py              ← WebSocket consumer (Django Channels)
│           ├── engine.py                 ← Async game loop (waiting → flying → crashed)
│           ├── admin.py                  ← Django admin with profit tracking
│           ├── urls.py                   ← DRF router: all API endpoints
│           └── management/
│               └── commands/
│                   └── run_game_engine.py  ← `python manage.py run_game_engine`
│
└── frontend/
    ├── index.html                        ← Bootstrap Icons CDN loaded here
    ├── package.json
    ├── vite.config.js                    ← Proxy /api and /ws to Django :8000
    └── src/
        ├── main.jsx                      ← ReactDOM.createRoot entry point
        ├── App.jsx                       ← BrowserRouter + AuthProvider + Routes
        │
        ├── styles/
        │   └── global.css                ← CSS variables, buttons, cards, animations
        │
        ├── contexts/
        │   └── AuthContext.jsx           ← Global auth state, login/register/logout
        │
        ├── services/
        │   └── api.js                    ← All fetch calls + JWT refresh + GameWebSocket class
        │
        ├── components/
        │   ├── Navbar.jsx                ← Top bar: logo, balance chip, user menu
        │   ├── GameCanvas.jsx            ← HTML5 Canvas: plane animation, trail, crash FX
        │   ├── BetPanel.jsx              ← Bet amount, auto-cashout, place/cashout buttons
        │   ├── LiveBets.jsx              ← Real-time bets table + round history tab
        │   ├── LiveChat.jsx              ← Live chat via WebSocket + REST history
        │   └── HistoryTicker.jsx         ← Scrolling multiplier history bar (top of screen)
        │
        └── pages/
            ├── MainPage.jsx              ← Full game layout (canvas + panel + chat + bets)
            ├── LoginPage.jsx             ← JWT login form
            ├── RegisterPage.jsx          ← Register with avatar picker
            ├── ProfilePage.jsx           ← Stats, bet history, deposit/withdraw links
            ├── PaymentPages.jsx          ← DepositPage + WithdrawPage (M-Pesa forms)
            └── AdminPage.jsx             ← House profit, round stats (staff only)
```

---

## 🧩 Component & Data Flow

```
Browser
  │
  ├─── HTTP (REST)  ──────────────────────────────────────▶ Django REST Framework
  │     └── /api/*                                              └── ViewSets (views.py)
  │           ├── /auth/login/  /auth/register/                      └── JWT via simplejwt
  │           ├── /game/place_bet/  /game/cashout/                   └── atomic() transactions
  │           ├── /payments/deposit/  /payments/withdraw/            └── M-Pesa Daraja API
  │           └── /admin-stats/overview/  /admin-stats/recent_rounds/
  │
  └─── WebSocket ─────────────────────────────────────────▶ Django Channels (ASGI)
        └── ws://host/ws/game/                                  └── GameConsumer (consumers.py)
              │                                                       └── channel_layer group: "game_room"
              │◀──── game_state  (every 100ms tick)
              │◀──── bet_placed  (when any user bets)
              │◀──── cashout_event (when any user cashes out)
              │◀──── chat_message (live chat broadcast)
              └────▶ chat_message (user sends chat)
```

---

## 🗄️ Database Models

### `CustomUser` (accounts app)
| Field | Type | Notes |
|-------|------|-------|
| username | CharField | Unique login |
| email | EmailField | |
| phone_number | CharField | M-Pesa number |
| balance | DecimalField | Current wallet balance (KES) |
| avatar | CharField | Emoji avatar e.g. 🚀 |
| total_wagered | DecimalField | Lifetime bets placed |
| total_won | DecimalField | Lifetime winnings |
| created_at | DateTimeField | |

### `GameRound`
| Field | Type | Notes |
|-------|------|-------|
| round_number | AutoField (PK) | Auto-increments |
| crash_multiplier | FloatField | Pre-determined by house algorithm |
| current_multiplier | FloatField | Live value broadcast to clients |
| status | CharField | `waiting` / `flying` / `crashed` |
| started_at | DateTimeField | When flying began |
| crashed_at | DateTimeField | When it ended |

### `Bet`
| Field | Type | Notes |
|-------|------|-------|
| user | FK → CustomUser | |
| round | FK → GameRound | |
| amount | DecimalField | Bet in KES |
| auto_cashout | FloatField | Optional auto-cashout multiplier |
| cashout_multiplier | FloatField | Actual cashout value (null if lost) |
| winnings | DecimalField | Payout (0 if lost) |
| status | CharField | `active` / `won` / `lost` / `cancelled` |
| placed_at | DateTimeField | |
| cashed_out_at | DateTimeField | |

### `Transaction`
| Field | Type | Notes |
|-------|------|-------|
| user | FK → CustomUser | |
| transaction_type | CharField | `deposit` / `withdrawal` / `bet` / `win` |
| amount | DecimalField | |
| status | CharField | `pending` / `completed` / `failed` |
| reference | CharField | Unique ref e.g. `DEP-A1B2C3D4` |
| mpesa_receipt | CharField | Safaricom receipt number |
| phone_number | CharField | M-Pesa phone |

### `ChatMessage`
| Field | Type | Notes |
|-------|------|-------|
| user | FK → CustomUser | |
| message | TextField | Max 200 chars |
| created_at | DateTimeField | |

---

## 🎮 Game Engine — Round Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    run_game_engine (async loop)                   │
│                                                                   │
│  1. Generate crash point (house algorithm)                        │
│  2. Create GameRound(status='waiting')                            │
│                                                                   │
│  ┌── WAITING PHASE (7 seconds) ──────────────────────────────┐   │
│  │  • Broadcast countdown (7, 6, 5, ... 1)                   │   │
│  │  • REST API accepts place_bet() calls                      │   │
│  │  • Bets deducted from user balance immediately             │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌── FLYING PHASE ────────────────────────────────────────────┐   │
│  │  • multiplier = 1.0024 ^ (elapsed_ms / 10)                │   │
│  │  • Broadcasts every 100ms tick                             │   │
│  │  • Checks auto-cashouts on every tick                      │   │
│  │  • Manual cashout available via REST POST /game/cashout/   │   │
│  │  • Stops when multiplier >= crash_point                    │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌── CRASHED ─────────────────────────────────────────────────┐   │
│  │  • All active bets → status='lost'                         │   │
│  │  • Broadcast final crash multiplier                        │   │
│  │  • Show crash screen 3 seconds                             │   │
│  │  • Loop back to step 1                                     │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎲 House Edge Algorithm

Defined in `GameRound.generate_crash_multiplier()`:

```python
r = random.random()   # 0.0 – 1.0

if r < 0.30:   → crash between  1.00x –  1.15x   (instant loss, 30% of rounds)
elif r < 0.70: → crash between  1.15x –  2.50x   (low multiplier, 40%)
elif r < 0.90: → crash between  2.50x –  6.00x   (medium, 20%)
elif r < 0.97: → crash between  6.00x – 20.00x   (high, 7%)
else:          → crash between 20.00x – 100.0x   (rare moon, 3%)
```

**Result:** ~15–20% house edge. The plane frequently crashes below 2x,
ensuring operator profit margin, while occasional high multipliers
keep players engaged and chasing wins.

---

## 🔌 Full API Reference

### Auth
| Method | Endpoint | Auth | Body / Response |
|--------|----------|------|-----------------|
| POST | `/api/auth/register/` | None | `{username, email, phone_number, password, password2}` → `{access, refresh, user}` |
| POST | `/api/auth/login/` | None | `{username, password}` → `{access, refresh, user}` |
| POST | `/api/auth/refresh_token/` | None | `{refresh}` → `{access}` |

### User
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users/profile/` | JWT | Current user profile + balance |
| PATCH | `/api/users/update_profile/` | JWT | Update username/email/avatar |
| GET | `/api/users/bet_history/` | JWT | Last 50 bets |
| GET | `/api/users/transactions/` | JWT | Last 50 transactions |

### Game
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/game/current_round/` | JWT | Active round status + multiplier |
| GET | `/api/game/history/` | JWT | Last 50 crashed rounds with multipliers |
| POST | `/api/game/place_bet/` | JWT | `{amount, auto_cashout?}` — only during `waiting` |
| POST | `/api/game/cashout/` | JWT | `{bet_id}` — only during `flying` |
| GET | `/api/game/my_active_bet/` | JWT | Your current round bet status |

### Chat
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/chat/messages/` | JWT | Last 50 messages |
| POST | `/api/chat/send/` | JWT | `{message}` → broadcasts via WebSocket |

### Payments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/payments/deposit/` | JWT | `{amount, phone_number}` — STK push or instant (DEBUG) |
| POST | `/api/payments/withdraw/` | JWT | `{amount, phone_number}` |
| POST | `/api/payments/mpesa_callback/` | None | Safaricom IPN callback |

### Admin (staff only)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin-stats/overview/` | Staff JWT | Users, rounds, wagered, won, house profit |
| GET | `/api/admin-stats/recent_rounds/` | Staff JWT | Last 20 rounds with per-round profit |

### WebSocket
```
ws://localhost:8000/ws/game/?token=<JWT>
```
**Inbound (client → server):**
```json
{ "type": "chat_message", "message": "hello!" }
```
**Outbound (server → client):**
```json
{ "type": "game_state",    "status": "flying", "current_multiplier": 2.34, "bets": [...], "countdown": 0 }
{ "type": "bet_placed",    "username": "john", "avatar": "🚀", "amount": 100, "round_number": 42 }
{ "type": "cashout_event", "username": "john", "multiplier": 2.34, "winnings": 234.0 }
{ "type": "chat_message",  "username": "john", "avatar": "🚀", "message": "nice!", "created_at": "..." }
```

---

## 🖥️ Frontend Pages & Components

### Pages
| Route | File | Description |
|-------|------|-------------|
| `/` | `MainPage.jsx` | Full game: canvas, bet panel, live bets, live chat, history ticker |
| `/login` | `LoginPage.jsx` | JWT login form with animated plane |
| `/register` | `RegisterPage.jsx` | Register + emoji avatar picker |
| `/profile` | `ProfilePage.jsx` | Win rate, best multiplier, bet history table |
| `/deposit` | `PaymentPages.jsx` | M-Pesa deposit form with quick-amount buttons |
| `/withdraw` | `PaymentPages.jsx` | M-Pesa withdraw form |
| `/admin` | `AdminPage.jsx` | House profit dashboard, round-by-round stats (staff only) |

### Components
| File | What It Does |
|------|-------------|
| `Navbar.jsx` | Sticky top bar — logo, live balance chip, deposit button, user menu |
| `GameCanvas.jsx` | HTML5 Canvas — bezier curve trail, turbulent plane animation, crash explosion, stars |
| `BetPanel.jsx` | Bet input, ½/2x buttons, quick presets, auto-cashout toggle, big CASHOUT button during flight |
| `LiveBets.jsx` | Real-time bets table with masked usernames; tabs: All Bets / Round History |
| `LiveChat.jsx` | Scrolling chat, sends via REST, receives via WebSocket broadcast |
| `HistoryTicker.jsx` | Horizontal scrolling row of colored multiplier badges from recent rounds |

### Services (`api.js`)
```
authAPI        → register, login, setTokens, clearTokens
userAPI        → getProfile, updateProfile, getBetHistory, getTransactions
gameAPI        → getCurrentRound, getHistory, getMyActiveBet, placeBet, cashout
chatAPI        → getMessages, sendMessage
paymentAPI     → deposit, withdraw
adminAPI       → getOverview, getRecentRounds
GameWebSocket  → connect, disconnect, send, auto-reconnect with exponential backoff
```

### State Management
- **Auth state:** React Context (`AuthContext`) — user object, login/logout/register
- **Game state:** Local state in `MainPage` — fed by WebSocket events
- No Redux/Zustand — kept intentionally lightweight

---

## 🔒 Security Architecture

| Layer | Mechanism |
|-------|-----------|
| Authentication | JWT (access 12h, refresh 7d, auto-rotate) |
| Authorization | `IsAuthenticated` on all game routes; `IsAdminUser` on admin routes |
| Bet validation | Status check (`waiting` only), balance check, duplicate check — all server-side |
| Financial integrity | All balance changes inside `transaction.atomic()` |
| Rate limiting | DRF throttle: 300 req/min per user |
| CORS | Whitelist only `localhost:3000` / `localhost:5173` (update for production) |

---

## 💳 M-Pesa Integration (Daraja API)

```
DEBUG=True  →  Instant credit, no API calls, for local development
DEBUG=False →  Full STK Push flow:

  Frontend          Backend              Safaricom
     │                 │                    │
     │  POST /deposit  │                    │
     │────────────────▶│                    │
     │                 │── STK Push Request─▶│
     │                 │                    │── Push notification to phone
     │  "Enter PIN"    │                    │
     │◀────────────────│                    │
     │                 │      IPN Callback  │
     │                 │◀───────────────────│
     │                 │  (ResultCode=0)    │
     │                 │── Credit balance   │
     │                 │── Mark txn complete│
```

Required env vars for production:
```
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
MPESA_CALLBACK_URL=https://yourdomain.com
```

---

## 🚀 Setup & Running

### 1. Backend

```bash
cd backend

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

# Environment (defaults work for local dev)
export DEBUG=True
export SECRET_KEY=change-this-in-production

# Migrations
python manage.py makemigrations accounts game
python manage.py migrate

# Create superuser (for /admin and /admin-stats endpoints)
python manage.py createsuperuser

# Terminal A — ASGI server (HTTP + WebSocket)
daphne -b 0.0.0.0 -p 8000 aviator_backend.asgi:application

# Terminal B — Game engine (REQUIRED — runs the actual game loop)
python manage.py run_game_engine
```

### 2. Frontend

```bash
cd frontend

npm install

# Development server
npm run dev          # http://localhost:3000

# Production build
npm run build
npm run preview
```

### 3. Environment Variables

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000/ws/game/
```

---

## 🛠️ Production Deployment

### Recommended Stack
```
Internet
   │
   ▼
Nginx (SSL + static files)
   ├── /api/*   ──▶  Daphne :8000  (Django ASGI)
   ├── /ws/*    ──▶  Daphne :8000  (WebSocket upgrade)
   ├── /admin/* ──▶  Daphne :8000
   └── /*       ──▶  React dist/ (static HTML/JS/CSS)

Separate process:
   python manage.py run_game_engine   (managed by systemd)

Database: PostgreSQL
Cache/Channels: Redis
```

### systemd Service for Game Engine
```ini
# /etc/systemd/system/aviator-engine.service
[Unit]
Description=Aviator Game Engine
After=network.target postgresql.service redis.service

[Service]
User=www-data
WorkingDirectory=/var/www/aviator/backend
Environment=DJANGO_SETTINGS_MODULE=aviator_backend.settings
ExecStart=/var/www/aviator/backend/venv/bin/python manage.py run_game_engine
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable aviator-engine
sudo systemctl start aviator-engine
sudo systemctl status aviator-engine
```

### Production Checklist
- [ ] `DEBUG=False`
- [ ] Strong unique `SECRET_KEY`
- [ ] `ALLOWED_HOSTS` set to your domain
- [ ] Switch to **PostgreSQL** (update `DATABASES` in settings.py)
- [ ] Switch to **Redis** channel layer (uncomment in settings.py, `pip install channels-redis`)
- [ ] Configure M-Pesa production credentials
- [ ] `CORS_ALLOWED_ORIGINS` set to your frontend domain
- [ ] Game engine running as systemd service
- [ ] SSL certificate (Let's Encrypt via Certbot)
- [ ] `npm run build` → serve `frontend/dist/` via Nginx

---

## 📦 Dependencies

### Backend (`requirements.txt`)
| Package | Purpose |
|---------|---------|
| Django ≥ 4.2 | Web framework |
| channels ≥ 4.0 | WebSocket / ASGI support |
| daphne ≥ 4.0 | ASGI server |
| channels-redis | Redis channel layer (production) |
| djangorestframework | REST API |
| djangorestframework-simplejwt | JWT authentication |
| django-cors-headers | CORS for React frontend |
| requests | M-Pesa Daraja API calls |

### Frontend (`package.json`)
| Package | Purpose |
|---------|---------|
| react + react-dom | UI library |
| react-router-dom | Client-side routing |
| vite + @vitejs/plugin-react | Build tool + dev server |
| bootstrap-icons (CDN) | Icons throughout the UI |

---

## 🎨 Design System

All design tokens live in CSS custom properties (`global.css`):

```css
--bg-primary:    #0d1117   /* Page background */
--bg-secondary:  #161b22   /* Navbar, panels */
--bg-card:       #1c2230   /* Cards */
--accent-red:    #e63946   /* Primary action, plane trail */
--accent-green:  #2ecc71   /* Wins, cashout button, balance */
--accent-yellow: #f39c12   /* Mid multipliers (2x–5x) */
--accent-blue:   #3498db   /* Chat, info states, waiting */
--accent-purple: #9b59b6   /* Moon multipliers (≥10x) */
```

Font stack: **Rajdhani** (headings, multipliers, money) + **Exo 2** (body text)

Multiplier color scale:
```
< 2x   → red    (#e63946)
2x–5x  → yellow (#f39c12)
5x–10x → green  (#2ecc71)
≥ 10x  → purple (#9b59b6)  "moon"
```

---

*Built to scale. Designed to win — for the house.*