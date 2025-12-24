# Multi-Instance Implementation Guide

**Date:** December 22, 2025  
**Version:** 1.0  
**Status:** Production Ready

---

## 🚀 QUICK START (5 minutes)

```bash
# 1. Make scripts executable
chmod +x setup-multi-instances.sh
chmod +x multi-instance-manager.sh

# 2. Run setup (creates 3 instances by default)
./setup-multi-instances.sh 3

# 3. Update Fyers credentials in each .env file
nano multi-instances/instance1/.env
nano multi-instances/instance2/.env
nano multi-instances/instance3/.env

# 4. Start all instances
cd multi-instances
./start-all.sh

# 5. Check health
./health-check.sh
```

---

## 📋 WHAT YOU GET

### Files Created

```
project-root/
├── setup-multi-instances.sh          ← Run this to initialize
├── multi-instance-manager.sh         ← Master control script
├── docker-compose.standalone.yml     ← Template for each instance
├── MULTI_INSTANCE_SETUP.md          ← Complete documentation
├── MULTI_INSTANCE_GUIDE.md          ← This file
└── multi-instances/
    ├── instance1/
    │   ├── .env                     ← Configuration (customize!)
    │   ├── docker-compose.standalone.yml
    │   ├── data/                    ← Instance data files
    │   ├── logs/                    ← Instance logs
    │   ├── backups/                 ← Database backups
    │   └── config/
    ├── instance2/
    │   └── (same as instance1)
    ├── instance3/
    │   └── (same as instance1)
    ├── manager.sh                   ← Management commands
    ├── start-all.sh                 ← Quick start script
    ├── stop-all.sh                  ← Quick stop script
    ├── health-check.sh              ← Health monitoring
    ├── monitoring/                  ← Monitoring configs
    ├── logs/                        ← Central logs
    └── README.md                    ← Quick reference
```

---

## 🎯 STEP-BY-STEP IMPLEMENTATION

### Step 1: Prepare Your System

```bash
# Check Docker installation
docker --version
docker-compose --version

# Create workspace
cd /Users/raghav/Documents/GitHub/APM-TOP-K-STOCKS
pwd
```

### Step 2: Run Setup Script

```bash
# Make scripts executable
chmod +x setup-multi-instances.sh
chmod +x multi-instance-manager.sh

# Run setup for 3 instances
./setup-multi-instances.sh 3

# Or specify different number of instances
./setup-multi-instances.sh 5
```

**What this does:**
- Creates `multi-instances/` directory structure
- Generates 3 independent instance directories
- Creates `.env` files with unique port assignments
- Copies docker-compose templates
- Sets up management scripts

### Step 3: Configure Fyers Credentials

Each instance needs Fyers API credentials:

```bash
# Edit Instance 1
nano multi-instances/instance1/.env

# Find these lines and update:
# FYERS_CLIENT_ID=YOUR_FYERS_CLIENT_ID_HERE
# FYERS_SECRET_ID=YOUR_FYERS_SECRET_ID_HERE
# FYERS_ACCESS_TOKEN=YOUR_FYERS_ACCESS_TOKEN_HERE

# Repeat for instance2 and instance3
nano multi-instances/instance2/.env
nano multi-instances/instance3/.env
```

### Step 4: Start Instances

```bash
# Navigate to multi-instances directory
cd multi-instances

# Option A: Start all at once
./start-all.sh

# Option B: Start one instance at a time
./manager.sh start 1
./manager.sh start 2
./manager.sh start 3
```

### Step 5: Verify Health

```bash
cd multi-instances

# Check health
./health-check.sh

# View status
./manager.sh status
```

---

## 📊 PORT ALLOCATION SCHEME

### Automatic Port Assignment

```
Instance 1:
  Frontend:      3000
  Backend:       5002
  Fyers 5001:    8001
  Fyers 5010:    8010
  Database:      5432
  Redis:         6379

Instance 2:
  Frontend:      4000  (3000 + 1000)
  Backend:       5102  (5002 + 100)
  Fyers 5001:    8002  (8001 + 1)
  Fyers 5010:    8011  (8010 + 1)
  Database:      5433  (5432 + 1)
  Redis:         6380  (6379 + 1)

Instance 3:
  Frontend:      5000  (3000 + 2000)
  Backend:       5202  (5002 + 200)
  Fyers 5001:    8003  (8001 + 2)
  Fyers 5010:    8012  (8010 + 2)
  Database:      5434  (5432 + 2)
  Redis:         6381  (6379 + 2)
```

