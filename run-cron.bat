@echo off
REM ============================================
REM Run Cron Script with IPv4 DNS Fix
REM ============================================
REM Usage: run-cron.bat <script-path>
REM Example: run-cron.bat src/scripts/scan-leaderboard.ts
REM ============================================

if "%~1"=="" (
    echo Usage: run-cron.bat ^<script-path^>
    echo Example: run-cron.bat src/scripts/scan-leaderboard.ts
    exit /b 1
)

set SCRIPT_DIR=%~dp0
cd /d %SCRIPT_DIR%

echo [run-cron] Starting %~1 with IPv4 DNS override...
echo [run-cron] DNS order: ipv4first
echo.

node --dns-result-order=ipv4first -r dotenv/config -r tsx/esm %~1