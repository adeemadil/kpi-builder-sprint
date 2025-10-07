
import pandas as pd
import sqlite3
from pathlib import Path

CSV_PATH = Path('work-package-raw-data.csv')  # adjust if needed
DB_PATH = Path('detections.sqlite')

def infer_timestamp_col(df):
    for cand in ['t', 'timestamp', 'time']:
        if cand in df.columns:
            return cand
    raise KeyError('No timestamp column found (expected one of t/timestamp/time)')

def main():
    df = pd.read_csv(CSV_PATH)
    ts_col = infer_timestamp_col(df)
    # Normalize timestamp
    if pd.api.types.is_integer_dtype(df[ts_col]) or pd.api.types.is_float_dtype(df[ts_col]):
        # assume milliseconds since epoch if > 10^10, else seconds
        factor = 1000 if df[ts_col].astype('int64').max() > 10_000_000_000 else 1
        df['t'] = pd.to_datetime(df[ts_col], unit='ms' if factor==1000 else 's', utc=True)
    else:
        df['t'] = pd.to_datetime(df[ts_col], utc=True, errors='coerce')
    # Standardize column names
    rename_map = {}
    for c in df.columns:
        if c.lower() in ['class_name','label']:
            rename_map[c] = 'class'
    df = df.rename(columns=rename_map)
    # Ensure required columns exist
    required = ['id','class','x','y','t']
    for col in required:
        if col not in df.columns:
            raise KeyError(f'Missing required column: {col}')
    # Optional numeric casts
    for col in ['x','y','heading','speed','vest']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    # Save to SQLite
    con = sqlite3.connect(DB_PATH)
    df[['id','class','t','x','y','heading','vest','speed']].to_sql('detections', con, if_exists='replace', index=False)
    # Add indices
    cur = con.cursor()
    cur.execute('CREATE INDEX IF NOT EXISTS idx_detections_t ON detections(t)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_detections_class ON detections(class)')
    con.commit()
    con.close()
    print(f'Loaded {len(df)} rows into {DB_PATH}')

if __name__ == '__main__':
    main()
