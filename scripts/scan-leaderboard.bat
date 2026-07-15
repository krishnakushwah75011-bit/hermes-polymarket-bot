@echo off
cd /d "%~dp0.."
REM FIX: Use Windows .cmd wrapper for tsx (not bash script)
REM Cron jobs run via cmd.exe, not git-bash
node --dns-result-order=ipv4first node_modules/.bin/tsx.cmd src/scripts/scan-leaderboard.ts %*