**Why different offsets?**
- Frontend: +1000 between instances (separates UI access)
- Backend: +100 between instances (API endpoints)
- Services: +1 between instances (tight packing for services)
- Database: +1 between instances (clear separation)
- Redis: +1 between instances

### Custom Port Assignment

To use different ports, edit `.env`:

```bash
# multi-instances/instance1/.env
FRONTEND_PORT=3000
BACKEND_PORT=5002
FYERS_5001_PORT=8001
FYERS_5010_PORT=8010
POSTGRES_PORT=5432
REDIS_PORT=6379
```

---

## 🎮 MANAGEMENT COMMANDS

### Basic Commands

```bash
# Start/Stop all
cd multi-instances
./start-all.sh           # Start all instances
./stop-all.sh            # Stop all instances

# Or use manager script
./manager.sh start-all
./manager.sh stop-all
./manager.sh restart-all
```

### Individual Instance Control

```bash
# Start specific instance
./manager.sh start 1
./manager.sh start 2

# Stop specific instance
./manager.sh stop 1

# Restart specific instance
./manager.sh restart 2

# Check status
./manager.sh status
./manager.sh status 1    # Specific instance
```

### Monitoring

```bash
# Health check all instances
./health-check.sh
./manager.sh health-check

# View resource usage
./manager.sh resources

# Generate report
./manager.sh report
```

### Logging

```bash
# View logs for specific instance
./manager.sh logs 1

# View logs for specific service
./manager.sh logs 1 backend
./manager.sh logs 2 frontend
./manager.sh logs 3 db

# Open shell in container
./manager.sh shell 1 backend
./manager.sh shell 2 frontend
```

### Database Operations

```bash
# Backup database
./manager.sh db-backup 1

# Restore from backup
./manager.sh db-restore 1 /path/to/backup.sql

# Open database shell
./manager.sh db-shell 1
```

---

## 🔧 ACCESSING INSTANCES

### Instance 1 (Default)
```
Frontend:      http://localhost:3000
Backend API:   http://localhost:5002
Database:      localhost:5432 (psql)
Redis:         localhost:6379 (redis-cli)
Fyers 5001:    http://localhost:8001
Fyers 5010:    http://localhost:8010
```

### Instance 2
```
Frontend:      http://localhost:4000
Backend API:   http://localhost:5102
Database:      localhost:5433 (psql)
Redis:         localhost:6380 (redis-cli)
Fyers 5001:    http://localhost:8002
Fyers 5010:    http://localhost:8011
```

### Instance 3
```
Frontend:      http://localhost:5000
Backend API:   http://localhost:5202
Database:      localhost:5434 (psql)
Redis:         localhost:6381 (redis-cli)
Fyers 5001:    http://localhost:8003
Fyers 5010:    http://localhost:8012
```

---

## 🗄️ DATA & STORAGE

### Volume Structure

Each instance has **completely isolated storage**:

```
Instance 1:
  Database:    instance1-postgres-data (separate DB)
  Redis:       instance1-redis-data
  Data files:  multi-instances/instance1/data/

Instance 2:
  Database:    instance2-postgres-data (separate DB)
  Redis:       instance2-redis-data
  Data files:  multi-instances/instance2/data/

Instance 3:
  Database:    instance3-postgres-data (separate DB)
  Redis:       instance3-redis-data
  Data files:  multi-instances/instance3/data/
```

### Database Isolation

Each instance has its own PostgreSQL database:
- Instance 1: `apm_stocks_instance1`
- Instance 2: `apm_stocks_instance2`
- Instance 3: `apm_stocks_instance3`

**No data sharing between instances!**

### Backup Strategy

```bash
cd multi-instances

# Backup all databases
for i in {1..3}; do
  ./manager.sh db-backup $i
done

# List backups
ls instance*/backups/

# Restore from backup
./manager.sh db-restore 1 instance1/backups/backup_20251222_120000.sql
```

---

