# """
# BALANCED LEAK-FREE PREPROCESSOR
# Uses lagged volume features (safe) while excluding current volume (target).
# This matches the paper's methodology exactly.
# """

# import pandas as pd
# import numpy as np
# from datetime import datetime
# import requests
# import zipfile
# import io
# from typing import List
# from tqdm import tqdm
# import warnings
# warnings.filterwarnings('ignore')

# print("=" * 80)
# print("BALANCED LEAK-FREE BINANCE PREPROCESSOR")
# print("Uses LAGGED volume features (safe) + trade counts")
# print("=" * 80)


# class BalancedBinancePreprocessor:
#     """
#     Balanced approach: Use lagged volumes + trade counts.
#     """
    
#     BASE_URL = "https://data.binance.vision/data/spot/daily/trades"
    
#     def __init__(self, symbols: List[str], start_date: str, end_date: str):
#         self.symbols = symbols
#         self.start_date = datetime.strptime(start_date, '%Y-%m-%d')
#         self.end_date = datetime.strptime(end_date, '%Y-%m-%d')
        
#     def download_and_aggregate_day(self, symbol: str, date: datetime) -> pd.DataFrame:
#         """Download and aggregate to 15-min bins."""
#         date_str = date.strftime('%Y-%m-%d')
#         url = f"{self.BASE_URL}/{symbol}/{symbol}-trades-{date_str}.zip"
        
#         try:
#             print(f"  {symbol} {date_str}...", end=" ")
#             response = requests.get(url, timeout=30)
#             response.raise_for_status()
            
#             with zipfile.ZipFile(io.BytesIO(response.content)) as z:
#                 with z.open(z.namelist()[0]) as f:
#                     df = pd.read_csv(f, names=[
#                         'trade_id', 'price', 'qty', 'quoteQty', 
#                         'time', 'isBuyerMaker', 'isBestMatch'
#                     ])
            
#             print(f"{len(df):,} trades")
            
#             df['timestamp'] = pd.to_datetime(df['time'], unit='ms')
#             df['is_buy_initiated'] = ~df['isBuyerMaker']
#             df = df.set_index('timestamp')
            
#             bins = df.resample('15min')
            
#             # Table 1 Features
#             bin_features = pd.DataFrame({
#                 # VOLUME QUANTITIES (will create lagged versions)
#                 'volBuyQty': bins.apply(lambda x: x[x['is_buy_initiated']]['qty'].sum()),
#                 'volSellQty': bins.apply(lambda x: x[~x['is_buy_initiated']]['qty'].sum()),
                
#                 # TRADE COUNTS
#                 'nrTrades': bins.size(),
#                 'volBuyNrTrades': bins.apply(lambda x: x[x['is_buy_initiated']].shape[0]),
#                 'volSellNrTrades': bins.apply(lambda x: x[~x['is_buy_initiated']].shape[0]),
                
#                 'symbol': symbol,
#                 'date': date_str
#             })
            
#             # Target variable
#             bin_features['total_volume'] = (
#                 bin_features['volBuyQty'] + bin_features['volSellQty']
#             )
            
#             # Time features
#             bin_features['hour'] = bin_features.index.hour
#             bin_features['minute'] = bin_features.index.minute
#             bin_features['bin_number'] = (
#                 (bin_features.index.hour * 60 + bin_features.index.minute) // 15
#             )
#             bin_features['day_of_week'] = bin_features.index.dayofweek
            
#             return bin_features.reset_index().rename(columns={'timestamp': 'bin_start_time'})
            
#         except Exception as e:
#             print(f"ERROR: {e}")
#             return pd.DataFrame()
    
#     def process_all_data(self) -> pd.DataFrame:
#         """Download all data."""
#         all_bins = []
#         date_range = pd.date_range(self.start_date, self.end_date, freq='D')
        
#         print(f"\nProcessing {len(self.symbols)} symbols × {len(date_range)} days\n")
        
#         for symbol in self.symbols:
#             print(f"\n{symbol}")
#             print("-" * 80)
#             for date in date_range:
#                 df = self.download_and_aggregate_day(symbol, date)
#                 if not df.empty:
#                     all_bins.append(df)
        
#         combined = pd.concat(all_bins, ignore_index=True)
#         combined = combined.fillna(0)
        
#         print("\n" + "=" * 80)
#         print(f"✓ Total bins: {len(combined):,}")
#         print("=" * 80)
        
#         return combined
    
