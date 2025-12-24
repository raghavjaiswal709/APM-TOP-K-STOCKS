# ⚡ QUICK DEPLOYMENT GUIDE - Server 1000.93.172.21

## 🎯 WHAT TO CHANGE - COPY & PASTE READY

### 1️⃣ File: `apps/frontend/next.config.ts` (Line 2)

**FIND:**
```typescript
const SERVER_IP = process.env.SERVER_IP || '100.93.172.21';
```

**REPLACE WITH:**
```typescript
const SERVER_IP = process.env.SERVER_IP || '1000.93.172.21';
```

---

### 2️⃣ File: `multi-instances/instance1/.env`

**CREATE THIS FILE** (copy-paste entire content):

```env
# ═══════════════════════════════════════════════════════════════════════════
# APM TOP-K STOCKS - Server 1000.93.172.21 Configuration
# ═══════════════════════════════════════════════════════════════════════════

# INSTANCE IDENTIFICATION
INSTANCE_ID=production-instance
INSTANCE_NAME="APM Production Server"
INSTANCE_REGION=nvme-server

# PORT CONFIGURATION
FRONTEND_PORT=3000
BACKEND_PORT=5002
FYERS_5001_PORT=8001
FYERS_5010_PORT=8010
POSTGRES_PORT=5432
REDIS_PORT=6379

# DATABASE CONFIGURATION
POSTGRES_USER=postgres
POSTGRES_PASSWORD=APM_2025_SecurePassword!@#
POSTGRES_DB=apm_stocks_production
DATABASE_URL=postgresql://postgres:APM_2025_SecurePassword!@#@db:5432/apm_stocks_production

# Legacy format
DB_HOST=db
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=APM_2025_SecurePassword!@#
DB_DATABASE=apm_stocks_production

# REDIS CONFIGURATION
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=

# FYERS API CONFIGURATION (⚠️ REPLACE THESE!)
FYERS_CLIENT_ID=YOUR_FYERS_APP_ID_HERE
FYERS_SECRET_ID=YOUR_FYERS_SECRET_HERE
FYERS_REDIRECT_URI=http://1000.93.172.21:3000/auth/callback
FYERS_ACCESS_TOKEN=

# FRONTEND CONFIGURATION
NEXT_PUBLIC_API_URL=http://1000.93.172.21:5002
BACKEND_URL=http://backend:5002
FYERS_SERVICE_5001_URL=http://1000.93.172.21:8001
FYERS_SERVICE_5010_URL=http://1000.93.172.21:8010

# ENVIRONMENT SETTINGS
NODE_ENV=production
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1
TZ=Asia/Kolkata

# PERFORMANCE
MAX_CONNECTIONS=100
REDIS_MAX_MEMORY=512mb
WORKER_THREADS=4

# LOGGING
LOG_LEVEL=info
LOG_DIR=/app/logs

# SECURITY
JWT_SECRET=change-this-to-random-string-use-openssl-rand-base64-32
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
CORS_ORIGIN=*
```

**⚠️ IMPORTANT - MUST CHANGE THESE:**

1. **POSTGRES_PASSWORD** - Change to your own strong password
2. **DATABASE_URL** - Update with your new password
3. **DB_PASSWORD** - Update with your new password  
4. **FYERS_CLIENT_ID** - Get from https://myapi.fyers.in/
5. **FYERS_SECRET_ID** - Get from https://myapi.fyers.in/
6. **JWT_SECRET** - Generate with: `openssl rand -base64 32`

---

### 3️⃣ Fyers Developer Portal Settings

**Go to:** https://myapi.fyers.in/

**Login** → **Select/Create App** → **Set:**

- **Redirect URL:** `http://1000.93.172.21:3000/auth/callback`
- **App Type:** Web App

**Copy these to your .env file:**
- App ID → `FYERS_CLIENT_ID`
- App Secret → `FYERS_SECRET_ID`

---

## 🚀 DEPLOYMENT COMMANDS

### Step 1: SSH to Server
```bash
ssh user@1000.93.172.21
```

### Step 2: Clone Repository
```bash
cd ~
git clone https://github.com/raghavjaiswal709/APM-TOP-K-STOCKS.git
cd APM-TOP-K-STOCKS
```

### Step 3: Update Configuration
```bash
# Update frontend config
nano apps/frontend/next.config.ts
# Change: '100.93.172.21' → '1000.93.172.21'
# Save: Ctrl+X, Y, Enter

# Create .env file
mkdir -p multi-instances/instance1
nano multi-instances/instance1/.env
# Paste the .env content from above
# Update: POSTGRES_PASSWORD, FYERS_CLIENT_ID, FYERS_SECRET_ID, JWT_SECRET
# Save: Ctrl+X, Y, Enter
```

### Step 4: Deploy
```bash
# Navigate to instance directory
cd multi-instances/instance1

# Copy docker-compose file
cp ../../docker-compose.standalone.yml ./docker-compose.yml

# Start all services
docker-compose up -d --build

# This will:
# - Build all Docker images
# - Create containers
# - Start all services
# - Takes 5-10 minutes first time
```

