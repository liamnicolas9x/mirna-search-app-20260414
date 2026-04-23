@echo off
cd /d %~dp0

echo =========================
echo STOPPING BACKEND...
echo =========================

:: Kill process chạy trên port 8000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    taskkill /PID %%a /F >nul 2>&1
)

timeout /t 1 >nul

echo =========================
echo STARTING BACKEND...
echo =========================

start "BACKEND" cmd /k "python -m uvicorn main:app --reload"

echo =========================
echo BACKEND RESTARTED
echo =========================

pause