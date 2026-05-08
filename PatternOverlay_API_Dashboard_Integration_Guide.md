# DAKSPHERE PRIVATE LIMITED
## PatternPool Overlay API
### Dashboard Integration Guide
*For dashboard team use only*

---

| **Base URL** | `http://<host>:8765` | **Poll Interval** | Every 15 min (IST) |
|---|---|---|---|
| **Auth** | None required | **Format** | JSON |
| **Market hours** | 09:15 – 15:30 IST, Mon – Fri | **Symbol** | Passed per call — no hardcoding |

---

## 1. System Overview

The PatternPool Overlay API identifies the top 3 intraday price-movement patterns for any NSE symbol each trading day. By 10:00am IST, the engine locks in a ranked shortlist of historical pattern clusters that best match how the live day is unfolding. The dashboard can then plot the expected intraday shape of each matched pattern alongside the live price curve.

**Key concepts the dashboard needs to understand:**

- **Pattern clusters —** each cluster (P0, P1 ... P14) represents a group of historical trading days with a similar intraday shape, characterised by a centroid curve, a confidence band, and performance statistics (win rate, average return, archetype).
- **Lock at 10:00am —** the Top-3 are finalised at W3 (the slot ending at 10:00 IST). They are frozen for the rest of the day. The dashboard should display these as the committed prediction.
- **Live evolution —** after lock, the engine continues scoring at each 15-minute slot. The current Top-3 may drift from the locked Top-3; the dashboard can show this drift as confirmation or divergence.
- **Symbol as argument —** the API holds no internal company list. Every call must pass the symbol. Never hardcode symbols on the dashboard side.

---

## 2. Endpoints

| **Endpoint** | **Method** | **Purpose** |
|---|---|---|
| `/health` | GET | Service status, IST clock, completed word-steps. Use on startup. |
| `/symbols` | GET | Lists all symbols with available pattern data on disk. |
| `/overlay/{symbol}` | GET | Main polling endpoint. Returns locked Top-3, live Top-3, step history. |
| `/overlay/{symbol}/pattern_curves` | GET | Plot-ready data: centroid curves, ±1σ bands, historical day curves, live progression. |
| `/overlay/{symbol}/centroids` | GET | PAA shape vector for the current scoring step. Lightweight scoring probe. |

---

### 2.1 /health

Call once on dashboard startup to confirm connectivity and check the current market slot.

```
GET /health

// Response
{
  "status": "ok",
  "server_time_ist": "2026-05-04 10:32:00 IST",
  "market_minute": 77,        // minutes elapsed since 09:15 open
  "completed_k": 5,           // W5 = slot ending 10:30 is complete
  "current_slot_end": "10:30",
  "first_scoring_k": 2,       // earliest valid live call = W2 (09:45)
  "lock_k": 3                 // Top-3 lock fires at W3 (10:00)
}
```

---

### 2.2 /symbols

Returns every symbol for which a pattern store exists on the server. Use this to populate symbol pickers or validate a symbol before making overlay calls.

```
GET /symbols

// Response
{ "count": 487, "symbols": ["ADANIGREEN", "APOLLOHOSP", ...] }
```

---

### 2.3 /overlay/{symbol} — Primary Polling Endpoint

This is the endpoint the dashboard calls every 15 minutes. It returns everything needed to render the pattern summary panel: lock state, frozen Top-3, live Top-3, and the full step history.

**Query Parameters**

| **Parameter** | **Type** | **Default** | **Description** |
|---|---|---|---|
| `date` | string | today | YYYY-MM-DD. Omit for live mode. Pass a past date for replay. |
| `full` | bool | false | Return the complete engine payload instead of the dashboard projection. |
| `nocache` | bool | false | Bypass result cache and recompute. Use sparingly. |
| `enable_gtt` | bool | false | Attach informational GTT directional overlay. Has zero effect on ranking. |

**Response — Dashboard Projection**

```
GET /overlay/ADANIGREEN

{
  "symbol": "ADANIGREEN",
  "date": "2026-05-04",
  "lock_status": "locked",    // "unlocked" | "tentative" | "locked"
  "lock_word": "W3",          // slot at which Top-3 was frozen

  "top3_locked": [            // FROZEN from W3 (10:00) — does not change
    { "rank":1, "cluster":"P4", "score":0.7786,
      "profile": { "win_rate":0.625, "avg_return":0.0103,
                   "sax_sim":0.412, "archetype":"Trending_Up", ... } },
    { "rank":2, "cluster":"P0", ... },
    { "rank":3, "cluster":"P3", ... }
  ],

  "current_step": "W8",       // latest completed word step
  "current_slot": "11:15",    // slot-end time of current_step
  "current_volatile": false,

  "current_top3": [           // LIVE — updates every poll
    { "rank":1, "cluster":"P4", "score":0.8339, ... },
    ...
  ],

  "step_evolution": [         // history of every slot from W1 to now
    { "word_step":"W1", "slot_end":"09:30", "volatile":true, "top3":[...] },
    { "word_step":"W2", "slot_end":"09:45", "volatile":false, "top3":[...] },
    ...
  ],

  "gtt": { "enabled":false, "available":false, ... }
}
```

