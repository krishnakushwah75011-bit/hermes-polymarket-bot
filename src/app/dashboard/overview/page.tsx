// app/dashboard/overview/page.tsx
// Overview page - main dashboard showing PnL, win rates, active positions, tracked wallets, today's signals, rule structure

import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

async function getDashboardData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Paper trades summary
  const allTrades = await prisma.paperTrade.findMany({
    include: { decisionJournal: true },
  });

  const openTrades = allTrades.filter(t => t.status === 'OPEN');
  const closedTrades = allTrades.filter(t => t.status === 'CLOSED' || t.status === 'RESOLVED');
  const winningTrades = closedTrades.filter(t => t.realizedPnl > 0);

  const totalUnrealizedPnl = openTrades.reduce((sum, t) => sum + t.unrealizedPnl, 0);
  const totalRealizedPnl = closedTrades.reduce((sum, t) => sum + t.realizedPnl, 0);
  const totalPnl = totalUnrealizedPnl + totalRealizedPnl;
  const winRate = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;

  // Active tracked wallets
  const trackedWallets = await prisma.walletProfile.count({ where: { status: 'TRACK' } });
  const watchWallets = await prisma.walletProfile.count({ where: { status: 'WATCH' } });

  // Today's signals
  const todayDecisions = await prisma.decisionJournal.findMany({
    where: { createdAt: { gte: today, lt: tomorrow } },
    include: { walletProfile: true, observedTrade: true },
  });

  const copiedToday = todayDecisions.filter(d => d.decision === 'PAPER_COPY').length;
  const watchedToday = todayDecisions.filter(d => d.decision === 'WATCHLIST').length;
  const skippedToday = todayDecisions.filter(d => d.decision === 'SKIP').length;

  // Latest report
  const latestReport = await prisma.dailyReport.findFirst({
    orderBy: { date: 'desc' },
  });

  // Rule structure
  const activeRules = await prisma.ruleSet.findFirst({
    where: { active: true },
    orderBy: { version: 'desc' },
  });

  // Recent rule changes
  const recentChanges = await prisma.ruleChange.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { oldRuleSet: true, newRuleSet: true },
  });

  // PnL chart data (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const dailyPnl = await prisma.dailyReport.findMany({
    where: { date: { gte: sevenDaysAgo } },
    orderBy: { date: 'asc' },
    select: { date: true, paperPnl: true },
  });

  return {
    totalPnl,
    totalUnrealizedPnl,
    totalRealizedPnl,
    openPositions: openTrades.length,
    closedPositions: closedTrades.length,
    winRate,
    trackedWallets,
    watchWallets,
    copiedToday,
    watchedToday,
    skippedToday,
    latestReport,
    activeRules,
    recentChanges,
    dailyPnl: dailyPnl.map(d => ({
      date: format(new Date(d.date), 'MMM d'),
      pnl: d.paperPnl,
    })),
  };
}

function MetricCard({ title, value, subtext, color }: { title: string; value: string; subtext: string; color: 'green' | 'red' | 'blue' | 'purple' | 'orange' | 'gray' }) {
  const colors: Record<'green' | 'red' | 'blue' | 'purple' | 'orange' | 'gray', string> = {
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return (
    <div className={`p-6 rounded-xl border ${colors[color]}`}>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{subtext}</p>
    </div>
  );
}

function PnLChart({ data }: { data: { date: string; pnl: number }[] }) {
  if (!data.length) return <p className="text-gray-500 text-center py-8">No PnL data yet</p>;

  const maxPnl = Math.max(...data.map(d => Math.abs(d.pnl)), 1);
  const width = 100;

  return (
    <div className="h-64 flex items-end justify-between gap-2 px-2">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center flex-1 min-w-0">
          <div
            className={`w-full max-h-full transition-all duration-300 rounded-t-sm ${
              d.pnl >= 0 ? 'bg-green-500' : 'bg-red-500'
            }`}
            style={{
              height: `${Math.max((Math.abs(d.pnl) / maxPnl) * 100, 4)}%`,
            }}
            title={`${d.date}: ${d.pnl >= 0 ? '+' : ''}$${d.pnl.toFixed(2)}`}
          />
          <span className="text-xs text-gray-500 mt-2">{d.date}</span>
        </div>
      ))}
    </div>
  );
}

