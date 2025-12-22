# GTT LIVE TRADING SYSTEM - DASHBOARD INTEGRATION GUIDE

**Version:** 1.0.0  
**Last Updated:** November 2025  
**Base URL:** `http://your-server:5113`  
**System:** GTT Multi-Model Stock Prediction System

---

## TABLE OF CONTENTS

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [API Endpoints](#api-endpoints)
4. [Integration Examples](#integration-examples)
5. [Data Models](#data-models)
6. [Real-time Updates](#real-time-updates)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

---

## SYSTEM OVERVIEW

### What is GTT Live Trading System?

The GTT (Generative Temporal Transformer) Live Trading System is an AI-powered stock prediction platform that generates real-time price forecasts for 33 NSE banking stocks across three categories:

- **PSU Banks** (12 stocks): SBIN, BANKBARODA, PNB, etc.
- **Private Banks** (10 stocks): HDFCBANK, ICICIBANK, AXISBANK, etc.
- **Small Banks** (21 stocks): IDBI, DHANBANK, CUB, etc.

### Key Features

- **Real-time Predictions**: Every 15 minutes during market hours (9:15 AM - 3:30 PM)
- **5-Step Horizon**: Predicts next 5 intervals (75 minutes ahead)
- **Multi-Model Architecture**: Separate fine-tuned models per category
- **Live Market Integration**: Uses Market Data API (port 5110) for real-time data
- **RESTful API**: Complete REST API on port 5113
- **Historical Backtesting**: 7-day backtest with day-wise analysis

---

## ARCHITECTURE

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                  YOUR DASHBOARD (Frontend)                   │
│                   Port: Your Choice                          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP GET Requests
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              GTT PREDICTION API (Flask/CORS)                 │
│                      Port: 5113                              │
│  - Real-time prediction endpoints                            │
│  - Stock & category management                               │
│  - Historical data access                                    │
│  - System status monitoring                                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            PREDICTION ENGINE (Background Process)            │
│  - Loads GTT models by category                              │
│  - Processes 15-min market data                              │
│  - Generates H1-H5 predictions                               │
│  - Updates prediction store                                  │
└────────────┬────────────────────────┬───────────────────────┘
             │                        │
             ▼                        ▼
┌──────────────────────┐   ┌──────────────────────────────────┐
│  Market Data API     │   │  PostgreSQL Database             │
│  Port: 5110          │   │  - Historical OHLCV data         │
│  - Live minute data  │   │  - Company metadata              │
│  - 9:15 AM - 3:30 PM │   │  - 90 days lookback              │
└──────────────────────┘   └──────────────────────────────────┘
```

### Data Flow

```
Market Opens (9:15 AM)
        ↓
Every 15 minutes:
        ↓
Fetch Historical (DB) ─→ Combine ──→ Prepare Input (1024 points)
        +                              ↓
Fetch Live (API) ────────────→    Load Category Model
                                      ↓
                                  Generate Predictions (H1-H5)
                                      ↓
                                  Denormalize Prices
                                      ↓
                                  Update API Store
                                      ↓
                              Your Dashboard ← Poll API
```

### Prediction Timeline

```
09:00 AM  ┃ System starts (can start night before)
          ┃ Waits for market open
          ┃
09:15 AM  ┃ Market Opens
          ┃
09:15 AM  ┃ First Prediction Cycle
          ┃ ↓ For each stock in category:
          ┃   ├─ Fetch historical data (90 days)
          ┃   ├─ Fetch live data (9:15 AM)
          ┃   ├─ Combine & resample to 15-min
          ┃   ├─ Prepare last 1024 points
          ┃   ├─ Predict H1-H5 (9:15, 9:30, 9:45, 10:00, 10:15)
          ┃   └─ Store predictions
          ┃
09:30 AM  ┃ Second Prediction Cycle
          ┃ (Repeat with data up to 9:30)
          ┃
09:45 AM  ┃ Third Prediction Cycle
          ┃
...       ┃ Continue every 15 minutes
          ┃
03:15 PM  ┃ Final Prediction Cycle
          ┃
03:30 PM  ┃ Market Closes
          ┃ ↓ Generate plots & CSVs
          ┃ ↓ Save to live_predictions_YYYYMMDD/
```

---

## API ENDPOINTS

### Base URL
```
http://your-server:5113
```

All endpoints return JSON. CORS enabled for all origins.

---

### 1. Health Check

**Endpoint:** `GET /api/health`

**Description:** Verify API is running

**Request:**
```bash
curl http://your-server:5113/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-20T14:30:00",
  "system_status": "running"
}
```

**Fields:**
- `status`: "healthy" (API operational)
- `timestamp`: Current server time (ISO 8601)
- `system_status`: "idle", "running", "stopped"

---

### 2. Get Latest Predictions (All Stocks)

**Endpoint:** `GET /api/predictions/latest`

**Description:** Get most recent prediction for all tracked stocks

**Request:**
```bash
curl http://your-server:5113/api/predictions/latest
```

**Response:**
```json
{
  "timestamp": "2025-11-20T14:30:05",
  "status": "running",
  "total_stocks": 33,
  "predictions": {
    "SBIN": {
      "prediction_time": "2025-11-20 14:30",
      "input_close": 625.50,
      "H1_pred": 626.20,
      "H2_pred": 626.80,
      "H3_pred": 627.10,
      "H4_pred": 627.50,
      "H5_pred": 628.00,
      "timestamp": "2025-11-20T14:30:05"
    },
    "ICICIBANK": {
      "prediction_time": "2025-11-20 14:30",
      "input_close": 1366.75,
      "H1_pred": 1367.20,
      "H2_pred": 1368.50,
      "H3_pred": 1369.00,
      "H4_pred": 1368.80,
      "H5_pred": 1369.50,
      "timestamp": "2025-11-20T14:30:05"
    }
  }
}
```

**Use Case:** Main dashboard display, show all stocks at once

---

### 3. Get Stock History (Individual Stock)

**Endpoint:** `GET /api/predictions/stock/{symbol}`

**Description:** Get all predictions made today for specific stock

**Parameters:**
- `symbol` (path): Stock symbol (e.g., "SBIN", "ICICIBANK")

**Request:**
```bash
curl http://your-server:5113/api/predictions/stock/SBIN
```

**Response:**
```json
{
  "symbol": "SBIN",
  "total_predictions": 25,
  "predictions": [
    {
      "prediction_time": "2025-11-20 09:15",
      "input_close": 620.30,
      "H1_pred": 620.80,
      "H2_pred": 621.20,
      "H3_pred": 621.50,
      "H4_pred": 621.80,
      "H5_pred": 622.10,
      "timestamp": "2025-11-20T09:15:05"
    },
    {
      "prediction_time": "2025-11-20 09:30",
      "input_close": 620.90,
      "H1_pred": 621.30,
      "H2_pred": 621.70,
      "H3_pred": 622.00,
      "H4_pred": 622.30,
      "H5_pred": 622.60,
      "timestamp": "2025-11-20T09:30:05"
    }
  ],
  "latest": {
    "prediction_time": "2025-11-20 14:30",
    "input_close": 625.50,
    "H1_pred": 626.20,
    "H2_pred": 626.80,
    "H3_pred": 627.10,
    "H4_pred": 627.50,
    "H5_pred": 628.00,
    "timestamp": "2025-11-20T14:30:05"
  }
}
```

**Use Case:** Individual stock page, historical chart

---

### 4. Get Category Predictions

**Endpoint:** `GET /api/predictions/category/{category}`

**Description:** Get latest predictions for all stocks in a category

**Parameters:**
- `category` (path): "PSU_BANKS", "PRIVATE_BANKS", "SMALL_BANKS"

**Request:**
```bash
curl http://your-server:5113/api/predictions/category/PSU_BANKS
```

**Response:**
```json
{
  "category": "PSU_BANKS",
  "description": "Public Sector Banks",
  "stock_count": 12,
  "active_predictions": 12,
  "predictions": {
    "SBIN": {
      "prediction_time": "2025-11-20 14:30",
      "input_close": 625.50,
      "H1_pred": 626.20,
      "H2_pred": 626.80,
      "H3_pred": 627.10,
      "H4_pred": 627.50,
      "H5_pred": 628.00,
      "timestamp": "2025-11-20T14:30:05"
    },
    "BANKBARODA": { ... },
    "PNB": { ... }
  }
}
```

**Use Case:** Category comparison view, sector analysis

---

### 5. Get Complete History

**Endpoint:** `GET /api/predictions/history`

**Description:** Get all predictions for all stocks today

**Request:**
```bash
curl http://your-server:5113/api/predictions/history
```

**Response:**
```json
{
  "date": "2025-11-20",
  "market_open": "2025-11-20T09:15:00",
  "history": {
    "SBIN": [
      {
        "prediction_time": "2025-11-20 09:15",
        "input_close": 620.30,
        "H1_pred": 620.80,
        "H2_pred": 621.20,
        "H3_pred": 621.50,
        "H4_pred": 621.80,
        "H5_pred": 622.10,
        "timestamp": "2025-11-20T09:15:05"
      }
    ],
    "ICICIBANK": [ ... ]
  },
  "total_predictions": 825
}
```

**Use Case:** Data export, analysis, historical review

---

### 6. List All Stocks

**Endpoint:** `GET /api/stocks/list`

**Description:** Get list of all tracked stocks with categories

**Request:**
```bash
curl http://your-server:5113/api/stocks/list
```

**Response:**
```json
{
  "total": 33,
  "stocks": [
    "SBIN", "BANKBARODA", "PNB", "CANBK", "UNIONBANK",
    "HDFCBANK", "ICICIBANK", "AXISBANK", "KOTAKBANK",
    "IDBI", "DHANBANK", "CUB"
  ],
  "categories": {
    "PSU_BANKS": {
      "description": "Public Sector Banks",
      "stock_count": 12,
      "stocks": [
        "SBIN", "BANKBARODA", "PNB", "CANBK", "UNIONBANK",
        "INDIANB", "BANKINDIA", "IOB", "CENTRALBK",
        "MAHABANK", "PSB", "UCOBANK"
      ]
    },
    "PRIVATE_BANKS": {
      "description": "Private Sector Banks",
      "stock_count": 10,
      "stocks": [
        "HDFCBANK", "ICICIBANK", "AXISBANK", "KOTAKBANK",
        "INDUSINDBK", "BANDHANBNK", "RBLBANK", "YESBANK",
        "FEDERALBNK", "IDFCFIRSTB"
      ]
    },
    "SMALL_BANKS": {
      "description": "Small Finance & Regional Banks",
      "stock_count": 21,
      "stocks": [
        "IDBI", "DHANBANK", "CUB", "KARURVYSYA", "SOUTHBANK",
        "J&KBANK", "KTKBANK", "DCBBANK", "TMB", "CSBBANK",
        "NAINITAL", "AUBANK", "EQUITASBNK", "UJJIVANSFB",
        "UTKARSHBNK", "SSFB", "JSFB", "ESAFSFB", "NSFB",
        "CAPITALSFB", "FINOPB"
      ]
    }
  }
}
```

**Use Case:** Populate stock selector, category filters

---

### 7. System Status

**Endpoint:** `GET /api/status`

**Description:** Get detailed system status and statistics

**Request:**
```bash
curl http://your-server:5113/api/status
```

**Response:**
```json
{
  "status": "running",
  "last_update": "2025-11-20T14:30:05",
  "active_stocks": 33,
  "total_predictions_today": 825,
  "market_time": "14:30:00",
  "is_market_hours": true,
  "market_open": "09:15",
  "market_close": "15:30"
}
```

**Use Case:** System health monitoring, status indicator

---

### 8. Prediction Summary

**Endpoint:** `GET /api/predictions/summary`

**Description:** Get quick summary stats for all stocks

**Request:**
```bash
curl http://your-server:5113/api/predictions/summary
```

**Response:**
```json
{
  "summary": {
    "SBIN": {
      "current_price": 625.50,
      "h1_prediction": 626.20,
      "prediction_count": 25,
      "last_updated": "2025-11-20T14:30:05"
    },
    "ICICIBANK": {
      "current_price": 1366.75,
      "h1_prediction": 1367.20,
      "prediction_count": 25,
      "last_updated": "2025-11-20T14:30:05"
    }
  },
  "total_stocks": 33
}
```

**Use Case:** Quick overview cards, mini widgets

---

## DATA MODELS

### Prediction Object

```typescript
interface Prediction {
  prediction_time: string;      // "YYYY-MM-DD HH:MM"
  input_close: number;           // Current closing price
  H1_pred: number;               // +15 min prediction
  H2_pred: number;               // +30 min prediction
  H3_pred: number;               // +45 min prediction
  H4_pred: number;               // +60 min prediction
  H5_pred: number;               // +75 min prediction
  H1_actual?: number;            // Actual price (if available)
  H2_actual?: number;
  H3_actual?: number;
  H4_actual?: number;
  H5_actual?: number;
  timestamp: string;             // ISO 8601 when predicted
}
```

### Category Information

```typescript
interface Category {
  path: string;                  // Model checkpoint path
  stocks: string[];              // List of stock symbols
  description: string;           // Human-readable name
}
```

### API Response Wrappers

```typescript
interface LatestResponse {
  timestamp: string;
  status: string;
  total_stocks: number;
  predictions: Record<string, Prediction>;
}

interface StockHistoryResponse {
  symbol: string;
  total_predictions: number;
  predictions: Prediction[];
  latest: Prediction;
}

interface CategoryResponse {
  category: string;
  description: string;
  stock_count: number;
  active_predictions: number;
  predictions: Record<string, Prediction>;
}
```

---

## INTEGRATION EXAMPLES

### JavaScript/TypeScript (Fetch API)

```javascript
const API_BASE = 'http://your-server:5113';

// Get latest predictions for all stocks
async function getLatestPredictions() {
  try {
    const response = await fetch(`${API_BASE}/api/predictions/latest`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log(`Status: ${data.status}`);
    console.log(`Total stocks: ${data.total_stocks}`);
    
    // Display each stock's prediction
    Object.entries(data.predictions).forEach(([symbol, pred]) => {
      console.log(`${symbol}: ₹${pred.input_close} → H1: ₹${pred.H1_pred}`);
    });
    
    return data;
  } catch (error) {
    console.error('Error fetching predictions:', error);
    throw error;
  }
}

// Get history for specific stock
async function getStockHistory(symbol) {
  const response = await fetch(
    `${API_BASE}/api/predictions/stock/${symbol}`
  );
  return await response.json();
}

// Get category predictions
async function getCategoryPredictions(category) {
  const response = await fetch(
    `${API_BASE}/api/predictions/category/${category}`
  );
  return await response.json();
}
```

---

### React Component Example

```jsx
import React, { useState, useEffect } from 'react';

function LivePredictionDashboard() {
  const [predictions, setPredictions] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('idle');
  const API_BASE = 'http://your-server:5113';

  // Fetch latest predictions
  const fetchPredictions = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/predictions/latest`);
      const data = await response.json();
      
      setPredictions(data.predictions);
      setStatus(data.status);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  // Initial fetch and setup polling
  useEffect(() => {
    fetchPredictions();
    
    // Poll every 60 seconds
    const interval = setInterval(fetchPredictions, 60000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="loading">Loading predictions...</div>;
  }

  return (
    <div className="dashboard">
      <div className="header">
        <h1>GTT Live Predictions</h1>
        <div className={`status status-${status}`}>
          {status === 'running' ? '🟢 Live' : '🔴 Stopped'}
        </div>
      </div>

      <div className="stock-grid">
        {Object.entries(predictions).map(([symbol, pred]) => (
          <div key={symbol} className="stock-card">
            <h3>{symbol}</h3>
            <div className="current-price">
              ₹{pred.input_close.toFixed(2)}
            </div>
            <div className="predictions">
              <div className="pred-item">
                <span>H1 (+15m)</span>
                <span className={getPriceClass(pred.input_close, pred.H1_pred)}>
                  ₹{pred.H1_pred.toFixed(2)}
                </span>
              </div>
              <div className="pred-item">
                <span>H2 (+30m)</span>
                <span className={getPriceClass(pred.input_close, pred.H2_pred)}>
                  ₹{pred.H2_pred.toFixed(2)}
                </span>
              </div>
              <div className="pred-item">
                <span>H5 (+75m)</span>
                <span className={getPriceClass(pred.input_close, pred.H5_pred)}>
                  ₹{pred.H5_pred.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="timestamp">
              {new Date(pred.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getPriceClass(current, predicted) {
  if (predicted > current) return 'price-up';
  if (predicted < current) return 'price-down';
  return 'price-neutral';
}

export default LivePredictionDashboard;
```

---

### Python Integration

```python
import requests
import pandas as pd
from datetime import datetime

API_BASE = 'http://your-server:5113'

class GTTPredictionClient:
    def __init__(self, base_url=API_BASE):
        self.base_url = base_url
    
    def get_latest(self):
        """Get latest predictions for all stocks"""
        response = requests.get(f'{self.base_url}/api/predictions/latest')
        response.raise_for_status()
        return response.json()
    
    def get_stock_history(self, symbol):
        """Get prediction history for stock"""
        response = requests.get(
            f'{self.base_url}/api/predictions/stock/{symbol}'
        )
        response.raise_for_status()
        return response.json()
    
    def get_category(self, category):
        """Get predictions for category"""
        response = requests.get(
            f'{self.base_url}/api/predictions/category/{category}'
        )
        response.raise_for_status()
        return response.json()
    
    def to_dataframe(self, stock_history):
        """Convert stock history to pandas DataFrame"""
        data = stock_history['predictions']
        df = pd.DataFrame(data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        return df

# Usage
client = GTTPredictionClient()

# Get latest predictions
latest = client.get_latest()
print(f"Status: {latest['status']}")
print(f"Total stocks: {latest['total_stocks']}")

# Get history for SBIN
sbin_data = client.get_stock_history('SBIN')
df = client.to_dataframe(sbin_data)

print(df[['prediction_time', 'input_close', 'H1_pred', 'H2_pred']])
```

---

### Chart.js Integration

```javascript
async function renderPredictionChart(symbol) {
  // Fetch stock history
  const response = await fetch(
    `${API_BASE}/api/predictions/stock/${symbol}`
  );
  const data = await response.json();
  
  // Prepare chart data
  const timestamps = data.predictions.map(p => p.prediction_time);
  const inputPrices = data.predictions.map(p => p.input_close);
  const h1Predictions = data.predictions.map(p => p.H1_pred);
  const h5Predictions = data.predictions.map(p => p.H5_pred);
  
  // Create chart
  const ctx = document.getElementById('predictionChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: timestamps,
      datasets: [
        {
          label: 'Current Price',
          data: inputPrices,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        },
        {
          label: 'H1 Prediction (+15min)',
          data: h1Predictions,
          borderColor: 'rgb(255, 99, 132)',
          borderDash: [5, 5],
          tension: 0.1
        },
        {
          label: 'H5 Prediction (+75min)',
          data: h5Predictions,
          borderColor: 'rgb(153, 102, 255)',
          borderDash: [5, 5],
          tension: 0.1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `${symbol} - Live Predictions`
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          title: {
            display: true,
            text: 'Price (₹)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Time'
          }
        }
      }
    }
  });
}
```

---

## REAL-TIME UPDATES

### Polling Strategy

**Recommended:** Poll every 60 seconds

```javascript
// Simple polling
setInterval(async () => {
  const data = await fetchLatestPredictions();
  updateDashboard(data);
}, 60000);

// Smart polling with error handling
class PredictionPoller {
  constructor(interval = 60000) {
    this.interval = interval;
    this.isRunning = false;
    this.retryCount = 0;
    this.maxRetries = 3;
  }
  
  start(callback) {
    this.isRunning = true;
    this.poll(callback);
  }
  
  stop() {
    this.isRunning = false;
  }
  
  async poll(callback) {
    if (!this.isRunning) return;
    
    try {
      const data = await fetchLatestPredictions();
      callback(data);
      this.retryCount = 0; // Reset on success
      
      setTimeout(() => this.poll(callback), this.interval);
      
    } catch (error) {
      console.error('Polling error:', error);
      this.retryCount++;
      
      if (this.retryCount < this.maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
        setTimeout(() => this.poll(callback), delay);
      } else {
        console.error('Max retries reached, stopping poller');
        this.stop();
      }
    }
  }
}

// Usage
const poller = new PredictionPoller();
poller.start((data) => {
  updateDashboard(data);
});
```

### Update Frequency by Market Time

```javascript
function getPollingInterval() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // During market hours (9:15 - 15:30)
  if ((hour >= 9 && hour < 15) || (hour === 15 && minute <= 30)) {
    return 60000; // 1 minute
  }
  
  // Pre-market (8:00 - 9:15)
  if (hour >= 8 && hour < 9) {
    return 300000; // 5 minutes
  }
  
  // After hours
  return 600000; // 10 minutes (minimal polling)
}

// Adaptive poller
setInterval(() => {
  const interval = getPollingInterval();
  // Adjust polling dynamically
}, 60000);
```

---

## ERROR HANDLING

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process normally |
| 404 | Not Found | Stock/category doesn't exist |
| 400 | Bad Request | Check parameters |
| 503 | Service Unavailable | System not ready, retry |
| 500 | Internal Error | Contact support |

### Error Response Format

```json
{
  "error": "Stock INVALID not found",
  "detail": "Stock symbol not in tracked list"
}
```

### Comprehensive Error Handler

```javascript
async function safeFetch(url, options = {}) {
  const maxRetries = 3;
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      // Success
      if (response.ok) {
        return await response.json();
      }
      
      // Handle specific status codes
      if (response.status === 404) {
        throw new Error('Resource not found');
      }
      
      if (response.status === 503) {
        // Service starting up, wait and retry
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      
      if (response.status === 500) {
        const error = await response.json();
        throw new Error(error.detail || 'Server error');
      }
      
      throw new Error(`HTTP ${response.status}`);
      
    } catch (error) {
      lastError = error;
      
      // Don't retry on 404
      if (error.message.includes('not found')) {
        throw error;
      }
      
      // Wait before retry
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
}

// Usage
try {
  const data = await safeFetch(`${API_BASE}/api/predictions/latest`);
  updateDashboard(data);
} catch (error) {
  showErrorMessage(error.message);
}
```

### Network Error Handling

```javascript
// Detect network status
window.addEventListener('online', () => {
  console.log('Network restored, resuming polling');
  resumePolling();
});

window.addEventListener('offline', () => {
  console.log('Network lost, pausing polling');
  pausePolling();
  showNetworkError();
});

// Handle stale data
function checkDataFreshness(timestamp) {
  const now = new Date();
  const predTime = new Date(timestamp);
  const ageMinutes = (now - predTime) / 60000;
  
  if (ageMinutes > 10) {
    showWarning('Predictions may be stale');
    return false;
  }
  
  return true;
}
```

---

## BEST PRACTICES

### 1. Efficient Data Fetching

**Use latest endpoint for dashboards:**
```javascript
// Good: Get all stocks at once
const data = await fetch('/api/predictions/latest');

// Avoid: Multiple individual requests
for (const symbol of stocks) {
  await fetch(`/api/predictions/stock/${symbol}`); // DON'T DO THIS
}
```

**Use category endpoint for sector views:**
```javascript
// Good: Get all PSU banks at once
const psuBanks = await fetch('/api/predictions/category/PSU_BANKS');

// Avoid: Individual stock requests
for (const stock of psuBankStocks) {
  await fetch(`/api/predictions/stock/${stock}`); // DON'T DO THIS
}
```

### 2. Caching Strategy

```javascript
class PredictionCache {
  constructor(ttl = 30000) { // 30 second TTL
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }
  
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    const age = Date.now() - item.timestamp;
    
    if (age > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  clear() {
    this.cache.clear();
  }
}

// Usage
const cache = new PredictionCache();

async function getCachedPredictions() {
  const cached = cache.get('latest');
  
  if (cached) {
    console.log('Using cached data');
    return cached;
  }
  
  const data = await fetch('/api/predictions/latest').then(r => r.json());
  cache.set('latest', data);
  
  return data;
}
```

### 3. Display Best Practices

**Show prediction horizon clearly:**
```jsx
function PredictionDisplay({ prediction }) {
  return (
    <div className="prediction-timeline">
      <div className="current">
        <label>Current</label>
        <span>₹{prediction.input_close.toFixed(2)}</span>
      </div>
      
      <div className="arrow">→</div>
      
      <div className="forecast">
        <div className="step">
          <label>H1 (+15m)</label>
          <span className={getChangeClass(prediction.input_close, prediction.H1_pred)}>
            ₹{prediction.H1_pred.toFixed(2)}
          </span>
        </div>
        
        <div className="step">
          <label>H5 (+75m)</label>
          <span className={getChangeClass(prediction.input_close, prediction.H5_pred)}>
            ₹{prediction.H5_pred.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
```

**Show timestamp and freshness:**
```jsx
function FreshnessIndicator({ timestamp }) {
  const [age, setAge] = useState(0);
  
  useEffect(() => {
    const updateAge = () => {
      const now = new Date();
      const pred = new Date(timestamp);
      const minutes = Math.floor((now - pred) / 60000);
      setAge(minutes);
    };
    
    updateAge();
    const interval = setInterval(updateAge, 10000);
    
    return () => clearInterval(interval);
  }, [timestamp]);
  
  const getFreshnessClass = () => {
    if (age < 2) return 'fresh';
    if (age < 5) return 'recent';
    if (age < 10) return 'aging';
    return 'stale';
  };
  
  return (
    <div className={`freshness ${getFreshnessClass()}`}>
      <span className="dot"></span>
      <span>Updated {age}m ago</span>
    </div>
  );
}
```

**Indicate price movement:**
```javascript
function getPriceMovement(current, predicted) {
  const change = predicted - current;
  const changePercent = (change / current) * 100;
  
  return {
    absolute: change.toFixed(2),
    percent: changePercent.toFixed(2),
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
    icon: change > 0 ? '↑' : change < 0 ? '↓' : '→'
  };
}

// Display
<div className={`price-change ${movement.direction}`}>
  {movement.icon} {movement.absolute} ({movement.percent}%)
</div>
```

### 4. Performance Optimization

**Lazy load charts:**
```jsx
import { lazy, Suspense } from 'react';

const StockChart = lazy(() => import('./StockChart'));

function StockDetail({ symbol }) {
  return (
    <Suspense fallback={<div>Loading chart...</div>}>
      <StockChart symbol={symbol} />
    </Suspense>
  );
}
```

**Virtual scrolling for large lists:**
```jsx
import { FixedSizeList } from 'react-window';

function StockList({ stocks, predictions }) {
  const Row = ({ index, style }) => {
    const symbol = stocks[index];
    const pred = predictions[symbol];
    
    return (
      <div style={style}>
        <StockCard symbol={symbol} prediction={pred} />
      </div>
    );
  };
  
  return (
    <FixedSizeList
      height={600}
      itemCount={stocks.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

**Debounce search/filter:**
```javascript
import { debounce } from 'lodash';

const debouncedSearch = debounce((query) => {
  filterStocks(query);
}, 300);

// In component
<input 
  type="text" 
  onChange={(e) => debouncedSearch(e.target.value)}
  placeholder="Search stocks..."
/>
```

### 5. Error States & Loading

**Comprehensive loading states:**
```jsx
function Dashboard() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null
  });
  
  useEffect(() => {
    fetchPredictions()
      .then(data => setState({ loading: false, error: null, data }))
      .catch(error => setState({ loading: false, error, data: null }));
  }, []);
  
  if (state.loading) {
    return (
      <div className="loading-container">
        <Spinner />
        <p>Loading predictions...</p>
      </div>
    );
  }
  
  if (state.error) {
    return (
      <div className="error-container">
        <ErrorIcon />
        <h3>Failed to load predictions</h3>
        <p>{state.error.message}</p>
        <button onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }
  
  return <PredictionDashboard data={state.data} />;
}
```

---

## ADVANCED FEATURES

### 1. Prediction Comparison

```javascript
async function comparePredictions(symbols) {
  const promises = symbols.map(symbol =>
    fetch(`${API_BASE}/api/predictions/stock/${symbol}`).then(r => r.json())
  );
  
  const results = await Promise.all(promises);
  
  // Compare latest predictions
  const comparison = results.map(({ symbol, latest }) => ({
    symbol,
    current: latest.input_close,
    h1: latest.H1_pred,
    h5: latest.H5_pred,
    h1_change: ((latest.H1_pred - latest.input_close) / latest.input_close * 100).toFixed(2),
    h5_change: ((latest.H5_pred - latest.input_close) / latest.input_close * 100).toFixed(2)
  }));
  
  // Sort by expected movement
  comparison.sort((a, b) => Math.abs(parseFloat(b.h5_change)) - Math.abs(parseFloat(a.h5_change)));
  
  return comparison;
}
```

### 2. Accuracy Tracking

```javascript
class AccuracyTracker {
  constructor() {
    this.predictions = [];
  }
  
  addPrediction(prediction) {
    this.predictions.push({
      ...prediction,
      recordedAt: Date.now()
    });
  }
  
  checkActual(symbol, timestamp, actualPrice) {
    const pred = this.predictions.find(p => 
      p.symbol === symbol && 
      p.prediction_time === timestamp
    );
    
    if (pred) {
      pred.actual = actualPrice;
      pred.error = Math.abs(pred.H1_pred - actualPrice);
      pred.errorPercent = (pred.error / actualPrice) * 100;
    }
  }
  
  getAccuracy(symbol = null) {
    let preds = this.predictions.filter(p => p.actual !== undefined);
    
    if (symbol) {
      preds = preds.filter(p => p.symbol === symbol);
    }
    
    if (preds.length === 0) return null;
    
    const avgError = preds.reduce((sum, p) => sum + p.error, 0) / preds.length;
    const avgErrorPercent = preds.reduce((sum, p) => sum + p.errorPercent, 0) / preds.length;
    
    const correct = preds.filter(p => {
      const predDirection = p.H1_pred > p.input_close;
      const actualDirection = p.actual > p.input_close;
      return predDirection === actualDirection;
    }).length;
    
    const directionAccuracy = (correct / preds.length) * 100;
    
    return {
      sampleSize: preds.length,
      mae: avgError.toFixed(2),
      mape: avgErrorPercent.toFixed(2),
      directionAccuracy: directionAccuracy.toFixed(2)
    };
  }
}

// Usage
const tracker = new AccuracyTracker();

// When new prediction arrives
tracker.addPrediction({ symbol: 'SBIN', ...prediction });

// When actual price is known
tracker.checkActual('SBIN', '2025-11-20 09:30', 625.75);

// Get accuracy stats
const accuracy = tracker.getAccuracy('SBIN');
console.log(`Accuracy: ${accuracy.directionAccuracy}%`);
```

### 3. Alert System

```javascript
class PredictionAlerts {
  constructor() {
    this.alerts = [];
    this.thresholds = {
      priceChange: 1.0,  // 1% change
      volumeSpike: 2.0   // 2x normal
    };
  }
  
  checkAlert(symbol, prediction, previous) {
    const alerts = [];
    
    // Large price movement predicted
    const h5Change = Math.abs((prediction.H5_pred - prediction.input_close) / prediction.input_close * 100);
    
    if (h5Change > this.thresholds.priceChange) {
      alerts.push({
        type: 'large_movement',
        symbol,
        message: `${symbol} predicted to move ${h5Change.toFixed(2)}% in next 75 minutes`,
        severity: h5Change > 2.0 ? 'high' : 'medium'
      });
    }
    
    // Trend reversal
    if (previous) {
      const prevTrend = previous.H5_pred > previous.input_close;
      const currTrend = prediction.H5_pred > prediction.input_close;
      
      if (prevTrend !== currTrend) {
        alerts.push({
          type: 'trend_reversal',
          symbol,
          message: `${symbol} trend reversal detected`,
          severity: 'medium'
        });
      }
    }
    
    return alerts;
  }
  
  notify(alert) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`${alert.symbol} Alert`, {
        body: alert.message,
        icon: '/icon.png'
      });
    }
    
    console.log(`🚨 ${alert.message}`);
  }
}
```

### 4. Export Functionality

```javascript
function exportToCSV(predictions, filename = 'predictions.csv') {
  // Convert to CSV
  const headers = ['Time', 'Symbol', 'Current', 'H1', 'H2', 'H3', 'H4', 'H5'];
  const rows = [];
  
  Object.entries(predictions).forEach(([symbol, pred]) => {
    rows.push([
      pred.prediction_time,
      symbol,
      pred.input_close,
      pred.H1_pred,
      pred.H2_pred,
      pred.H3_pred,
      pred.H4_pred,
      pred.H5_pred
    ]);
  });
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

function exportToJSON(data, filename = 'predictions.json') {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}
```

---

## TESTING

### API Testing with cURL

```bash
# Health check
curl http://your-server:5113/api/health

# Get latest predictions
curl http://your-server:5113/api/predictions/latest

# Get specific stock
curl http://your-server:5113/api/predictions/stock/SBIN

# Get category
curl http://your-server:5113/api/predictions/category/PSU_BANKS

# Get system status
curl http://your-server:5113/api/status
```

### Automated Test Script

```javascript
// test_api.js
const API_BASE = 'http://your-server:5113';

async function testAPI() {
  const tests = [
    { name: 'Health Check', url: '/api/health' },
    { name: 'Latest Predictions', url: '/api/predictions/latest' },
    { name: 'Stock History', url: '/api/predictions/stock/SBIN' },
    { name: 'Category', url: '/api/predictions/category/PSU_BANKS' },
    { name: 'Stock List', url: '/api/stocks/list' },
    { name: 'Status', url: '/api/status' },
    { name: 'Summary', url: '/api/predictions/summary' },
    { name: 'History', url: '/api/predictions/history' }
  ];
  
  console.log('Testing GTT API...\n');
  
  for (const test of tests) {
    try {
      const start = Date.now();
      const response = await fetch(`${API_BASE}${test.url}`);
      const duration = Date.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✓ ${test.name} - ${duration}ms`);
      } else {
        console.log(`✗ ${test.name} - HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`✗ ${test.name} - ${error.message}`);
    }
  }
}

