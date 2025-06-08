import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import argparse
import sys
import json
import time
import logging

# Configure logging with proper levels
logging.basicConfig(
    level=logging.INFO,
    format='INFO: %(message)s',
    stream=sys.stderr
)

logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description='Fetch and aggregate stock data.')
    parser.add_argument('--company_code', type=str, required=True, help='Company code to fetch data for')
    parser.add_argument('--exchange', type=str, default='NSE,BSE', help='Exchange filter (NSE, BSE, or NSE,BSE)')
    parser.add_argument('--start_date', type=str, default='2024-02-22 00:00:00', help='Start date and time (ISO format or YYYY-MM-DD HH:MM:SS)')
    parser.add_argument('--end_date', type=str, default='2024-04-16 00:00:00', help='End date and time (ISO format or YYYY-MM-DD HH:MM:SS)')
    parser.add_argument('--interval', type=str, default='10m', help='Interval for aggregation (e.g., 1m, 5m, 10m, 15m, 30m, 1h)')
    parser.add_argument('--first_fifteen_minutes', type=str, default='false', 
                       choices=['true', 'false'],
                       help='Filter to first 15 minutes of trading day')
    parser.add_argument('--fetch_all_data', type=str, default='false',
                       choices=['true', 'false'],
                       help='Fetch all available data for the company (ignores date range)')
    
    # Enhanced arguments for the new StockService
    parser.add_argument('--limit', type=int, default=10000, help='Maximum number of records to return')
    parser.add_argument('--enable_cache', type=str, default='false', 
                       choices=['true', 'false'],
                       help='Enable caching (future feature)')
    parser.add_argument('--compression', type=str, default='false',
                       choices=['true', 'false'], 
                       help='Enable compression (future feature)')
    parser.add_argument('--validate_data', type=str, default='true',
                       choices=['true', 'false'],
                       help='Enable data validation')
    parser.add_argument('--optimize_for_range', type=str, default='false',
                       choices=['true', 'false'],
                       help='Optimize query for date range requests')
    parser.add_argument('--buffer_minutes', type=int, default=30,
                       help='Buffer minutes to add around date range')
    parser.add_argument('--indicators', type=str, default='',
                       help='Comma-separated list of indicators (future feature)')
    parser.add_argument('--parallel_processing', type=str, default='false',
                       choices=['true', 'false'],
                       help='Enable parallel processing (future feature)')
    
    args = parser.parse_args()
    
    # Parse boolean arguments
    first_fifteen_minutes = args.first_fifteen_minutes.lower() == 'true'
    fetch_all_data = args.fetch_all_data.lower() == 'true'
    enable_cache = args.enable_cache.lower() == 'true'
    compression = args.compression.lower() == 'true'
    validate_data = args.validate_data.lower() == 'true'
    optimize_for_range = args.optimize_for_range.lower() == 'true'
    parallel_processing = args.parallel_processing.lower() == 'true'
    
    # Parse indicators
    indicators = [ind.strip() for ind in args.indicators.split(',') if ind.strip()] if args.indicators else []
    
    if fetch_all_data:
        start_date = None
        end_date = None
        logger.info(f"Fetching all available data for company_code={args.company_code} on exchanges={args.exchange} (limit={args.limit})")
    else:
        try:
            start_date = parse_date_string(args.start_date)
            end_date = parse_date_string(args.end_date)
            
            # Apply buffer for range optimization
            if optimize_for_range and args.buffer_minutes > 0:
                buffer_delta = timedelta(minutes=args.buffer_minutes)
                start_date = start_date - buffer_delta
                end_date = end_date + buffer_delta
                logger.info(f"Applied {args.buffer_minutes}min buffer: {start_date} to {end_date}")
            
            if first_fifteen_minutes:
                start_date, end_date = adjust_for_first_fifteen_minutes(start_date, end_date)
                
        except ValueError as e:
            logger.error(f"Date parsing error: {e}")
            sys.exit(1)
    
    # Interval mapping with enhanced support
    interval_map = {
        '1m': 1,
        '5m': 5,
        '10m': 10,
        '15m': 15,
        '30m': 30,
        '1h': 60,
        '2h': 120,
        '4h': 240,
        '1d': 1440
    }
    
    interval_minutes = interval_map.get(args.interval, 10)
    
    # Database connection parameters
    db_params = {
        'dbname': 'company_hist_db',
        'user': 'readonly_user',
        'password': 'db_read_5432',
        'host': '100.93.172.21',
        'port': '5432',
    }

    start_time = time.time()
    
    try:
        # Connect to database with improved error handling
        try:
            conn = psycopg2.connect(**db_params)
            cur = conn.cursor(cursor_factory=RealDictCursor)
        except psycopg2.Error as e:
            logger.error(f"Database connection failed: {e}")
            sys.exit(1)

        # Set timezone
        cur.execute("SET TIME ZONE 'Asia/Kolkata';")

        # Parse exchanges
        exchanges = [ex.strip() for ex in args.exchange.split(',') if ex.strip()]
        exchange_placeholders = ','.join(['%s'] * len(exchanges))

        # Company lookup with enhanced error handling
        company_lookup_query = f"""
        SELECT company_id, company_code, name, exchange
        FROM companies
        WHERE company_code = %s
        AND exchange IN ({exchange_placeholders})
        """
        
        company_params = [args.company_code] + exchanges
        logger.info(f"Looking up company: {args.company_code} on exchanges: {args.exchange}")
        
        cur.execute(company_lookup_query, company_params)
        company_records = cur.fetchall()
        
        if not company_records:
            logger.error(f"No company found with code '{args.company_code}' on exchanges {args.exchange}")
            sys.exit(1)
        
        company_ids = [record['company_id'] for record in company_records]
        company_id_placeholders = ','.join(['%s'] * len(company_ids))
        
        logger.info(f"Found {len(company_records)} company records")
        for record in company_records:
            logger.info(f"  - {record['company_code']} ({record['name']}) on {record['exchange']} [ID: {record['company_id']}]")

        # Build optimized query based on request type
        if fetch_all_data:
            if optimize_for_range:
                # Optimized query for large datasets
                stock_data_query = f"""
                SELECT timestamp, open, high, low, close, volume, company_id
                FROM company_data
                WHERE company_id IN ({company_id_placeholders})
                ORDER BY timestamp DESC
                LIMIT %s
                """
                query_params = company_ids + [args.limit]
                logger.info(f"Querying RECENT {args.limit} records for company_ids: {company_ids}")
            else:
                stock_data_query = f"""
                SELECT timestamp, open, high, low, close, volume, company_id
                FROM company_data
                WHERE company_id IN ({company_id_placeholders})
                ORDER BY timestamp
                """
                query_params = company_ids
                logger.info(f"Querying ALL stock data for company_ids: {company_ids}")
        else:
            if optimize_for_range:
                # Optimized range query with indexes
                stock_data_query = f"""
                SELECT timestamp, open, high, low, close, volume, company_id
                FROM company_data
                WHERE company_id IN ({company_id_placeholders})
                AND timestamp >= %s
                AND timestamp < %s
                ORDER BY timestamp
                LIMIT %s
                """
                query_params = company_ids + [start_date, end_date, args.limit]
            else:
                stock_data_query = f"""
                SELECT timestamp, open, high, low, close, volume, company_id
                FROM company_data
                WHERE company_id IN ({company_id_placeholders})
                AND timestamp >= %s
                AND timestamp < %s
                ORDER BY timestamp
                """
                query_params = company_ids + [start_date, end_date]
            
            logger.info(f"Querying stock data for company_ids: {company_ids}, date range: {start_date} to {end_date}")
        
        # Execute query with timing
        query_start = time.time()
        cur.execute(stock_data_query, query_params)
        rows = cur.fetchall()
        query_time = time.time() - query_start
        
        logger.info(f"Query executed in {query_time:.2f}s, fetched {len(rows)} raw records")
        
        if not rows:
            if fetch_all_data:
                logger.info(f"No stock data found for company_code='{args.company_code}' on exchanges={args.exchange}")
            else:
                logger.info(f"No stock data found for company_code='{args.company_code}' on exchanges={args.exchange} in date range {start_date} to {end_date}")
            sys.exit(0)

        # Apply limit for all data requests (if not already limited in query)
        if fetch_all_data and not optimize_for_range and len(rows) > args.limit:
            logger.info(f"Large dataset detected ({len(rows)} records). Limiting to most recent {args.limit} records.")
            rows = rows[-args.limit:]

        # Data aggregation with enhanced error handling
        def get_interval_start(dt):
            minute = dt.minute
            interval_minute = (minute // interval_minutes) * interval_minutes
            return dt.replace(minute=interval_minute, second=0, microsecond=0)

        # Process data into intervals
        processing_start = time.time()
        interval_data = {}
        invalid_records = 0
        
        for row in rows:
            # Data validation if enabled
            if validate_data:
                if not validate_ohlcv_data(row):
                    invalid_records += 1
                    continue
            
            interval_start = get_interval_start(row['timestamp'])
            if interval_start not in interval_data:
                interval_data[interval_start] = []
            interval_data[interval_start].append(row)

        if invalid_records > 0:
            logging.warning(f"Skipped {invalid_records} invalid records during validation")

        # Aggregate intervals
        results = []
        for interval_start in sorted(interval_data.keys()):
            interval_rows = interval_data[interval_start]
            if interval_rows:
                interval_rows.sort(key=lambda x: x['timestamp'])
                
                try:
                    open_price = float(interval_rows[0]['open'])
                    high_price = max(float(row['high']) for row in interval_rows)
                    low_price = min(float(row['low']) for row in interval_rows)
                    close_price = float(interval_rows[-1]['close'])
                    volume_sum = sum(int(row['volume']) for row in interval_rows)
                    
                    # Additional validation for aggregated data
                    if validate_data and not validate_aggregated_ohlc(open_price, high_price, low_price, close_price):
                        logging.warning(f"Invalid OHLC relationship at {interval_start}, skipping")
                        continue
                    
                    results.append({
                        'interval_start': interval_start,
                        'open': round(open_price, 2),
                        'high': round(high_price, 2),
                        'low': round(low_price, 2),
                        'close': round(close_price, 2),
                        'volume': volume_sum
                    })
                except (ValueError, TypeError) as e:
                    logging.warning(f"Error processing interval {interval_start}: {e}")
                    continue

        processing_time = time.time() - processing_start
        logger.info(f"Data processing completed in {processing_time:.2f}s")

        # Apply first fifteen minutes filter for all data requests
        if first_fifteen_minutes and fetch_all_data:
            filtered_results = []
            for result in results:
                timestamp = result['interval_start']
                if timestamp.hour == 9 and 15 <= timestamp.minute <= 30:
                    filtered_results.append(result)
            results = filtered_results
            logger.info(f"Filtered to first 15 minutes: {len(results)} data points")

        # Sort results by timestamp (important for chart rendering)
        results.sort(key=lambda x: x['interval_start'])

        # Output results in the expected format
        for result in results:
            print(f"Interval:{result['interval_start'].isoformat()},Open:{result['open']},High:{result['high']},Low:{result['low']},Close:{result['close']},Volume:{result['volume']}")
        
        total_time = time.time() - start_time
        
        if fetch_all_data:
            logger.info(f"Successfully fetched ALL available data: {len(results)} data points in {total_time:.2f}s")
        else:
            logger.info(f"Successfully fetched {len(results)} data points for date range in {total_time:.2f}s")

        # Performance statistics
        if len(results) > 0:
            logger.info(f"Data range: {results[0]['interval_start']} to {results[-1]['interval_start']}")
            
        # Future: Indicator calculations
        if indicators:
            logger.info(f"Note: Indicators requested but not yet implemented: {indicators}")

    except psycopg2.Error as e:
        logger.error(f"Database error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

def parse_date_string(date_str):
    """Parse date string in various formats with enhanced support"""
    try:
        # Handle ISO format with timezone
        if 'T' in date_str:
            if date_str.endswith('Z'):
                date_str = date_str[:-1] + '+00:00'
            # Try to parse with timezone info
            try:
                dt = datetime.fromisoformat(date_str)
                # Convert to naive datetime in IST
                if dt.tzinfo is not None:
                    import pytz
                    ist = pytz.timezone('Asia/Kolkata')
                    dt = dt.astimezone(ist).replace(tzinfo=None)
                return dt
            except:
                # Fallback to naive parsing
                return datetime.fromisoformat(date_str.replace('+00:00', '').replace('Z', ''))
        else:
            return datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
    except ValueError:
        # Try multiple formats
        formats = [
            '%Y-%m-%d',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%S.%f',
            '%Y-%m-%d %H:%M',
            '%d/%m/%Y %H:%M:%S',
            '%d-%m-%Y %H:%M:%S'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        raise ValueError(f"Unable to parse date string: {date_str}")

def adjust_for_first_fifteen_minutes(start_date, end_date):
    """Adjust dates for first 15 minutes of trading day with enhanced logic"""
    # Handle timezone conversion
    if start_date.tzinfo is not None:
        ist_offset = timedelta(hours=5, minutes=30)
        start_date = start_date.replace(tzinfo=None) + ist_offset
    
    # Market opens at 9:15 AM, so first 15 minutes is 9:15 to 9:30
    market_start = start_date.replace(hour=9, minute=15, second=0, microsecond=0)
    market_end = market_start + timedelta(minutes=15)  # Corrected: 15 minutes, not 375
    
    logger.info(f"Adjusted for first 15 minutes: {market_start} to {market_end}")
    
    return market_start, market_end

def validate_ohlcv_data(row):
    """Validate individual OHLCV data record"""
    try:
        open_price = float(row['open'])
        high_price = float(row['high'])
        low_price = float(row['low'])
        close_price = float(row['close'])
        volume = int(row['volume'])
        
        # Basic validation rules
        if any(x <= 0 for x in [open_price, high_price, low_price, close_price]):
            return False
        
        if volume < 0:
            return False
            
        if high_price < max(open_price, close_price) or low_price > min(open_price, close_price):
            return False
            
        # Check for extreme values (possible data errors)
        if high_price / low_price > 2.0:  # More than 100% intraday move
            return False
            
        return True
    except (ValueError, TypeError, KeyError):
        return False

def validate_aggregated_ohlc(open_price, high_price, low_price, close_price):
    """Validate aggregated OHLC data"""
    try:
        # High must be >= max(open, close)
        if high_price < max(open_price, close_price):
            return False
            
        # Low must be <= min(open, close)
        if low_price > min(open_price, close_price):
            return False
            
        # All prices must be positive
        if any(x <= 0 for x in [open_price, high_price, low_price, close_price]):
            return False
            
        return True
    except (ValueError, TypeError):
        return False

if __name__ == "__main__":
    main()
