@echo off
REM ============================================
REM Initialize Polymarket Bot Database
REM ============================================
REM Run this ONCE to:
REM 1. Scan the Polymarket leaderboard
REM 2. Populate WalletProfile table
REM 3. Fetch initial trade data
REM ============================================

set SCRIPT_DIR=%~dp0
cd /d %SCRIPT_DIR%

echo.
echo ========================================
echo  Initializing Database
echo ========================================
echo.
echo This will:
echo   1. Scan Polymarket leaderboard
echo   2. Save top wallets to database
echo   3. Fetch their trade history
echo.
echo First run may take 1-2 minutes...
echo.
pause

echo.
echo [1/3] Scanning leaderboard...
node --dns-result-order=ipv4first -r dotenv/config -r tsx/esm src/scripts/scan-leaderboard.ts 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Leaderboard scan failed
    pause
    exit /b 1
)

echo.
echo [2/3] Scanning wallets...
node --dns-result-order=ipv4first -r dotenv/config -r tsx/esm src/scripts/scan-wallets.ts 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Wallet scan failed
    pause
    exit /b 1
)

echo.
echo [3/3] Scoring wallets...
node --dns-result-order=ipv4first -r dotenv/config -r tsx/esm src/scripts/score-trades.ts 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Wallet scoring failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Initialization Complete!
echo ========================================
echo.
echo Database is now populated with:
echo   - Wallet profiles from leaderboard
echo   - Trade history for tracked wallets
echo   - Wallet scores and rankings
echo.
echo Next steps:
echo   1. Run setup-cron.bat to schedule automated scans
echo   2. Monitor the dashboard: https://hermes-polymarket-bot-krishnakushwah75011-bits-projects.vercel.app
echo.
pause