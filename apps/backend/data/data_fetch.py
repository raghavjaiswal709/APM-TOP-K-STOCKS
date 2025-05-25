import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import argparse
import sys

def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Fetch and aggregate stock data.')
    parser.add_argument('--company_id', type=int, default=2, help='Company ID to fetch data for')
    parser.add_argument('--start_date', type=str, default='2024-02-22 00:00:00', help='Start date and time (ISO format or YYYY-MM-DD HH:MM:SS)')
    parser.add_argument('--end_date', type=str, default='2024-04-16 00:00:00', help='End date and time (ISO format or YYYY-MM-DD HH:MM:SS)')
    parser.add_argument('--interval', type=str, default='10m', help='Interval for aggregation (e.g., 1m, 5m, 10m, 15m, 30m, 1h)')
    parser.add_argument('--first_fifteen_minutes', type=str, default='false', 
                       choices=['true', 'false'],
                       help='Filter to first 15 minutes of trading day')
    
    args = parser.parse_args()
    
    # Convert first_fifteen_minutes string to boolean
    first_fifteen_minutes = args.first_fifteen_minutes.lower() == 'true'
    
    # Parse and convert dates
    try:
        start_date = parse_date_string(args.start_date)
        end_date = parse_date_string(args.end_date)
        
        # Adjust dates for first 15 minutes if needed
        if first_fifteen_minutes:
            start_date, end_date = adjust_for_first_fifteen_minutes(start_date, end_date)
            
    except ValueError as e:
        print(f"Date parsing error: {e}", file=sys.stderr)
        sys.exit(1)
    
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
    # db_params = {
    #     'dbname': 'temp_db',
    #     'user': 'temp_raghav',
    #     'password': 'password',
    #     'host': '100.93.172.21',
    #     'port': '5432',
    # }
    
    db_params = {
        'dbname': 'company_hist_db',
         'user': 'readonly_user',
         'password': 'db_read_5432',
         'host': '100.93.172.21',
         'port': '5432',
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
        
        # Log the query parameters for debugging
        print(f"Querying data for company_id={args.company_id}, start_date={start_date}, end_date={end_date}", file=sys.stderr)
        
        cur.execute(query, (args.company_id, start_date, end_date))

        # Fetch all rows
        rows = cur.fetchall()
        if not rows:
            print(f"No data found for company_id = {args.company_id} in the specified date range.", file=sys.stderr)
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

        # Output results in the format expected by the backend
        for result in results:
            print(f"Interval:{result['interval_start'].isoformat()},Open:{result['open']},High:{result['high']},Low:{result['low']},Close:{result['close']},Volume:{result['volume']}")
        
        # Log success message to stderr
        print(f"Successfully fetched {len(results)} data points", file=sys.stderr)

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

def parse_date_string(date_str):
    """Parse date string in various formats"""
    try:
        # Try ISO format first (from backend)
        if 'T' in date_str:
            # Handle ISO format with or without 'Z'
            if date_str.endswith('Z'):
                date_str = date_str[:-1] + '+00:00'
            return datetime.fromisoformat(date_str)
        else:
            # Handle simple format (YYYY-MM-DD HH:MM:SS)
            return datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
    except ValueError:
        # Try other common formats
        formats = [
            '%Y-%m-%d',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%S.%f',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        raise ValueError(f"Unable to parse date string: {date_str}")

def adjust_for_first_fifteen_minutes(start_date, end_date):
    """Adjust dates for first 15 minutes of trading day"""
    # Convert UTC to IST if needed
    if start_date.tzinfo is not None:
        # Convert to IST (UTC+5:30)
        ist_offset = timedelta(hours=5, minutes=30)
        start_date = start_date.replace(tzinfo=None) + ist_offset
    
    # Set to market opening time (9:15 AM IST)
    market_start = start_date.replace(hour=9, minute=15, second=0, microsecond=0)
    market_end = market_start + timedelta(minutes=375)
    
    print(f"Adjusted for first 15 minutes: {market_start} to {market_end}", file=sys.stderr)
    
    return market_start, market_end

if __name__ == "__main__":
    main()
