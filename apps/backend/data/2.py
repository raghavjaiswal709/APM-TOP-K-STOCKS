
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

db_params = {
    'dbname': 'temp_db',
    'user': 'temp_raghav',
    'password': 'password',
    'host': '100.93.172.21',
    'port': '5432'
}


try:
    conn = psycopg2.connect(**db_params)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SET TIME ZONE 'Asia/Kolkata';")

    query = """
    SELECT timestamp, open, high, low, close, volume
    FROM company_data
    WHERE company_id = %s
    AND timestamp >= %s
    AND timestamp < %s
    ORDER BY timestamp
    """
    cur.execute(query, (2, '2024-02-22 00:00:00', '2024-04-16 00:00:00'))

    rows = cur.fetchall()
    if not rows:
        print("No data found for company_id = 2 in the specified date range.")
        exit()

    def get_interval_start(dt):
        minute = dt.minute
        interval_minute = (minute // 10) * 10  # Floor to nearest 10
        return dt.replace(minute=interval_minute, second=0, microsecond=0)

    interval_data = {}
    for row in rows:
        interval_start = get_interval_start(row['timestamp'])
        if interval_start not in interval_data:
            interval_data[interval_start] = []
        interval_data[interval_start].append(row)

    results = []
    for interval_start in sorted(interval_data.keys()):
        rows = interval_data[interval_start]
        if rows:
            open_price = rows[0]['open']               # First open
            high_price = max(row['high'] for row in rows)  # Max high
            low_price = min(row['low'] for row in rows)    # Min low
            close_price = rows[-1]['close']            # Last close
            volume_sum = sum(row['volume'] for row in rows)  # Sum volume
            results.append({
                'interval_start': interval_start,
                'open': open_price,
                'high': high_price,
                'low': low_price,
                'close': close_price,
                'volume': volume_sum
            })

    for result in results:
        print(f"Interval: {result['interval_start']}, "
              f"Open: {result['open']}, High: {result['high']}, "
              f"Low: {result['low']}, Close: {result['close']}, "
              f"Volume: {result['volume']}")

except psycopg2.Error as e:
    print(f"Database error: {e}")

finally:
    # Clean up
    if 'cur' in locals():
        cur.close()
    if 'conn' in locals():
        conn.close()