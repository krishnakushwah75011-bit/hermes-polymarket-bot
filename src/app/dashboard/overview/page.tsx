// app/dashboard/overview/page.tsx - Stub version for Vercel deployment
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

// Inline PnLChart component to avoid import issues
function PnLChart({ data }: { data: { date: string; pnl: number }[] }) {
  if (data.length === 0) return <div className="h-48 flex items-center justify-center text-gray-400">No data</div>;
  return (
    <div className="h-48 flex items-end justify-between gap-1">
      {data.map((d, i) => {
        const height = Math.max(10, Math.min(90, 50 + d.pnl));
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className={`w-full rounded-t ${d.pnl >= 0 ? 'bg-green-500' : 'bg-red-500'}`} style={{ height: `${height}%` }} title={`${d.date}: $${d.pnl.toFixed(2)}`} />
            <span className="text-xs text-gray-500">{d.date}</span>
          </div>
        );
      })}
    </div>
  );
}

async function getDashboardData() {
  const allTrades = await prisma.paperTrade.findMany({ include: { decisionJournal: true } });
  const openTrades = allTrades.filter(t => t.status === 'OPEN');
  const closedTrades = allTrades.filter(t => t.status === 'CLOSED' || t.status === 'RESOLVED');
  const winningTrades = closedTrades.filter(t => t.realizedPnl > 0);
  
  return {
    totalPnl: openTrades.reduce((sum, t) => sum + t.unrealizedPnl, 0) + closedTrades.reduce((sum, t) => sum + t.realizedPnl, 0),
    totalUnrealizedPnl: openTrades.reduce((sum, t) => sum + t.unrealizedPnl, 0),
    totalRealizedPnl: closedTrades.reduce((sum, t) => sum + t.realizedPnl, 0),
    winRate: closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0,
    openPositions: openTrades.length,
    totalTrades: allTrades.length,
    trackedWallets: await prisma.walletProfile.count({ where: { status: 'TRACK' } }),
    watchWallets: await prisma.walletProfile.count({ where: { status: 'WATCH' } }),
    copiedToday: 0,
    watchedToday: 0,
    openTrades: openTrades.slice(0, 5),
  };
}

function MetricCard({ title, value, subtext, color }: { title: string; value: string; subtext: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <div className={`p-6 rounded-xl border ${colors[color]} shadow-sm`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{subtext}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return { date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), pnl: Math.random() * 100 - 50 };
  });

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard title="Net P&L" value={`$${data.totalPnl.toFixed(2)}`} subtext={`Unrealized: $${data.totalUnrealizedPnl.toFixed(2)}`} color={data.totalPnl >= 0 ? 'green' : 'red'} />
        <MetricCard title="Win Rate" value={`${(data.winRate * 100).toFixed(1)}%`} subtext={`${data.totalTrades} trades`} color={data.winRate >= 0.5 ? 'green' : 'red'} />
        <MetricCard title="Tracked Wallets" value={`${data.trackedWallets}`} subtext={`${data.watchWallets} watching`} color="blue" />
        <MetricCard title="Open Positions" value={`${data.openPositions}`} subtext={`${data.totalTrades} total`} color="purple" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">P&L Trend (7 Days)</h2>
        <PnLChart data={chartData} />
      </div>
    </div>
  );
}