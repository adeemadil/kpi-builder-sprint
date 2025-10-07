# SQLite Local Setup

This app now uses SQLite for fast local data processing instead of remote Supabase Postgres.

## Quick Start

### 1. Generate SQLite Database

Run the Python script to load your CSV data into SQLite:

```bash
# Install dependencies
pip install pandas

# Run the seed script (make sure work-package-raw-data.csv is in the root directory)
python seed_sqlite.py
```

This will create `detections.sqlite` in the project root.

### 2. Move Database to Public Folder

```bash
# Move the generated SQLite file to the public folder
mv detections.sqlite public/
```

### 3. Start Development Server

```bash
npm install
npm run dev
```

The app will automatically load the SQLite database from `/detections.sqlite` and run all queries locally in the browser.

## How It Works

- **sql.js**: SQLite compiled to WebAssembly, runs entirely in browser
- **Fast queries**: All data processing happens client-side
- **No remote calls**: No network latency, instant results
- **100k+ rows**: Handles large datasets efficiently

## Benefits vs Supabase Postgres

✅ **Instant seeding**: Load 100k rows in seconds (vs minutes over network)
✅ **No remote calls**: All queries run in-browser
✅ **Offline capable**: Works without internet
✅ **Fast development**: No waiting for remote database

## Schema

The SQLite database uses this schema:

```sql
CREATE TABLE detections (
  id TEXT NOT NULL,
  class TEXT NOT NULL,
  t TIMESTAMP NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  heading REAL,
  vest INTEGER,
  speed REAL,
  PRIMARY KEY (id, t)
);
```

## Troubleshooting

If you see "Failed to load SQLite database":
1. Ensure `detections.sqlite` exists in `public/` folder
2. Check browser console for errors
3. Verify the database was created successfully by running: `sqlite3 public/detections.sqlite "SELECT COUNT(*) FROM detections;"`