> **`lock_status` values:**
> - **`unlocked`** — before W2 (09:45). No committed result yet.
> - **`tentative`** — W2 complete, lock window not yet reached.
> - **`locked`** — W3 (10:00) fired. Top-3 is frozen for the day.

**`profile` fields inside `top3_locked` / `current_top3`**

| **Field** | **Type** | **Description** |
|---|---|---|
| `win_rate` | float | Historical win rate of the cluster (0–1). E.g. 0.6250 = 62.5% |
| `avg_return` | float | Mean end-of-day return for days in this cluster. E.g. 0.0103 = +1.03% |
| `sax_sim` | float | Cosine similarity between today's live shape and the cluster centroid at the current scoring step (0–1). Higher = stronger shape match. |
| `archetype` | string | Pattern type label, e.g. `Trending_Up`, `Volatile`, `Mean_Reverting`. |
| `day_count` | int | Number of historical days assigned to this cluster. |
| `intra_sim` | float | Intra-cluster shape similarity. Higher = tighter, more consistent pattern. |
| `risk_adj_ret` | float | Risk-adjusted return (return / volatility) for the cluster. |
| `recurrence` | float | How frequently this pattern recurs across the historical window. |
| `persistence` | float | Tendency of the pattern direction to hold through the day. |
| `is_noise` | bool | True if this cluster is a noise/residual group. Its score is penalised. |

---

### 2.4 /overlay/{symbol}/pattern_curves — Chart Data Endpoint

Returns everything needed to plot intraday pattern curves on a chart. Call this alongside the primary polling endpoint to update the pattern overlay panel.

**Query Parameters**

| **Parameter** | **Type** | **Default** | **Description** |
|---|---|---|---|
| `date` | string | today | YYYY-MM-DD for replay. Omit for live. |
| `historical_limit` | int | 20 | Max historical days returned per pattern (0–200). 0 returns centroids + bands only (smallest payload). |
| `enable_gtt` | bool | false | Attach informational GTT block. No effect on curves or ranking. |

**Response**

```
GET /overlay/ADANIGREEN/pattern_curves?date=2026-05-04&historical_limit=20

{
  "symbol": "ADANIGREEN",
  "date": "2026-05-04",
  "lock_word": "W3",
  "lock_status": "locked",

  "time_axis": ["09:30","09:45","10:00",...,"15:30"],  // 25 fixed slot-end times

  "live_curve": {
    "completed_k": 8,                // W8 complete = 8 slots done
    "current_slot": "11:15",
    "paa_normalized": [-1.2, -0.9, ...],  // length = completed_k (z-score)
    "cum_return": [-0.002,-0.005,...]      // length = completed_k (fractional)
  },

  "patterns": [
    {
      "rank": 1,
      "cluster": "P4",
      "score": 0.7786,
      "centroid": [-1.41,-1.48,...,1.27],    // 25 values — full-day shape
      "band_upper": [-1.23,-1.30,...,1.41],  // centroid + 1σ
      "band_lower": [-1.55,-1.67,...,1.10],  // centroid − 1σ
      "n_historical": 46,                    // total days in cluster
      "historical_days": [                   // most-recent first
        { "date":"2025-12-12", "curve":[-1.35,...,1.03] },
        { "date":"2025-12-11", "curve":[-1.42,...,1.19] },
        ...
      ],
      "meta": { "win_rate":0.625, "avg_return":0.0103, ... }
    },
    { "rank":2, "cluster":"P0", ... },
    { "rank":3, "cluster":"P3", ... }
  ]
}
```

> **Note on `n_historical` confidence:** Clusters with fewer historical days produce wider, less reliable bands. Display `n_historical` alongside the chart (e.g. `P0 · 2014 · 16 days`). A cluster with 16 days has a materially wider band than one with 67 days.

---

### 2.5 /overlay/{symbol}/centroids

Returns the PAA shape vector for the current scoring step for each top-3 cluster. Lighter than `/pattern_curves` — use when you only need the current-step shape probe, not the full-day curves.