## 🐛 TROUBLESHOOTING

### Common Issues

#### 1. Port Already in Use

```bash
# Find what's using the port
lsof -i :3000
lsof -i :5002

# Kill the process
kill -9 <PID>

# Or change port in .env
nano multi-instances/instance1/.env
# Change FRONTEND_PORT=3000 to FRONTEND_PORT=3001
```

#### 2. Instance Won't Start

```bash
# Check logs
cd multi-instances/instance1
docker-compose -f docker-compose.standalone.yml logs

# Or use manager
./manager.sh logs 1

# Rebuild containers
docker-compose -f docker-compose.standalone.yml build --no-cache
docker-compose -f docker-compose.standalone.yml up -d
```

#### 3. Database Connection Failed

```bash
# Check database is running
docker ps | grep db

# Check logs
docker logs instance1-db

# Verify DATABASE_URL in .env
cat multi-instances/instance1/.env | grep DATABASE_URL

# Connect directly
docker exec -it instance1-db psql -U postgres -d apm_stocks_instance1
```

#### 4. Out of Memory

```bash
# Check resource usage
./manager.sh resources

# Free up space
docker system prune -a
docker volume prune

# Reduce number of instances
# Stop instances and edit setup
```

#### 5. Network Issues

```bash
# Verify networks are created
docker network ls | grep apm

# Check network configuration
docker network inspect instance1-network

# Restart networking
docker-compose -f multi-instances/instance1/docker-compose.standalone.yml down
docker-compose -f multi-instances/instance1/docker-compose.standalone.yml up -d
```

---

## 📈 SCALING INSTANCES

### Add More Instances

```bash
# Modify setup script or run with different count
./setup-multi-instances.sh 10

# This creates instance1 through instance10 with proper port allocation
```

### Remove Instances

```bash
cd multi-instances

# Stop instance 5
./manager.sh stop 5

# Remove containers
docker-compose -f instance5/docker-compose.standalone.yml down -v

# Delete directory
rm -rf instance5
```

---

## 🔐 SECURITY CONSIDERATIONS

### For Production

1. **Change Default Password**
   ```bash
   # Edit all .env files
   POSTGRES_PASSWORD=your_secure_password_here
   ```

2. **Use Environment Variables**
   ```bash
   export FYERS_CLIENT_ID="your_client_id"
   export FYERS_SECRET_ID="your_secret_id"
   # Reference in .env
   ```

3. **Network Security**
   ```yaml
   # In docker-compose file, restrict ports to localhost only
   ports:
     - "127.0.0.1:3000:3000"  # Only accessible from localhost
   ```

4. **Database Backup**
   ```bash
   # Regular backups
   ./manager.sh db-backup 1
   ./manager.sh db-backup 2
   ./manager.sh db-backup 3
   ```

---

## 📊 MONITORING & ALERTS

### Real-Time Monitoring

```bash
# Watch resource usage
watch -n 5 'docker stats --no-stream'

# Or use dashboard
cd multi-instances
./manager.sh resources
```

### Health Checks

```bash
# Automated health check
cd multi-instances
./health-check.sh

# In cron job (runs every 5 minutes)
*/5 * * * * /path/to/multi-instances/health-check.sh >> /tmp/health.log 2>&1
```

### Logging

```bash
# All logs are in multi-instances/logs/

# View specific service logs
cd multi-instances
./manager.sh logs 1 backend
./manager.sh logs 2 frontend

# Follow logs in real-time
./manager.sh logs 1 db
```

---

## 🚀 DEPLOYMENT OPTIONS

### Option 1: Local Development
```bash
./setup-multi-instances.sh 3
cd multi-instances
./start-all.sh
```

### Option 2: Single Server (Multiple Instances)
```bash
./setup-multi-instances.sh 5
cd multi-instances
./start-all.sh
```

### Option 3: Multiple Servers (One Instance Each)
```bash
# On Server 1
./setup-multi-instances.sh 1
cd multi-instances/instance1
docker-compose -f docker-compose.standalone.yml up -d

# On Server 2
./setup-multi-instances.sh 1
cd multi-instances/instance1
docker-compose -f docker-compose.standalone.yml up -d

# Add load balancer (nginx) for traffic distribution
```

