// app/dashboard/overview/page.tsx
// Overview page - main dashboard showing PnL, win rates, active positions, tracked wallets, today's signals, rule structure

import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';
import Link from 'next/link';
import PnLChart from '../../components/pnl-chart-simple';

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

  // Active rule set
  const activeRules = await prisma.ruleSet.findFirst({
    where: { active: true },
    orderBy: { version: 'desc' },
  });

  return {
    totalPnl,
    totalUnrealizedPnl,
    totalRealizedPnl,
    winRate,
    openPositions: openTrades.length,
    totalTrades: allTrades.length,
    trackedWallets,
    watchWallets,
    copiedToday,
    watchedToday,
    skippedToday,
    latestReport,
    activeRules,
    openTrades: openTrades.slice(0, 5),
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
    <div className={`p-6 rounded-xl border ${colors[color]} shadow-sm`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{subtext}</p>
    </div>
  );
}

function DecisionBadge({ decision }: { decision: 'PAPER_COPY' | 'WATCHLIST' | 'SKIP' }) {
  const styles: Record<'PAPER_COPY' | 'WATCHLIST' | 'SKIP', string> = {
    PAPER_COPY: 'bg-green-100 text-green-700',
    WATCHLIST: 'bg-yellow-100 text-yellow-700',
    SKIP: 'bg-gray-100 text-gray-700',
  };

  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[decision]}`}>{decision}</span>;
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  // Generate PnL chart data (last 7 days)
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      date: format(date, 'MMM d'),
      pnl: Math.random() * 100 - 50, // placeholder
    };
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Polymarket Copy Trading Bot - Paper Trading Dashboard</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Net P&L"
          value={`$${data.totalPnl.toFixed(2)}`}
          subtext={`Unrealized: $${data.totalUnrealizedPnl.toFixed(2)} | Realized: $${data.totalRealizedPnl.toFixed(2)}`}
          color={data.totalPnl >= 0 ? 'green' : 'red'}
        />
        <MetricCard
          title="Win Rate"
          value={`${(data.winRate * 100).toFixed(1)}%`}
          subtext={`${data.totalTrades} total trades | ${data.openPositions} open`}
          color={data.winRate >= 0.5 ? 'green' : 'red'}
        />
        <MetricCard
          title="Tracked Wallets"
          value={`${data.trackedWallets} TRACK / ${data.watchWallets} WATCH`}
          subtext={`${data.copiedToday} copied today | ${data.watchedToday} watched`}
          color="blue"
        />
        <MetricCard
          title="Active Rules"
          value={`v${data.activeRules?.version || 0}`}
          subtext={`Last updated: ${data.activeRules ? format(new Date(data.activeRules.updatedAt), 'MMM d, yyyy') : 'Never'}`}
          color="purple"
        />
      </div>

      {/* Charts & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* PnL Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">P&L Trend (7 Days)</h2>
          <PnLChart data={chartData} />
        </div>

        {/* Open Positions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Open Positions</h2>
            <Link href="/dashboard/paper-trades" className="text-sm text-blue-600 hover:underline">
              View All →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="p-4">Market</th>
                  <th className="p-4">Outcome</th>
                  <th className="p-4">Side</th>
                  <th className="p-4">Entry</th>
                  <th className="p-4">Current</th>
                  <th className="p-4">P&L</th>
                  <th className="p-4">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.openTrades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-gray-500">No open positions</td>
                  </tr>
                ) : (
                  data.openTrades.map((trade) => {
                    const pnl = trade.unrealizedPnl;
                    return (
                      <tr key={trade.id} className="hover:bg-gray-50">
                        <td className="p-4 font-mono text-gray-700">{trade.marketId.slice(0, 12)}...</td>
                        <td className="p-4">{trade.outcome}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs ${trade.side === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="p-4 font-mono">${trade.entryPrice.toFixed(4)}</td>
                        <td className="p-4 font-mono">${trade.currentPrice.toFixed(4)}</td>
                        <td className="p-4 font-mono font-medium {pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                          ${pnl.toFixed(2)}
                        </td>
                        <td className="p-4">${trade.simulatedPositionSize.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Today's Signals */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Today's Signals</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="p-4">Market</th>
                <th className="p-4">Wallet</th>
                <th className="p-4">Outcome</th>
                <th className="p-4">Side</th>
                <th className="p-4">Score</th>
                <th className="p-4">Decision</th>
                <th className="p-4">Time</th>
              </thead>
              <tbody className="divide-y">
                {/* Would populate with todayDecisions data */}
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500">No signals today</td>
                </tr>
              </tbody>
            </table>
          </div>
      </div>

      {/* Active Rule Structure */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Rule Structure (v{data.activeRules?.version || 0})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.activeRules?.rules && Object.entries(data.activeRules.rules).map(([key, value]) => (
            <div key={key} className="bg-gray-50 p-4 rounded-lg">
              <p className="text-xs text-gray-500 font-mono">{key}</p>
              <p className="text-lg font-semibold">{typeof value === 'object' ? JSON.stringify(value) : value}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}