testAPI();
```

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Verify Market Data API (port 5110) is accessible
- [ ] Check PostgreSQL database connection
- [ ] Ensure all 33 stock models are available
- [ ] Verify port 5113 is open for API
- [ ] Test all API endpoints

### Configuration
- [ ] Set correct DB_CONFIG (host, database, credentials)
- [ ] Configure MARKET_DATA_API base URL
- [ ] Set API_CONFIG (host, port)
- [ ] Verify model paths in CATEGORY_MODELS
- [ ] Check output directories exist

### Runtime
- [ ] Start system before 9:00 AM (or night before)
- [ ] Monitor logs for errors
- [ ] Verify predictions are being generated
- [ ] Check API responses
- [ ] Monitor system resources (RAM, CPU)

### Dashboard Integration
- [ ] API accessible from dashboard network
- [ ] CORS working correctly
- [ ] Dashboard can fetch predictions
- [ ] Real-time updates functioning
- [ ] Error handling implemented

---

## TROUBLESHOOTING

### Issue: API Returns Empty Predictions

**Check:**
```bash
# Check if system is running
curl http://your-server:5113/api/status

# Check prediction store
curl http://your-server:5113/api/predictions/latest
```

**Solutions:**
1. System may be starting up (wait 2-3 minutes)
2. Market not open yet (check time)
3. Check service logs for errors

### Issue: Predictions Not Updating

**Check:**
```bash
# Verify system status
curl http://your-server:5113/api/status | jq '.status'