### Option 4: Kubernetes (Advanced)
```bash
# Convert docker-compose to Kubernetes manifests
kompose convert -f docker-compose.standalone.yml

# Deploy to cluster
kubectl apply -f .
```

---

## 📝 WORKFLOW EXAMPLES

### Example 1: Development Environment

```bash
# Setup 2 instances for testing
./setup-multi-instances.sh 2

# Configure Fyers credentials
nano multi-instances/instance1/.env

# Start instances
cd multi-instances
./start-all.sh

# Work on features - each instance independent
# Frontend 1: http://localhost:3000
# Frontend 2: http://localhost:4000

# Check health
./health-check.sh
```

### Example 2: Load Testing

```bash
# Setup 10 instances
./setup-multi-instances.sh 10

# Start instances
cd multi-instances
./start-all.sh

# Run load tests against each instance
for i in {1..10}; do
  PORT=$((3000 + (i-1)*1000))
  curl -L http://localhost:$PORT &
done

# Monitor
./manager.sh resources
./manager.sh health-check
```

### Example 3: Production Backup & Recovery

```bash
# Backup all instances
cd multi-instances
for i in {1..3}; do
  ./manager.sh db-backup $i
done

# Something goes wrong...
# Restore from backup
./manager.sh db-restore 1 instance1/backups/backup_20251222_120000.sql

# Verify
./health-check.sh
```

---

## 🎓 ADVANCED CONFIGURATION

### Custom Docker Networks

Edit `docker-compose.standalone.yml`:
```yaml
networks:
  ${INSTANCE_ID}-network:
    driver: bridge
    driver_opts:
      com.docker.network.driver.mtu: 9000
```

### Resource Limits

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
```

### Custom Volumes

```yaml
volumes:
  postgres-data:
    driver: local
    driver_opts:
      type: tmpfs
      device: tmpfs
```

---

## 🆘 SUPPORT & DEBUGGING

### Enable Debug Logging

```bash
# For instance 1
cd multi-instances/instance1
docker-compose -f docker-compose.standalone.yml logs -f --tail=100 backend
```

### Collect Debug Info

```bash
cd multi-instances

# Get complete system info
docker ps -a
docker network ls
docker volume ls

# Get instance-specific info
for i in {1..3}; do
  echo "=== Instance $i ==="
  ./manager.sh status $i
done
```

### Test Connectivity

```bash
# From host
curl http://localhost:3000        # Instance 1 Frontend
curl http://localhost:4000        # Instance 2 Frontend
curl http://localhost:5000        # Instance 3 Frontend

# From container
docker exec instance1-backend curl http://db:5432
```

---

## 📚 FILES REFERENCE

| File | Purpose |
|------|---------|
| `setup-multi-instances.sh` | Initialize multi-instance environment |
| `multi-instance-manager.sh` | Master control and management script |
| `docker-compose.standalone.yml` | Template for each instance |
| `.env.template` | Configuration template |
| `multi-instances/instance*/` | Individual instance directories |
| `multi-instances/manager.sh` | Copied manager script |
| `MULTI_INSTANCE_SETUP.md` | Detailed documentation |

---

## ✅ CHECKLIST

Before going live:
- [ ] Run `./setup-multi-instances.sh`
- [ ] Update Fyers credentials in all `.env` files
- [ ] Verify port assignments don't conflict
- [ ] Start all instances with `./start-all.sh`
- [ ] Run health check with `./health-check.sh`
- [ ] Test frontend access on all ports
- [ ] Test backend API endpoints
- [ ] Backup databases
- [ ] Set up monitoring
- [ ] Document instance purposes

---

## 🎉 SUCCESS INDICATORS

You're ready when:
✅ All instances show `healthy` in health check  
✅ Can access all frontend URLs  
✅ Backend APIs responding on all ports  
✅ Databases initialized for each instance  
✅ Fyers data flowing to all instances  
✅ Logs showing no errors  
✅ Resource usage within limits  

---

**Need Help?**
1. Check logs: `./manager.sh logs <instance_num>`
2. Run health check: `./health-check.sh`
3. Check documentation: `cat MULTI_INSTANCE_SETUP.md`
4. Review detailed guide in the main docs folder

Good luck! 🚀
