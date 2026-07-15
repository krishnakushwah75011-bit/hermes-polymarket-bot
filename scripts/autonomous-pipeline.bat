@echo off
cd /d "%~dp0.."
node --dns-result-order=ipv4first -r tsx scripts/autonomous-pipeline.ts %*