```
GET /overlay/ADANIGREEN/centroids?date=2026-05-04&k=8

{
  "symbol": "ADANIGREEN", "date": "2026-05-04",
  "current_slot": "11:15", "k": 8,
  "centroids": [
    { "cluster":"P4", "rank":1, "score":0.7786,
      "centroid_paa": [-1.41,-1.48,-1.36,-1.30,-1.06,-0.94,-0.76,-0.49],
      "meta": { ... } },
    ...
  ]
}
```

---

## 3. Live Mode — 15-Minute Poll

In live mode, no `date` parameter is passed. The API operates against today's data. The dashboard should poll every 15 minutes from 09:45 to 15:30 IST on trading days.

### 3.1 Polling Schedule

| **Time (IST)** | **lock_status** | **Dashboard action** |
|---|---|---|
| **Before 09:45** | — | HTTP 425 returned. Do not poll. Show "Waiting for first slot" state. |
| **09:45** | `tentative` | First valid response. W2 complete. Top-3 shown as tentative. |
| **10:00** | `locked` | Top-3 frozen. Lock confirmed. Display locked patterns prominently. |
| **10:15 – 15:30** | `locked` | `top3_locked` unchanged. `current_top3` evolves. Show drift indicator. |

---

### 3.2 Recommended Poll Sequence

```javascript
// Call both endpoints in the same 15-min tick

// 1. Overlay — pattern summary + lock state
GET /overlay/{SYMBOL}

// 2. Curves — chart data (pass historical_limit=0 if you only need centroid + band)
GET /overlay/{SYMBOL}/pattern_curves?historical_limit=5
```

---

### 3.3 Drift Detection

After 10:00, compare `top3_locked` to `current_top3`. If the cluster order changes, the live day is diverging from the locked prediction. Surface this to the trader.

```javascript
// Pseudo-code drift check
locked_clusters  = top3_locked.map(e => e.cluster)   // ['P4','P0','P3']
current_clusters = current_top3.map(e => e.cluster)  // ['P4','P3','P0']

drift = JSON.stringify(locked_clusters) !== JSON.stringify(current_clusters)
```

---

## 4. Replay / Playback Mode

Pass a `?date=YYYY-MM-DD` parameter to any endpoint to replay a past trading day. The API returns a fully-computed result against the historical live data for that date. All locking and scoring logic runs identically to live mode.

### 4.1 Usage

```
// Replay a past date
GET /overlay/ADANIGREEN?date=2026-04-08
GET /overlay/ADANIGREEN/pattern_curves?date=2026-04-08&historical_limit=20

// Replay response is structurally identical to live — same fields, same types.
// lock_status will always be 'locked' (full day data available).
// step_evolution contains all 25 word steps (W1 – W25).
```

---

### 4.2 Differences vs Live

| | **Live mode** | **Replay mode** |
|---|---|---|
| **`date` param** | Omitted | Required: `?date=YYYY-MM-DD` |
| **Pre-09:45 guard** | HTTP 425 | No guard — full day always available |
| **`lock_status`** | Changes over day | Always `locked` |
| **`step_evolution`** | Grows each poll | Always all 25 steps |
| **`live_curve` (curves)** | Partial (k=2..25) | Complete (k=25 = full day) |
| **Result cache** | Cached per slot | Not cached — recomputed each call |

---

## 5. Visualisation Guide

### 5.1 Pattern Summary Panel (from `/overlay`)

- **Header:** Symbol + date + lock state badge (`UNLOCKED` / `TENTATIVE` / `LOCKED`) + `lock_word`.
- **Locked Top-3 cards:** one card per cluster. Show cluster label, rank, archetype, win rate, avg return, score bar.
- **Drift indicator:** after 10:00, show whether `current_top3` cluster order matches `top3_locked`. A mismatch is a drift alert.
- **Step evolution mini-chart:** use `step_evolution` to render a small sparkline or table of how Top-1 changed across word steps.
- **`current_step` / `current_slot`:** show the latest slot the engine has scored (e.g. W8 — 11:15).

---

### 5.2 Pattern Curve Panel (from `/pattern_curves`)

- **X-axis:** use `time_axis` — always 25 points from 09:30 to 15:30.
- **Y-axis:** z-score-normalised cumulative return. Label as *normalised return*.
- **Centroid line:** plot `centroid` for each of the 3 patterns as a solid line.
- **Confidence band:** fill the region between `band_upper` and `band_lower`. Use low opacity (10–20%). Show `n_historical` as a tooltip — thinner bands from few days should be visually distinguished.
- **Historical day curves:** plot `historical_days[*].curve` as faint lines behind the centroid. 5–10 days is enough to show spread without clutter.
- **Live curve:** overlay `live_curve.cum_return` on the same axis (raw fractional return). It will only cover the completed portion of the day (`completed_k` points). Extend as the day progresses.
- **Live cursor:** draw a vertical line at `current_slot` to mark how far the live day has progressed.

