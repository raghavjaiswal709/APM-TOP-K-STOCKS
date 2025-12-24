# APM TOP-K STOCKS - Multi-Instance Deployment

This directory contains configurations for running multiple independent instances of the APM system.

## Quick Start

### Start All Instances
```bash
./start-all.sh
```

### Stop All Instances
```bash
./stop-all.sh
```

### Check Health
```bash
./health-check.sh
```

### Manage Instances
```bash
./manager.sh help
```

## Instance Details

Each instance has:
- Independent frontend (Next.js)
- Independent backend API (NestJS)
- Independent database (PostgreSQL)
- Independent cache (Redis)
- Independent Fyers services (Python)

### Port Mapping

Instance 1: Frontend 3000, Backend 5002, DB 5432, Redis 6379
Instance 2: Frontend 4000, Backend 5102, DB 5433, Redis 6380
Instance 3: Frontend 5000, Backend 5202, DB 5434, Redis 6381

## Configuration

Each instance has a `.env` file with:
- Instance ID and name
- Port assignments
- Database credentials
- Fyers API credentials
- Service URLs

## Management Commands

Start specific instance:
```bash
./manager.sh start 1
```

View logs:
```bash
./manager.sh logs 1
```

Health check:
```bash
./manager.sh health-check
```

## Database Operations

Backup database:
```bash
./manager.sh db-backup 1
```

Restore database:
```bash
./manager.sh db-restore 1 backup_file.sql
```

## Monitoring

Resources:
```bash
./manager.sh resources
```

Report:
```bash
./manager.sh report
```

