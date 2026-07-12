// app/dashboard/overview/page.tsx - Stub version for Vercel deployment
import { query } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
  try {
    // Paper trades summary
    const allTradesResult = await query('SELECT * FROM "PaperTrade"');
    const allTrades = allTradesResult.rows;
    
    const openTrades = allTrades.filter((t: any) => t.status === 'OPEN');
    const closedTrades = allTrades.filter((t: any) => t.status === 'CLOSED' || t.status === 'RESOLVED');
    const winningTrades = closedTrades.filter((t: any) => t.realized_pnl > 0);
    
    const totalUnrealizedPnl = openTrades.reduce((sum: number, t: any) => sum + (t.unrealized_pnl || 0), 0);
    const totalRealizedPnl = closedTrades.reduce((sum: number, t: any) => sum + (t.realized_pnl || 0), 0);
    const totalPnl = totalUnrealizedPnl + totalRealizedPnl;
    const winRate = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;
    
    // Wallet counts
    const trackedResult = await query('SELECT COUNT(*) FROM "WalletProfile" WHERE status = $1', ['TRACK']);
    const watchResult = await query('SELECT COUNT(*) FROM "WalletProfile" WHERE status = $1', ['WATCH']);
    const trackedWallets = parseInt(trackedResult.rows[0]?.count || '0');
    const watchWallets = parseInt(watchResult.rows[0]?.count || '0');
    
    return {
      totalPnl,
      totalUnrealizedPnl,
      totalRealizedPnl,
      winRate,
      openPositions: openTrades.length,
      totalTrades: allTrades.length,
      trackedWallets,
      watchWallets,
      copiedToday: 0,
      watchedToday: 0,
      openTrades: openTrades.slice(0, 5).map((t: any) => ({
        id: t.id,
        marketId: t.market_id,
        outcome: t.outcome,
        side: t.side,
        entryPrice: t.entry_price,
        currentPrice: t.current_price,
        unrealizedPnl: t.unrealized_pnl,
      })),
    };
  } catch (error) {
    console.error('[Dashboard] Error fetching data:', error);
    // Return empty state on error
    return {
      totalPnl: 0,
      totalUnrealizedPnl: 0,
      totalRealizedPnl: 0,
      winRate: 0,
      openPositions: 0,
      totalTrades: 0,
      trackedWallets: 0,
      watchWallets: 0,
      copiedToday: 0,
      watchedToday: 0,
      openTrades: [],
    };
  }
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