> **Y-axis note:** The centroid, band, and historical curves are z-score normalised — dimensionless. The live `cum_return` is raw fractional (e.g. +0.012 = +1.2%). Both can be plotted on the same axis since z-score normalisation centres them similarly, but label the axis clearly or use separate y-scales if the ranges diverge significantly.

---

### 5.3 Payload Size Reference

| **Call** | **Approx size** | **Recommended use** |
|---|---|---|
| `/overlay/{symbol}` | **2–4 KB** | Every 15-min poll |
| `/pattern_curves?historical_limit=0` | **~8 KB** | Centroid + band only. First render. |
| `/pattern_curves?historical_limit=5` | **~16 KB** | Standard polling with recent history |
| `/pattern_curves?historical_limit=20` (default) | **~30 KB** | Full chart with historical fan |
| `/pattern_curves?historical_limit=200` | **up to 60 KB** | Deep history. Use sparingly. |

---

## 6. Error Handling

| **HTTP** | **`error` field** | **Cause and dashboard action** |
|---|---|---|
| **425** | `market_open_<30_min...` | Called in live mode before W2 (09:45). Suppress the call. Show "Waiting for first slot" state. |
| **425** | `no_scoring_step_available_yet` | Only W1 (volatile open) has completed. No meaningful prediction yet. Same treatment as above. |
| **425** | `insufficient_live_data` | Live data file missing or truncated for that day. Show "No data" state. |
| **404** | *(detail string)* | Symbol has no pattern store on the server. Check `/symbols` first. |
| **503** | *(detail string)* | Engine failed to initialise. Log and retry after next poll interval. |

> **425 is not an error:** HTTP 425 ("Too Early") is a normal market-hours state, not a failure. Suppress the call silently before 09:45 IST and show a waiting indicator. Do not surface it as an error to the trader.

---

## 7. Quick Reference

### 7.1 Minimum Integration — Two Calls Per Poll

```javascript
// Every 15 minutes, 09:45 – 15:30 IST
const SYMBOL = '<from dashboard UI>';  // never hardcode

// Call 1 — pattern summary
fetch(`/overlay/${SYMBOL}`)
  .then(r => r.json())
  .then(data => {
    renderLockBadge(data.lock_status, data.lock_word);
    renderTop3Locked(data.top3_locked);
    renderCurrentTop3(data.current_top3);
    renderDriftAlert(data.top3_locked, data.current_top3);
  });

// Call 2 — chart data
fetch(`/overlay/${SYMBOL}/pattern_curves?historical_limit=5`)
  .then(r => r.json())
  .then(data => {
    renderPatternCurves(
      data.time_axis,
      data.patterns,    // centroid, band_upper, band_lower, historical_days
      data.live_curve   // cum_return + completed_k
    );
  });
```

---

### 7.2 Replay — One Call, Any Past Date

```javascript
// Replay — pass ?date=
fetch(`/overlay/${SYMBOL}?date=2026-04-08`)
fetch(`/overlay/${SYMBOL}/pattern_curves?date=2026-04-08&historical_limit=20`)

// Response structure is identical to live mode.
```

---

### 7.3 Response Field Cheat Sheet

| **Field** | **Endpoint** | **Use for** |
|---|---|---|
| `lock_status` | `/overlay` | Lock state badge: `unlocked` / `tentative` / `locked` |
| `lock_word` | `/overlay` | Label: "Locked at W3 (10:00)" |
| `top3_locked` | `/overlay` | Committed Top-3 — render prominently, do not change after lock |
| `current_top3` | `/overlay` | Live Top-3 — update every poll, compare to `top3_locked` for drift |
| `step_evolution` | `/overlay` | Step-by-step history sparkline / table |
| `time_axis` | `/pattern_curves` | X-axis labels for all pattern charts |
| `live_curve.cum_return` | `/pattern_curves` | Live price line on chart (fractional return, partial day) |
| `patterns[].centroid` | `/pattern_curves` | Expected full-day shape for each top pattern |
| `patterns[].band_upper/lower` | `/pattern_curves` | Confidence band fill (±1σ) |
| `patterns[].historical_days` | `/pattern_curves` | Historical instances — faint background lines |
| `patterns[].n_historical` | `/pattern_curves` | Show as confidence indicator (more days = tighter band) |

---

*DAKSPHERE PRIVATE LIMITED — INTERNAL — NOT FOR DISTRIBUTION*
