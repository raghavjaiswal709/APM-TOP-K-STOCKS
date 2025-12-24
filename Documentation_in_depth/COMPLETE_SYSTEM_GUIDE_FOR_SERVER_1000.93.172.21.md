# 🚀 APM TOP-K STOCKS - COMPLETE SYSTEM GUIDE
## Crystal Clear Visual Documentation & Server Deployment Guide

**Target Server:** `1000.93.172.21` (NVME Server)  
**Last Updated:** December 22, 2025  
**Audience:** Developers & Non-Developers

---

## 📖 TABLE OF CONTENTS

1. [Visual System Architecture](#1-visual-system-architecture)
2. [How Everything Works (Step-by-Step)](#2-how-everything-works-step-by-step)
3. [Data Flow Diagrams](#3-data-flow-diagrams)
4. [All Components Explained (Non-Technical)](#4-all-components-explained-non-technical)
5. [Environment Variables - Complete Guide](#5-environment-variables-complete-guide)
6. [Server Deployment Checklist](#6-server-deployment-checklist)
7. [Configuration Files to Modify](#7-configuration-files-to-modify)
8. [Port Mapping Reference](#8-port-mapping-reference)
9. [Troubleshooting Guide](#9-troubleshooting-guide)

---

## 1. VISUAL SYSTEM ARCHITECTURE

### 🏗️ The Big Picture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    🌐 INTERNET / EXTERNAL WORLD                         │
│                                                                          │
│  ┌──────────────┐              ┌──────────────┐                        │
│  │ Fyers API    │              │ Your Browser │                        │
│  │ (Stock Data) │              │ (User/Trader)│                        │
│  └──────┬───────┘              └──────┬───────┘                        │
│         │                              │                                │
└─────────┼──────────────────────────────┼────────────────────────────────┘
          │                              │
          │                              │ (Visits http://1000.93.172.21:3000)
          │                              ↓
┌─────────┼──────────────────────────────────────────────────────────────┐
│         │           🖥️  NVME SERVER (1000.93.172.21)                   │
│         │                                                               │
│         │              ┌─────────────────────────────┐                 │
│         │              │  🎨 FRONTEND LAYER          │                 │
│         │              │  (What User Sees)           │                 │
│         │              │                             │                 │
│         │              │  ┌──────────────────────┐   │                 │
│         │              │  │ Next.js Web App      │   │                 │
│         │              │  │ Port: 3000           │   │                 │
│         │              │  │ Shows: Charts,       │   │                 │
│         │              │  │        Tables,       │   │                 │
│         │              │  │        Real-time     │   │                 │
│         │              │  │        Stock Prices  │   │                 │
│         │              │  └──────────┬───────────┘   │                 │
│         │              └─────────────┼───────────────┘                 │
│         │                            │                                 │
│         │                            │ API Requests                    │
│         │                            ↓                                 │
│         │              ┌─────────────────────────────┐                 │
│         │              │  🧠 BACKEND LAYER           │                 │
│         │              │  (The Brain/Manager)        │                 │
│         │              │                             │                 │
│         │              │  ┌──────────────────────┐   │                 │
│         │              │  │ NestJS API Server    │   │                 │
│         │              │  │ Port: 5002           │   │                 │
│         │              │  │ Handles: Requests,   │   │                 │
│         │              │  │          Business    │   │                 │
│         │              │  │          Logic,      │   │                 │
│         │              │  │          Data Flow   │   │                 │
│         │              │  └──┬────────────────┬──┘   │                 │
│         │              └─────┼────────────────┼──────┘                 │
│         │                    │                │                        │
│         │                    │                │                        │
│         │    ┌───────────────┘                └──────────────┐         │
│         │    │                                               │         │
│         │    ↓                                               ↓         │
│         │  ┌────────────────────────┐          ┌─────────────────────┐│
│         │  │ 🐍 PYTHON WORKERS      │          │ 💾 DATA STORAGE     ││
│         │  │ (Stock Data Collectors)│          │ (Memory/Warehouse)  ││
│         │  │                        │          │                     ││
│         │  │ ┌──────────────────┐   │          │ ┌─────────────────┐ ││
│         └──┼─│ Service 5001     │   │          │ │ PostgreSQL DB   │ ││
│     Fetches │ │ Port: 5001/8001  │   │          │ │ Port: 5432      │ ││
│  Stock Data │ │ Role: Live       │   │          │ │ Stores: History │ ││
│             │ │       Real-time  │   │          │ │         Companies││
│             │ │       Feed       │◄──┼──────────┼─┤         Settings││ ││
│             │ └──────────────────┘   │   Saves  │ └─────────────────┘ ││
│             │                        │   Data   │                     ││
│             │ ┌──────────────────┐   │          │ ┌─────────────────┐ ││
│             │ │ Service 5010     │   │          │ │ Redis Cache     │ ││
│             │ │ Port: 5010/8010  │   │          │ │ Port: 6379      │ ││
│             │ │ Role: Multi-view │   │          │ │ Stores: Temp    │ ││
│             │ │       Aggregator │◄──┼──────────┼─┤         Quick   │ ││
│             │ └──────────────────┘   │   Fast   │ │         Access  │ ││
│             └────────────────────────┘  Access  └─────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 🎯 Component Roles at a Glance

| Component | Port | Role | Think of it as... |
|-----------|------|------|-------------------|
| **Next.js Frontend** | 3000 | User Interface | The Shop Window |
| **NestJS Backend** | 5002 | API & Logic | The Store Manager |
| **Python Service 5001** | 8001 | Live Data Feed | Radio Listener |
| **Python Service 5010** | 8010 | Data Aggregator | Data Researcher |
| **PostgreSQL** | 5432 | Permanent Storage | The Warehouse |
| **Redis** | 6379 | Fast Cache | Sticky Notes |

---

## 2. HOW EVERYTHING WORKS (STEP-BY-STEP)

### 🔄 Complete User Journey

```
USER ACTION                    →    SYSTEM RESPONSE
═══════════════════════════════     ═══════════════════════════════════════

Step 1: User Opens Browser
├─ Types: http://1000.93.172.21:3000
└─ Connects to: Frontend (Next.js)
    │
    ↓
Step 2: Frontend Loads
├─ Shows: Loading screen
├─ Requests: Initial data from Backend
└─ Sends HTTP Request to: http://1000.93.172.21:5002/api/...
    │
    ↓
Step 3: Backend Receives Request
├─ Checks: What data is needed?
├─ Decision Point:
│   ├─ Is data in Redis Cache? → YES: Return immediately (Fast!)
│   └─ Not in cache? → Continue below
    │
    ↓
Step 4: Backend Checks Database
├─ Connects to: PostgreSQL (localhost:5432 inside Docker)
├─ Queries: Historical stock data, company lists
└─ Caches result in Redis for next time
    │
    ↓
Step 5: If Live Data Needed
├─ Backend sends command to: Python Service 5001
├─ Service 5001:
│   ├─ Connects to: Fyers API (Internet)
│   ├─ Subscribes to: Real-time stock feed
│   ├─ Receives: Live prices every second
│   ├─ Processes: Calculates indicators (RSI, VWAP, etc.)
│   └─ Sends back to: Backend via WebSocket
    │
    ↓
Step 6: Backend Processes & Responds
├─ Combines: Database data + Live data
├─ Formats: JSON response
└─ Sends to: Frontend
    │
    ↓
Step 7: Frontend Updates UI
├─ Receives: JSON data
├─ Updates: Charts, tables, numbers
└─ User sees: Live stock dashboard!
    │
    ↓
Step 8: Continuous Real-time Updates
└─ WebSocket connection maintained
    ├─ Service 5001 → Backend → Frontend
    ├─ Updates: Every 200ms (0.2 seconds)
    └─ User sees: Prices changing in real-time
```

---

## 3. DATA FLOW DIAGRAMS

### 📊 Real-time Stock Price Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                         REAL-TIME DATA FLOW                            │
└────────────────────────────────────────────────────────────────────────┘

External API          Python Service        Backend API        Frontend
━━━━━━━━━━━            ━━━━━━━━━━━━━━        ━━━━━━━━━━        ━━━━━━━━
                                                                
Fyers API                                                       
   │                                                            
   │ 1. Subscribe                                               
   │◄───────────── Service 5001                                
   │                  (8001)                                    
   │                    │                                       
   │ 2. Stream data     │                                       
   │ every 1 second     │                                       
   ├────────────────────►                                       
   │                    │                                       
   │                    │ 3. Process &                          
   │                    │    Calculate                          
   │                    │    Indicators                         
   │                    │                                       
   │                    │ 4. Send via                           
   │                    │    WebSocket                          
   │                    ├──────────────► NestJS                 
   │                    │                 (5002)                
   │                    │                   │                   
   │                    │                   │ 5. Save to        
   │                    │                   │    PostgreSQL     
   │                    │                   ├──────────┐        
   │                    │                   │          ↓        
   │                    │                   │      Database     
   │                    │                   │          │        
   │                    │                   │◄─────────┘        
   │                    │                   │                   
   │                    │                   │ 6. Cache in       
   │                    │                   │    Redis          
   │                    │                   ├──────────┐        
   │                    │                   │          ↓        
   │                    │                   │       Redis       
   │                    │                   │          │        
   │                    │                   │◄─────────┘        
   │                    │                   │                   
   │                    │                   │ 7. Forward        
   │                    │                   │    to UI          
   │                    │                   ├──────────────────►Next.js
   │                    │                   │                   (3000)
   │                    │                   │                      │
   │                    │                   │                      │
   │                    │                   │                      ↓
   │                    │                   │                   Browser
   │                    │                   │                   Updates!
                                                                
   │◄───Repeat every second────────────────────────────────────────│
```

### 🔐 Authentication Flow (Fyers Login)

```
┌────────────────────────────────────────────────────────────────────────┐
│                      FYERS AUTHENTICATION FLOW                         │
└────────────────────────────────────────────────────────────────────────┘

User Browser          Frontend          Backend          Fyers API
━━━━━━━━━━━━          ━━━━━━━━          ━━━━━━━          ━━━━━━━━━

    │                    │                 │                 │
    │ 1. Click "Login"   │                 │                 │
    ├───────────────────►│                 │                 │
    │                    │                 │                 │
    │                    │ 2. Request      │                 │
    │                    │    Auth URL     │                 │
    │                    ├────────────────►│                 │
    │                    │                 │                 │
    │                    │                 │ 3. Generate     │
    │                    │                 │    Auth Link    │
    │                    │                 ├────────────────►│
    │                    │                 │                 │
    │                    │                 │ 4. Auth URL     │
    │                    │                 │◄────────────────┤
    │                    │                 │                 │
    │                    │ 5. Redirect URL │                 │
    │                    │◄────────────────┤                 │
    │                    │                 │                 │
    │ 6. Redirect        │                 │                 │
    │    to Fyers        │                 │                 │
    │◄───────────────────┤                 │                 │
    │                    │                 │                 │
    ├─────────────────────────────────────────────────────►│
    │                    │                 │                 │
    │ 7. User logs in    │                 │                 │
    │    at Fyers        │                 │                 │
    │                    │                 │                 │
    │ 8. Fyers redirects │                 │                 │
    │    back with code  │                 │                 │
    │◄─────────────────────────────────────────────────────┤
    │                    │                 │                 │
    │ (To: http://1000.93.172.21:3000/auth/callback?code=xxx)
    │                    │                 │                 │
    ├───────────────────►│                 │                 │
    │                    │ 9. Send code    │                 │
    │                    ├────────────────►│                 │
    │                    │                 │                 │
    │                    │                 │ 10. Exchange    │
    │                    │                 │     code for    │
    │                    │                 │     token       │
    │                    │                 ├────────────────►│
    │                    │                 │                 │
    │                    │                 │ 11. Access Token│
    │                    │                 │◄────────────────┤
    │                    │                 │                 │
    │                    │                 │ 12. Save token  │
    │                    │                 │     in .env &   │
    │                    │                 │     database    │
    │                    │                 │                 │
    │                    │ 13. Success!    │                 │
    │◄───────────────────┤◄────────────────┤                 │
    │                    │                 │                 │
    │ 14. Dashboard      │                 │                 │
    │     loads with     │                 │                 │
    │     data           │                 │                 │
```

---

## 4. ALL COMPONENTS EXPLAINED (NON-TECHNICAL)

### 🎨 Frontend (Next.js - Port 3000)

**What is it?**  
The part you see and interact with in your web browser. Think of it as the "face" of the application.

**What does it do?**
- Shows beautiful charts and graphs
- Displays stock prices that update in real-time
- Has buttons and forms you can click
- Makes the data look pretty and organized

**How does it work?**
- It's built with React and Next.js (modern web technologies)
- Runs in a Docker container
- When you type `http://1000.93.172.21:3000` in your browser, you're connecting to this

**Files involved:**
- `/apps/frontend/` - All the frontend code
- `Dockerfile.frontend` - Instructions to build it
- `next.config.ts` - Configuration file

**Important settings for server 1000.93.172.21:**
```javascript
// In next.config.ts, change:
const SERVER_IP = '1000.93.172.21';  // ← Your server IP

// This tells the frontend where to find other services
```

---

### 🧠 Backend (NestJS - Port 5002)

**What is it?**  
The "brain" of the application. It's the middleman between what you see (Frontend) and where data is stored (Database).

**What does it do?**
- Receives requests from the Frontend
- Decides what data to fetch and from where
- Talks to the Database to get/save information
- Talks to Python services to get live stock data
- Sends processed data back to Frontend

**How does it work?**
- Built with NestJS (a Node.js framework)
- Has "routes" like doors in a building - each door leads to different data
  - `/api/stocks` → Get stock information
  - `/api/companies` → Get company list
  - `/api/watchlist` → Get your watchlist
- Runs 24/7 waiting for requests

**Files involved:**
- `/apps/backend/src/` - All backend code
- `Dockerfile.backend` - Instructions to build it
- `.env` file - Secret configuration (passwords, API keys)

**Important settings for server 1000.93.172.21:**
```env
# Backend needs to know how to connect to database
DB_HOST=db                    # Inside Docker, it's just "db"
DB_PORT=5432                  # PostgreSQL standard port
DB_USERNAME=postgres          # Database username
DB_PASSWORD=your_password     # ← Set a strong password
DB_DATABASE=apm_stocks_db     # Database name
```

---

### 🐍 Python Service 5001 (Live Feed - Port 8001)

**What is it?**  
A specialized worker written in Python that listens to live stock prices like a radio.

**What does it do?**
- Connects to Fyers API (the stock exchange)
- Subscribes to stock symbols you want to track
- Receives price updates every second
- Calculates technical indicators (RSI, VWAP, Moving Averages)
- Sends data to Backend via WebSocket (super fast connection)

**How does it work?**
- Uses `eventlet` for handling thousands of connections simultaneously
- Maintains a WebSocket connection that's always open
- Processes data in real-time (no delay)
- Runs in its own Docker container

**Files involved:**
- `fyers_service_5001.py` - Main Python script
- `Dockerfile.python-5001` - Build instructions

**Important settings:**
```env
FYERS_CLIENT_ID=YOUR_APP_ID        # ← From Fyers Developer Portal
FYERS_SECRET_ID=YOUR_SECRET_KEY    # ← Keep this SECRET!
FYERS_ACCESS_TOKEN=your_token      # ← Generated after login
FYERS_REDIRECT_URI=http://1000.93.172.21:3000/auth/callback
```

---

### 🐍 Python Service 5010 (Aggregator - Port 8010)

**What is it?**  
Another Python worker that fetches and organizes stock data from multiple views/timeframes.

**What does it do?**
- Fetches historical data (1 minute, 5 minute, 15 minute candles)
- Handles multiple companies simultaneously (up to 6 by default)
- Aggregates data into useful formats
- Provides multi-timeframe analysis

**How does it work?**
- Uses `asyncio` for asynchronous operations
- Runs with `uvicorn` web server
- Communicates with Backend via HTTP and WebSocket
- Runs independently in Docker

**Files involved:**
- `fyers_service_5010.py` - Main script
- `Dockerfile.python-5010` - Build instructions

**Same Fyers credentials as Service 5001**

---

### 💾 PostgreSQL Database (Port 5432)

**What is it?**  
A powerful database system - think of it as a giant, organized filing cabinet.

**What does it store?**
- Historical stock prices (yesterday, last week, last month)
- Company information (names, symbols, sectors)
- Your watchlists
- User settings and preferences
- Calculated metrics and indicators

**How does it work?**
- Data is stored in "tables" (like Excel spreadsheets)
- Each table has rows (records) and columns (fields)
- Backend queries it using SQL (database language)
- Data persists even if server restarts

**Files involved:**
- `init-db.sql` - Initial database setup script
- Docker volume `postgres-data` - Where actual data is stored on disk

**Important settings:**
```env
POSTGRES_USER=postgres                          # Admin username
POSTGRES_PASSWORD=apm_secure_password_2025     # ← CHANGE THIS!
POSTGRES_DB=apm_stocks_db                      # Database name
DATABASE_URL=postgresql://postgres:apm_secure_password_2025@db:5432/apm_stocks_db
```

**Tables created:**
- `companies` - List of all companies
- `stock_data` - Historical price data
- `daily_watchlist` - Your watchlists
- `daily_watchlist_metrics` - Calculated metrics

---

### ⚡ Redis Cache (Port 6379)

**What is it?**  
Super-fast temporary storage - like RAM memory for the application.

**What does it do?**
- Stores frequently accessed data
- Makes responses incredibly fast (milliseconds)
- Reduces load on PostgreSQL
- Stores temporary session data

**How does it work?**
- Data is stored in key-value pairs (like a dictionary)
- Data expires after a certain time
- Backend checks Redis first before querying database
- If data is in Redis → Instant response!
- If not in Redis → Get from database, store in Redis for next time

**Files involved:**
- None (uses official Redis Docker image)

**Important settings:**
```env
REDIS_URL=redis://redis:6379
REDIS_MAX_MEMORY=512mb              # Max memory usage
REDIS_MAX_MEMORY_POLICY=allkeys-lru # Evict least recently used
```

**Example usage:**
```
Request: "Get price for RELIANCE"
1. Check Redis → Found! Return in 5ms
vs.
2. Check Redis → Not found
3. Query PostgreSQL → Takes 50ms
4. Store in Redis for next time
5. Return data
```

---

## 5. ENVIRONMENT VARIABLES - COMPLETE GUIDE

### 📋 What are Environment Variables?

Think of environment variables as a "settings file" that contains:
- Passwords
- Server addresses
- API keys
- Port numbers
- Configuration options

**Why use them?**
- Security: Don't hardcode passwords in code
- Flexibility: Easy to change without modifying code
- Different environments: Development vs Production settings

### 🔐 Complete `.env` File for Server 1000.93.172.21

Create this file at: `/multi-instances/instance1/.env`

```env
# ═══════════════════════════════════════════════════════════════════════════
# APM TOP-K STOCKS - Production Configuration
# Server: 1000.93.172.21 (NVME Server)
# Date: December 22, 2025
# ═══════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────
# 1. INSTANCE IDENTIFICATION
# ─────────────────────────────────────────────────────────────────────────
# What this instance is called (useful if running multiple copies)
INSTANCE_ID=production-instance
INSTANCE_NAME="APM Production Server"
INSTANCE_REGION=nvme-server

# ─────────────────────────────────────────────────────────────────────────
# 2. PORT CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────
# These are the "doors" each service listens on

# Frontend - What users visit in browser
FRONTEND_PORT=3000
# Access at: http://1000.93.172.21:3000

# Backend API - Main application server
BACKEND_PORT=5002
# Access at: http://1000.93.172.21:5002

# Python Service 5001 - Live data feed
FYERS_5001_PORT=8001
# Access at: http://1000.93.172.21:8001

# Python Service 5010 - Data aggregator
FYERS_5010_PORT=8010
# Access at: http://1000.93.172.21:8010

# PostgreSQL Database
POSTGRES_PORT=5432
# Access at: localhost:5432 (inside Docker network)
# External access: 1000.93.172.21:5432 (if exposed)

# Redis Cache
REDIS_PORT=6379
# Access at: localhost:6379 (inside Docker network)

# ─────────────────────────────────────────────────────────────────────────
# 3. DATABASE CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────

# PostgreSQL Settings
POSTGRES_USER=postgres
# ↑ The admin username for database
#   Default is 'postgres', you can change it

POSTGRES_PASSWORD=MySecurePassword2025!@#
# ↑ CRITICAL: Set a STRONG password here
#   Requirements:
#   - At least 16 characters
#   - Mix of uppercase, lowercase, numbers, symbols
#   - DO NOT use 'password', '123456', or similar
#   Example good passwords:
#   - K9#mPq2$vL8@nR5w
#   - Trading@2025$Secure
#   - APM_nvme_2025!Strong

POSTGRES_DB=apm_stocks_production
# ↑ The name of your database
#   This is where all tables will be created

# Complete Database Connection String
DATABASE_URL=postgresql://postgres:MySecurePassword2025!@#@db:5432/apm_stocks_production
# ↑ Format: postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
#   IMPORTANT: Inside Docker, host is 'db' not '1000.93.172.21'
#   Docker containers talk to each other using service names

# Legacy format (for older backend code)
DB_HOST=db
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=MySecurePassword2025!@#
DB_DATABASE=apm_stocks_production

# ─────────────────────────────────────────────────────────────────────────
# 4. REDIS CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────

REDIS_URL=redis://redis:6379
# ↑ Inside Docker, Redis is accessible at 'redis:6379'

REDIS_PASSWORD=
# ↑ Optional: Leave empty for no password
#   For production, consider setting:
#   REDIS_PASSWORD=AnotherSecurePassword123

# ─────────────────────────────────────────────────────────────────────────
# 5. FYERS API CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────
# You get these from Fyers Developer Portal: https://myapi.fyers.in/

FYERS_CLIENT_ID=XXXXXXXXXXXXX-100
# ↑ Your Fyers App ID
#   Format: Usually ends with '-100'
#   Example: ABCD1234XY-100
#   Where to get it:
#   1. Go to https://myapi.fyers.in/
#   2. Login with your Fyers credentials
#   3. Create an App
#   4. Copy the 'App ID'

FYERS_SECRET_ID=XXXXXXXXXXXXXXXX
# ↑ Your Fyers App Secret
#   Format: Usually 16-20 characters
#   Example: A1B2C3D4E5F6G7H8
#   Where to get it:
#   1. Same Fyers Developer Portal
#   2. It's shown when you create the app
#   3. NEVER share this publicly!
#   4. If leaked, regenerate it immediately

FYERS_REDIRECT_URI=http://1000.93.172.21:3000/auth/callback
# ↑ CRITICAL: Must match EXACTLY what you set in Fyers portal
#   This is where Fyers redirects after login
#   Format: http://YOUR_SERVER_IP:FRONTEND_PORT/auth/callback
#   Steps to configure:
#   1. Go to Fyers Developer Portal
#   2. Edit your App
#   3. Set 'Redirect URL' to: http://1000.93.172.21:3000/auth/callback
#   4. Save
#   MUST use the same IP as your server!

FYERS_ACCESS_TOKEN=
# ↑ Leave empty initially
#   This is generated when user logs in
#   Format: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
#   The system will populate this automatically after first login
#   If you already have a token, paste it here

# ─────────────────────────────────────────────────────────────────────────
# 6. FRONTEND CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────

# Public API URL - Used by browser
NEXT_PUBLIC_API_URL=http://1000.93.172.21:5002
# ↑ This is what the user's browser uses to call backend
#   Format: http://YOUR_SERVER_IP:BACKEND_PORT
#   MUST be the external IP address (1000.93.172.21)
#   NOT 'localhost' or '127.0.0.1' - those won't work from other devices

# Internal Backend URL - Used server-side
BACKEND_URL=http://backend:5002
# ↑ Inside Docker, frontend container talks to backend using 'backend'
#   This is for Server Side Rendering (SSR) calls

# Python Services URLs
FYERS_SERVICE_5001_URL=http://1000.93.172.21:8001
FYERS_SERVICE_5010_URL=http://1000.93.172.21:8010
# ↑ External URLs for browser to connect to Python services

# ─────────────────────────────────────────────────────────────────────────
# 7. ENVIRONMENT & PERFORMANCE SETTINGS
# ─────────────────────────────────────────────────────────────────────────

NODE_ENV=production
# ↑ Options: 'development' or 'production'
#   Production mode:
#   - Optimized performance
#   - Minified code
#   - No debugging info
#   Development mode:
#   - Easier debugging
#   - More verbose errors
#   - Hot reload

PYTHONUNBUFFERED=1
# ↑ Makes Python output appear immediately in logs
#   Keep this as 1

PYTHONDONTWRITEBYTECODE=1
# ↑ Prevents Python from creating .pyc files
#   Keep this as 1

TZ=Asia/Kolkata
# ↑ Timezone for the server
#   All timestamps will use Indian Standard Time
#   Options: Asia/Kolkata, America/New_York, Europe/London, etc.

# Performance tuning
MAX_CONNECTIONS=100
# ↑ Maximum simultaneous database connections

REDIS_MAX_MEMORY=512mb
# ↑ Maximum RAM Redis can use
#   Adjust based on your server's available RAM
#   Options: 256mb, 512mb, 1gb, 2gb

WORKER_THREADS=4
# ↑ Number of worker threads for processing
#   Set to number of CPU cores for best performance

# ─────────────────────────────────────────────────────────────────────────
# 8. LOGGING CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────

LOG_LEVEL=info
# ↑ How detailed the logs should be
#   Options (from least to most detailed):
#   - error   : Only show errors
#   - warn    : Errors + warnings
#   - info    : Errors + warnings + general info
#   - debug   : Everything including debugging info
#   - verbose : Maximum detail

LOG_DIR=/app/logs
# ↑ Where to save log files inside container

# ─────────────────────────────────────────────────────────────────────────
# 9. SECURITY SETTINGS (Optional but Recommended)
# ─────────────────────────────────────────────────────────────────────────

# JWT Secret (for session tokens)
JWT_SECRET=your-super-secret-jwt-key-change-this
# ↑ Used to encrypt user session tokens
#   Generate a random string: openssl rand -base64 32

# API Rate Limiting
RATE_LIMIT_MAX=100
# ↑ Maximum requests per IP per minute

RATE_LIMIT_WINDOW=60000
# ↑ Time window in milliseconds (60000 = 1 minute)

# CORS Configuration
CORS_ORIGIN=*
# ↑ Which domains can access the API
#   * = Allow all (for development)
#   For production, set to: http://1000.93.172.21:3000

# ═══════════════════════════════════════════════════════════════════════════
# END OF CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

# IMPORTANT REMINDERS:
# 1. Replace ALL placeholder values (XXXXXXXXXXXXX) with real values
# 2. Use STRONG passwords for POSTGRES_PASSWORD
# 3. Keep FYERS_SECRET_ID confidential
# 4. Update FYERS_REDIRECT_URI in both this file AND Fyers portal
# 5. Ensure all IPs are set to 1000.93.172.21 (not localhost)
# 6. Save this file as .env in your instance directory
# 7. Never commit this file to Git (it's in .gitignore)
```

### 📝 Environment Variable Checklist

Before starting the system, verify:

- [ ] `POSTGRES_PASSWORD` - Set to a strong password
- [ ] `FYERS_CLIENT_ID` - Copied from Fyers portal
- [ ] `FYERS_SECRET_ID` - Copied from Fyers portal
- [ ] `FYERS_REDIRECT_URI` - Matches setting in Fyers portal AND uses correct IP
- [ ] `NEXT_PUBLIC_API_URL` - Uses server IP 1000.93.172.21
- [ ] All port numbers don't conflict with other services
- [ ] `NODE_ENV` - Set to 'production' for production server
- [ ] `TZ` - Set to your timezone

---

## 6. SERVER DEPLOYMENT CHECKLIST

### ✅ Pre-Deployment Steps

#### Step 1: Server Prerequisites
```bash
# 1. Connect to your server
ssh user@1000.93.172.21

# 2. Verify Docker is installed
docker --version
# Should show: Docker version 20.10.x or higher

docker-compose --version
# Should show: docker-compose version 1.29.x or higher

# 3. If not installed, install Docker
# For Ubuntu/Debian:
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# For other systems, visit: https://docs.docker.com/engine/install/

# 4. Add your user to docker group (to run without sudo)
sudo usermod -aG docker $USER
# Then logout and login again

# 5. Verify Git is installed
git --version
```

#### Step 2: Clone Repository
```bash
# 1. Navigate to where you want the project
cd /home/user/projects  # Or your preferred location

# 2. Clone the repository
git clone https://github.com/your-username/APM-TOP-K-STOCKS.git

# 3. Enter project directory
cd APM-TOP-K-STOCKS

# 4. Verify all files are there
ls -la
# You should see: apps/, docker-compose.yml, Dockerfile.*, etc.
```

#### Step 3: Configure Environment
```bash
# 1. Copy the environment template
cp multi-instances/.env.template multi-instances/instance1/.env

# 2. Edit the .env file
nano multi-instances/instance1/.env
# OR
vi multi-instances/instance1/.env

# 3. Update these CRITICAL values:
# - POSTGRES_PASSWORD (choose a strong password)
# - FYERS_CLIENT_ID (from Fyers portal)
# - FYERS_SECRET_ID (from Fyers portal)
# - FYERS_REDIRECT_URI (must be http://1000.93.172.21:3000/auth/callback)
# - NEXT_PUBLIC_API_URL (must be http://1000.93.172.21:5002)

# 4. Save and exit
# For nano: Ctrl+X, then Y, then Enter
# For vi: Press Esc, then :wq, then Enter
```

#### Step 4: Configure Frontend
```bash
# Edit next.config.ts
nano apps/frontend/next.config.ts

# Find this line:
# const SERVER_IP = process.env.SERVER_IP || '100.93.172.21';

# Change to:
# const SERVER_IP = process.env.SERVER_IP || '1000.93.172.21';

# Save and exit
```

#### Step 5: Verify Fyers Portal Settings
```
1. Open browser
2. Go to: https://myapi.fyers.in/
3. Login with Fyers credentials
4. Select your app (or create new one)
5. Verify/Set these settings:
   
   App Type: Web App
   Redirect URL: http://1000.93.172.21:3000/auth/callback
   
6. Note down:
   - App ID (example: ABC123XY-100)
   - App Secret (example: ABC123XYZ789)
   
7. Put these in your .env file
```

### 🚀 Deployment Steps

#### Method 1: Multi-Instance (Recommended)
```bash
# 1. Navigate to multi-instances directory
cd multi-instances/instance1

# 2. Copy docker-compose file
cp ../../docker-compose.standalone.yml ./docker-compose.yml

# 3. Build and start all services
docker-compose up -d --build

# 4. Verify all containers are running
docker-compose ps

# Expected output:
# NAME                      STATUS
# production-instance-frontend   Up 30 seconds
# production-instance-backend    Up 30 seconds
# production-instance-fyers-5001 Up 30 seconds
# production-instance-fyers-5010 Up 30 seconds
# production-instance-db         Up 30 seconds
# production-instance-redis      Up 30 seconds

# 5. Check logs for any errors
docker-compose logs -f

# Press Ctrl+C to stop viewing logs
```

#### Method 2: Simple Docker Compose
```bash
# 1. From project root
cd /path/to/APM-TOP-K-STOCKS

# 2. Start services
docker-compose up -d --build

# 3. Check status
docker-compose ps

# 4. View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f fyers-5001
```

### 🧪 Verification Steps

#### Test 1: Check Service Health
```bash
# Frontend (should show HTML)
curl http://1000.93.172.21:3000

# Backend API health endpoint
curl http://1000.93.172.21:5002/health
# Expected: {"status":"ok","timestamp":"..."}

# Python Service 5001
curl http://1000.93.172.21:8001/health
# Expected: {"status":"running","service":"fyers-5001"}

# Python Service 5010
curl http://1000.93.172.21:8010/health
# Expected: {"status":"running","service":"fyers-5010"}
```

#### Test 2: Check Database Connection
```bash
# Connect to PostgreSQL container
docker exec -it production-instance-db psql -U postgres -d apm_stocks_production

# Inside PostgreSQL prompt:
# List all tables
\dt

# You should see:
# companies, stock_data, daily_watchlist, etc.

# Exit
\q
```

#### Test 3: Check Redis
```bash
# Connect to Redis container
docker exec -it production-instance-redis redis-cli

# Inside Redis prompt:
# Test connection
PING
# Should respond: PONG

# Check if any data is stored
KEYS *

# Exit
exit
```

#### Test 4: Browser Access
```
1. Open browser
2. Navigate to: http://1000.93.172.21:3000
3. You should see the APM TOP-K STOCKS dashboard
4. Click "Login with Fyers"
5. Should redirect to Fyers login page
6. After login, should redirect back to dashboard
```

---

## 7. CONFIGURATION FILES TO MODIFY

### 📁 Complete List of Files to Change

#### File 1: `apps/frontend/next.config.ts`
**Location:** `/apps/frontend/next.config.ts`  
**What to change:** Server IP address  
**Line:** 2

```typescript
// BEFORE:
const SERVER_IP = process.env.SERVER_IP || '100.93.172.21';

// AFTER:
const SERVER_IP = process.env.SERVER_IP || '1000.93.172.21';
```

#### File 2: `multi-instances/instance1/.env`
**Location:** `/multi-instances/instance1/.env`  
**What to change:** All environment variables  
**Create from template:** Copy from `.env.template`

```bash
# Copy template
cp multi-instances/.env.template multi-instances/instance1/.env

# Edit file
nano multi-instances/instance1/.env
```

**Critical changes:**
```env
# Change these lines:
FYERS_CLIENT_ID=XXXXXXXXXXXXX-100           # ← Your Fyers App ID
FYERS_SECRET_ID=XXXXXXXXXXXXXXXX            # ← Your Fyers Secret
FYERS_REDIRECT_URI=http://1000.93.172.21:3000/auth/callback  # ← Server IP
NEXT_PUBLIC_API_URL=http://1000.93.172.21:5002               # ← Server IP
FYERS_SERVICE_5001_URL=http://1000.93.172.21:8001            # ← Server IP
FYERS_SERVICE_5010_URL=http://1000.93.172.21:8010            # ← Server IP
POSTGRES_PASSWORD=MySecurePassword2025!@#                     # ← Strong password
```

#### File 3: `apps/backend/.env` (if exists)
**Location:** `/apps/backend/.env`  
**Note:** Usually created by copying multi-instances/.env

Same changes as File 2 above.

#### File 4: `apps/frontend/.env` (if exists)
**Location:** `/apps/frontend/.env`

```env
NEXT_PUBLIC_API_URL=http://1000.93.172.21:5002
BACKEND_URL=http://backend:5002
```

#### File 5: `docker-compose.yml` (if using root level)
**Location:** `/docker-compose.yml`  
**What to check:** Environment variable references

Ensure it uses variables from .env file:
```yaml
environment:
  - NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT}
```

Change to:
```yaml
environment:
  - NEXT_PUBLIC_API_URL=http://1000.93.172.21:${BACKEND_PORT}
```

### 🔍 Files You DON'T Need to Change

These files are already configured correctly:
- ✅ `Dockerfile.backend`
- ✅ `Dockerfile.frontend`
- ✅ `Dockerfile.python-5001`
- ✅ `Dockerfile.python-5010`
- ✅ `apps/backend/src/database/database.module.ts`
- ✅ `apps/backend/src/config/fyers.config.ts`
- ✅ `apps/backend/fyers_service_5001.py`
- ✅ `apps/backend/fyers_service_5010.py`

These files read from environment variables, so as long as your `.env` is correct, they'll work automatically.

---

## 8. PORT MAPPING REFERENCE

### 🔌 Complete Port Guide

| Service | Internal Port | External Port | Access URL | Purpose |
|---------|--------------|---------------|------------|---------|
| **Frontend** | 3000 | 3000 | http://1000.93.172.21:3000 | User interface |
| **Backend API** | 5002 | 5002 | http://1000.93.172.21:5002 | Main API server |
| **Fyers Service 5001** | 5001 | 8001 | http://1000.93.172.21:8001 | Live data feed |
| **Fyers Service 5010** | 5010 | 8010 | http://1000.93.172.21:8010 | Data aggregator |
| **PostgreSQL** | 5432 | 5432 | localhost:5432 (internal) | Database |
| **Redis** | 6379 | 6379 | localhost:6379 (internal) | Cache |

### 📡 Port Explanation

**Internal Port:** The port the service listens on INSIDE its Docker container  
**External Port:** The port exposed to the outside world  
**Why they can be different:** Allows flexibility and avoiding conflicts

**Example:**
```yaml
ports:
  - "8001:5001"
  #  ^^^^  ^^^^
  #   |     └─ Internal: Service listens on 5001 inside container
  #   └─ External: World accesses it on 8001
```

### 🔒 Port Security

**Exposed Ports (accessible from outside):**
- 3000 - Frontend (needed for users to access)
- 5002 - Backend API (needed for frontend to communicate)
- 8001 - Python Service 5001 (needed for WebSocket connections)
- 8010 - Python Service 5010 (needed for data requests)

**Internal Only Ports (not accessible from outside):**
- 5432 - PostgreSQL (security: don't expose database to internet)
- 6379 - Redis (security: don't expose cache to internet)

**To expose database externally (not recommended):**
```yaml
# In docker-compose.yml, change:
ports:
  - "5432:5432"  # This exposes it to the world

# Better: Use SSH tunnel
ssh -L 5432:localhost:5432 user@1000.93.172.21
```

### 🌐 Firewall Configuration

If you have a firewall on server 1000.93.172.21, open these ports:

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 3000/tcp   # Frontend
sudo ufw allow 5002/tcp   # Backend
sudo ufw allow 8001/tcp   # Python 5001
sudo ufw allow 8010/tcp   # Python 5010

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=5002/tcp
sudo firewall-cmd --permanent --add-port=8001/tcp
sudo firewall-cmd --permanent --add-port=8010/tcp
sudo firewall-cmd --reload

# Verify
sudo ufw status  # For Ubuntu
sudo firewall-cmd --list-ports  # For CentOS
```

---

## 9. TROUBLESHOOTING GUIDE

### ❌ Common Issues & Solutions

#### Issue 1: Cannot Access http://1000.93.172.21:3000

**Symptoms:**
- Browser shows "This site can't be reached"
- Connection timeout
- ERR_CONNECTION_REFUSED

**Solutions:**
```bash
# 1. Check if frontend container is running
docker ps | grep frontend

# 2. Check frontend logs
docker logs production-instance-frontend

# 3. Verify port is listening
netstat -tuln | grep 3000
# OR
ss -tuln | grep 3000

# 4. Check if Docker container port is mapped
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep frontend

# 5. Restart frontend
docker restart production-instance-frontend

# 6. Check firewall
sudo ufw status | grep 3000

# 7. Test from server itself
curl http://localhost:3000
```

#### Issue 2: Backend API Not Responding

**Symptoms:**
- Frontend loads but shows no data
- Network errors in browser console
- 500/502/503 errors

**Solutions:**
```bash
# 1. Check backend logs
docker logs production-instance-backend -f

# 2. Check if backend is healthy
curl http://localhost:5002/health

# 3. Verify backend can connect to database
docker exec -it production-instance-backend sh
# Inside container:
env | grep DATABASE_URL
# Should show correct connection string

# 4. Check database is running
docker ps | grep postgres

# 5. Test database connection
docker exec -it production-instance-db psql -U postgres -d apm_stocks_production

# 6. Restart backend
docker restart production-instance-backend

# 7. Rebuild if needed
docker-compose up -d --build backend
```

#### Issue 3: Fyers Login Redirects to Wrong URL

**Symptoms:**
- After login, redirects to localhost instead of server IP
- "Redirect URI mismatch" error
- Can't complete login flow

**Solutions:**
```bash
# 1. Verify FYERS_REDIRECT_URI in .env
cat multi-instances/instance1/.env | grep FYERS_REDIRECT_URI
# Should be: http://1000.93.172.21:3000/auth/callback

# 2. Check Fyers portal settings
# Go to https://myapi.fyers.in/
# Verify Redirect URL matches EXACTLY

# 3. Verify NEXT_PUBLIC_API_URL
cat multi-instances/instance1/.env | grep NEXT_PUBLIC_API_URL
# Should be: http://1000.93.172.21:5002

# 4. Check next.config.ts
cat apps/frontend/next.config.ts | grep SERVER_IP
# Should be: 1000.93.172.21

# 5. Rebuild frontend with correct config
docker-compose up -d --build frontend

# 6. Clear browser cache and try again
```

#### Issue 4: Database Connection Failed

**Symptoms:**
- Backend logs show "Connection refused" or "Authentication failed"
- Error: "role 'postgres' does not exist"
- Error: "database 'xxx' does not exist"

**Solutions:**
```bash
# 1. Check database container logs
docker logs production-instance-db

# 2. Verify DATABASE_URL is correct
cat multi-instances/instance1/.env | grep DATABASE_URL
# Format should be: postgresql://USER:PASSWORD@db:PORT/DATABASE

# 3. Check if password matches
# Compare POSTGRES_PASSWORD in .env with DATABASE_URL

# 4. Verify database exists
docker exec -it production-instance-db psql -U postgres
# Inside psql:
\l  # List databases
# Look for your database name

# If database doesn't exist:
CREATE DATABASE apm_stocks_production;
\q

# 5. Check if user has permissions
docker exec -it production-instance-db psql -U postgres -d apm_stocks_production
# Inside psql:
GRANT ALL PRIVILEGES ON DATABASE apm_stocks_production TO postgres;
\q

# 6. Restart backend to reconnect
docker restart production-instance-backend
```

#### Issue 5: Python Services Not Receiving Data

**Symptoms:**
- No real-time updates
- Charts not updating
- WebSocket connection failed

**Solutions:**
```bash
# 1. Check Python service logs
docker logs production-instance-fyers-5001 -f
docker logs production-instance-fyers-5010 -f

# 2. Verify Fyers credentials
cat multi-instances/instance1/.env | grep FYERS_CLIENT_ID
cat multi-instances/instance1/.env | grep FYERS_SECRET_ID
cat multi-instances/instance1/.env | grep FYERS_ACCESS_TOKEN

# 3. Check if access token is expired
# Tokens typically expire after 24 hours
# Solution: Re-login through frontend

# 4. Test Fyers API connectivity
docker exec -it production-instance-fyers-5001 sh
# Inside container:
ping api.fyers.in
# Should get responses

# 5. Verify Python services can reach Fyers
curl https://api.fyers.in/api/v2/
# Should return API information

# 6. Restart Python services
docker restart production-instance-fyers-5001
docker restart production-instance-fyers-5010
```

#### Issue 6: Out of Memory / Performance Issues

**Symptoms:**
- Containers keep restarting
- Slow response times
- "Cannot allocate memory" errors

**Solutions:**
```bash
# 1. Check available memory
free -h

# 2. Check Docker resource usage
docker stats

# 3. Check individual container memory
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}"

# 4. Reduce Redis memory limit
# Edit .env:
REDIS_MAX_MEMORY=256mb  # Reduce from 512mb

# 5. Limit container resources in docker-compose.yml
# Add to each service:
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'

# 6. Clear unused Docker resources
docker system prune -a
docker volume prune

# 7. Restart system with lower resource usage
docker-compose down
docker-compose up -d
```

#### Issue 7: "Permission Denied" Errors

**Symptoms:**
- Cannot write to log files
- Cannot access data directory
- Volume mount errors

**Solutions:**
```bash
# 1. Check file permissions
ls -la multi-instances/instance1/data
ls -la multi-instances/instance1/logs

# 2. Fix permissions
sudo chown -R $USER:$USER multi-instances/instance1/data
sudo chown -R $USER:$USER multi-instances/instance1/logs
sudo chmod -R 755 multi-instances/instance1/data

# 3. For Docker volumes
# List volumes
docker volume ls

# Inspect volume
docker volume inspect production-instance-postgres-data

# 4. If still issues, run as root (not recommended)
# Edit docker-compose.yml:
user: "0:0"  # Add this under service

# Better: Fix host permissions
sudo usermod -aG docker $USER
```

### 🔧 Diagnostic Commands

```bash
# Check all running containers
docker ps -a

# Check container resource usage
docker stats

# Check Docker networks
docker network ls
docker network inspect production-instance_apm-network

# Check Docker volumes
docker volume ls

# View complete container configuration
docker inspect production-instance-backend

# Check Docker logs for specific time
docker logs --since 30m production-instance-backend
docker logs --until 2h production-instance-frontend

# Follow logs from multiple containers
docker-compose logs -f backend frontend fyers-5001

# Check environment variables in container
docker exec -it production-instance-backend env

# Execute commands in running container
docker exec -it production-instance-backend sh

# Check open ports on server
sudo netstat -tuln | grep LISTEN
sudo ss -tuln | grep LISTEN

# Check if specific port is accessible
nc -zv 1000.93.172.21 3000
telnet 1000.93.172.21 5002
```

### 📞 Getting Help

If you're still stuck:

1. **Collect Information:**
```bash
# Save all logs
docker-compose logs > debug-logs.txt

# Save system info
uname -a > system-info.txt
docker --version >> system-info.txt
docker-compose --version >> system-info.txt
free -h >> system-info.txt
df -h >> system-info.txt

# Save configuration (remove sensitive data!)
cat multi-instances/instance1/.env | sed 's/PASSWORD=.*/PASSWORD=<REDACTED>/' > config.txt
```

2. **Check Documentation:**
- Docker docs: https://docs.docker.com/
- Fyers API docs: https://myapi.fyers.in/docs/
- NestJS docs: https://docs.nestjs.com/

3. **Search for Similar Issues:**
- GitHub Issues
- Stack Overflow
- Docker Community Forums

---

## 🎓 APPENDIX: Key Concepts for Non-Developers

### What is Docker?
Think of Docker as a "container" or "box" that packages an application with everything it needs to run (code, libraries, settings). It's like a portable apartment - you can move it anywhere and it works the same way.

### What is an API?
API (Application Programming Interface) is like a waiter in a restaurant:
- You (frontend) tell the waiter (API) what you want
- The waiter goes to the kitchen (backend/database)
- The waiter brings back your food (data)

### What is a Database?
A database is like a digital filing cabinet with organized drawers:
- Each drawer is a "table"
- Each folder in a drawer is a "row"
- Each paper in a folder is a "field"

### What is a WebSocket?
A WebSocket is like a phone call that stays connected:
- HTTP is like sending letters (request → response, then disconnect)
- WebSocket is like a phone call (stay connected, both sides can talk anytime)
- Used for real-time data (stock prices updating every second)

### What is Environment Variable?
Think of it as a settings file that tells your application:
- Where to find things (database address)
- Passwords to use (database password)
- How to behave (development mode vs production mode)

### What is Port?
A port is like an apartment number in a building:
- The building is your server (1000.93.172.21)
- Each apartment (port) has a different service
- Apartment 3000 = Frontend
- Apartment 5002 = Backend
- Apartment 5432 = Database

### What is Redis?
Redis is like a super-fast sticky note board:
- Instead of always going to the filing cabinet (database)
- Check the sticky note first (Redis)
- If the note has what you need, you get it instantly
- Notes eventually expire and get removed

---

## ✅ FINAL CHECKLIST

Before going live, ensure:

### Configuration
- [ ] All `.env` files have correct values
- [ ] Fyers credentials are valid and tested
- [ ] Database password is strong and documented
- [ ] All IP addresses changed from `100.93.172.21` to `1000.93.172.21`
- [ ] `next.config.ts` has correct server IP
- [ ] Fyers portal redirect URI matches `.env` setting

### Server
- [ ] Docker and Docker Compose installed
- [ ] All required ports are open in firewall
- [ ] Sufficient disk space (at least 20GB free)
- [ ] Sufficient RAM (at least 4GB, 8GB recommended)
- [ ] Server is accessible from internet at `1000.93.172.21`

### Services
- [ ] All 6 containers running (frontend, backend, fyers-5001, fyers-5010, db, redis)
- [ ] Frontend accessible at http://1000.93.172.21:3000
- [ ] Backend health check passes at http://1000.93.172.21:5002/health
- [ ] Python services responding
- [ ] Database contains required tables
- [ ] Redis is responding to PING

### Testing
- [ ] Can access dashboard in browser
- [ ] Fyers login flow works completely
- [ ] Real-time data is updating
- [ ] Charts are rendering
- [ ] No errors in browser console
- [ ] No errors in Docker logs

### Documentation
- [ ] Database password stored securely
- [ ] Fyers credentials documented
- [ ] Backup strategy in place
- [ ] Know how to restart services
- [ ] Know how to check logs

---

## 🎉 SUCCESS!

If all checklist items are complete, your APM TOP-K STOCKS system is now running perfectly on server `1000.93.172.21`!

**Access your system:**
- 🌐 Dashboard: http://1000.93.172.21:3000
- 🔧 Backend API: http://1000.93.172.21:5002
- 📊 Live Data Feed: http://1000.93.172.21:8001
- 📈 Data Aggregator: http://1000.93.172.21:8010

**Next Steps:**
1. Set up automated backups for PostgreSQL
2. Configure monitoring (Prometheus + Grafana)
3. Set up SSL/HTTPS with Let's Encrypt
4. Create regular maintenance schedule
5. Document your specific trading strategies

---

**Document Version:** 1.0  
**Created:** December 22, 2025  
**Server:** 1000.93.172.21 (NVME Server)  
**Maintained By:** APM Development Team
