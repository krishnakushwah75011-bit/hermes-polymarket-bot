# Polymarket Copy Trading Bot - Status Report

**Date:** 2026-07-13  
**Status:** ✅ OPERATIONAL

---

## Fixes Applied

### 1. Cron Job Module Resolution
**Problem:** Cron jobs failing with "Cannot find module 'polymarket-client'"
**Root Cause:** Scripts use TypeScript (.ts files) but cron was running them with `node` instead of `tsx`
**Fix:** Created wrapper batch files in `scripts/` that run with proper flags:
```bash
node --dns-result-order=ipv4first -r tsx src/scripts/<script>.ts
```
**Updated Jobs:**
- polymarket-monitor-trades
- polymarket-score-trades
- polymarket-update-paper-pnl
- polymarket-review-outcomes
- polymarket-update-rules
- polymarket-scan-wallets
- polymarket-scan-leaderboard

---

## Current State

### Database
| Table | Count |
|-------|-------|
| HistoricalTrade | 8,253 |
| WalletProfile (TRACK) | 14 |
| WalletProfile (IGNORE) | 558 |
| ObservedTrade | 63 |
| DecisionJournal | 63 |
| PaperTrade (OPEN) | 0 |
| DailyReport | 1 |
| MarketMetadata | 153 |

### Cron Jobs Status (8 Total)
| Job | Schedule | Last Run | Status |
|-----|----------|----------|--------|
| collect-trades | every 15m | Running | ✅ OK |
| monitor-trades | */15 8-18 | Fixed | ⏳ Waiting |
| score-trades | 0 */2 8-18 | Fixed | ⏳ Waiting |
| update-paper-pnl | 0 8-18 | Fixed | ⏳ Waiting |
| review-outcomes | 0 6 daily | Fixed | ⏳ Waiting |
| update-rules | 0 6 Sunday | Fixed | ⏳ Waiting |
| scan-wallets | 10,12,14,16,18 M-F | Fixed | ⏳ Waiting |
| scan-leaderboard | 9,12,15,18 M-F | Fixed | ⏳ Waiting |
| daily-report | 30 18 daily | Last: Jul 12 | ✅ OK |

---

## Pipeline Verification

### ✅ Manual Run Results
```
[score:trades] Completed: 2 scored, 0 paper copied, 2 watchlisted
[paper:pnl] Completed: 0 open trades, 0 resolved
[scan:leaderboard] Built leaderboard with 500 wallets
[scan:wallets] Running...
```

### 🔄 In Progress
- **Wallet Scan:** Processing 572 wallets (will set top 200 to TRACKING based on scores)
- **Trade Monitor:** Watching 14 TRACKING wallets for new trades

---

## Next Automated Runs
- **8:30 AM IST:** collect-trades, monitor-trades
- **9:00 AM IST:** scan-leaderboard, update-paper-pnl
- **10:00 AM IST:** scan-wallets, score-trades

---

## Dashboard
**URL:** https://hermes-polymarket-bot-krishnakushwah75011-bits-projects.vercel.app
**Status:** Responsive (Vercel login protection active)

---

## Telegram Integration
**Bot:** @TradHy_bot  
**Chat ID:** 1463103481  
**Daily Report:** 6:30 PM IST

---

## Health Checklist
- [x] All 8 cron jobs configured
- [x] Batch wrappers created for all scripts
- [x] DNS flag added (Airtel IPv4 priority)
- [x] Database accessible (8253 trades collected)
- [x] Leaderboard scan working (500 wallets)
- [x] Wallet scanning running
- [ ] First full cycle complete (waiting on cron schedule)
- [ ] COPY decisions made (need scored trades first)
- [ ] Paper trades opened (depend on COPY decisions)

---

## Expected Flow
1. **Leaderboard Scan** → finds top wallets
2. **Wallet Scan** → analyzes metrics, sets TRACK status on top 200
3. **Monitor Trades** → detects new trades from TRACKING wallets
4. **Score Trades** → evaluates each trade (COPY/WATCH/SKIP)
5. **Paper Engine** → opens simulated positions for COPY decisions
6. **Update PnL** → tracks unrealized/realized PnL hourly
7. **Daily Report** → summarizes day's performance to Telegram

---

**Time to Full Operation:** ~2 hours (next scheduled runs at 9:00 AM and 10:00 AM IST)