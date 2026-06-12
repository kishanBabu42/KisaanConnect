@echo off
title 🌾 KisaanConnect Professional Server
setlocal enabledelayedexpansion

echo ===================================================
echo   🌾 KISAAN CONNECT — AUTO-REPAIR BOOTLOADER 🌾
echo ===================================================
echo.

:: 1. Aggressive Port Cleaning
echo [1/4] Scanning for port 3000 conflicts...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo [!] ALERT: Process %%a is blocking Port 3000. Killing it...
    taskkill /F /PID %%a >nul 2>&1
)
echo [OK] Port 3000 is clean.

:: 2. Ghost Node Cleanup
echo [2/4] Cleaning up orphaned Node.js processes...
taskkill /F /IM node.exe /T >nul 2>&1
echo [OK] Node processes cleared.

:: 3. IP Discovery for Console
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr "IPv4" ^| findstr /v "127.0.0.1"') do (
    set IP=%%i
    set IP=!IP:~1!
)

:: 4. Launch with Auto-Diagnostic
echo [3/4] Starting Professional Server...
echo.
echo ---------------------------------------------------
echo  📱 MOBILE ACCESS: http://!IP!:3000
echo  🏠 LOCAL ACCESS:  http://localhost:3000
echo ---------------------------------------------------
echo.
node server.js
pause
