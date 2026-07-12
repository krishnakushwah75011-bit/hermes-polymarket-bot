@echo off
REM ============================================
REM Hermes Polymarket Bot - Daily Cron Schedule
REM ============================================
REM This script sets up Windows Task Scheduler jobs
REM for the Polymarket copy trading bot.
REM 
REM Schedule:
REM - Every 10 minutes 8AM-6PM: Core trading loop
REM - Daily 9AM: Leaderboard scan
REM - Daily 6:30PM: Daily report
REM ============================================

set SCRIPT_DIR=%~dp0
cd /d %SCRIPT_DIR%

echo.
echo ========================================
echo  Setting up Cron Schedule
echo ========================================
echo.
echo This will create Windows Task Scheduler jobs.
echo Requires: Administrator privileges
echo.
pause

REM Check admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo ERROR: Run as Administrator!
    echo Right-click this file -^> "Run as administrator"
    pause
    exit /b 1
)

echo.
echo [1/3] Creating core trading task (every 10 min, 8AM-6PM)...
schtasks /Create /TN "Polymarket-Trading" /TR "cmd /c 'cd /d %SCRIPT_DIR% && node --dns-result-order=ipv4first -r dotenv/config -r tsx/esm src/scripts/monitor-trades.ts'" /SC MINUTE /MO 10 /RH 8 /RT 18 /RU SYSTEM /RL HIGHEST /F >nul 2>&1
if %errorLevel% equ 0 (
    echo OK: Core trading task created
) else (
    echo FAILED: Could not create core trading task
)

echo.
echo [2/3] Creating leaderboard scan task (daily 9AM)...
schtasks /Create /TN "Polymarket-Leaderboard" /TR "cmd /c 'cd /d %SCRIPT_DIR% && node --dns-result-order=ipv4first -r dotenv/config -r tsx/esm src/scripts/scan-leaderboard.ts'" /SC DAILY /ST 09:00 /RU SYSTEM /RL HIGHEST /F >nul 2>&1
if %errorLevel% equ 0 (
    echo OK: Leaderboard task created
) else (
    echo FAILED: Could not create leaderboard task
)

echo.
echo [3/3] Creating daily report task (daily 6:30PM)...
schtasks /Create /TN "Polymarket-Daily-Report" /TR "cmd /c 'cd /d %SCRIPT_DIR% && node --dns-result-order=ipv4first -r dotenv/config -r tsx/esm src/scripts/generate-daily-report.ts'" /SC DAILY /ST 18:30 /RU SYSTEM /RL HIGHEST /F >nul 2>&1
if %errorLevel% equ 0 (
    echo OK: Daily report task created
) else (
    echo FAILED: Could not create daily report task
)

echo.
echo ========================================
echo  Schedule Summary
echo ========================================
echo.
schtasks /Query /TN "Polymarket-Trading" /V | findstr "TaskName Next Run"
schtasks /Query /TN "Polymarket-Leaderboard" /V | findstr "TaskName Next Run"
schtasks /Query /TN "Polymarket-Daily-Report" /V | findstr "TaskName Next Run"

echo.
echo To view all tasks: schtasks /Query | findstr "Polymarket"
echo To delete tasks:   schtasks /Delete /TN "Polymarket-*" /F
echo.
pause