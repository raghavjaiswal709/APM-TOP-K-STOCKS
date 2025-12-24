# APM TOP-K STOCKS — Server Setup (Best Way Possible)

Audience: Non-developers. Goal: Run multi-instance on your server so it works exactly like your PC.
Server: http://100.93.172.21/

---

## 1) Prerequisites
- A Linux server (Ubuntu recommended) with internet access.
- Docker Engine + Docker Compose plugin installed.

Ubuntu install:
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
| sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
newgrp docker
docker compose version
```

Firewall: Allow inbound ports used by instances: 3000, 4000, 5000 (frontend), 5002, 5102, 5202 (backend), 5432–5434 (Postgres), 6379–6381 (Redis), 8001–8003 (Python services). Configure at your cloud/firewall level if needed.

---

## 2) Get the Project on the Server
```bash
cd /opt
sudo git clone https://github.com/raghavjaiswal709/APM-TOP-K-STOCKS.git
sudo chown -R "$USER":"$USER" APM-TOP-K-STOCKS
cd APM-TOP-K-STOCKS
```

Note: Keep the folder structure exactly as cloned. Multi-instance scripts expect paths relative to the repo root.

---

## 3) Configure Each Instance (.env)
Files to edit:
- `multi-instances/instance1/.env`
- `multi-instances/instance2/.env`
- `multi-instances/instance3/.env`

Update these values for your server:
- `FYERS_CLIENT_ID`, `FYERS_SECRET_ID`, `FYERS_ACCESS_TOKEN` — put your real credentials for each instance.
- `FYERS_REDIRECT_URI` — use the server IP and the instance frontend port:
  - instance1: `http://100.93.172.21:3000/auth/callback`
  - instance2: `http://100.93.172.21:4000/auth/callback`
  - instance3: `http://100.93.172.21:5000/auth/callback`
- `NEXT_PUBLIC_API_URL` — point to the backend port of each instance:
  - instance1: `http://100.93.172.21:5002`
  - instance2: `http://100.93.172.21:5102`
  - instance3: `http://100.93.172.21:5202`

Quick commands to set the server URLs (then manually fill FYERS credentials):
```bash
# Instance 1
sed -i 's|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://100.93.172.21:5002|' multi-instances/instance1/.env
sed -i 's|FYERS_REDIRECT_URI=.*|FYERS_REDIRECT_URI=http://100.93.172.21:3000/auth/callback|' multi-instances/instance1/.env

# Instance 2
sed -i 's|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://100.93.172.21:5102|' multi-instances/instance2/.env
sed -i 's|FYERS_REDIRECT_URI=.*|FYERS_REDIRECT_URI=http://100.93.172.21:4000/auth/callback|' multi-instances/instance2/.env

# Instance 3
sed -i 's|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://100.93.172.21:5202|' multi-instances/instance3/.env
sed -i 's|FYERS_REDIRECT_URI=.*|FYERS_REDIRECT_URI=http://100.93.172.21:5000/auth/callback|' multi-instances/instance3/.env
```

Ports are pre-assigned and do not conflict:
- instance1: `FRONTEND_PORT=3000`, `BACKEND_PORT=5002`, `POSTGRES_PORT=5432`, `REDIS_PORT=6379`, `FYERS_5001_PORT=8001`, `FYERS_5010_PORT=8010`
- instance2: `FRONTEND_PORT=4000`, `BACKEND_PORT=5102`, `POSTGRES_PORT=5433`, `REDIS_PORT=6380`, `FYERS_5001_PORT=8002`, `FYERS_5010_PORT=8011`
- instance3: `FRONTEND_PORT=5000`, `BACKEND_PORT=5202`, `POSTGRES_PORT=5434`, `REDIS_PORT=6381`, `FYERS_5001_PORT=8003`, `FYERS_5010_PORT=8012`

---

## 4) Start All Instances
```bash
cd /opt/APM-TOP-K-STOCKS/multi-instances
./start-all.sh
```

What happens:
- Each instance starts its own frontend, backend, Postgres, Redis, and two Python services.
- Instances are isolated on unique Docker networks: `instance1-network`, `instance2-network`, `instance3-network`.
- Compose files are already configured (no obsolete version, correct build paths).

---

## 5) Verify and Access
Health checks:
```bash
curl -f http://100.93.172.21:5002/health
curl -f http://100.93.172.21:5102/health
curl -f http://100.93.172.21:5202/health
```
Frontends:
- Instance 1: `http://100.93.172.21:3000`
- Instance 2: `http://100.93.172.21:4000`
- Instance 3: `http://100.93.172.21:5000`

Optional quick checks:
```bash
docker ps --format '{{.Names}}\t{{.Status}}'
/opt/APM-TOP-K-STOCKS/multi-instances/health-check.sh
```

---

## 6) Manage & Logs
Stop all:
```bash
cd /opt/APM-TOP-K-STOCKS/multi-instances
./stop-all.sh
```
Per-instance management:
```bash
cd /opt/APM-TOP-K-STOCKS/multi-instances
./manager.sh up instance1
./manager.sh logs instance2
./manager.sh down instance3
```

View logs:
```bash
docker logs instance1-backend --follow
```

---

## 7) Troubleshooting
- Credentials: Ensure valid `FYERS_*` values in each `.env`. Redirect URIs must match the frontend URLs.
- Firewall: Open ports externally on your cloud/host firewall.
- Network errors: Already resolved; each compose uses a fixed network key `internal` with dynamic name `${INSTANCE_ID}-network`.
- Compose warnings: No `version` key used (Compose v2+ ignores it anyway); our files avoid the warning.
- Path issues: Do not move or rename the repo folders. Compose uses `../../` build contexts to reach Dockerfiles in the repo root.
- Health failing: Check `.env` values; then `docker logs <container>` for details.

---

## 8) Optional: Run One Instance Only
```bash
cd /opt/APM-TOP-K-STOCKS/multi-instances
./manager.sh up instance1
# Access: http://100.93.172.21:3000
```
Repeat for `instance2` or `instance3` as needed.

---

## 9) Summary
- Edit `.env` for each instance to point to server URLs and fill FYERS credentials.
- Run `./start-all.sh` to launch all three isolated instances.
- Access the frontends at `http://100.93.172.21:3000`, `:4000`, `:5000`.
- Use `./manager.sh` and `./stop-all.sh` for day-to-day operations.
