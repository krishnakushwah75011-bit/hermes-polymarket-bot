// app/dashboard/performance/page.tsx
// Performance page with charts and benchmarks

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function PerformancePage() {
  // Get all paper trades for performance analysis
  const paperTrades = await prisma.paperTrade.findMany({
    orderBy: { openedAt: 'asc' },
    include: {
      decisionJournal: { include: { walletProfile: true } },
    },
  });
  
  const closedTrades = paperTrades.filter(t => t.status === 'CLOSED' || t.status === 'RESOLVED');
  const openTrades = paperTrades.filter(t => t.status === 'OPEN');
  
  // PnL over time (cumulative)
  let cumulativePnl = 0;
  const pnlOverTime = paperTrades.map(trade => {
    cumulativePnl += trade.realizedPnl;
    if (trade.status === 'OPEN') cumulativePnl += trade.unrealizedPnl;
    return {
      date: trade.openedAt.toISOString().split('T')[0],
      cumulativePnl,
      tradePnl: trade.realizedPnl + (trade.status === 'OPEN' ? trade.unrealizedPnl : 0),
    };
  });
  
  // Win rate over time (rolling)
  const winRateOverTime = closedTrades.map((trade, i) => {
    const window = closedTrades.slice(Math.max(0, i - 9), i + 1);
    const wins = window.filter(t => t.realizedPnl > 0).length;
    return {
      date: trade.openedAt.toISOString().split('T')[0],
      winRate: window.length > 0 ? wins / window.length * 100 : 0,
    };
  });
  
  // Category performance
  const categoryPerf: Record<string, { trades: number; wins: number; pnl: number }> = {};
  for (const trade of closedTrades) {
    const cat = trade.decisionJournal?.observedTrade?.marketCategory || 'unknown';
    if (!categoryPerf[cat]) categoryPerf[cat] = { trades: 0, wins: 0, pnl: 0 };
    categoryPerf[cat].trades++;
    if (trade.realizedPnl > 0) categoryPerf[cat].wins++;
    categoryPerf[cat].pnl += trade.realizedPnl;
  }
  
  // Wallet performance
  const walletPerf: Record<string, { trades: number; wins: number; pnl: number; label?: string }> = {};
  for (const trade of closedTrades) {
    const addr = trade.walletAddress;
    if (!walletPerf[addr]) walletPerf[addr] = { trades: 0, wins: 0, pnl: 0, label: trade.decisionJournal?.walletProfile?.label };
    walletPerf[addr].trades++;
    if (trade.realizedPnl > 0) walletPerf[addr].wins++;
    walletPerf[addr].pnl += trade.realizedPnl;
  }
  
  // Bot vs Blind Copy (simplified - would need actual blind copy tracking)
  const botFilteredPnl = closedTrades.reduce((sum, t) => sum + t.realizedPnl, 0);
  const botWinRate = closedTrades.length > 0 
    ? closedTrades.filter(t => t.realizedPnl > 0).length / closedTrades.length * 100 
    : 0;
  
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Performance</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard 
          title="Bot-Filtered PnL" 
          value={`$${botFilteredPnl.toFixed(2)}`} 
          color={botFilteredPnl >= 0 ? 'green' : 'red'} 
        />
        <SummaryCard 
          title="Bot Win Rate" 
          value={`${botWinRate.toFixed(1)}%`} 
          color="blue" 
        />
        <SummaryCard 
          title="Total Trades" 
          value={closedTrades.length.toString()} 
          color="purple" 
        />
        <SummaryCard 
          title="Open Positions" 
          value={openTrades.length.toString()} 
          color="orange" 
        />
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card title="Cumulative PnL">
          <div className="h-80">
            <PnLLineChart data={pnlOverTime} />
          </div>
        </Card>
        
        <Card title="Rolling Win Rate (10-trade window)">
          <div className="h-80">
            <WinRateChart data={winRateOverTime} />
          </div>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card title="Category Performance">
          <div className="space-y-3">
            {Object.entries(categoryPerf)
              .sort(([,a], [,b]) => b.pnl - a.pnl)
              .map(([cat, data]) => (
                <CategoryRow key={cat} category={cat} data={data} />
              ))}
          </div>
        </Card>
        
        <Card title="Top Wallet Performance">
          <div className="space-y-3">
            {Object.entries(walletPerf)
              .sort(([,a], [,b]) => b.pnl - a.pnl)
              .slice(0, 10)
              .map(([addr, data]) => (
                <WalletPerfRow key={addr} address={addr} data={data} />
              ))}
          </div>
        </Card>
      </div>
      
      {/* Benchmark Comparison */}
      <Card title="Bot-Filtered vs Blind Leaderboard Copy">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-50 p-5 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Bot-Filtered Strategy</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>PnL</span><span className="font-bold">{botFilteredPnl >= 0 ? '+' : ''}${botFilteredPnl.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Win Rate</span><span className="font-bold">{botWinRate.toFixed(1)}%</span></div>
              <div className="flex justify-between"><span>Trades</span><span className="font-bold">{closedTrades.length}</span></div>
            </div>
          </div>
          <div className="bg-gray-50 p-5 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Blind Leaderboard Copy</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>PnL</span><span className="font-bold text-gray-500">Not tracked</span></div>
              <div className="flex justify-between"><span>Win Rate</span><span className="font-bold text-gray-500">Not tracked</span></div>
              <div className="flex justify-between"><span>Trades</span><span className="font-bold text-gray-500">Not tracked</span></div>
            </div>
          </div>
          <div className="bg-gray-50 p-5 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Key Metrics</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Missed Winners</span><span className="font-bold text-green-600">N/A</span></div>
              <div className="flex justify-between"><span>Avoided Losers</span><span className="font-bold text-red-600">N/A</span></div>
              <div className="flex justify-between"><span>Bad Copies</span><span className="font-bold">N/A</span></div>
              <div className="flex justify-between"><span>Good Skips</span><span className="font-bold">N/A</span></div>
            </div>
          </div>
        </div>
      </Card>
    </main>
  );
}

