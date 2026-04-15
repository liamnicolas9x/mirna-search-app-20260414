@echo off
echo =========================
echo UPDATE DATABASE START
echo =========================

echo.
echo [1] Building database from CSV...
python db.py

IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: db.py failed
    pause
    exit /b
)

echo.
echo [2] Adding changes to git...
git add .

echo.
echo [3] Commit changes...
git commit -m "update database"

echo.
echo [4] Pushing to GitHub...
git push

IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: git push failed
    pause
    exit /b
)

echo.
echo =========================
echo DONE! Database updated and deployed
echo =========================
pause