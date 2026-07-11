// app/dashboard/signals/page.tsx
// Trade Signals page

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function SignalsPage() {
  const signals = await prisma.decisionJournal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      observedTrade: true,
      walletProfile: true,
    },
  });
  
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Trade Signals</h1>
      
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="p-4">Time</th>
              <th className="p-4">Wallet</th>
              <th className="p-4">Market</th>
              <th className="p-4">Outcome</th>
              <th className="p-4">Entry Price</th>
              <th className="p-4">Current Price</th>
              <th className="p-4">Movement</th>
              <th className="p-4">Spread</th>
              <th className="p-4">Liquidity</th>
              <th className="p-4">Time to Res.</th>
              <th className="p-4">Decision</th>
              <th className="p-4">Score</th>
              <th className="p-4">Reason</th>
              <th className="p-4">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {signals.map((signal) => (
              <tr key={signal.id} className="hover:bg-gray-50">
                <td className="p-4 text-gray-500 font-mono text-xs">
                  {new Date(signal.createdAt).toLocaleString()}
                </td>
                <td className="p-4">
                  <a href={`/dashboard/wallets/${signal.walletAddress}`} className="text-blue-600 hover:underline font-mono text-xs">
                    {signal.walletAddress.slice(0, 8)}...
                  </a>
                </td>
                <td className="p-4 max-w-xs truncate">{signal.observedTrade?.marketQuestion || signal.marketId}</td>
                <td className="p-4 font-mono">{signal.observedTrade?.outcome}</td>
                <td className="p-4 font-mono">{signal.observedTrade?.walletEntryPrice.toFixed(3) || 'N/A'}</td>
                <td className="p-4 font-mono">{signal.observedTrade?.detectedPrice?.toFixed(3) || 'N/A'}</td>
                <td className="p-4">
                  {signal.priceMovement !== undefined ? (
                    <span className={`font-mono ${signal.priceMovement > 0.5 ? 'text-green-600' : 'text-red-600'}`}>
                      {(signal.priceMovement * 100).toFixed(1)}%
                    </span>
                  ) : 'N/A'}
                </td>
                <td className="p-4 font-mono">
                  {(signal.observedTrade as any)?.spread ? ((signal.observedTrade as any).spread * 100).toFixed(1) + '%' : 'N/A'}
                </td>
                <td className="p-4 font-mono">
                  {(signal.observedTrade as any)?.liquidity ? '$' + (signal.observedTrade as any).liquidity.toFixed(0) : 'N/A'}
                </td>
                <td className="p-4 font-mono">
                  {(signal.observedTrade as any)?.timeToResolution ? (signal.observedTrade as any).timeToResolution.toFixed(1) + 'h' : 'N/A'}
                </td>
                <td className="p-4">
                  <DecisionBadge decision={signal.decision} />
                </td>
                <td className="p-4 font-mono font-medium">{signal.copyScore.toFixed(2)}</td>
                <td className="p-4 max-w-md">
                  <ul className="text-xs text-gray-600 space-y-1">
                    {JSON.parse(signal.reasonsJson || '[]').map((r: string, i: number) => (
                      <li key={i}>✓ {r}</li>
                    ))}
                  </ul>
                </td>
                <td className="p-4 max-w-md">
                  <ul className="text-xs text-red-600 space-y-1">
                    {JSON.parse(signal.risksJson || '[]').map((r: string, i: number) => (
                      <li key={i}>✗ {r}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
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