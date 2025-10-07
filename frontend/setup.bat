@echo off
REM Setup script for KPI Dashboard (Windows)

echo 🚀 KPI Dashboard Setup
echo =======================

REM Check if .env exists
if not exist .env (
    echo 📝 Creating .env file from .env.example...
    copy .env.example .env
    echo ⚠️  Please edit .env and add your DATABASE_URL
    echo    Then run this script again.
    pause
    exit /b 1
)

echo ✓ Environment file found

REM Check for Docker
where docker >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ Docker found
    set /p use_docker="Use Docker? (y/n): "
    
    if /i "%use_docker%"=="y" (
        echo 🐳 Starting with Docker...
        docker-compose up --build -d
        echo.
        echo ✅ Application started!
        echo    URL: http://localhost:3000
        echo.
        echo 📊 To load CSV data, run:
        echo    docker-compose exec kpi-dashboard python3 seed_postgres.py
        pause
        exit /b 0
    )
)

REM Manual setup
echo 📦 Installing dependencies...

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js not found. Please install Node.js 18+ first.
    pause
    exit /b 1
)

call npm install

REM Check for Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Python not found. Please install Python 3.8+ first.
    pause
    exit /b 1
)

echo ✓ Dependencies installed

REM Install Python dependencies
echo 📦 Installing Python dependencies...
pip install psycopg2-binary

REM Ask to load data
set /p load_data="Load CSV data into database? (y/n): "
if /i "%load_data%"=="y" (
    echo 📊 Loading data...
    python seed_postgres.py
)

REM Start development server
echo 🚀 Starting development server...
call npm run dev
