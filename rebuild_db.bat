@echo off
cd /d %~dp0

echo =========================
echo REBUILD DATABASE (SQLite)
echo =========================

python db.py

if %errorlevel% neq 0 (
    echo ❌ DB build failed
    pause
    exit /b
)

echo =========================
echo BUILD FRONTEND JSON
echo =========================

python csv_to_json.py

if %errorlevel% neq 0 (
    echo ❌ JSON build failed
    pause
    exit /b
)

echo =========================
echo ALL DONE
echo =========================

pause