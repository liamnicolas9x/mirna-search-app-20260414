@echo off
echo =========================
echo FRONTEND DEPLOY
echo =========================

git add .

set msg=frontend update %date% %time%
git commit -m "%msg%"

git push

echo DONE! Vercel deploying...
pause