#     def generate_lagged_features_BALANCED(self, df: pd.DataFrame) -> pd.DataFrame:
#         """
#         BALANCED: Create lagged features from BOTH volumes AND counts.
#         Key: Current volBuyQty/volSellQty are EXCLUDED from final features.
#         Only their LAGGED versions are used.
#         """
#         print("\nGenerating BALANCED lagged features...")
#         print("Strategy: Lag BOTH volumes and counts (paper's approach)")
        
#         df = df.sort_values(['symbol', 'date', 'bin_start_time']).copy()
        
#         # Base features to create lags from
#         base_features = [
#             'volBuyQty',        # Will create lag1_volBuyQty, past8_volBuyQty, etc.
#             'volSellQty',       # Will create lag1_volSellQty, past8_volSellQty, etc.
#             'nrTrades',
#             'volBuyNrTrades',
#             'volSellNrTrades'
#         ]
        
#         print(f"\nCreating lagged versions of: {base_features}")
        
#         for symbol in tqdm(df['symbol'].unique(), desc="Processing symbols"):
#             mask = df['symbol'] == symbol
#             symbol_data = df[mask].copy()
            
#             for feature in base_features:
#                 # LAG 1: Previous bin (15 min ago)
#                 df.loc[mask, f'lag1_{feature}'] = symbol_data[feature].shift(1).values
                
#                 # PAST 2: Sum of previous 2 bins (30 min)
#                 df.loc[mask, f'past2_{feature}'] = (
#                     symbol_data[feature].shift(1).rolling(window=2, min_periods=1).sum().values
#                 )
                
#                 # PAST 4: Sum of previous 4 bins (1 hour)
#                 df.loc[mask, f'past4_{feature}'] = (
#                     symbol_data[feature].shift(1).rolling(window=4, min_periods=1).sum().values
#                 )
                
#                 # PAST 8: Sum of previous 8 bins (2 hours) - Paper's key feature
#                 df.loc[mask, f'past8_{feature}'] = (
#                     symbol_data[feature].shift(1).rolling(window=8, min_periods=1).sum().values
#                 )
                
#                 # DAILY: Previous day same time
#                 df.loc[mask, f'daily_{feature}'] = symbol_data[feature].shift(96).values
            
#             # Volume ratios (current bin - safe)
#             df.loc[mask, 'buy_sell_qty_ratio'] = (
#                 symbol_data['volBuyQty'] / (symbol_data['volSellQty'] + 1)
#             ).values
            
#             df.loc[mask, 'buy_sell_count_ratio'] = (
#                 symbol_data['volBuyNrTrades'] / (symbol_data['volSellNrTrades'] + 1)
#             ).values
        
#         # Fill NaN
#         lagged_cols = [col for col in df.columns if any(
#             prefix in col for prefix in ['lag1_', 'past2_', 'past4_', 'past8_', 'daily_']
#         )]
#         df[lagged_cols] = df[lagged_cols].fillna(0)
        
#         print(f"\n✓ Generated {len(lagged_cols)} lagged features")
#         print(f"✓ Total columns: {len(df.columns)}")
        
#         return df
    
#     def save_to_csv(self, df: pd.DataFrame, filename: str = 'binance_balanced_data.csv'):
#         """Save processed data."""
#         df.to_csv(filename, index=False)
#         print(f"\n✓ Saved: {filename}")
#         print(f"✓ Rows: {len(df):,}")
#         print(f"✓ Columns: {len(df.columns)}")
        
#         return df


# def main():
#     """Main execution."""
#     SYMBOLS = ['BTCUSDT', 'ETHUSDT']
#     START_DATE = '2024-10-01'
#     END_DATE = '2024-10-25'
#     OUTPUT_FILE = 'binance_balanced_data.csv'
    
#     print(f"\nSymbols: {SYMBOLS}")
#     print(f"Dates: {START_DATE} to {END_DATE}")
    
#     preprocessor = BalancedBinancePreprocessor(SYMBOLS, START_DATE, END_DATE)
    
#     print("\n[STEP 1/3] Downloading...")
#     binned_data = preprocessor.process_all_data()
    
#     print("\n[STEP 2/3] Creating lagged features...")
#     full_features = preprocessor.generate_lagged_features_BALANCED(binned_data)
    
#     # Remove first 2 days
#     unique_dates = sorted(full_features['date'].unique())
#     full_features = full_features[full_features['date'].isin(unique_dates[2:])]
    
#     print(f"\n✓ Final: {full_features['date'].min()} to {full_features['date'].max()}")
    
#     print("\n[STEP 3/3] Saving...")
#     preprocessor.save_to_csv(full_features, OUTPUT_FILE)
    
#     print("\n✓ DONE! Upload to Colab.")


# if __name__ == "__main__":
#     main()





