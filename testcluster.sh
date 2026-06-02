# ── Service ──────────────────────────────────────────────────────────────────

curl -s http://localhost:8765/health | python3 -m json.tool

curl -s "http://localhost:8765/symbols?paa_width_min=15" | python3 -m json.tool
curl -s "http://localhost:8765/symbols?paa_width_min=9"  | python3 -m json.tool
curl -s "http://localhost:8765/symbols?paa_width_min=5"  | python3 -m json.tool
curl -s "http://localhost:8765/symbols?paa_width_min=3"  | python3 -m json.tool

# ── v3 Legacy ─────────────────────────────────────────────────────────────────

# Live — dashboard projection (default paa=15m)
curl -s "http://localhost:8765/overlay/RELIANCE" | python3 -m json.tool

# Live — full payload, explicit resolution
curl -s "http://localhost:8765/overlay/RELIANCE?full=true&paa_width_min=15" | python3 -m json.tool
curl -s "http://localhost:8765/overlay/RELIANCE?full=true&paa_width_min=9"  | python3 -m json.tool
curl -s "http://localhost:8765/overlay/RELIANCE?full=true&paa_width_min=5"  | python3 -m json.tool
curl -s "http://localhost:8765/overlay/RELIANCE?full=true&paa_width_min=3"  | python3 -m json.tool

# Historical date
curl -s "http://localhost:8765/overlay/RELIANCE?date=2026-03-24&paa_width_min=15" | python3 -m json.tool
curl -s "http://localhost:8765/overlay/RELIANCE?date=2026-03-24&paa_width_min=9"  | python3 -m json.tool

# With GTT
curl -s "http://localhost:8765/overlay/RELIANCE?date=2026-03-24&enable_gtt=true&paa_width_min=15" | python3 -m json.tool

# Cache bypass
curl -s "http://localhost:8765/overlay/RELIANCE?nocache=true&paa_width_min=15" | python3 -m json.tool

# Centroids
curl -s "http://localhost:8765/overlay/RELIANCE/centroids?date=2026-03-24&paa_width_min=15" | python3 -m json.tool
curl -s "http://localhost:8765/overlay/RELIANCE/centroids?date=2026-03-24&k=10&paa_width_min=9" | python3 -m json.tool

# Pattern curves
curl -s "http://localhost:8765/overlay/RELIANCE/pattern_curves?date=2026-03-24&paa_width_min=15" | python3 -m json.tool
curl -s "http://localhost:8765/overlay/RELIANCE/pattern_curves?date=2026-03-24&historical_limit=10&paa_width_min=9" | python3 -m json.tool

# ── v2 Two-stage ──────────────────────────────────────────────────────────────

# Live — dashboard projection
curl -s "http://localhost:8765/overlay/v2/RELIANCE?paa_width_min=15" | python3 -m json.tool
curl -s "http://localhost:8765/overlay/v2/RELIANCE?paa_width_min=9"  | python3 -m json.tool
curl -s "http://localhost:8765/overlay/v2/RELIANCE?paa_width_min=5"  | python3 -m json.tool
curl -s "http://localhost:8765/overlay/v2/RELIANCE?paa_width_min=3"  | python3 -m json.tool

# Historical — full payload
curl -s "http://localhost:8765/overlay/v2/RELIANCE?date=2026-03-24&full=true&paa_width_min=15" | python3 -m json.tool
curl -s "http://localhost:8765/overlay/v2/RELIANCE?date=2026-03-24&full=true&paa_width_min=9"  | python3 -m json.tool

# k-NN count and nearest toggle
curl -s "http://localhost:8765/overlay/v2/RELIANCE?date=2026-03-24&knn_k=20&paa_width_min=9"              | python3 -m json.tool
curl -s "http://localhost:8765/overlay/v2/RELIANCE?date=2026-03-24&include_nearest=false&paa_width_min=9" | python3 -m json.tool

# Nearest days standalone
curl -s "http://localhost:8765/overlay/v2/RELIANCE/nearest_days?date=2026-03-24&knn_k=10&paa_width_min=15" | python3 -m json.tool
curl -s "http://localhost:8765/overlay/v2/RELIANCE/nearest_days?date=2026-03-24&knn_k=10&paa_width_min=9"  | python3 -m json.tool

# Pattern curves
curl -s "http://localhost:8765/overlay/v2/RELIANCE/pattern_curves?date=2026-03-24&paa_width_min=15"                        | python3 -m json.tool
curl -s "http://localhost:8765/overlay/v2/RELIANCE/pattern_curves?date=2026-03-24&historical_limit=5&paa_width_min=9"      | python3 -m json.tool

# ── Error / boundary cases ────────────────────────────────────────────────────

# Invalid paa_width_min — expect HTTP 400
curl -sv "http://localhost:8765/overlay/RELIANCE?paa_width_min=7"         2>&1 | grep -E "< HTTP|detail"
curl -sv "http://localhost:8765/overlay/v2/RELIANCE?paa_width_min=30"     2>&1 | grep -E "< HTTP|detail"
curl -sv "http://localhost:8765/symbols?paa_width_min=1"                  2>&1 | grep -E "< HTTP|detail"

# Symbol not built for that resolution — expect HTTP 404
curl -sv "http://localhost:8765/overlay/FAKESYM?date=2026-03-24&paa_width_min=3" 2>&1 | grep -E "< HTTP|detail"

# ── Cross-resolution diff (same symbol, same date) ────────────────────────────

for paa in 15 9 5 3; do
  echo "=== paa_width_min=${paa}m ==="
  curl -s "http://localhost:8765/overlay/v2/RELIANCE?date=2026-03-24&full=true&paa_width_min=${paa}" \
    | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'error' in d:
    print('ERROR:', d['error'])
else:
    print('paa_segment_minutes:', d.get('paa_segment_minutes'))
    print('lock_word:', d.get('lock_word'), '|', d.get('lock_status'))
    print('low_match_confidence:', d.get('low_match_confidence'))
    for e in d.get('top3_final', []):
        p = e['profile']
        print(f\"  #{e['rank']}  {e['cluster']:<8}  score={e['score']:.4f}  \
cd={p.get('cluster_distance',0):.3f}  cos={p.get('cos_sim_signed',0):+.3f}  \
wr={p.get('win_rate',0):.2%}  ret={p.get('avg_return',0):+.4%}\")
"
done
 