# Safety Documentation

## Why Version One Is Paper Trading Only

This system is designed as a **research and educational tool** to validate copy trading strategies on Polymarket before any real capital is deployed. Version 1 explicitly:

- **Does not execute real trades** - All positions are simulated
- **Does not store private keys** - No wallet credentials are ever requested or stored
- **Does not sign transactions** - No cryptographic operations on user behalf
- **Does not spend money** - Zero financial risk in v1
- **Uses only public APIs** - Gamma, CLOB, and Data APIs require no authentication

The long-term goal is autonomy, but **only after paper trading proves a consistent edge** over sufficient sample size (minimum 100+ paper trades with positive expectancy).

## Why Real Execution Is Disabled

1. **Regulatory uncertainty** - Prediction market regulations vary by jurisdiction
2. **Smart contract risk** - Polymarket contracts could have vulnerabilities
3. **Oracle risk** - Market resolution depends on UMA oracle integrity
4. **Liquidity risk** - Slippage on real execution could eliminate paper profits
5. **Counterparty risk** - CLOB orderbook could have gaps during volatility
6. **Model risk** - Scoring methodology may have unseen flaws

## How Autonomy Could Be Added Later

If/when paper trading demonstrates consistent profitability:

1. **Wallet integration** - Add optional EIP-712 signing for CLOB orders
2. **Position management** - Real-time hedging and stop-loss execution
3. **Capital allocation** - Kelly criterion sizing with drawdown limits
4. **Multi-account support** - Sub-accounts for strategy isolation
5. **Audit trail** - Immutable on-chain record of all decisions

**Each step would require explicit user approval and extensive testnet validation.**

## Risks of Stale Data

- **Leaderboard lag** - Polymarket leaderboard updates ~hourly; wallet scores may be stale
- **Trade detection delay** - 15-min monitoring interval means new trades detected with latency
- **Price staleness** - CLOB prices can move between snapshot and decision
- **Resolution timing** - Market end dates ≠ resolution times; markets can resolve early/late

**Mitigation**: Hourly PnL updates, 4-hour trade lookback window, explicit staleness checks in scoring.

## Risks of Low Liquidity

- **Wide spreads** - Cost to enter/exit can exceed expected value
- **Slippage** - Large paper positions may not be fillable in reality
- **Manipulation risk** - Thin markets vulnerable to wash trading
- **Resolution uncertainty** - Low-liquidity markets may have disputed outcomes

**Mitigation**: Minimum $1,000 liquidity threshold, max 5% spread, position size caps.

## Risks of Wide Spreads

- **Hidden costs** - Midpoint price ≠ executable price
- **Adverse selection** - Market makers widen spreads before informed trades
- **Execution failure** - Limit orders may not fill at expected prices

**Mitigation**: Spread score component, max 5% spread for paper copies, real-time spread monitoring.

## Risks of Copy Trading

- **Survivorship bias** - Leaderboard shows winners, not losers who blew up
- **Strategy drift** - Wallet behavior may change over time
- **Information asymmetry** - Wallet may have private info we lack
- **Correlation risk** - Multiple wallets copying same signal = herd behavior
- **Timing disadvantage** - We always enter after the wallet

**Mitigation**: 
- One-hit-wonder penalty
- Entry timing score (penalize late entries)
- Price movement score (require favorable move since wallet entry)
- Category-specific tracking
- Blind copy benchmark comparison

## Why Leaderboard Wallets Can Be Misleading

1. **Selection bias** - Only top 500 shown; thousands of losing wallets invisible
2. **Time window gaming** - 30-day ROI can be inflated by one big win
3. **Category masking** - Wallet may be skilled in politics but copying their crypto trades fails
4. **Volume distortion** - High-volume wallets may be market makers, not directional traders
5. **Syndicate behavior** - Coordinated groups can manipulate leaderboard rankings

**Our approach**: Deep 30-day analysis, category-specific scoring, one-hit-wonder detection, consistency weighting over raw ROI.

## Why Private Keys Should Never Be Stored

1. **Single point of failure** - Compromise = total loss of all managed funds
2. **No recovery** - Blockchain transactions are irreversible
3. **Insider risk** - Any system access = potential key access
4. **Regulatory liability** - Custody implies legal obligations
5. **Audit impossibility** - Cannot prove keys weren't misused

**Our architecture**: 
- Read-only public API access
- Paper trading = no keys needed
- If v2 adds execution: hardware wallet integration, multi-sig, user-held keys only

## Data Privacy

- No personal data collected
- Wallet addresses are public on-chain data
- Telegram chat ID stored only if user configures alerts
- All logs redact sensitive values (API tokens, etc.)
- Local SQLite - no cloud database unless user deploys to Vercel with PostgreSQL

## Emergency Procedures

If anomalous behavior detected:

1. **Kill switch** - Stop all cron jobs via Hermes: `hermes cron pause polymarket-*`
2. **Data integrity** - SQLite database is append-only for critical tables
3. **Rollback** - Rule versions allow instant reversion: `hermes cron run update-rules --version N-1`
4. **Investigation** - Decision journal provides full audit trail of every action

## Compliance Notes

- This is **not** a registered investment advisor
- No fiduciary duty to users
- No guarantee of profits
- User responsible for their own deployment decisions
- Check local laws before using prediction market data