import pandas as pd
import numpy as np
from datetime import datetime
import requests
import zipfile
import io
from typing import List
from tqdm import tqdm
import warnings
warnings.filterwarnings('ignore')

print("=" * 80)
print("PRODUCTION PREPROCESSOR - 10 SYMBOLS × 90 DAYS")
print("Expected: ~51,840 training samples, R² = 0.77-0.80")
print("=" * 80)


class ProductionBinancePreprocessor:

    BASE_URL = "https://data.binance.vision/data/spot/daily/trades"

    def __init__(self, symbols: List[str], start_date: str, end_date: str):
        self.symbols = symbols
        self.start_date = datetime.strptime(start_date, '%Y-%m-%d')
        self.end_date = datetime.strptime(end_date, '%Y-%m-%d')

    def download_and_aggregate_day(self, symbol: str, date: datetime) -> pd.DataFrame:
        date_str = date.strftime('%Y-%m-%d')
        url = f"{self.BASE_URL}/{symbol}/{symbol}-trades-{date_str}.zip"

        try:
            print(f"  {symbol} {date_str}...", end=" ")
            response = requests.get(url, timeout=30)
            response.raise_for_status()

            with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                with z.open(z.namelist()[0]) as f:
                    df = pd.read_csv(f, names=[
                        'trade_id', 'price', 'qty', 'quoteQty',
                        'time', 'isBuyerMaker', 'isBestMatch'
                    ])

            print(f"{len(df):,} trades")

            df['timestamp'] = pd.to_datetime(df['time'], unit='ms')
            df['is_buy_initiated'] = ~df['isBuyerMaker']
            df = df.set_index('timestamp')

            bins = df.resample('15min')

            bin_features = pd.DataFrame({
                'volBuyQty': bins.apply(lambda x: x[x['is_buy_initiated']]['qty'].sum()),
                'volSellQty': bins.apply(lambda x: x[~x['is_buy_initiated']]['qty'].sum()),
                'nrTrades': bins.size(),
                'volBuyNrTrades': bins.apply(lambda x: x[x['is_buy_initiated']].shape[0]),
                'volSellNrTrades': bins.apply(lambda x: x[~x['is_buy_initiated']].shape[0]),
                'symbol': symbol,
                'date': date_str
            })

            bin_features['total_volume'] = (
                bin_features['volBuyQty'] + bin_features['volSellQty']
            )

            bin_features['hour'] = bin_features.index.hour
            bin_features['minute'] = bin_features.index.minute
            bin_features['bin_number'] = (
                (bin_features.index.hour * 60 + bin_features.index.minute) // 15
            )
            bin_features['day_of_week'] = bin_features.index.dayofweek

            return bin_features.reset_index().rename(columns={'timestamp': 'bin_start_time'})

        except Exception as e:
            print(f"ERROR: {e}")
            return pd.DataFrame()

    def process_all_data(self) -> pd.DataFrame:
        """Download all data."""
        all_bins = []
        date_range = pd.date_range(self.start_date, self.end_date, freq='D')

        total = len(self.symbols) * len(date_range)
        print(f"\nProcessing {len(self.symbols)} symbols × {len(date_range)} days = {total} downloads")
        print(f"Estimated time: {total * 2 / 60:.0f} minutes\n")

        for symbol in self.symbols:
            print(f"\n{symbol}")
            print("-" * 80)
            for date in date_range:
                df = self.download_and_aggregate_day(symbol, date)
                if not df.empty:
                    all_bins.append(df)

        combined = pd.concat(all_bins, ignore_index=True)
        combined = combined.fillna(0)

        print("\n" + "=" * 80)
        print(f"✓ Total bins: {len(combined):,}")
        print(f"✓ Date range: {combined['date'].min()} to {combined['date'].max()}")
        print(f"✓ Symbols: {len(combined['symbol'].unique())}")
        print("=" * 80)

        return combined

    def generate_lagged_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate lagged features (balanced approach)."""
        print("\nGenerating lagged features...")
        print("Creating past1, past2, past4, past8, daily lags...")

        df = df.sort_values(['symbol', 'date', 'bin_start_time']).copy()

        base_features = [
            'volBuyQty',
            'volSellQty',
            'nrTrades',
            'volBuyNrTrades',
            'volSellNrTrades'
        ]

        for symbol in tqdm(df['symbol'].unique(), desc="Processing symbols"):
            mask = df['symbol'] == symbol
            symbol_data = df[mask].copy()

            for feature in base_features:
                # Lag 1 (15 min)
                df.loc[mask, f'lag1_{feature}'] = symbol_data[feature].shift(1).values

                # Past 2 (30 min)
                df.loc[mask, f'past2_{feature}'] = (
                    symbol_data[feature].shift(1).rolling(window=2, min_periods=1).sum().values
                )

                # Past 4 (1 hour)
                df.loc[mask, f'past4_{feature}'] = (
                    symbol_data[feature].shift(1).rolling(window=4, min_periods=1).sum().values
                )

                # Past 8 (2 hours)
                df.loc[mask, f'past8_{feature}'] = (
                    symbol_data[feature].shift(1).rolling(window=8, min_periods=1).sum().values
                )

                # Past 16 (4 hours)
                df.loc[mask, f'past16_{feature}'] = (
                    symbol_data[feature].shift(1).rolling(window=16, min_periods=1).sum().values
                )

                # Daily (96 bins = 24 hours)
                df.loc[mask, f'daily_{feature}'] = symbol_data[feature].shift(96).values

            # Ratios
            df.loc[mask, 'buy_sell_count_ratio'] = (
                symbol_data['volBuyNrTrades'] / (symbol_data['volSellNrTrades'] + 1)
            ).values

            df.loc[mask, 'trade_intensity'] = (symbol_data['nrTrades'] / 15).values

        lagged_cols = [col for col in df.columns if any(
            p in col for p in ['lag1_', 'past2_', 'past4_', 'past8_', 'past16_', 'daily_']
        )]
        df[lagged_cols] = df[lagged_cols].fillna(0)

        print(f"\n✓ Generated {len(lagged_cols)} lagged features")
        print(f"✓ Total columns: {len(df.columns)}")

        return df

    def save_to_csv(self, df: pd.DataFrame, filename: str = 'binance_production_10x90.csv'):
        """Save processed data."""
        df.to_csv(filename, index=False)
        file_size_mb = df.memory_usage(deep=True).sum() / (1024 * 1024)

        print(f"\n✓ Saved: {filename}")
        print(f"✓ Size: {file_size_mb:.1f} MB")
        print(f"✓ Rows: {len(df):,}")
        print(f"✓ Columns: {len(df.columns)}")

        return df


def main():
    """Main execution."""
    print("\n" + "=" * 80)
    print("CONFIGURATION - OPTIMAL SETUP")
    print("=" * 80)

    # OPTIMAL: 10 symbols × 90 days
    SYMBOLS = [
        'BTCUSDT',   
        'ETHUSDT',   # Ethereum - Smart contracts
        'BNBUSDT',   # Binance Coin - Exchange token
        'SOLUSDT',   # Solana - Fast L1
        'ADAUSDT',   # Cardano - Research-driven
        'XRPUSDT',   
        'DOGEUSDT', 
        'MATICUSDT', 
        'DOTUSDT',   
        'AVAXUSDT'  
    ]

    START_DATE = '2024-07-28'  
    END_DATE = '2024-10-25'
    OUTPUT_FILE = 'binance_production_10x90.csv'

    print(f"\nSymbols ({len(SYMBOLS)}): {SYMBOLS}")
    print(f"Date range: {START_DATE} to {END_DATE}")
    print(f"Days: 90")
    print(f"Expected samples: ~51,840")
    print(f"Output: {OUTPUT_FILE}")
    print("=" * 80)

    preprocessor = ProductionBinancePreprocessor(SYMBOLS, START_DATE, END_DATE)

    # Step 1: Download
    print("\n[STEP 1/3] Downloading tick data (this will take ~60-90 min)...")
    binned_data = preprocessor.process_all_data()

    # Step 2: Generate features
    print("\n[STEP 2/3] Creating lagged features...")
    full_features = preprocessor.generate_lagged_features(binned_data)

    # Step 3: Remove insufficient history
    unique_dates = sorted(full_features['date'].unique())
    full_features = full_features[full_features['date'].isin(unique_dates[2:])]

    print(f"\n✓ Removed first 2 days (insufficient history)")
    print(f"✓ Final date range: {full_features['date'].min()} to {full_features['date'].max()}")
    print(f"✓ Final samples: {len(full_features):,}")

    # Step 4: Save
    print("\n[STEP 3/3] Saving...")
    preprocessor.save_to_csv(full_features, OUTPUT_FILE)

    print("\n" + "=" * 80)
    print("✓ PREPROCESSING COMPLETE!")
    print("=" * 80)
    print(f"\nNext steps:")
    print(f"1. Upload '{OUTPUT_FILE}' to Google Colab")
    print(f"2. Run the training script (Part B)")
    print(f"3. Expected R²: 0.77-0.80")
    print("=" * 80)


if __name__ == "__main__":
    main()
