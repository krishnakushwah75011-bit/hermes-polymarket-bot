// app/dashboard/paper-trades/page.tsx
// Paper Trades page

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function PaperTradesPage() {
  const trades = await prisma.paperTrade.findMany({
    orderBy: { openedAt: 'desc' },
    take: 100,
    include: {
      decisionJournal: {
        include: { observedTrade: true, walletProfile: true },
      },
    },
  });
  
  const openTrades = trades.filter(t => t.status === 'OPEN');
  const closedTrades = trades.filter(t => t.status === 'CLOSED' || t.status === 'RESOLVED');
  const totalUnrealized = openTrades.reduce((sum, t) => sum + t.unrealizedPnl, 0);
  const totalRealized = closedTrades.reduce((sum, t) => sum + t.realizedPnl, 0);
  const winRate = closedTrades.length > 0 
    ? closedTrades.filter(t => t.realizedPnl > 0).length / closedTrades.length * 100 
    : 0;
  
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Paper Trades</h1>
        <div className="flex gap-4">
          <a href="/dashboard/paper-trades?status=OPEN" className="text-blue-600 hover:underline">
            Open ({openTrades.length})
          </a>
          <a href="/dashboard/paper-trades?status=CLOSED" className="text-gray-600 hover:underline">
            Closed ({closedTrades.length})
          </a>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard title="Total PnL" value={`$${(totalUnrealized + totalRealized).toFixed(2)}`} color="blue" />
        <SummaryCard title="Unrealized PnL" value={`$${totalUnrealized.toFixed(2)}`} color="purple" />
        <SummaryCard title="Realized PnL" value={`$${totalRealized.toFixed(2)}`} color={totalRealized >= 0 ? 'green' : 'red'} />
        <SummaryCard title="Win Rate" value={`${winRate.toFixed(1)}%`} color="orange" />
      </div>
      
      {/* Open Positions */}
      {openTrades.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Open Positions</h2>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b bg-gray-50">
                  <th className="p-3">Wallet</th>
                  <th className="p-3">Market</th>
                  <th className="p-3">Outcome</th>
                  <th className="p-3">Side</th>
                  <th className="p-3">Entry</th>
                  <th className="p-3">Current</th>
                  <th className="p-3">Size</th>
                  <th className="p-3">Unrealized PnL</th>
                  <th className="p-3">Hold Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {openTrades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <a href={`/dashboard/wallets/${trade.walletAddress}`} className="text-blue-600 hover:underline font-mono text-xs">
                        {trade.walletAddress.slice(0, 10)}...
                      </a>
                    </td>
                    <td className="p-3 max-w-xs truncate">{trade.decisionJournal?.observedTrade?.marketQuestion || trade.marketId}</td>
                    <td className="p-3 font-mono">{trade.outcome}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${trade.side === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="p-3 font-mono">{trade.entryPrice.toFixed(3)}</td>
                    <td className="p-3 font-mono">{trade.currentPrice.toFixed(3)}</td>
                    <td className="p-3 font-mono">${trade.simulatedPositionSize.toFixed(2)}</td>
                    <td className="p-3 font-mono font-medium {trade.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                      ${trade.unrealizedPnl.toFixed(2)}
                    </td>
                    <td className="p-3 text-gray-500 text-xs">
                      {Math.round((Date.now() - trade.openedAt.getTime()) / (1000 * 60 * 60))}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      
      {/* Closed/Resolved Trades */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Resolved Trades</h2>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="p-3">Wallet</th>
                <th className="p-3">Market</th>
                <th className="p-3">Decision</th>
                <th className="p-3">Entry</th>
                <th className="p-3">Exit</th>
                <th className="p-3">Size</th>
                <th className="p-3">PnL</th>
                <th className="p-3">Status</th>
                <th className="p-3">Hold Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {closedTrades.slice(0, 50).map((trade) => (
                <tr key={trade.id} className="hover:bg-gray-50">
                  <td className="p-3">
                    <a href={`/dashboard/wallets/${trade.walletAddress}`} className="text-blue-600 hover:underline font-mono text-xs">
                      {trade.walletAddress.slice(0, 10)}...
                    </a>
                  </td>
                  <td className="p-3 max-w-xs truncate">{trade.decisionJournal?.observedTrade?.marketQuestion || trade.marketId}</td>
                  <td className="p-3">
                    <DecisionBadge decision={trade.decisionJournal?.decision || 'SKIP'} />
                  </td>
                  <td className="p-3 font-mono">{trade.entryPrice.toFixed(3)}</td>
                  <td className="p-3 font-mono">{trade.currentPrice.toFixed(3)}</td>
                  <td className="p-3 font-mono">${trade.simulatedPositionSize.toFixed(2)}</td>
                  <td className="p-3 font-mono font-medium {trade.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${trade.realizedPnl.toFixed(2)}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      trade.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                      trade.status === 'CLOSED' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {trade.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">
                    {trade.closedAt ? Math.round((trade.closedAt.getTime() - trade.openedAt.getTime()) / (1000 * 60 * 60)) + 'h' : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ title, value, color }: { title: string; value: string; color: 'green' | 'red' | 'blue' | 'purple' | 'orange' }) {
  const colors: Record<'green' | 'red' | 'blue' | 'purple' | 'orange', string> = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
  };
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-2xl font-bold font-mono ${colors[color]} mt-1`}>{value}</p>
    </div>
  );
}

function DecisionBadge({ decision }: any) {
  const styles = {
    PAPER_COPY: 'bg-green-100 text-green-700',
    WATCHLIST: 'bg-yellow-100 text-yellow-700',
    SKIP: 'bg-gray-100 text-gray-700',
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[decision as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
      {decision.replace('_', ' ')}
    </span>
  );
}