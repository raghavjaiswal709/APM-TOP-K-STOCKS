# APM-TOP-K-STOCKS: Project Documentation

## Overview

**APM-TOP-K-STOCKS** is a full-stack, monorepo-based stock analytics and dashboard platform. It is designed to provide real-time and historical market data, stock recommendations, and advanced charting for Indian equities. The project is modular, scalable, and leverages modern web technologies, microservices, and data pipelines.

---

## Table of Contents
1. [Project Structure](#project-structure)
2. [Key Features](#key-features)
3. [Technology Stack](#technology-stack)
4. [How It Works](#how-it-works)
5. [Setup & Deployment](#setup--deployment)
6. [Main Modules](#main-modules)
7. [Data Flow](#data-flow)
8. [Extending the Project](#extending-the-project)

---

## Project Structure

```
APM-TOP-K-STOCKS/
├── apps/
│   ├── backend/         # NestJS API, WebSocket, Data Services, Python integration
│   └── frontend/        # Next.js React UI, Dashboard, Charts, Components
├── docker-compose.yml   # Multi-service orchestration
├── Dockerfile.*         # Dockerfiles for backend, frontend, python
├── setup.sh             # Setup script
└── ...                  # Other configs and scripts
```

---

## Key Features
- Real-time and historical stock market data (NSE/BSE)
- Interactive dashboards and charts (Plotly, ApexCharts, Syncfusion)
- Watchlists, recommendations, and company-specific analytics
- WebSocket-based live data streaming
- Modular, extensible UI with Next.js and Tailwind CSS
- Python integration for data fetching and analytics
- Dockerized for easy deployment

---

## Technology Stack
- **Frontend:** Next.js (React), Tailwind CSS, Plotly.js, ApexCharts, Syncfusion, SWR
- **Backend:** NestJS (TypeScript), WebSocket, REST API, TypeORM, PostgreSQL
- **Python Services:** Data fetching, analytics, integration with Fyers API
- **Database:** PostgreSQL (Dockerized)
- **DevOps:** Docker, Docker Compose

---

## How It Works

1. **Data Ingestion:**
   - Python scripts/services fetch live and historical data from Fyers API and other sources.
   - Data is stored in PostgreSQL and/or as JSON files.

2. **Backend API:**
   - NestJS backend exposes REST and WebSocket APIs for market data, watchlists, recommendations, and more.
   - Handles authentication, data aggregation, and business logic.

3. **Frontend UI:**
   - Next.js frontend provides dashboards, charts, and interactive components for users.
   - Real-time updates via WebSocket, advanced charting, and user customization.

4. **Orchestration:**
   - Docker Compose manages all services (frontend, backend, python, database) for local or cloud deployment.

---

## Setup & Deployment

### Prerequisites
- Docker & Docker Compose
- Node.js (for local dev)

### Quick Start (Docker)
```sh
git clone <repo-url>
cd APM-TOP-K-STOCKS
docker-compose up --build
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Database: localhost:5432

### Local Development
- `apps/frontend`: `npm run dev`
- `apps/backend`: `npm run start:dev`
- Python scripts: Run as needed for data fetching

---

## Main Modules

### Backend (NestJS)
- `src/market-data/`: Market data API, WebSocket, DTOs, entities
- `src/live-market/`: Live market streaming
- `src/stock/`: Stock info, filters, entities
- `src/watchlist/`: Watchlist CRUD and management
- `src/database/`: TypeORM/PostgreSQL integration
- `src/services/`: Fyers API, Python bridge

### Frontend (Next.js)
- `app/`: Main app, routing, layout
- `app/components/`: UI components, charts, sidebar, theme
- `app/market-data/`, `app/live-market/`, `app/recommendations/`: Feature pages
- `hooks/`: Custom React hooks for data, WebSocket, etc.
- `lib/`: Utilities, socket, indicators

### Python
- `apps/backend/data/`: Data fetch scripts, company master, watchlists
- `apps/backend/recorded_data/`: Historical data storage

---

## Data Flow
1. **Python** fetches data → stores in DB/files
2. **Backend** serves data via API/WebSocket
3. **Frontend** consumes API/WebSocket → renders dashboards

---

## Extending the Project
- Add new data sources by extending Python scripts and backend services
- Add new charts or UI features in the frontend
- Integrate more analytics or ML models in Python/backend

---

## Authors & License
- Author: raghavjaiswal709
- License: ISC/UNLICENSED (see package.json)

---

## Contact & Support
For issues, open a GitHub issue or contact the maintainer.
