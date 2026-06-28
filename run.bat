@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Mail Cleaner

cd /d "%~dp0"

echo.
echo  ========================================
echo   Mail Cleaner - Setup ^& Run
echo  ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo         Install Node.js 20+ from https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm not found. Reinstall Node.js.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js %NODE_VER%

if not exist "data" mkdir "data"

if not exist "data\credentials.json" (
  echo.
  echo [WARN] Missing data\credentials.json
  echo.
  echo        1. Google Cloud Console - enable Gmail API
  echo        2. Create OAuth Web client
  echo        3. Redirect URI: http://localhost:3000/api/auth/callback
  echo        4. Save JSON as data\credentials.json
  echo.
  echo        Full guide: README.md
  echo.
  if exist "data\credentials.example.json" (
    echo        Example template: data\credentials.example.json
    echo.
  )
  set /p CONTINUE="Continue anyway? (y/N): "
  if /i not "%CONTINUE%"=="y" exit /b 1
)

if not exist "node_modules" (
  echo.
  echo [1/3] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
) else (
  echo [OK] Dependencies already installed
)

echo.
echo [2/3] Starting dev server on http://localhost:3000
echo       Press Ctrl+C to stop.
echo.

timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

echo [3/3] Opening browser...
call npm run dev

if errorlevel 1 (
  echo.
  echo [ERROR] Server stopped with error.
  pause
  exit /b 1
)

endlocal