# Check last update time
curl http://your-server:5113/api/status | jq '.last_update'
```

**Solutions:**
1. Check if market hours (9:15 AM - 3:30 PM)
2. Verify Market Data API is responding
3. Check system logs for errors
4. Restart prediction engine

### Issue: Slow API Responses

**Check:**
```bash
# Measure response time
time curl http://your-server:5113/api/predictions/latest
```

**Solutions:**
1. Use category endpoints instead of individual stocks
2. Implement caching in dashboard
3. Optimize database queries
4. Check network latency

### Issue: Missing Stock Data

**Check:**
```bash
# List available stocks
curl http://your-server:5113/api/stocks/list | jq '.stocks'

# Check specific stock
curl http://your-server:5113/api/predictions/stock/SBIN
```

**Solutions:**
1. Verify stock symbol is in ALL_STOCKS list
2. Check if model exists for stock's category
3. Ensure database has historical data
4. Check Market Data API for live data

---

## PERFORMANCE METRICS

| Metric | Expected Value | Notes |
|--------|---------------|-------|
| API Response Time | < 100ms | For latest predictions |
| Prediction Latency | 5-10 seconds | After market data arrives |
| Update Frequency | Every 15 minutes | During market hours |
| Predictions per Stock | 25-28/day | 9:15 AM - 3:15 PM |
| Total Predictions/Day | 825-924 | 33 stocks × 25-28 |
| Model Load Time | 2-5 seconds | Per category |
| Memory Usage | 2-4 GB | Peak during prediction |

---

## FAQ

**Q: How often are predictions updated?**  
A: Every 15 minutes during market hours (9:15 AM - 3:30 PM IST).

**Q: How far ahead do predictions go?**  
A: 5 timesteps (H1-H5), which is 75 minutes ahead (15 min × 5).

**Q: Can I get predictions outside market hours?**  
A: No predictions are generated outside 9:15 AM - 3:30 PM on trading days.

**Q: What's the difference between categories?**  
A: Each category (PSU, Private, Small banks) has a separate fine-tuned model optimized for those stocks.

**Q: How accurate are the predictions?**  
A: Check backtest reports for MAE, RMSE, and direction accuracy. Typically 50-70% direction accuracy.

**Q: Can I get historical predictions?**  
A: The API stores predictions for the current trading day. For historical data, you need to save predictions as they're generated.

**Q: What happens if Market Data API is down?**  
A: System falls back to database-only data. Live updates won't work but historical data predictions continue.

**Q: How do I know if data is stale?**  
A: Check the `timestamp` field in predictions. If > 20 minutes old during market hours, data may be stale.

**Q: Can I request specific time ranges?**  
A: Not directly via API. Fetch all predictions and filter client-side.

**Q: Is there a rate limit?**  
A: No explicit rate limit, but recommended max 1 request/second. Use batch endpoints to reduce requests.

---

## SUPPORT

### System Logs
```bash
# View live logs
tail -f live_predictions_YYYYMMDD/live.log

