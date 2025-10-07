#!/usr/bin/env python3
"""
Load CSV data into PostgreSQL database
Handles the work-package-raw-data.csv file with 100k+ rows
"""

import csv
import sys
import os
from urllib.parse import urlparse
import psycopg2
from psycopg2.extras import execute_batch

def get_db_connection(database_url):
    """Parse database URL and create connection"""
    result = urlparse(database_url)
    return psycopg2.connect(
        database=result.path[1:],
        user=result.username,
        password=result.password,
        host=result.hostname,
        port=result.port
    )

def create_table(conn):
    """Create detections table if it doesn't exist"""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS detections (
                id TEXT NOT NULL,
                class TEXT NOT NULL,
                t TIMESTAMP WITH TIME ZONE NOT NULL,
                x DOUBLE PRECISION NOT NULL,
                y DOUBLE PRECISION NOT NULL,
                heading DOUBLE PRECISION,
                area TEXT,
                vest INTEGER,
                speed DOUBLE PRECISION,
                with_object BOOLEAN
            );
        """)
        
        # Create indices for better query performance
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_detections_t ON detections(t);
            CREATE INDEX IF NOT EXISTS idx_detections_class ON detections(class);
            CREATE INDEX IF NOT EXISTS idx_detections_id_t ON detections(id, t);
            CREATE INDEX IF NOT EXISTS idx_detections_area ON detections(area);
        """)
        conn.commit()
        print("✓ Table created/verified with indices")

def convert_boolean(value):
    """Convert string boolean to Python boolean"""
    if value.lower() in ('true', 't', '1', 'yes'):
        return True
    elif value.lower() in ('false', 'f', '0', 'no', ''):
        return False
    return None

def load_csv_data(conn, csv_path):
    """Load CSV data into database in batches"""
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        batch = []
        batch_size = 1000
        total_rows = 0
        
        for row in reader:
            # Map CSV columns to database columns
            # CSV: type, timestamp, id, x, y, heading, area, vest, speed, with_object
            # DB:  class, t, id, x, y, heading, area, vest, speed, with_object
            
            data = (
                row['id'],
                row['type'],  # Maps to 'class' in DB
                row['timestamp'],
                float(row['x']),
                float(row['y']),
                float(row['heading']) if row['heading'] else None,
                row['area'] if row['area'] else None,
                int(row['vest']) if row['vest'] else None,
                float(row['speed']) if row['speed'] else None,
                convert_boolean(row['with_object']) if row['with_object'] else None
            )
            batch.append(data)
            
            if len(batch) >= batch_size:
                with conn.cursor() as cur:
                    execute_batch(cur, """
                        INSERT INTO detections (id, class, t, x, y, heading, area, vest, speed, with_object)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, batch)
                conn.commit()
                total_rows += len(batch)
                print(f"✓ Loaded {total_rows} rows...", end='\r')
                batch = []
        
        # Insert remaining rows
        if batch:
            with conn.cursor() as cur:
                execute_batch(cur, """
                    INSERT INTO detections (id, class, t, x, y, heading, area, vest, speed, with_object)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, batch)
            conn.commit()
            total_rows += len(batch)
        
        print(f"\n✓ Successfully loaded {total_rows} rows from CSV")
        return total_rows

def main():
    # Get database URL from environment or argument
    database_url = os.environ.get('DATABASE_URL')
    if not database_url and len(sys.argv) > 1:
        database_url = sys.argv[1]
    
    if not database_url:
        print("Error: DATABASE_URL not provided")
        print("Usage: python seed_postgres.py [DATABASE_URL]")
        print("   or: DATABASE_URL=... python seed_postgres.py")
        sys.exit(1)
    
    # CSV file path
    csv_path = 'public/work-package-raw-data.csv'
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        sys.exit(1)
    
    print("🚀 Starting PostgreSQL data import...")
    print(f"📁 CSV file: {csv_path}")
    
    try:
        # Connect to database
        conn = get_db_connection(database_url)
        print("✓ Connected to PostgreSQL database")
        
        # Check if data already exists
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM detections")
            existing_count = cur.fetchone()[0]
            
            if existing_count > 0:
                print(f"⚠️  Database already contains {existing_count} rows")
                response = input("Do you want to clear existing data and reload? (yes/no): ")
                if response.lower() in ('yes', 'y'):
                    cur.execute("TRUNCATE TABLE detections")
                    conn.commit()
                    print("✓ Existing data cleared")
                else:
                    print("Skipping data load. Use existing data.")
                    conn.close()
                    return
        
        # Create table and load data
        create_table(conn)
        load_csv_data(conn, csv_path)
        
        # Verify data
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as total FROM detections")
            total = cur.fetchone()[0]
            cur.execute("SELECT COUNT(DISTINCT class) as classes FROM detections")
            classes = cur.fetchone()[0]
            cur.execute("SELECT MIN(t) as min_time, MAX(t) as max_time FROM detections")
            min_time, max_time = cur.fetchone()
            
            print("\n" + "="*60)
            print("📊 Database Statistics:")
            print(f"  • Total records: {total:,}")
            print(f"  • Unique classes: {classes}")
            print(f"  • Time range: {min_time} to {max_time}")
            print("="*60)
        
        conn.close()
        print("\n✅ Data import completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
