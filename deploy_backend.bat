@echo off
echo =========================
echo BACKEND DEPLOY
echo =========================

echo [1] Build database...
python db.py

IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: db.py failed
    pause
    exit /b
)

echo [2] Git add...
git add .

echo [3] Commit...
git diff --cached --quiet
IF %ERRORLEVEL% EQU 0 (
    git commit --allow-empty -m "force deploy %date% %time%"
) ELSE (
    git commit -m "backend update %date% %time%"
)

echo [4] Push...
git push

echo DONE! Render deploying...
pause