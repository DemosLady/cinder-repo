@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
pushd "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed or not in PATH.
  echo Get it from https://git-scm.com/download/win
  pause
  popd
  exit /b 1
)

REM First run: create the repo and connect the remote
if not exist ".git" (
  echo No git repository here yet. Setting one up...
  git init
  git branch -M main
  set /p REMOTE="Paste your GitHub repo URL: "
  git remote add origin "!REMOTE!"
)

git add -A

set "MSG=%~1"
if "!MSG!"=="" set /p MSG="Commit message (Enter = timestamp): "
if "!MSG!"=="" set "MSG=update !DATE! !TIME!"

git commit -m "!MSG!"
if errorlevel 1 echo Nothing new to commit - pushing current state...

git push -u origin main

echo.
echo Done. If the repo is connected to Vercel, it will redeploy automatically.
pause
popd
endlocal
