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
    # **NEW**: Add fetch_all_data argument
    parser.add_argument('--fetch_all_data', type=str, default='false',
                       choices=['true', 'false'],
                       help='Fetch all available data for the company (ignores date range)')
    
    args = parser.parse_args()
    
    # Convert boolean strings
    first_fifteen_minutes = args.first_fifteen_minutes.lower() == 'true'
    fetch_all_data = args.fetch_all_data.lower() == 'true'
    
    # **MODIFIED**: Handle date parsing based on fetch_all_data flag
    if fetch_all_data:
        # When fetching all data, we'll determine the date range from the database
        start_date = None
        end_date = None
        print(f"Fetching all available data for company_id={args.company_id}", file=sys.stderr)
    else:
        # Parse and convert dates normally
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
    
    # Database connection parameters
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

        # **MODIFIED**: Build query based on fetch_all_data flag
        if fetch_all_data:
            # Query to fetch ALL data for the company
            query = """
            SELECT timestamp, open, high, low, close, volume
            FROM company_data
            WHERE company_id = %s
            ORDER BY timestamp
            """
            query_params = (args.company_id,)
            print(f"Querying ALL data for company_id={args.company_id}", file=sys.stderr)
        else:
            # Query to fetch data within date range
            query = """
            SELECT timestamp, open, high, low, close, volume
            FROM company_data
            WHERE company_id = %s
            AND timestamp >= %s
            AND timestamp < %s
            ORDER BY timestamp
            """
            query_params = (args.company_id, start_date, end_date)
            print(f"Querying data for company_id={args.company_id}, start_date={start_date}, end_date={end_date}", file=sys.stderr)
        
        cur.execute(query, query_params)

        # Fetch all rows
        rows = cur.fetchall()
        if not rows:
            if fetch_all_data:
                print(f"No data found for company_id = {args.company_id}.", file=sys.stderr)
            else:
                print(f"No data found for company_id = {args.company_id} in the specified date range.", file=sys.stderr)
            sys.exit(0)

        # **NEW**: If fetching all data, optionally limit to recent data to avoid overwhelming the frontend
        if fetch_all_data and len(rows) > 10000:  # Limit to last 10k records for performance
            print(f"Large dataset detected ({len(rows)} records). Limiting to most recent 10,000 records.", file=sys.stderr)
            rows = rows[-10000:]

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

        # **NEW**: Apply first_fifteen_minutes filter after aggregation if needed
        if first_fifteen_minutes and fetch_all_data:
            # Filter results to only include first 15 minutes of each trading day
            filtered_results = []
            for result in results:
                timestamp = result['interval_start']
                # Check if this timestamp is within first 15 minutes (9:15 AM to 9:30 AM IST)
                if timestamp.hour == 9 and 15 <= timestamp.minute <= 30:
                    filtered_results.append(result)
            results = filtered_results
            print(f"Filtered to first 15 minutes: {len(results)} data points", file=sys.stderr)

        # Output results in the format expected by the backend
        for result in results:
            print(f"Interval:{result['interval_start'].isoformat()},Open:{result['open']},High:{result['high']},Low:{result['low']},Close:{result['close']},Volume:{result['volume']}")
        
        # Log success message to stderr
        if fetch_all_data:
            print(f"Successfully fetched ALL available data: {len(results)} data points", file=sys.stderr)
        else:
            print(f"Successfully fetched {len(results)} data points for date range", file=sys.stderr)

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
