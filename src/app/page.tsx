// app/page.tsx
// Main dashboard overview page

import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';
import Link from 'next/link';

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
  
  // Latest rule changes
  const recentRuleChanges = await prisma.ruleChange.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { oldRuleSet: true, newRuleSet: true },
  });
  
  // PnL history for chart (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const pnlSnapshots = await prisma.pnlSnapshot.findMany({
    where: { collectedAt: { gte: thirtyDaysAgo } },
    orderBy: { collectedAt: 'asc' },
    select: { collectedAt: true, pnl: true },
  });
  
  // Group by day for chart
  const pnlByDay = new Map<string, number>();
  for (const snap of pnlSnapshots) {
    const day = format(snap.collectedAt, 'yyyy-MM-dd');
    pnlByDay.set(day, (pnlByDay.get(day) || 0) + snap.pnl);
  }
  
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
    const day = format(date, 'yyyy-MM-dd');
    return { date: format(date, 'MMM d'), pnl: pnlByDay.get(day) || 0 };
  });
  
  return {
    totalPnl,
    totalRealizedPnl,
    totalUnrealizedPnl,
    winRate: winRate * 100,
    openPositions: openTrades.length,
    trackedWallets,
    watchWallets,
    totalWallets: trackedWallets + watchWallets,
    copiedToday,
    watchedToday,
    skippedToday,
    totalSignals: todayDecisions.length,
    todayDecisions,
    latestReport,
    recentRuleChanges,
    chartData,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hermes Polymarket Bot</h1>
          <p className="text-gray-600 mt-1">Copy trading research dashboard</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/wallets" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Wallet Rankings
          </Link>
          <Link href="/dashboard/signals" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
            Trade Signals
          </Link>
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <MetricCard
          title="Total Paper PnL"
          value={`$${data.totalPnl.toFixed(2)}`}
          subtext={`Realized: $${data.totalRealizedPnl.toFixed(2)} | Unrealized: $${data.totalUnrealizedPnl.toFixed(2)}`}
          color={data.totalPnl >= 0 ? 'green' : 'red'}
        />
        <MetricCard
          title="Win Rate"
          value={`${data.winRate.toFixed(1)}%`}
          subtext={`${data.openPositions} open positions`}
          color="blue"
        />
        <MetricCard
          title="Active Wallets"
          value={`${data.trackedWallets} Track / ${data.watchWallets} Watch`}
          subtext={`${data.totalWallets} total profiled`}
          color="purple"
        />
        <MetricCard
          title="Today's Signals"
          value={data.totalSignals.toString()}
          subtext={`${data.copiedToday} copied, ${data.watchedToday} watched, ${data.skippedToday} skipped`}
          color="orange"
        />
        <MetricCard
          title="Latest Report"
          value={data.latestReport ? format(new Date(data.latestReport.date), 'MMM d') : 'None'}
          subtext={data.latestReport?.sentToTelegram ? 'Sent to Telegram' : 'Not sent'}
          color="gray"
        />
      </div>
      
      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* PnL Chart */}
        <Card title="Paper PnL (Last 30 Days)">
          <div className="h-64">
            <PnLChart data={data.chartData} />
          </div>
        </Card>
        
        {/* Recent Rule Changes */}
        <Card title="Recent Rule Changes">
          {data.recentRuleChanges.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No recent rule changes</p>
          ) : (
            <div className="space-y-3">
              {data.recentRuleChanges.map((change) => (
                <div key={change.id} className="p-3 bg-gray-50 rounded-lg border">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{change.reason}</p>
                      <p className="text-xs text-gray-500">v{change.oldRuleSet.version} → v{change.newRuleSet.version}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {format(new Date(change.createdAt), 'MMM d, h:mm a')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      
      {/* Today's Decisions */}
      <Card title="Today's Decisions">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">Wallet</th>
                <th className="pb-2 pr-4">Market</th>
                <th className="pb-2 pr-4">Decision</th>
                <th className="pb-2 pr-4">Score</th>
                <th className="pb-2 pr-4">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.todayDecisions.slice(0, 10).map((decision) => (
                <tr key={decision.id} className="hover:bg-gray-50">
                  <td className="py-2 pr-4 text-gray-500">
                    {format(new Date(decision.createdAt), 'h:mm a')}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    {decision.walletAddress.slice(0, 8)}...
                  </td>
                  <td className="py-2 pr-4 max-w-xs truncate">
                    {decision.observedTrade?.marketQuestion ? decision.observedTrade.marketQuestion.slice(0, 40) + '...' : (decision.marketId ?? 'Unknown market')}
                  </td>
                  <td className="py-2 pr-4">
                    <DecisionBadge decision={decision.decision} />
                  </td>
                  <td className="py-2 pr-4 font-mono">
                    {decision.copyScore.toFixed(2)}
                  </td>
                  <td className="py-2 pr-4">
                    ${decision.simulatedPositionSize?.toFixed(2) || '0'}
                  </td>
                </tr>
              ))}
              {data.todayDecisions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No decisions today
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}

// Components
function MetricCard({ title, value, subtext, color }: any) {
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };
  
  return (
    <div className={`p-5 rounded-xl border ${colors[color]}`}>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{subtext}</p>
    </div>
  );
}

function Card({ title, children }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function PnLChart({ data }: any) {
  // Simple SVG chart
  const width = '100%';
  const height = 256;
  const padding = 40;
  
  const values = data.map(d => d.pnl);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (parseInt(width) - 2 * padding);
    const y = padding + (1 - (d.pnl - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${parseInt(width)} ${height}`}>
      <polyline
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        points={points}
      />
      {data.map((d, i) => (
        <circle
          key={i}
          cx={padding + (i / (data.length - 1)) * (parseInt(width) - 2 * padding)}
          cy={padding + (1 - (d.pnl - min) / range) * (height - 2 * padding)}
          r={3}
          fill="#3b82f6"
        />
      ))}
    </svg>
  );
}

function DecisionBadge({ decision }: any) {
  const styles = {
    PAPER_COPY: 'bg-green-100 text-green-700',
    WATCHLIST: 'bg-yellow-100 text-yellow-700',
    SKIP: 'bg-gray-100 text-gray-700',
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[decision]}`}>
      {decision.replace('_', ' ')}
    </span>
  );
}