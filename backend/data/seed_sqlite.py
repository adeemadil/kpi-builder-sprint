
#!/usr/bin/env python3
"""
SQLite Database Seeding Script for KPI Builder
Loads CSV data into SQLite database with proper schema and indexing.
"""

import pandas as pd
import sqlite3
import sys
from pathlib import Path
from typing import Optional

# Configuration
CSV_PATH = Path('work-package-raw-data.csv')
DB_PATH = Path('kpi_builder.sqlite')

def log_info(message: str) -> None:
    """Log info message with timestamp."""
    print(f"[INFO] {message}")

def log_error(message: str, error: Optional[Exception] = None) -> None:
    """Log error message with optional exception details."""
    print(f"[ERROR] {message}")
    if error:
        print(f"[ERROR] Details: {error}")

def infer_timestamp_col(df: pd.DataFrame) -> str:
    """Infer the timestamp column name from common variations."""
    for cand in ['t', 'timestamp', 'time']:
        if cand in df.columns:
            return cand
    raise KeyError('No timestamp column found (expected one of t/timestamp/time)')

def validate_csv_file(csv_path: Path) -> None:
    """Validate that the CSV file exists and is readable."""
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    
    if not csv_path.is_file():
        raise ValueError(f"Path is not a file: {csv_path}")
    
    # Check if file is readable
    try:
        with open(csv_path, 'r') as f:
            f.read(1)
    except Exception as e:
        raise PermissionError(f"Cannot read CSV file: {e}")

def create_schema(con: sqlite3.Connection) -> None:
    """Create the detections table schema if it doesn't exist."""
    schema_sql = """
    CREATE TABLE IF NOT EXISTS detections (
        id TEXT NOT NULL,
        class TEXT NOT NULL,
        t TIMESTAMP NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        heading REAL,
        vest INTEGER,
        speed REAL,
        area TEXT,
        PRIMARY KEY (id, t)
    );
    """
    con.execute(schema_sql)
    log_info("Schema created/verified")

def create_indexes(con: sqlite3.Connection) -> None:
    """Create database indexes for optimal query performance."""
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_detections_t ON detections(t)",
        "CREATE INDEX IF NOT EXISTS idx_detections_class ON detections(class)",
        "CREATE INDEX IF NOT EXISTS idx_detections_area ON detections(area)",
        "CREATE INDEX IF NOT EXISTS idx_detections_vest ON detections(vest)",
        "CREATE INDEX IF NOT EXISTS idx_detections_speed ON detections(speed)"
    ]
    
    for index_sql in indexes:
        con.execute(index_sql)
    
    log_info("Indexes created/verified")

def process_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Process and clean the dataframe for database insertion."""
    log_info(f"Processing {len(df)} rows...")
    
    # Infer timestamp column
    ts_col = infer_timestamp_col(df)
    log_info(f"Using timestamp column: {ts_col}")
    
    # Normalize timestamp
    if pd.api.types.is_integer_dtype(df[ts_col]) or pd.api.types.is_float_dtype(df[ts_col]):
        # Assume milliseconds since epoch if > 10^10, else seconds
        factor = 1000 if df[ts_col].astype('int64').max() > 10_000_000_000 else 1
        df['t'] = pd.to_datetime(df[ts_col], unit='ms' if factor == 1000 else 's', utc=True)
    else:
        df['t'] = pd.to_datetime(df[ts_col], utc=True, errors='coerce')
    
    # Standardize column names
    rename_map = {}
    for c in df.columns:
        if c.lower() in ['class_name', 'label', 'type']:
            rename_map[c] = 'class'
    
    if rename_map:
        df = df.rename(columns=rename_map)
        log_info(f"Renamed columns: {rename_map}")
    
    # Ensure required columns exist
    required = ['id', 'class', 'x', 'y', 't']
    missing_cols = [col for col in required if col not in df.columns]
    if missing_cols:
        raise KeyError(f'Missing required columns: {missing_cols}')
    
    # Optional numeric casts
    numeric_cols = ['x', 'y', 'heading', 'speed', 'vest']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Handle area column (ensure it's string)
    if 'area' in df.columns:
        df['area'] = df['area'].astype(str).replace('nan', None)
    else:
        df['area'] = None
    
    # Remove rows with invalid coordinates
    initial_count = len(df)
    df = df.dropna(subset=['x', 'y'])
    final_count = len(df)
    if initial_count != final_count:
        log_info(f"Removed {initial_count - final_count} rows with invalid coordinates")
    
    # Remove rows with invalid timestamps
    initial_count = len(df)
    df = df.dropna(subset=['t'])
    final_count = len(df)
    if initial_count != final_count:
        log_info(f"Removed {initial_count - final_count} rows with invalid timestamps")
    
    return df

def main() -> int:
    """Main seeding function."""
    try:
        log_info("Starting SQLite database seeding...")
        
        # Validate CSV file
        validate_csv_file(CSV_PATH)
        log_info(f"CSV file validated: {CSV_PATH}")
        
        # Read CSV data
        log_info("Reading CSV data...")
        df = pd.read_csv(CSV_PATH)
        log_info(f"Loaded {len(df)} rows from CSV")
        
        # Process dataframe
        df = process_dataframe(df)
        
        # Connect to database
        log_info(f"Connecting to database: {DB_PATH}")
        con = sqlite3.connect(DB_PATH)
        
        try:
            # Create schema and indexes
            create_schema(con)
            create_indexes(con)
            
            # Insert data
            log_info("Inserting data into database...")
            df[['id', 'class', 't', 'x', 'y', 'heading', 'vest', 'speed', 'area']].to_sql(
                'detections', 
                con, 
                if_exists='replace', 
                index=False,
                method='multi'
            )
            
            # Verify insertion
            cursor = con.cursor()
            cursor.execute("SELECT COUNT(*) FROM detections")
            count = cursor.fetchone()[0]
            
            log_info(f"Successfully loaded {count} rows into {DB_PATH}")
            
            # Show sample data
            cursor.execute("SELECT class, COUNT(*) as count FROM detections GROUP BY class")
            class_counts = cursor.fetchall()
            log_info("Data distribution by class:")
            for class_name, count in class_counts:
                log_info(f"  {class_name}: {count}")
            
        finally:
            con.close()
        
        log_info("Database seeding completed successfully!")
        return 0
        
    except Exception as e:
        log_error("Database seeding failed", e)
        return 1

if __name__ == '__main__':
    sys.exit(main())
