# KPI Dashboard - Work Package Analysis

A real-time KPI dashboard for analyzing detection data from work packages. Built with React, TypeScript, and PostgreSQL, featuring interactive charts and customizable metrics.

## 🚀 Quick Start with Docker

The fastest way to get started:

```bash
# 1. Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# 2. Copy environment configuration
cp .env.example .env

# 3. Edit .env and add your PostgreSQL connection string
# DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@host:port/database

# 4. Start the application
docker-compose up -d

# 5. Load CSV data into database
docker-compose exec kpi-dashboard python3 seed_postgres.py

# 6. Access the dashboard
# Open http://localhost:3000 in your browser
```

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
  - [Docker Setup (Recommended)](#docker-setup-recommended)
  - [Manual Setup](#manual-setup)
- [Database Configuration](#database-configuration)
- [Usage](#usage)
- [Architecture](#architecture)
- [Technologies](#technologies)
- [Troubleshooting](#troubleshooting)

## ✨ Features

- **Interactive KPI Builder**: Create custom metrics with filters and groupings
- **Multiple Chart Types**: Line, area, bar charts, and data tables
- **Multi-Series Support**: Compare multiple classes simultaneously
- **Real-time Filtering**: Filter by time range, class, area, speed, and more
- **CSV Export**: Export your KPI data for external analysis
- **100k+ Records**: Efficiently handles large datasets
- **PostgreSQL Backend**: Production-ready relational database

### Available Metrics

- **Count**: Total number of detections
- **Unique IDs**: Count of unique assets
- **Average Speed**: Mean speed in m/s
- **Rate**: Events per hour
- **Close Calls**: Safety incidents (proximity < 2m, speed > 1.5 m/s)
- **Vest Violations**: Workers without safety vests
- **Overspeed Events**: Detections exceeding speed threshold

## 🔧 Prerequisites

### For Docker Setup (Recommended)
- Docker 20.10+
- Docker Compose 2.0+

### For Manual Setup
- Node.js 18+ and npm
- Python 3.8+
- PostgreSQL database (or Supabase account)

## 📦 Installation Methods

### Docker Setup (Recommended)

**One-command deployment:**

```bash
# Linux/Mac
chmod +x setup.sh
./setup.sh

# Windows
setup.bat
```

**Manual Docker steps:**

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 2. Build and start
docker-compose up --build -d

# 3. Load data
docker-compose exec kpi-dashboard python3 seed_postgres.py

# 4. View logs (optional)
docker-compose logs -f

# 5. Stop
docker-compose down
```

### Manual Setup

```bash
# 1. Install Node.js dependencies
npm install

# 2. Install Python dependencies
pip3 install psycopg2-binary

# 3. Configure environment
cp .env.example .env
# Edit .env with your database URL

# 4. Load CSV data into database
python3 seed_postgres.py

# 5. Start development server
npm run dev

# The app will be available at http://localhost:8080
```

## 🗄️ Database Configuration

### Using Supabase (Current Setup)

The project is configured to use Supabase PostgreSQL:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.lxbqczazcjhnltlzaeyk.supabase.co:5432/postgres
VITE_SUPABASE_URL=https://lxbqczazcjhnltlzaeyk.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_key_here
```

### Database Schema

The `detections` table structure:

```sql
CREATE TABLE detections (
    id TEXT NOT NULL,
    class TEXT NOT NULL,              -- 'human', 'vehicle', 'pallet_truck', 'agv'
    t TIMESTAMP WITH TIME ZONE NOT NULL,
    x DOUBLE PRECISION NOT NULL,
    y DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION,
    area TEXT,
    vest INTEGER,                     -- 0 or 1
    speed DOUBLE PRECISION,
    with_object BOOLEAN
);

-- Indices for performance
CREATE INDEX idx_detections_t ON detections(t);
CREATE INDEX idx_detections_class ON detections(class);
CREATE INDEX idx_detections_id_t ON detections(id, t);
CREATE INDEX idx_detections_area ON detections(area);
```

### Loading Data

The `seed_postgres.py` script handles CSV import:

```bash
# Using environment variable
export DATABASE_URL="postgresql://..."
python3 seed_postgres.py

# Or pass URL as argument
python3 seed_postgres.py "postgresql://..."

# Using the load-data.sh helper script
chmod +x load-data.sh
./load-data.sh
```

## 🎯 Usage

### Building a KPI

1. **Select Metric**: Choose from count, speed, close calls, etc.
2. **Apply Filters**: 
   - Time range (last 24h, 7d, custom)
   - Classes (human, vehicle, pallet_truck, agv)
   - Areas, speed threshold, vest status
3. **Choose Grouping**: Time buckets, class, area, asset ID, or none
4. **Select Chart Type**: Line, area, bar, or table
5. **Generate**: Click "Generate KPI" to visualize

### Multi-Series Charts

When selecting multiple classes (e.g., human + vehicle), the dashboard automatically creates separate lines/bars for each class, allowing easy comparison.

### Saving KPIs

- Click "Save KPI" to store your configuration
- Saved KPIs appear in the left sidebar
- Click any saved KPI to reload it instantly
- Delete saved KPIs with the trash icon

## 🏗️ Architecture

```
┌─────────────────┐
│   React App     │
│   (Frontend)    │
└────────┬────────┘
         │
         │ Supabase Client
         │
┌────────▼────────┐
│  PostgreSQL DB  │
│   (Supabase)    │
└─────────────────┘
         ▲
         │
    ┌────┴────┐
    │ CSV     │
    │ Seed    │
    │ Script  │
    └─────────┘
```

### Data Flow

1. **CSV → Database**: `seed_postgres.py` loads `work-package-raw-data.csv` into PostgreSQL
2. **Database → Frontend**: `dataAdapter.ts` fetches data via Supabase client
3. **Processing**: `kpiCalculations.ts` aggregates and computes metrics
4. **Visualization**: `ChartPreview.tsx` renders results using Recharts

### Key Files

```
├── seed_postgres.py          # CSV data loader
├── Dockerfile                # Container definition
├── docker-compose.yml        # One-command deployment
├── src/
│   ├── lib/
│   │   ├── dataAdapter.ts           # Database connection layer
│   │   ├── kpiCalculations.ts      # Metric computation
│   │   └── multiSeriesAggregation.ts # Multi-class handling
│   └── components/
│       ├── KPIBuilder.tsx           # Main dashboard UI
│       ├── ChartPreview.tsx         # Chart rendering
│       └── SavedKPIsSidebar.tsx     # Saved KPIs management
└── public/
    └── work-package-raw-data.csv    # Source data (100k+ rows)
```

## 🛠️ Technologies

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** + **shadcn/ui** for styling
- **Recharts** for data visualization
- **React Query** for data fetching
- **date-fns** for time manipulation

### Backend
- **Supabase** (PostgreSQL + client SDK)
- **Python** for data seeding
- **psycopg2** for PostgreSQL access

### DevOps
- **Docker** & **Docker Compose**
- **Multi-stage builds** for optimization

## 🐛 Troubleshooting

### "No data found in database"

```bash
# Load the CSV data
python3 seed_postgres.py
# or
docker-compose exec kpi-dashboard python3 seed_postgres.py
```

### Database connection issues

1. Verify `.env` file exists and `DATABASE_URL` is correct
2. Test connection:
   ```bash
   psql "postgresql://user:pass@host:port/db" -c "SELECT COUNT(*) FROM detections;"
   ```
3. Check network/firewall settings

### Docker build failures

```bash
# Clear Docker cache
docker system prune -a
docker-compose build --no-cache
```

### Port 3000 already in use

```bash
# Change port in docker-compose.yml
ports:
  - "3001:3000"  # Host:Container
```

### Slow queries with large datasets

The seed script creates indices automatically. If queries are still slow:

```sql
-- Verify indices exist
SELECT indexname FROM pg_indexes WHERE tablename = 'detections';

-- Analyze table statistics
ANALYZE detections;
```

### Multi-series charts not showing

Ensure:
1. Multiple classes are selected in filters
2. Grouping is NOT set to "class"
3. Data exists for the selected classes

## 📄 Environment Variables

See `.env.example` for full configuration:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | Yes |
| `DATA_LOADED` | Flag to track if CSV is loaded | No |
| `NODE_ENV` | development/production | No |

## 🤝 Contributing

When submitting changes:
1. Test locally: `npm run dev`
2. Test in Docker: `docker-compose up --build`
3. Verify data loading works
4. Check all KPI metrics calculate correctly

## 📝 Submission Checklist

For the work package assignment:

- [x] Public repo with complete code
- [x] One-command setup (`docker-compose up`)
- [x] `.env.example` with all required variables
- [x] CSV data loads into relational database (PostgreSQL)
- [x] Repeatable setup script (`setup.sh`/`setup.bat`)
- [x] README with clear instructions
- [ ] Loom/GIF demo (≤5 min) - **You need to create this**

## 🔗 Links

- **Lovable Project**: https://lovable.dev/projects/a81ec073-6026-4a47-80a9-4ff20fb89122
- **Supabase Dashboard**: https://supabase.com/dashboard/project/lxbqczazcjhnltlzaeyk

## 📧 Support

For issues with:
- **Code/Features**: Open an issue in this repo
- **Deployment**: Check Docker logs with `docker-compose logs`
- **Database**: Verify connection and data with `psql` or Supabase dashboard

---

Built with ❤️ using Lovable, React, and Supabase
