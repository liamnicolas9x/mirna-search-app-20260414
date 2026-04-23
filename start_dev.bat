@echo off
cd /d %~dp0

echo =========================
echo Starting Backend...
echo =========================

start cmd /k "python -m uvicorn main:app --reload"

timeout /t 2 >nul

echo =========================
echo Starting Frontend...
echo =========================

start cmd /k "cd frontend && npm run dev"

timeout /t 2 >nul

echo =========================
echo Opening Browser...
echo =========================

start http://localhost:5173

pause