function SummaryCard({ title, value, color }: any) {
  const colors = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
  };
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-2xl font-bold font-mono ${colors[color]} mt-1`}>{value}</p>
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

function PnLLineChart({ data }: any) {
  if (data.length < 2) return <div className="text-center text-gray-500 py-20">Insufficient data</div>;
  
  const width = '100%';
  const height = 320;
  const padding = 40;
  const chartWidth = 800; // approximate
  
  const values = data.map((d: any) => d.cumulativePnl);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  
  const points = data.map((d: any, i: number) => {
    const x = padding + (i / (data.length - 1)) * (chartWidth - 2 * padding);
    const y = padding + (1 - (d.cumulativePnl - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
      <polyline
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        points={points}
      />
    </svg>
  );
}

function WinRateChart({ data }: any) {
  if (data.length < 2) return <div className="text-center text-gray-500 py-20">Insufficient data</div>;
  
  const width = 800;
  const height = 320;
  const padding = 40;
  
  const points = data.map((d: any, i: number) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = padding + (1 - d.winRate / 100) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        stroke="#10b981"
        strokeWidth="2"
        points={points}
      />
    </svg>
  );
}

function CategoryRow({ category, data }: any) {
  const winRate = data.trades > 0 ? data.wins / data.trades * 100 : 0;
  
  return (
    <div className="flex items-center gap-4 py-2">
      <span className="w-40 text-sm text-gray-500">{category}</span>
      <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 rounded-full"
          style={{ width: `${Math.min(100, data.trades * 10)}%` }}
        />
      </div>
      <span className="w-16 text-sm font-mono text-right">{data.trades}</span>
      <span className="w-20 text-sm font-mono text-right text-green-600">{winRate.toFixed(0)}%</span>
      <span className="w-24 text-sm font-mono text-right {data.pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
        ${data.pnl.toFixed(2)}
      </span>
    </div>
  );
}

function WalletPerfRow({ address, data }: any) {
  const winRate = data.trades > 0 ? data.wins / data.trades * 100 : 0;
  
  return (
    <div className="flex items-center gap-4 py-2">
      <span className="w-24 text-xs font-mono text-gray-500">{address.slice(0, 8)}...</span>
      <span className="w-20 text-sm font-medium">{data.label || ''}</span>
      <span className="w-12 text-sm font-mono text-right">{data.trades}</span>
      <span className="w-20 text-sm font-mono text-right text-green-600">{winRate.toFixed(0)}%</span>
      <span className="w-24 text-sm font-mono text-right {data.pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
        ${data.pnl.toFixed(2)}
      </span>
    </div>
  );
}