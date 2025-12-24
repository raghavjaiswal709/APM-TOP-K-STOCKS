# 🎨 VISUAL SYSTEM DIAGRAMS - APM TOP-K STOCKS

## 📐 Architecture Diagrams

### Diagram 1: System Overview - What Talks to What

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                     🌍 EXTERNAL WORLD                                 ┃
┃                                                                       ┃
┃    ┌────────────┐                              ┌──────────────┐      ┃
┃    │ Fyers API  │                              │ Your Browser │      ┃
┃    │ Stock Data │                              │   (Chrome)   │      ┃
┃    └─────┬──────┘                              └──────┬───────┘      ┃
┃          │                                            │              ┃
┗━━━━━━━━━━┿━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┿━━━━━━━━━━━━━━┛
           │                                            │
           │ Stock prices                               │ http://1000.93.172.21:3000
           │ every 1 sec                                │
           ▼                                            ▼
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃              🖥️  SERVER 1000.93.172.21 (NVME Server)                 ┃
┃                                                                       ┃
┃  ┌─────────────────────────────────────────────────────────────┐    ┃
┃  │                  🎨 PRESENTATION LAYER                      │    ┃
┃  │  ┌───────────────────────────────────────────────────┐      │    ┃
┃  │  │         Next.js Frontend (Port 3000)             │      │    ┃
┃  │  │  ┌────────────┬────────────┬─────────────┐       │      │    ┃
┃  │  │  │  Charts    │  Tables    │   Buttons   │       │      │    ┃
┃  │  │  │  📊       │  📋       │   🔘        │       │      │    ┃
┃  │  │  └────────────┴────────────┴─────────────┘       │      │    ┃
┃  │  └───────────────────┬───────────────────────────────┘      │    ┃
┃  └────────────────────────────────────────────────────────────┘    ┃
┃                         │                                           ┃
┃                         │ HTTP/WebSocket                            ┃
┃                         │ API Calls                                 ┃
┃                         ▼                                           ┃
┃  ┌─────────────────────────────────────────────────────────────┐    ┃
┃  │                  🧠 APPLICATION LAYER                       │    ┃
┃  │  ┌───────────────────────────────────────────────────┐      │    ┃
┃  │  │        NestJS Backend API (Port 5002)            │      │    ┃
┃  │  │  ┌────────────┬────────────┬─────────────┐       │      │    ┃
┃  │  │  │ REST APIs  │  WebSocket │ Business    │       │      │    ┃
┃  │  │  │  /api/*    │  Real-time │  Logic      │       │      │    ┃
┃  │  │  └────────────┴────────────┴─────────────┘       │      │    ┃
┃  │  └───┬──────────────────────────────────────┬────────┘      │    ┃
┃  └──────┼──────────────────────────────────────┼───────────────┘    ┃
┃         │                                      │                    ┃
┃         │ Commands                             │ DB Queries         ┃
┃         │                                      │                    ┃
┃         ▼                                      ▼                    ┃
┃  ┌─────────────────────┐           ┌────────────────────────┐       ┃
┃  │  🐍 WORKER LAYER    │           │  💾 STORAGE LAYER      │       ┃
┃  │                     │           │                        │       ┃
┃  │  ┌───────────────┐  │           │  ┌──────────────────┐ │       ┃
┃  │  │ Python 5001   │  │           │  │  PostgreSQL DB   │ │       ┃
┃  │  │ Live Feed     │◄─┼───Saves───┼──┤  (Port 5432)     │ │       ┃
┃  │  │ Port: 8001    │  │   Data    │  │  📚 Historical   │ │       ┃
┃  │  └───────────────┘  │           │  │     Data         │ │       ┃
┃  │         ▲            │           │  └──────────────────┘ │       ┃
┃  │         │            │           │                        │       ┃
┃  │         │ From Fyers │           │  ┌──────────────────┐ │       ┃
┃  │  ┌───────────────┐  │           │  │  Redis Cache     │ │       ┃
┃  │  │ Python 5010   │  │           │  │  (Port 6379)     │ │       ┃
┃  │  │ Aggregator    │◄─┼───Cache───┼──┤  ⚡ Quick Access│ │       ┃
┃  │  │ Port: 8010    │  │           │  │     Data         │ │       ┃
┃  │  └───────────────┘  │           │  └──────────────────┘ │       ┃
┃  └─────────────────────┘           └────────────────────────┘       ┃
┃                                                                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Diagram 2: Request Flow - "I Want Stock Price"

```
User Types in Browser          Server Processes                    Response
━━━━━━━━━━━━━━━━━━━━          ━━━━━━━━━━━━━━━━━                   ━━━━━━━━━

1. http://1000.93.172.21:3000/dashboard
   │
   ├──────────────────────────────►  Frontend Container
                                      │
                                      │ "I need stock data"
                                      │
2. HTTP GET /api/stocks              ▼
   ├──────────────────────────────►  Backend Container (5002)
                                      │
                                      │ "Let me check cache first"
                                      │
                                      ▼
3. Check Redis                        Redis Container (6379)
   │                                  │
   │◄─────────────────────────────────┤ "Not in cache"
   │
4. Query Database                     │
   ├──────────────────────────────►   PostgreSQL Container (5432)
   │                                  │
   │                                  │ SELECT * FROM stocks
   │                                  │ WHERE symbol='RELIANCE'
   │                                  │
   │◄─────────────────────────────────┤ Returns 1000 rows
   │
5. Store in Redis for next time      │
   ├──────────────────────────────►   Redis (6379)
   │                                  │ Cached for 5 minutes
   │
6. Format JSON Response               │
   │                                  Backend (5002)
   │                                  {
   │                                    "symbol": "RELIANCE",
   │                                    "price": 2850.50,
   │                                    "change": +15.30
   │                                  }
   │                                  │
   │◄─────────────────────────────────┘
   │
7. Display on Screen                 Frontend (3000)
   │                                  │
   │                                  │ Updates React components
   │                                  │ Draws charts
   │                                  │
   ▼                                  ▼

User Sees: Price chart updates! 📊

NEXT REQUEST (Same stock):
═════════════════════════════
User clicks refresh
   │
   ├──────► Frontend ──────► Backend ──────► Redis ──────► "Found it!" ✅
   │                                                        Returns in 5ms
   │◄──────────────────────────────────────────────────────┘
   │
   ▼ Much faster! (No database query needed)
```

### Diagram 3: Real-Time Data Flow - WebSocket Connection

```
Timeline         Fyers API          Python 5001        Backend          Frontend
━━━━━━━━         ━━━━━━━━━          ━━━━━━━━━━━        ━━━━━━━          ━━━━━━━━

00:00.000                                              
                                                       User clicks "Start Live Feed"
                                                                            │
                                                                            ▼
00:00.001                          ◄───Subscribe──────────────────────────┘
                                   "Give me RELIANCE prices"
                                          │
                                          ▼
00:00.002       ◄─────Connect─────────────┘
                WebSocket opened
                     │
00:01.000       │ Price: 2850.50
                ├──────────────────────►
                                          │ Process
                                          │ Calculate RSI, VWAP
                                          │
00:01.050                                 ├──────────────────────►
                                                                  │ Validate
                                                                  │ Add timestamp
                                                                  │
00:01.100                                                         ├─────────────►
                                                                  WebSocket emit
                                                                         │
                                                                         ▼
                                                                  📊 Chart updates!

00:02.000       │ Price: 2850.55         (Repeat every second)
                ├──────────────────────►────────────────────────►────────────────►

00:03.000       │ Price: 2850.48
                ├──────────────────────►────────────────────────►────────────────►

00:04.000       │ Price: 2850.60
                ├──────────────────────►────────────────────────►────────────────►

                ▲                       ▲                        ▲               ▲
                │                       │                        │               │
                └───────CONTINUOUS CONNECTION (Until user closes browser)───────┘
```

### Diagram 4: Docker Container Network

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   Docker Network: production-instance_apm-network       │
│                                                                          │
│   ┌────────────────┐       ┌────────────────┐      ┌───────────────┐   │
│   │   Frontend     │       │   Backend      │      │  Python 5001  │   │
│   │   Container    │──────►│   Container    │◄─────│   Container   │   │
│   │                │       │                │      │               │   │
│   │  Next.js App   │       │  NestJS App    │      │  Flask Server │   │
│   │                │       │                │      │               │   │
│   │  Internal: 3000│       │  Internal: 5002│      │  Internal:5001│   │
│   │  External: 3000│       │  External: 5002│      │  External:8001│   │
│   └────────────────┘       └───────┬────────┘      └───────────────┘   │
│                                    │                                    │
│   ┌────────────────┐               │                ┌───────────────┐   │
│   │  Python 5010   │               │                │  PostgreSQL   │   │
│   │   Container    │               └───────────────►│   Container   │   │
│   │                │                                │               │   │
│   │  Flask Server  │               ┌───────────────►│  Database     │   │
│   │                │               │                │               │   │
│   │  Internal:5010 │               │                │  Internal:5432│   │
│   │  External:8010 │               │                │  External:5432│   │
│   └────────────────┘               │                └───────────────┘   │
│                                    │                                    │
│                                    │                ┌───────────────┐   │
│                                    │                │     Redis     │   │
│                                    └───────────────►│   Container   │   │
│                                                     │               │   │
│                                                     │     Cache     │   │
│                                                     │               │   │
│                                                     │  Internal:6379│   │
│                                                     │  External:6379│   │
│                                                     └───────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ All containers can talk to each other
                                    │ using container names (e.g., 'backend', 'db')
                                    │
                                    ▼
                          Host Machine: 1000.93.172.21
                          (External access via mapped ports)
```

### Diagram 5: File & Data Storage

```
Server Filesystem                    Docker Volumes                Database Tables
━━━━━━━━━━━━━━━━━                   ━━━━━━━━━━━━━━━                ━━━━━━━━━━━━━━

/Users/raghav/Documents/
GitHub/APM-TOP-K-STOCKS/
│
├── apps/
│   ├── backend/
│   │   ├── data/                 ──► Mounted to containers
│   │   │   ├── auth_status.json      │
│   │   │   ├── fyers_token.json      │
│   │   │   └── company_master.csv    │
│   │   │                              │
│   │   └── src/                       │
│   │       └── (Backend code)         │
│   │                                  │
│   └── frontend/                      │
│       ├── app/                       │
│       ├── components/                │
│       └── (Frontend code)            │
│                                      │
└── multi-instances/                   │
    └── instance1/                     │
        ├── .env ─────────────────────►│ Used by all containers
        ├── data/ ────────────────────►│ Mounted for shared access
        ├── logs/ ────────────────────►│ Container logs written here
        │                              │
        └── docker-compose.yml         │
                                       │
                                       ▼
                            Docker Volumes (Persistent Storage)
                            ════════════════════════════════════
                            
                            postgres-data/          redis-data/
                            │                       │
                            ├── base/               ├── appendonly.aof
                            ├── global/             └── dump.rdb
                            └── pg_wal/
                                  │
                                  │ Stored on disk, survives restarts
                                  │
                                  ▼
                            PostgreSQL Tables
                            ════════════════
                            
                            ┌─────────────────────────┐
                            │  companies              │
                            ├─────────────────────────┤
                            │ id | symbol | name     │
                            │ 1  | RELIANCE | ...    │
                            │ 2  | TCS | ...         │
                            └─────────────────────────┘
                            
                            ┌─────────────────────────┐
                            │  stock_data             │
                            ├─────────────────────────┤
                            │ id | symbol | price    │
                            │ 1  | RELIANCE | 2850   │
                            │ 2  | RELIANCE | 2851   │
                            └─────────────────────────┘
                            
                            ┌─────────────────────────┐
                            │  daily_watchlist        │
                            ├─────────────────────────┤
                            │ id | date | symbols    │
                            │ 1  | 2025-12-22 | [...] │
                            └─────────────────────────┘
```

### Diagram 6: Environment Variable Flow

```
Configuration Source              Container Uses                Service Behavior
━━━━━━━━━━━━━━━━━━━━              ━━━━━━━━━━━━━━                ━━━━━━━━━━━━━━━━

.env file:                        Frontend Container:           Next.js App:
┌─────────────────────┐          ┌──────────────────┐          ┌────────────────┐
│NEXT_PUBLIC_API_URL  │─────────►│ process.env      │─────────►│ API calls go   │
│=http://1000.93...   │          │  .NEXT_PUBLIC_   │          │ to this URL    │
└─────────────────────┘          │  API_URL         │          └────────────────┘
                                 └──────────────────┘

.env file:                        Backend Container:            NestJS App:
┌─────────────────────┐          ┌──────────────────┐          ┌────────────────┐
│DATABASE_URL=        │─────────►│ process.env      │─────────►│ Connects to    │
│postgresql://...     │          │  .DATABASE_URL   │          │ this database  │
└─────────────────────┘          └──────────────────┘          └────────────────┘

.env file:                        Python 5001 Container:        Python Script:
┌─────────────────────┐          ┌──────────────────┐          ┌────────────────┐
│FYERS_CLIENT_ID=     │─────────►│ os.getenv(       │─────────►│ Authenticates  │
│ABC123XY-100         │          │  "FYERS_CLIENT"  │          │ with Fyers API │
└─────────────────────┘          │  "_ID")          │          └────────────────┘
                                 └──────────────────┘

.env file:                        PostgreSQL Container:         Database:
┌─────────────────────┐          ┌──────────────────┐          ┌────────────────┐
│POSTGRES_PASSWORD=   │─────────►│ POSTGRES_        │─────────►│ Admin password │
│MySecurePass123      │          │  PASSWORD env    │          │ is set to this │
└─────────────────────┘          └──────────────────┘          └────────────────┘
```

### Diagram 7: Port Mapping Visualization

```
External World                    Server Firewall               Docker Containers
━━━━━━━━━━━━━━                   ━━━━━━━━━━━━━━━               ━━━━━━━━━━━━━━━━

User's Browser                    1000.93.172.21
     │                            ┌─────────────┐
     │                            │             │
     │──── :3000 ────────────────►│  Port 3000  │───────────────► Frontend :3000
     │                            │   (Open)    │                  Next.js
     │                            │             │
     │──── :5002 ────────────────►│  Port 5002  │───────────────► Backend :5002
     │                            │   (Open)    │                  NestJS
     │                            │             │
     │──── :8001 ────────────────►│  Port 8001  │───────────────► Python :5001
     │                            │   (Open)    │                  Service A
     │                            │             │
     │──── :8010 ────────────────►│  Port 8010  │───────────────► Python :5010
     │                            │   (Open)    │                  Service B
     │                            │             │
     ├──── :5432 ─────────X──────►│  Port 5432  │       ┌────────► PostgreSQL :5432
     │                     ▲      │  (Closed)   │       │          Database
     │                     │      │             │       │
     │                     │      │             │       │
     │                 Blocked    │  Port 6379  │       │         Redis :6379
     │                 by         │  (Closed)   │       │         Cache
     │                 firewall   │             │       │
     │                            └─────────────┘       │
     │                                                  │
     │                            Internal Docker       │
     │                            Network (bridge)      │
     └─────────────────────────────────────────────────┘
                                  All containers can talk
                                  to each other internally
```

### Diagram 8: Authentication Flow Diagram

```
Step-by-Step Login Process
══════════════════════════

1. INITIAL STATE - User Not Logged In
   ┌────────────────────────────────────────────────────────────┐
   │  Browser                                                    │
   │  ┌──────────────────────────────────────────────────┐      │
   │  │  http://1000.93.172.21:3000/dashboard            │      │
   │  │                                                  │      │
   │  │  ┌────────────────────────────────────┐          │      │
   │  │  │   🔒 Please Login with Fyers       │          │      │
   │  │  │                                    │          │      │
   │  │  │   ┌──────────────────────┐         │          │      │
   │  │  │   │  [Login with Fyers]  │ ◄───── Click      │      │
   │  │  │   └──────────────────────┘         │          │      │
   │  │  └────────────────────────────────────┘          │      │
   │  └──────────────────────────────────────────────────┘      │
   └────────────────────────────────────────────────────────────┘

2. REQUEST AUTH URL
   ┌────────────────────────────────────────────────────────────┐
   │  Frontend sends to Backend:                                 │
   │  GET http://1000.93.172.21:5002/api/auth/fyers-url          │
   │                                                              │
   │  Backend generates:                                          │
   │  https://api.fyers.in/api/v2/generate-authcode              │
   │    ?client_id=ABC123XY-100                                  │
   │    &redirect_uri=http://1000.93.172.21:3000/auth/callback   │
   │    &response_type=code                                       │
   │    &state=random_string_for_security                        │
   │                                                              │
   │  Backend returns URL to Frontend                             │
   └────────────────────────────────────────────────────────────┘

3. REDIRECT TO FYERS
   ┌────────────────────────────────────────────────────────────┐
   │  Browser redirects to Fyers:                                │
   │                                                              │
   │  https://api.fyers.in/api/v2/generate-authcode?...          │
   │                                                              │
   │  ┌─────────────────────────────────────────────┐            │
   │  │        Fyers Login Page                     │            │
   │  │  ┌─────────────────────────────────────┐    │            │
   │  │  │  Client ID: [        ]              │    │            │
   │  │  │  Password:  [        ]              │    │            │
   │  │  │  PIN:       [        ]              │    │            │
   │  │  │  ┌────────────┐                     │    │            │
   │  │  │  │   Login    │ ◄──── User enters   │    │            │
   │  │  │  └────────────┘       credentials   │    │            │
   │  │  └─────────────────────────────────────┘    │            │
   │  └─────────────────────────────────────────────┘            │
   └────────────────────────────────────────────────────────────┘

4. FYERS VALIDATES & REDIRECTS BACK
   ┌────────────────────────────────────────────────────────────┐
   │  Fyers validates credentials                                │
   │  ✓ Client ID matches                                        │
   │  ✓ Password correct                                         │
   │  ✓ PIN correct                                              │
   │                                                              │
   │  Fyers generates authorization code: "abc123xyz789"         │
   │                                                              │
   │  Redirects browser to:                                       │
   │  http://1000.93.172.21:3000/auth/callback                   │
   │    ?code=abc123xyz789                                       │
   │    &state=random_string_for_security                        │
   └────────────────────────────────────────────────────────────┘

5. FRONTEND RECEIVES CODE
   ┌────────────────────────────────────────────────────────────┐
   │  Frontend at /auth/callback receives:                       │
   │  - code: abc123xyz789                                       │
   │  - state: random_string_for_security                        │
   │                                                              │
   │  Frontend sends to Backend:                                 │
   │  POST http://1000.93.172.21:5002/api/auth/exchange-token    │
   │  Body: { code: "abc123xyz789" }                             │
   └────────────────────────────────────────────────────────────┘

6. BACKEND EXCHANGES CODE FOR TOKEN
   ┌────────────────────────────────────────────────────────────┐
   │  Backend sends to Fyers:                                    │
   │  POST https://api.fyers.in/api/v2/validate-authcode         │
   │  Body: {                                                     │
   │    grant_type: "authorization_code",                        │
   │    appIdHash: sha256(APP_ID:SECRET_ID),                    │
   │    code: "abc123xyz789"                                     │
   │  }                                                           │
   │                                                              │
   │  Fyers responds with:                                        │
   │  {                                                           │
   │    access_token: "eyJhbGciOiJIUz...(very long token)",      │
   │    token_type: "Bearer",                                    │
   │    expires_in: 86400  (24 hours)                            │
   │  }                                                           │
   └────────────────────────────────────────────────────────────┘

7. BACKEND SAVES TOKEN
   ┌────────────────────────────────────────────────────────────┐
   │  Backend saves token to:                                    │
   │  1. Database (for persistence)                              │
   │  2. .env file (for service restarts)                        │
   │  3. Redis (for quick access)                                │
   │  4. Python services (for API calls)                         │
   │                                                              │
   │  Returns success to Frontend                                │
   └────────────────────────────────────────────────────────────┘

8. LOGGED IN - DATA FLOWS
   ┌────────────────────────────────────────────────────────────┐
   │  Browser shows Dashboard                                    │
   │  ┌──────────────────────────────────────────────────┐      │
   │  │  Welcome! ✓ Logged in                            │      │
   │  │                                                  │      │
   │  │  📊 Live Stock Prices                            │      │
   │  │  ┌──────────────────────────────────┐            │      │
   │  │  │  RELIANCE    2850.50  ▲ +15.30   │            │      │
   │  │  │  TCS         3420.75  ▼ -10.20   │            │      │
   │  │  └──────────────────────────────────┘            │      │
   │  │                                                  │      │
   │  │  Using access_token for all API calls            │      │
   │  └──────────────────────────────────────────────────┘      │
   └────────────────────────────────────────────────────────────┘
```

---

## 📦 Component Interaction Matrix

| From ↓ / To → | Frontend | Backend | Python 5001 | Python 5010 | PostgreSQL | Redis |
|---------------|----------|---------|-------------|-------------|------------|-------|
| **Frontend** | - | HTTP/WS ✓ | WS ✓ | WS ✓ | ✗ | ✗ |
| **Backend** | WS ✓ | - | HTTP ✓ | HTTP ✓ | SQL ✓ | TCP ✓ |
| **Python 5001** | WS ✓ | WS ✓ | - | ✗ | SQL ✓ | ✗ |
| **Python 5010** | WS ✓ | WS ✓ | ✗ | - | SQL ✓ | ✗ |
| **PostgreSQL** | ✗ | ✓ | ✓ | ✓ | - | ✗ |
| **Redis** | ✗ | ✓ | ✗ | ✗ | ✗ | - |

**Legend:**
- ✓ = Can communicate
- ✗ = Cannot/Should not communicate directly
- HTTP = REST API calls
- WS = WebSocket connection
- SQL = Database queries
- TCP = Redis protocol

---

## 🎯 Data Flow Timing Diagram

```
User Action: "Show me RELIANCE stock data"
═══════════════════════════════════════════

Time        Action                                              Duration
────────────────────────────────────────────────────────────────────────
0ms         User types in browser                               -
            └─ Presses Enter

1ms         Browser sends HTTP GET                              -
            └─ http://1000.93.172.21:3000/stock/RELIANCE

2ms         Frontend receives request                           -
            └─ Checks if data in local state (no)

5ms         Frontend calls Backend API                          -
            └─ http://1000.93.172.21:5002/api/stock/RELIANCE

10ms        Backend receives request                            -
            └─ Checks Redis cache

12ms        Redis check (cache miss)                            2ms ✗
            └─ Data not in cache

15ms        Backend queries PostgreSQL                          -
            └─ SELECT * FROM stocks WHERE symbol='RELIANCE'

65ms        PostgreSQL returns 10,000 rows                      50ms ✓
            └─ Historical data

70ms        Backend processes data                              5ms
            └─ Formats, calculates indicators

75ms        Backend stores in Redis                             5ms
            └─ SET stock:RELIANCE:data {...}

80ms        Backend sends response to Frontend                  5ms
            └─ JSON: 50KB

90ms        Frontend receives data                              10ms (network)
            └─ Parses JSON

100ms       Frontend renders chart                              10ms
            └─ React updates DOM

110ms       User sees chart                                     -
            ✓ Total time: 110ms

SECOND REQUEST (same stock):
════════════════════════════

0ms         User refreshes                                      -

1ms         Browser sends request                               -

5ms         Frontend calls Backend                              -

10ms        Backend checks Redis                                -

12ms        Redis HIT! Returns data                             2ms ✓✓✓
            └─ Much faster!

15ms        Backend sends to Frontend                           3ms

20ms        Frontend renders                                    5ms

25ms        User sees chart                                     -
            ✓ Total time: 25ms (4.4x faster!)
```

---

## 🔄 Lifecycle Diagrams

### Application Startup Sequence

```
Docker Compose UP
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  1. Read docker-compose.yml                              │
│  2. Read .env file                                       │
│  3. Create network: production-instance_apm-network      │
│  4. Create volumes: postgres-data, redis-data            │
└──────────────────────────────────────────────────────────┘
       │
       ├───────────────────────────────────────────┐
       │                                           │
       ▼                                           ▼
┌─────────────────┐                    ┌──────────────────┐
│  Start Database │                    │   Start Redis    │
│  (PostgreSQL)   │                    │                  │
│                 │                    │                  │
│  1. Create DB   │                    │  1. Load config  │
│  2. Run init.sql│                    │  2. Start server │
│  3. Ready! ✓    │                    │  3. Ready! ✓     │
└────────┬────────┘                    └────────┬─────────┘
         │                                      │
         │  Wait for healthy...                 │
         │                                      │
         └──────────────┬───────────────────────┘
                        │ Both healthy ✓
                        │
                        ▼
         ┌──────────────────────────────┐
         │  Start Backend (NestJS)      │
         │                              │
         │  1. npm install              │
         │  2. npm run build            │
         │  3. Connect to DB ✓          │
         │  4. Connect to Redis ✓       │
         │  5. Start API server         │
         │  6. Ready! ✓                 │
         └──────────────┬───────────────┘
                        │ Healthy ✓
                        │
         ┌──────────────┴───────────────┐
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌──────────────────┐
│ Start Python    │          │ Start Frontend   │
│ Service 5001    │          │ (Next.js)        │
│                 │          │                  │
│ 1. pip install  │          │ 1. npm install   │
│ 2. Load Fyers   │          │ 2. npm run build │
│    credentials  │          │ 3. Start server  │
│ 3. Start Flask  │          │ 4. Ready! ✓      │
│ 4. Ready! ✓     │          │                  │
└─────────────────┘          └──────────────────┘
         │
         ▼
┌─────────────────┐
│ Start Python    │
│ Service 5010    │
│                 │
│ 1. pip install  │
│ 2. Load config  │
│ 3. Start Flask  │
│ 4. Ready! ✓     │
└─────────────────┘

All services started! System ready.
Access at: http://1000.93.172.21:3000
```

---

These diagrams provide a complete visual understanding of how every component in the APM TOP-K STOCKS system works together!
