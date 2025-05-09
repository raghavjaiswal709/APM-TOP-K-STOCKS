import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import argparse
import sys

def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Fetch and aggregate stock data.')
    parser.add_argument('--company_id', type=int, default=2, help='Company ID to fetch data for')
    parser.add_argument('--start_date', type=str, default='2024-02-22 00:00:00', help='Start date and time (YYYY-MM-DD HH:MM:SS)')
    parser.add_argument('--end_date', type=str, default='2024-04-16 00:00:00', help='End date and time (YYYY-MM-DD HH:MM:SS)')
    parser.add_argument('--interval', type=str, default='10m', help='Interval for aggregation (e.g., 1m, 5m, 10m, 15m, 30m, 1h)')
    
    args = parser.parse_args()
    
    # Convert interval string to minutes
    interval_map = {
        '1m': 1,
        '5m': 5,
        '10m': 10,
        '15m': 15,
        '30m': 30,
        '1h': 60
    }
    
    interval_minutes = interval_map.get(args.interval, 10)  # Default to 10 minutes
    
    # Database connection parameters (update these as needed)
    db_params = {
        'dbname': 'temp_db',
        'user': 'temp_raghav',
        'password': 'password',
        'host': '100.93.172.21',
        'port': '5432',
        'options=':'no-gssapi'

    }

    try:
        # Connect to the database
        conn = psycopg2.connect(**db_params)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Set timezone to IST
        cur.execute("SET TIME ZONE 'Asia/Kolkata';")

        # Query to fetch minute-wise data
        query = """
        SELECT timestamp, open, high, low, close, volume
        FROM company_data
        WHERE company_id = %s
        AND timestamp >= %s
        AND timestamp < %s
        ORDER BY timestamp
        """
        cur.execute(query, (args.company_id, args.start_date, args.end_date))

        # Fetch all rows
        rows = cur.fetchall()
        if not rows:
            print(f"No data found for company_id = {args.company_id} in the specified date range.")
            sys.exit(0)

        # Function to get the start of an interval
        def get_interval_start(dt):
            minute = dt.minute
            interval_minute = (minute // interval_minutes) * interval_minutes  # Floor to nearest interval
            return dt.replace(minute=interval_minute, second=0, microsecond=0)

        # Group rows by intervals
        interval_data = {}
        for row in rows:
            interval_start = get_interval_start(row['timestamp'])
            if interval_start not in interval_data:
                interval_data[interval_start] = []
            interval_data[interval_start].append(row)

        # Compute OHLCV aggregates for each interval
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

        # Display results (or use a DataFrame for further analysis)
        for result in results:
            print(f"Interval: {result['interval_start']}, "
                f"Open: {result['open']}, High: {result['high']}, "
                f"Low: {result['low']}, Close: {result['close']}, "
                f"Volume: {result['volume']}")

    except psycopg2.Error as e:
        print(f"Database error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        # Clean up
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    main()