### Step 5: Verify
```bash
# Check all containers are running
docker-compose ps

# Should show 6 containers as "Up":
# - production-instance-frontend
# - production-instance-backend
# - production-instance-fyers-5001
# - production-instance-fyers-5010
# - production-instance-db
# - production-instance-redis

# Check logs
docker-compose logs -f

# Press Ctrl+C to stop viewing logs
```

### Step 6: Test in Browser
```
Open browser:
http://1000.93.172.21:3000

You should see the APM Dashboard!
```

---

## 🔥 FIREWALL CONFIGURATION

### Ubuntu/Debian (ufw)
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 5002/tcp
sudo ufw allow 8001/tcp
sudo ufw allow 8010/tcp
sudo ufw status
```

### CentOS/RHEL (firewalld)
```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=5002/tcp
sudo firewall-cmd --permanent --add-port=8001/tcp
sudo firewall-cmd --permanent --add-port=8010/tcp
sudo firewall-cmd --reload
```

---

## ✅ VERIFICATION CHECKLIST

### Test Each Service:

```bash
# Frontend
curl http://1000.93.172.21:3000
# Should return HTML

# Backend API
curl http://1000.93.172.21:5002/health
# Should return: {"status":"ok"}

# Python Service 5001
curl http://1000.93.172.21:8001/health
# Should return: {"status":"running"}

# Python Service 5010
curl http://1000.93.172.21:8010/health
# Should return: {"status":"running"}

# Database
docker exec -it production-instance-db psql -U postgres -d apm_stocks_production -c "SELECT 1;"
# Should return: 1

# Redis
docker exec -it production-instance-redis redis-cli PING
# Should return: PONG
```

---

## 🛠️ COMMON COMMANDS

### View Logs
```bash
cd multi-instances/instance1

# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f fyers-5001
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
```

### Stop Services
```bash
# Stop all (keeps data)
docker-compose down

# Stop and remove everything (⚠️ DELETES DATA!)
docker-compose down -v
```

### Update Code
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build
```

---

## ❌ TROUBLESHOOTING

### Cannot access http://1000.93.172.21:3000

```bash
# Check if container is running
docker ps | grep frontend

# Check logs
docker logs production-instance-frontend

# Restart
docker restart production-instance-frontend

# Check firewall
sudo ufw status | grep 3000
```

### No data showing / API errors

```bash
# Check backend logs
docker logs production-instance-backend

# Check database connection
docker exec -it production-instance-db psql -U postgres -d apm_stocks_production

# Verify .env file
cat .env | grep DATABASE_URL

# Restart backend
docker restart production-instance-backend
```

### Fyers login not working

```bash
# Check redirect URI
cat .env | grep FYERS_REDIRECT_URI
# Must be: http://1000.93.172.21:3000/auth/callback

# Verify in Fyers portal:
# https://myapi.fyers.in/
# Redirect URL must match EXACTLY

# Check credentials
cat .env | grep FYERS_CLIENT_ID
cat .env | grep FYERS_SECRET_ID

# Rebuild frontend
docker-compose up -d --build frontend
```

---

## 📊 MONITORING

### Resource Usage
```bash
# All containers
docker stats

# Disk usage
docker system df

# Individual service
docker stats production-instance-backend
```

### Database Size
```bash
docker exec -it production-instance-db psql -U postgres -d apm_stocks_production -c "\l+"
```

### Clean Up Old Data
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes (⚠️ be careful!)
docker volume prune

# Remove everything unused
docker system prune -a --volumes
```

---

## 🎯 FINAL CHECKLIST

Before considering deployment complete:

- [ ] Changed `next.config.ts` from `100.93.172.21` to `1000.93.172.21`
- [ ] Created `.env` file in `multi-instances/instance1/`
- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Added real `FYERS_CLIENT_ID` from Fyers portal
- [ ] Added real `FYERS_SECRET_ID` from Fyers portal
- [ ] Set `FYERS_REDIRECT_URI` to `http://1000.93.172.21:3000/auth/callback`
- [ ] Updated Fyers portal with same redirect URI
- [ ] Generated `JWT_SECRET` with `openssl rand -base64 32`
- [ ] Opened firewall ports (3000, 5002, 8001, 8010)
- [ ] All 6 Docker containers running
- [ ] Frontend accessible at http://1000.93.172.21:3000
- [ ] Backend health check passes
- [ ] Can complete Fyers login flow
- [ ] Real-time data is updating

---

## 📱 QUICK ACCESS URLS

- **Dashboard:** http://1000.93.172.21:3000
- **Backend API:** http://1000.93.172.21:5002
- **API Health:** http://1000.93.172.21:5002/health
- **Live Feed:** http://1000.93.172.21:8001
- **Aggregator:** http://1000.93.172.21:8010
- **Fyers Portal:** https://myapi.fyers.in/

---

**Ready to deploy?** Follow the steps above in order, and you'll be live in 15 minutes! 🚀