# Check for errors
grep ERROR live_predictions_YYYYMMDD/live.log
```

### Contact Points

**API Issues:**  
- Check /api/health endpoint
- Review system logs
- Contact: Backend Team

**Data Quality:**  
- Review backtest reports
- Check model performance metrics
- Contact: ML Team

**Integration Help:**  
- Refer to integration examples
- Test with provided code samples
- Contact: Backend Team

---

## APPENDIX

### A. Stock List

**PSU Banks (12):**
SBIN, BANKBARODA, PNB, CANBK, UNIONBANK, INDIANB, BANKINDIA, IOB, CENTRALBK, MAHABANK, PSB, UCOBANK

**Private Banks (10):**
HDFCBANK, ICICIBANK, AXISBANK, KOTAKBANK, INDUSINDBK, BANDHANBNK, RBLBANK, YESBANK, FEDERALBNK, IDFCFIRSTB

**Small Banks (21):**
IDBI, DHANBANK, CUB, KARURVYSYA, SOUTHBANK, J&KBANK, KTKBANK, DCBBANK, TMB, CSBBANK, NAINITAL, AUBANK, EQUITASBNK, UJJIVANSFB, UTKARSHBNK, SSFB, JSFB, ESAFSFB, NSFB, CAPITALSFB, FINOPB

### B. Time Intervals

| Horizon | Minutes Ahead | Example (from 9:15) |
|---------|---------------|---------------------|
| H1 | +15 | 9:30 |
| H2 | +30 | 9:45 |
| H3 | +45 | 10:00 |
| H4 | +60 | 10:15 |
| H5 | +75 | 10:30 |

### C. Output Files

**Live Mode:**
- `live_predictions_YYYYMMDD/plots/{SYMBOL}_YYYYMMDD.png`
- `live_predictions_YYYYMMDD/csv/{SYMBOL}_YYYYMMDD.csv`
- `live_predictions_YYYYMMDD/live.log`

**Backtest Mode:**
- `backtest_7days/plots/{SYMBOL}_YYYYMMDD.png` (one per day)
- `backtest_7days/csv/{SYMBOL}_7days.csv`

---

**END OF DOCUMENTATION**

*For updates and more information, contact the development team.*