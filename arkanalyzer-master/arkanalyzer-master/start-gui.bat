@echo off
cd /d "%~dp0"
title HarmonyOS Lifecycle GUI

echo.
echo ============================================================
echo   HarmonyOS Lifecycle Analyzer - Starting GUI Server...
echo ============================================================
echo.
echo   Browser will open at: http://localhost:3000
echo   Press Ctrl+C to stop the server
echo.
echo ------------------------------------------------------------
echo.

set OPEN_BROWSER=1
npx ts-node src/TEST_lifecycle/gui/server.ts

pause
