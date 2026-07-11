// app/dashboard/decisions/page.tsx
// Decision Journal page

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function DecisionsPage() {
  const decisions = await prisma.decisionJournal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      observedTrade: true,
      walletProfile: true,
      outcomeReview: true,
    },
  });
  
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Decision Journal</h1>
      
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="p-3">Time</th>
              <th className="p-3">Wallet</th>
              <th className="p-3">Market</th>
              <th className="p-3">Decision</th>
              <th className="p-3">Score</th>
              <th className="p-3">Confidence</th>
              <th className="p-3">Reasons</th>
              <th className="p-3">Risks</th>
              <th className="p-3">Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {decisions.map((decision) => (
              <tr key={decision.id} className="hover:bg-gray-50">
                <td className="p-3 text-gray-500 font-mono text-xs">
                  {new Date(decision.createdAt).toLocaleString()}
                </td>
                <td className="p-3">
                  <a href={`/dashboard/wallets/${decision.walletAddress}`} className="text-blue-600 hover:underline font-mono text-xs">
                    {decision.walletAddress.slice(0, 10)}...
                  </a>
                </td>
                <td className="p-3 max-w-xs truncate">{decision.observedTrade?.marketQuestion || decision.marketId}</td>
                <td className="p-3">
                  <DecisionBadge decision={decision.decision} />
                </td>
                <td className="p-3 font-mono font-medium">{decision.copyScore.toFixed(2)}</td>
                <td className="p-3 font-mono">{decision.confidence.toFixed(2)}</td>
                <td className="p-3 max-w-md">
                  <ul className="text-xs text-gray-600 space-y-1">
                    {JSON.parse(decision.reasonsJson || '[]').map((r: string, i: number) => (
                      <li key={i}>✓ {r}</li>
                    ))}
                  </ul>
                </td>
                <td className="p-3 max-w-md">
                  <ul className="text-xs text-red-600 space-y-1">
                    {JSON.parse(decision.risksJson || '[]').map((r: string, i: number) => (
                      <li key={i}>✗ {r}</li>
                    ))}
                  </ul>
                </td>
                <td className="p-3">
                  {decision.outcomeReview ? (
                    <>
                      <span className={`px-2 py-1 rounded text-xs ${decision.outcomeReview.wasDecisionGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {decision.outcomeReview.wasDecisionGood ? 'Good' : 'Bad'}
                      </span>
                      <div className="text-xs text-gray-500 mt-1">
                        PnL: ${decision.outcomeReview.simulatedPnl.toFixed(2)}
                      </div>
                    </>
                  ) : (
                    <span className="text-gray-400 text-xs">Pending</span>
                  )}
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