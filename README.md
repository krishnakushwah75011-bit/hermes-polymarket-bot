# Hermes Polymarket Copy Trading Bot

A self-improving Polymarket copy trading research system with paper trading, wallet scoring, and automatic rule adaptation.

## ⚠️ Safety First

**This is a RESEARCH/EDUCATIONAL system only:**
- ✅ Paper trading only - no real trades executed
- ✅ No private keys stored or requested
- ✅ No transaction signing
- ✅ No money spent
- ✅ Public API endpoints only
- ✅ Secrets redacted in logs and UI

**Version 1 does NOT place real trades.** The long-term goal is eventual autonomy after paper trading proves the edge.

## What It Does

1. **Pulls Polymarket/Bullpen leaderboard** - Top 500 wallets
2. **Scans 30-day wallet activity** - Fetches complete trade history
3. **Scores wallets** by ROI, consistency, copyability, category edge, liquidity quality, entry timing
4. **Penalizes one-hit-wonders** - Wallets where most profit came from one lucky trade
5. **Ranks wallets globally and by category** - TRACK / WATCH / IGNORE status
6. **Monitors tracked wallets** - Detects new trades in real-time
7. **Scores each new trade** - Wallet quality + market conditions + rules
8. **Paper trades** with $5-$20 simulated positions
9. **Updates PnL hourly** - Tracks unrealized/realized PnL
10. **Reviews outcomes** when markets resolve
11. **Compares bot-filtered vs blind copy** - Missed winners, avoided losers
12. **Auto-updates rules** based on performance evidence
13. **Sends daily Telegram reports** - PnL, wins/losses, rule changes, lessons

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Layer 1: Hermes Agent                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Scheduler  │  │   Scanner   │  │    Paper Engine     │  │
│  │  (Cron)     │  │  (Wallets)  │  │  ($5-$20 positions) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Monitor    │  │   Scorer    │  │    Rules Engine     │  │
│  │  (Trades)   │  │  (Decisions)│  │  (Self-Improving)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Layer 2: Vercel Dashboard               │
│  Overview │ Wallets │ Signals │ Paper Trades │ Decisions    │
│  Performance │ Rules │ Reports                                     │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Runtime**: Node.js 20+ / Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: SQLite (local) / PostgreSQL (production) via Prisma
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **APIs**: Polymarket Gamma, CLOB, Data API + Bullpen fallback
- **Deployment**: Vercel (dashboard) + Hermes cron (backend)

## Quick Start

### Prerequisites

- Node.js 20+
- npm or pnpm
- (Optional) Telegram bot token for reports

### Installation

```bash
cd hermes-polymarket-bot
npm install
npm run db:generate
npm run db:push
npm run db:seed  # Optional: seed sample data
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL="file:./dev.db"

# Polymarket APIs (no auth required)
POLYMARKET_GAMMA_API="https://gamma-api.polymarket.com"
POLYMARKET_CLOB_API="https://clob.polymarket.com"
POLYMARKET_DATA_API="https://data-api.polymarket.com"
BULLPEN_API="https://api.bullpen.fi"

# Telegram (optional)
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SCAN_LOOKBACK_DAYS=30
MAX_WALLETS_TO_SCAN=500
```

### Running Locally

```bash
# Terminal 1: Start Next.js dashboard
npm run dev

# Terminal 2: Run scans manually (or use Hermes cron)
npm run scan:leaderboard
npm run scan:wallets
npm run monitor:trades
npm run paper:update-pnl
npm run report:daily
```

### Hermes Integration

The `hermes-cron-jobs.json` file contains cron job definitions for Hermes Agent:

```bash
# Import into Hermes (example)
hermes cron import hermes-cron-jobs.json
```

Or manually create jobs with the schedules and scripts defined.

## Database Schema

12 models covering the full lifecycle:
- `LeaderboardScan` - Scan metadata
- `WalletProfile` - Scored wallets with all metrics
- `ObservedTrade` - Detected wallet trades
- `MarketSnapshot` - Hourly market data
- `DecisionJournal` - Every copy decision with score breakdown
- `PaperTrade` - Simulated positions
- `PnlSnapshot` - Hourly PnL history
- `OutcomeReview` - Post-resolution analysis
- `RuleSet` - Versioned scoring rules
- `RuleChange` - Rule change history
- `DailyReport` - End-of-day summaries

## Scoring Methodology

### Wallet Scoring (0-1)

```
globalScore = 
  (roi × 0.25) +
  (consistency × 0.20) +
  (copyability × 0.20) +
  (liquidity × 0.10) +
  (spread × 0.10) +
  (timing × 0.05) +
  (diversity × 0.10) -
  (oneHitWonderPenalty × 0.30)
```

**One-Hit-Wonder Penalty**: 0.8 if <3 resolved trades, 0.6 if >10 trades/win with high ROI, 0.5 if win rate <40% but ROI >20%

