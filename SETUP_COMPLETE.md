# Polymarket Copy Trading Bot - Setup Complete

## ✅ Completed Setup

### 1. Supabase Database
- **Tables Created**: All 13 tables migrated successfully
- **Connection**: Working with IPv4 DNS override
- **Location**: https://supabase.com/dashboard/project/iaxfwsjjmwvlqyqvzvfb

### 2. Vercel Dashboard
- **Status**: ✅ Live
- **URL**: https://hermes-polymarket-bot-krishnakushwah75011-bits-projects.vercel.app
- **Dashboard**: https://hermes-polymarket-bot-krishnakushwah75011-bits-projects.vercel.app/dashboard/overview

### 3. Cron Scripts
- **DNS Fix**: IPv4 resolution via `--dns-result-order=ipv4first`
- **Wrapper**: `run-cron.bat` for running any script
- **All 11 scripts**: Ready to run

---

## 🚀 Next Steps (In Order)

### Step 1: Initialize Database (Run ONCE)
```bash
cd C:\Users\krish\hermes-polymarket-bot
./init-database.bat
```

This will:
- Scan Polymarket leaderboard
- Populate WalletProfile table with top traders
- Fetch their trade history
- Score the wallets

**Takes:** 2-5 minutes on first run

---

### Step 2: Test Telegram Notifications
```bash
./test-telegram.bat
```

This sends a test message to your Telegram (@TradHy_bot).

**Expected:** You receive a message saying "Bot is ready to send trading alerts!"

---

### Step 3: Set Up Cron Schedule
```bash
# Run as Administrator
./setup-cron.bat
```

This creates Windows Task Scheduler jobs:
- **Core Trading**: Every 10 minutes (8AM-6PM)
- **Leaderboard Scan**: Daily at 9AM
- **Daily Report**: Daily at 6:30PM

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `init-database.bat` | One-time database initialization |
| `setup-cron.bat` | Set up automated schedule |
| `test-telegram.bat` | Test Telegram notifications |
| `run-cron.bat <script>` | Run any cron script manually |
| `.env` | Environment variables (DB, Telegram) |

---

## 🔧 Manual Commands

### Run Individual Scripts
```bash
cd C:\Users\krish\hermes-polymarket-bot

# Scan leaderboard (fetch top traders)
./run-cron.bat src/scripts/scan-leaderboard.ts

# Scan wallets (fetch trade history)
./run-cron.bat src/scripts/scan-wallets.ts

# Score wallets
./run-cron.bat src/scripts/score-trades.ts

# Update paper P&L
./run-cron.bat src/scripts/update-paper-pnl.ts

# Generate daily report
./run-cron.bat src/scripts/generate-daily-report.ts
```

### View Scheduled Tasks
```bash
schtasks /Query | findstr "Polymarket"
```

### Delete All Tasks
```bash
schtasks /Delete /TN "Polymarket-Trading" /F
schtasks /Delete /TN "Polymarket-Leaderboard" /F
schtasks /Delete /TN "Polymarket-Daily-Report" /F
```

---

## 📊 Monitoring

### Dashboard
- Live at: https://hermes-polymarket-bot-krishnakushwah75011-bits-projects.vercel.app/dashboard
- Shows: P&L, win rate, tracked wallets, open positions

### Telegram
- Bot: @TradHy_bot
- Daily reports at 6:30PM
- Trade alerts (configured in scripts)

### Database
- Supabase Dashboard: https://supabase.com/dashboard/project/iaxfwsjjmwvlqyqvzvfb
- Tables: WalletProfile, PaperTrade, DecisionJournal, etc.

---

## ⚠️ Troubleshooting

### Scripts exit immediately
This is normal if database is empty. Run `init-database.bat` first.

### DNS errors
Ensure Google DNS (8.8.8.8 / 8.8.4.4) is set in Windows network settings.

### Telegram not sending
Check `.env` has correct `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.

### Task Scheduler jobs not running
Check task history:  
```bash
schtasks /Query /TN "Polymarket-Trading" /V /FO LIST
```

---

## 📈 Expected Workflow

1. **First Run**: `init-database.bat` populates database with ~20-50 wallets
2. **Daily 9AM**: Leaderboard scan adds new top traders
3. **Every 10 min**: Monitor trades, update P&L, score new trades
4. **Daily 6:30PM**: Telegram report with daily summary

---

## 🎯 Success Criteria

After initialization, you should see:
- ✅ `WalletProfile` table has 20+ wallets
- ✅ `PaperTrade` table has trade records
- ✅ Dashboard shows non-zero metrics
- ✅ Telegram test message received
- ✅ Cron tasks scheduled and running

---

**Created:** 2026-07-12  
**Status:** Ready for production use