function DecisionBadge({ decision }: { decision: 'PAPER_COPY' | 'WATCHLIST' | 'SKIP' }) {
  const styles: Record<'PAPER_COPY' | 'WATCHLIST' | 'SKIP', string> = {
    PAPER_COPY: 'bg-green-100 text-green-700',
    WATCHLIST: 'bg-yellow-100 text-yellow-700',
    SKIP: 'bg-gray-100 text-gray-700',
  };

  return <span className={`px-2 py-1 rounded text-xs font-medium ${styles[decision]}`}>{decision}</span>;
}

export default async function OverviewPage() {
  const data = await getDashboardData();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">HERMES PROFIT ENGINE</h1>
        <p className="text-gray-500 mt-1">Paper Trading Dashboard — Polymarket Copy Trading Research</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total PnL"
          value={`${data.totalPnl >= 0 ? '+' : ''}$${data.totalPnl.toFixed(2)}`}
          subtext={`Realized: ${data.totalRealizedPnl >= 0 ? '+' : ''}$${data.totalRealizedPnl.toFixed(2)} | Unrealized: ${data.totalUnrealizedPnl >= 0 ? '+' : ''}$${data.totalUnrealizedPnl.toFixed(2)}`}
          color={data.totalPnl >= 0 ? 'green' : 'red'}
        />
        <MetricCard
          title="Open Positions"
          value={data.openPositions.toString()}
          subtext={`${data.closedPositions} closed • ${(data.winRate * 100).toFixed(1)}% win rate`}
          color="blue"
        />
        <MetricCard
          title="Tracked Wallets"
          value={data.trackedWallets.toString()}
          subtext={`${data.watchWallets} watching • ${data.copiedToday} copied today`}
          color="purple"
        />
        <MetricCard
          title="Today's Signals"
          value={`${data.copiedToday + data.watchedToday + data.skippedToday}`}
          subtext={`${data.copiedToday} copied • ${data.watchedToday} watched • ${data.skippedToday} skipped`}
          color="orange"
        />
      </div>

      {/* PnL Chart + Rule Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* PnL Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">7-Day PnL</h2>
          <PnLChart data={data.dailyPnl} />
        </div>

        {/* Rule Structure */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Rule Structure</h2>
            {data.activeRules && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                v{data.activeRules.version} Active
              </span>
            )}
          </div>

          {data.activeRules?.rules ? (
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-700">Wallet Scoring</p>
                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <span className="text-gray-500">Min ROI 30d:</span>
                  <span className="font-mono text-gray-900">{(data.activeRules.rules.minRoi30d * 100).toFixed(1)}%</span>
                  <span className="text-gray-500">Min Consistency:</span>
                  <span className="font-mono text-gray-900">{(data.activeRules.rules.minConsistencyScore * 100).toFixed(0)}%</span>
                  <span className="text-gray-500">Min Copyability:</span>
                  <span className="font-mono text-gray-900">{(data.activeRules.rules.minCopyabilityScore * 100).toFixed(0)}%</span>
                  <span className="text-gray-500">Max One-Hit Penalty:</span>
                  <span className="font-mono text-gray-900">{(data.activeRules.rules.maxOneHitWonderPenalty * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-700">Trade Scoring</p>
                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <span className="text-gray-500">Min Copy Score:</span>
                  <span className="font-mono text-gray-900">{(data.activeRules.rules.minTradeScoreForCopy * 100).toFixed(0)}%</span>
                  <span className="text-gray-500">Min Watch Score:</span>
                  <span className="font-mono text-gray-900">{(data.activeRules.rules.minTradeScoreForWatch * 100).toFixed(0)}%</span>
                  <span className="text-gray-500">Min Liquidity:</span>
                  <span className="font-mono text-gray-900">$${data.activeRules.rules.minLiquidityForCopy?.toLocaleString()}</span>
                  <span className="text-gray-500">Max Spread:</span>
                  <span className="font-mono text-gray-900">{(data.activeRules.rules.maxSpreadForCopy * 100).toFixed(1)}%</span>
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-700">Paper Trading</p>
                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <span className="text-gray-500">Position Size:</span>
                  <span className="font-mono text-gray-900">$${data.activeRules.rules.paperMinPosition} - $${data.activeRules.rules.paperMaxPosition}</span>
                  <span className="text-gray-500">Max Concurrent:</span>
                  <span className="font-mono text-gray-900">{data.activeRules.rules.maxConcurrentPaperTrades}</span>
                  <span className="text-gray-500">Stop Loss:</span>
                  <span className="font-mono text-gray-900">{(data.activeRules.rules.stopLossPercent * 100).toFixed(0)}%</span>
                  <span className="text-gray-500">Take Profit:</span>
                  <span className="font-mono text-gray-900">{(data.activeRules.rules.takeProfitPercent * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No active rule set</p>
          }
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Rule Changes */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Rule Changes</h2>
          {data.recentChanges?.length ? (
            <div className="space-y-3">
              {data.recentChanges.slice(0, 5).map((change: any) => (
                <div key={change.id} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-gray-900">
                      {change.beforeJson && change.afterJson ? (
                        <>
                          <span className="text-red-600">{change.beforeJson}</span> →{' '}
                          <span className="text-green-600">{change.afterJson}</span>
                        </>
                      ) : (
                        change.reason
                      )}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(change.createdAt), 'MMM d, HH:mm')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{change.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No rule changes yet</p>
          )}
        </div>

        {/* Latest Report */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Latest Daily Report</h2>
          {data.latestReport ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date</span>
                <span className="font-mono">{format(new Date(data.latestReport.date), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Paper PnL</span>
                <span className={`font-mono font-medium ${data.latestReport.paperPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${data.latestReport.paperPnl >= 0 ? '+' : ''}${data.latestReport.paperPnl.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Win Rate</span>
                <span className="font-mono">{(data.latestReport.winRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Open Positions</span>
                <span className="font-mono">{data.latestReport.openPositions}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Signals Today</span>
                <span className="font-mono">{data.latestReport.newSignals} ({data.latestReport.copiedSignals} copied, {data.latestReport.watchedSignals} watched)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Best Wallet</span>
                <span className="font-mono text-green-600">
                  {JSON.parse(data.latestReport.bestWalletsJson || '[]')[0]?.address?.slice(0, 8)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Rule Changes</span>
                <span className="font-mono text-yellow-600">{JSON.parse(data.latestReport.ruleChangesJson || '[]').length}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="text-gray-500">Telegram</span>
                <span className={data.latestReport.sentToTelegram ? 'text-green-600' : 'text-yellow-600'}>
                  {data.latestReport.sentToTelegram ? 'Sent' : 'Not Sent'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No reports generated yet</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/dashboard/wallets" className="bg-gray-50 hover:bg-gray-100 p-4 rounded-xl text-center transition">
          <p className="text-sm font-medium text-gray-900">Wallet Rankings</p>
          <p className="text-xs text-gray-500 mt-1">Top 500 tracked wallets</p>
        </Link>
        <Link href="/dashboard/signals" className="bg-gray-50 hover:bg-gray-100 p-4 rounded-xl text-center transition">
          <p className="text-sm font-medium text-gray-900">Trade Signals</p>
          <p className="text-xs text-gray-500 mt-1">Today's decisions</p>
        </Link>
        <Link href="/dashboard/paper-trades" className="bg-gray-50 hover:bg-gray-100 p-4 rounded-xl text-center transition">
          <p className="text-sm font-medium text-gray-900">Paper Trades</p>
          <p className="text-xs text-gray-500 mt-1">Open & closed positions</p>
        </Link>
        <Link href="/dashboard/performance" className="bg-gray-50 hover:bg-gray-100 p-4 rounded-xl text-center transition">
          <p className="text-sm font-medium text-gray-900">Performance</p>
          <p className="text-xs text-gray-500 mt-1">Charts & benchmarks</p>
        </Link>
      </div>
    </main>
  );
}