### Trade Scoring (0-1)

```
score = 
  walletQuality × 0.30 +
  priceMovement × 0.20 +
  liquidity × 0.15 +
  spread × 0.10 +
  timeToResolution × 0.10 +
  categoryMatch × 0.10 +
  positionSize × 0.05
```

**Decisions**:
- `PAPER_COPY`: Score ≥ 0.65 + favorable price movement + good liquidity
- `WATCHLIST`: Score 0.45-0.65
- `SKIP`: Below thresholds, illiquid, wide spread, <1h to resolution

### Position Sizing

$5-$20 per trade, scaled by conviction (score 0.65→$5, 1.0→$20)

## Self-Improving Rules Engine

Weekly (Sunday 3 AM), the system analyzes last 30 days of paper trades:

| Trigger | Condition | Action |
|---------|-----------|--------|
| Low-liq losses | ≥5 low-liq trades losing | minLiquidity × 1.5 |
| Wide-spread losses | >65% loss rate on spread>5% | maxSpread × 0.7 |
| Category outperformance | One category 30% better win rate | categoryMatch weight × 1.5 |
| One-hit-wonder losses | High-penalty wallets losing 70%+ | maxOneHitWonderPenalty × 1.2 |
| Late entry losses | Late entries (>15% move) losing 70%+ | maxPriceMovementSinceEntry × 0.8 |
| Sub-threshold winning | Below-threshold wallets winning 60%+ | minWinRate × 0.95 |

**Safety**: Minimum 20 trades for adaptation, p<0.05 significance, max 50% parameter change per cycle, all changes logged with evidence.

## Dashboard Pages

1. **Overview** - Total PnL, win rate, open positions, tracked wallets, today's signals, latest report, rule changes, PnL chart
2. **Wallet Rankings** - Top 500 with all scores, status, rank
3. **Wallet Profile** - Deep dive: 30d ROI, trades, win rate, category strengths, liquidity profile, recent trades, paper performance
4. **Trade Signals** - New wallet trades with decision, score, reasons, risks
5. **Paper Trades** - Simulated positions with hourly PnL, status, entry/exit
6. **Decision Journal** - Every decision with score breakdown, post-hoc judgment
7. **Performance** - PnL chart, win rate chart, category/wallet performance, bot vs blind copy
8. **Rules** - Active version, thresholds, auto-changes with evidence, history
9. **Reports** - Daily/weekly reports, best/worst wallets, rule updates

## API Endpoints

All endpoints under `/api/`:

- `GET /api/wallets` - List wallets with filters
- `GET /api/wallets/[address]` - Wallet profile
- `GET /api/signals` - Trade signals
- `GET /api/paper-trades` - Paper positions
- `GET /api/performance` - Performance metrics
- `GET /api/rules` - Active rules and history
- `GET /api/reports` - Daily/weekly reports

## Testing

```bash
npm run test        # Run all tests
npm run test:watch  # Watch mode
```

Test coverage includes:
- Wallet scoring (ROI, consistency, copyability, one-hit-wonder)
- Trade scoring (components, decisions, hard filters)
- Paper trade creation and PnL updates
- Hourly PnL updates
- Rule versioning
- Automatic rule changes
- Benchmark comparison
- Read-only safety (no real execution)

## Deployment

### Vercel (Dashboard)

1. Push to GitHub
2. Connect repo in Vercel
3. Add `DATABASE_URL` (PostgreSQL recommended)
4. Deploy - dashboard at `your-app.vercel.app`

### Production Database

Use PostgreSQL for production:

```env
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public"
```

Run migrations:
```bash
npm run db:migrate
```

### Hermes Cron (Backend)

The backend runs as scheduled scripts via Hermes Agent. Ensure:
- Node.js 20+ available
- Scripts directory accessible
- Environment variables set in Hermes

## API Limitations

- **Gamma API**: ~60 req/min
- **CLOB API**: ~1200 req/min
- **Data API**: ~100 req/min
- Built-in rate limiting with exponential backoff

## Known Limitations (v1)

1. No real trade execution - paper only
2. Wallet resolution tracking uses market end dates (not oracle resolution)
3. Blind copy benchmark not fully implemented (needs historical leaderboard snapshots)
4. Category detection relies on Polymarket's categorization
5. Telegram alerts minimal by design
6. Single-user (no auth)

## Future Enhancements (v2+)

- [ ] Real trade execution with wallet integration
- [ ] Multi-user with authentication
- [ ] Advanced portfolio optimization
- [ ] Cross-market arbitrage detection
- [ ] ML-based trade scoring
- [ ] Mobile app
- [ ] Webhook-based real-time trade detection

## License

MIT - Educational/Research purposes only. Not financial advice.

## Disclaimer

**This software is for educational and research purposes only. It does not constitute financial advice. Prediction markets involve substantial risk of loss. Past performance does not guarantee future results. Never trade with money you cannot afford to lose.**