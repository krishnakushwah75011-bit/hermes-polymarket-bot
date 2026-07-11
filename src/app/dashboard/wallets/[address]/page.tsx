// app/dashboard/wallets/[address]/page.tsx
// Wallet Profile page

import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

async function getWalletProfile(address: string) {
  const wallet = await prisma.walletProfile.findUnique({
    where: { address: address.toLowerCase() },
    include: {
      observedTrades: {
        orderBy: { timestamp: 'desc' },
        take: 50,
      },
      decisions: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { observedTrade: true },
      },
      paperTrades: {
        orderBy: { openedAt: 'desc' },
        take: 20,
        include: {
          decisionJournal: { include: { observedTrade: true } }
        }
      },
      outcomeReviews: {
        orderBy: { reviewTime: 'desc' },
        take: 10,
      },
    },
  });
  
  if (!wallet) notFound();
  
  return wallet;
}

export default async function WalletProfilePage({ params }: { params: { address: string } }) {
  const wallet = await getWalletProfile(params.address);
  
  // Parse categoryStrengthsJson from string to object
  let categoryStrengths: Record<string, number> = {};
  try {
    categoryStrengths = JSON.parse(wallet.categoryStrengthsJson || '{}');
  } catch {
    categoryStrengths = {};
  }
  
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {wallet.label || wallet.address}
            </h1>
            <p className="text-gray-500 mt-1 font-mono text-sm">{wallet.address}</p>
          </div>
          <div className="flex items-center gap-4">
            <StatusBadge status={wallet.status} />
            <span className="text-sm text-gray-500">Global Rank: #{wallet.sourceRank || 'N/A'}</span>
          </div>
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <MetricCard title="ROI (30d)" value={`${(wallet.roi30d * 100).toFixed(1)}%`} color={wallet.roi30d >= 0 ? 'green' : 'red'} />
        <MetricCard title="Global Score" value={wallet.globalScore.toFixed(3)} color="blue" />
        <MetricCard title="Consistency" value={wallet.consistencyScore.toFixed(2)} color="purple" />
        <MetricCard title="Copyability" value={wallet.copyabilityScore.toFixed(2)} color="orange" />
        <MetricCard title="Win Rate" value={`${(wallet.winRate30d * 100).toFixed(1)}%`} color="blue" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Trade Stats */}
        <Card title="Trading Statistics">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Total Trades (30d)</dt>
              <dd className="font-mono font-medium">{wallet.tradeCount30d}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Resolved Trades</dt>
              <dd className="font-mono font-medium">{wallet.resolvedTradeCount30d}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Avg Trade Size</dt>
              <dd className="font-mono font-medium">${wallet.averageTradeSize.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Avg Liquidity</dt>
              <dd className="font-mono font-medium">${wallet.averageLiquidity.toFixed(0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Avg Spread</dt>
              <dd className="font-mono font-medium">{(wallet.averageSpread * 100).toFixed(1)}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Avg Entry Timing</dt>
              <dd className="font-mono font-medium">{wallet.averageEntryTiming.toFixed(1)}h before resolution</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">One-Hit-Wonder Penalty</dt>
              <dd className="font-mono font-medium text-red-600">{wallet.oneHitWonderPenalty.toFixed(2)}</dd>
            </div>
          </dl>
        </Card>
        
        {/* Category Strengths */}
                <Card title="Category Strengths">
                  {Object.entries(categoryStrengths).length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No category data available</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(categoryStrengths).map(([category, strength]) => (
                <div key={category} className="flex items-center gap-3">
                  <span className="w-32 text-sm text-gray-500">{category}</span>
                  <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${strength * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm font-mono text-right">
                    {(strength * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      
      {/* Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card title="Copyability Notes">
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{wallet.copyabilityNotes || 'No notes'}</p>
        </Card>
        <Card title="Risk Notes">
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{wallet.riskNotes || 'No notes'}</p>
        </Card>
      </div>
      
      {/* Recent Trades */}
      <Card title="Recent Observed Trades">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="p-3">Time</th>
                <th className="p-3">Market</th>
                <th className="p-3">Outcome</th>
                <th className="p-3">Side</th>
                <th className="p-3">Entry Price</th>
                <th className="p-3">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {wallet.observedTrades.slice(0, 20).map((trade) => (
                <tr key={trade.id} className="hover:bg-gray-50">
                  <td className="p-3 text-gray-500 font-mono text-xs">
                    {new Date(trade.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3 max-w-xs truncate">{trade.marketQuestion}</td>
                  <td className="p-3 font-mono">{trade.outcome}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      trade.side === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {trade.side}
                    </span>
                  </td>
                  <td className="p-3 font-mono">{trade.walletEntryPrice.toFixed(3)}</td>
                  <td className="p-3 font-mono">${(trade.size * trade.walletEntryPrice).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* Paper Performance */}
      {wallet.paperTrades.length > 0 && (
        <Card title="Paper Trading Performance">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Total Paper PnL</p>
              <p className="text-2xl font-bold font-mono text-green-600">
                ${wallet.paperTrades.reduce((sum, t) => sum + t.realizedPnl + t.unrealizedPnl, 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Win Rate</p>
              <p className="text-2xl font-bold font-mono text-blue-600">
                {wallet.paperTrades.filter(t => t.realizedPnl > 0).length / wallet.paperTrades.length * 100}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Open Positions</p>
              <p className="text-2xl font-bold font-mono text-purple-600">
                {wallet.paperTrades.filter(t => t.status === 'OPEN').length}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Total Trades</p>
              <p className="text-2xl font-bold font-mono text-gray-600">
                {wallet.paperTrades.length}
              </p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="p-3">Market</th>
                  <th className="p-3">Decision</th>
                  <th className="p-3">Entry</th>
                  <th className="p-3">Current</th>
                  <th className="p-3">Size</th>
                  <th className="p-3">Unrealized</th>
                  <th className="p-3">Realized</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {wallet.paperTrades.slice(0, 10).map((trade) => (
                  <tr key={trade.id} className="hover:bg-gray-50">
                    <td className="p-3 max-w-xs truncate">{trade.decisionJournal?.observedTrade?.marketQuestion || trade.marketId}</td>
                    <td className="p-3">
                      <DecisionBadge decision={trade.decisionJournal?.decision || 'SKIP'} />
                    </td>
                    <td className="p-3 font-mono">{trade.entryPrice.toFixed(3)}</td>
                    <td className="p-3 font-mono">{trade.currentPrice.toFixed(3)}</td>
                    <td className="p-3 font-mono">${trade.simulatedPositionSize.toFixed(2)}</td>
                    <td className="p-3 font-mono text-green-600">${trade.unrealizedPnl.toFixed(2)}</td>
                    <td className="p-3 font-mono ${trade.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                      ${trade.realizedPnl.toFixed(2)}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        trade.status === 'OPEN' ? 'bg-blue-100 text-blue-700' :
                        trade.status === 'CLOSED' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {trade.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </main>
  );
}

function MetricCard({ title, value, color }: { title: string; value: string; color: 'green' | 'red' | 'blue' | 'purple' | 'orange' | 'gray' }) {
  const colors: Record<'green' | 'red' | 'blue' | 'purple' | 'orange' | 'gray', string> = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
    gray: 'text-gray-600',
  };
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
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

function StatusBadge({ status }: { status: string }) {
  const styles = {
    TRACK: 'bg-green-100 text-green-700',
    WATCH: 'bg-yellow-100 text-yellow-700',
    IGNORE: 'bg-gray-100 text-gray-700',
  };
  
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
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