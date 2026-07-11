// app/dashboard/wallets/page.tsx
// Wallet Rankings page

import { PrismaClient } from '@prisma/client';
import Link from 'next/link';

const prisma = new PrismaClient();

async function getWalletRankings() {
  const wallets = await prisma.walletProfile.findMany({
    where: {
      status: { in: ['TRACK', 'WATCH', 'IGNORE'] },
    },
    orderBy: [
      { status: 'asc' },
      { globalScore: 'desc' },
    ],
    take: 500,
  });
  
  return wallets;
}

export default async function WalletsPage() {
  const wallets = await getWalletRankings();
  
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Wallet Rankings</h1>
        <p className="text-gray-600 mt-1">Top 500 wallets from leaderboard scans</p>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-gray-500 font-medium">
              <th className="p-4">Rank</th>
              <th className="p-4">Wallet</th>
              <th className="p-4">Label</th>
              <th className="p-4">Status</th>
              <th className="p-4">ROI 30d</th>
              <th className="p-4">Consistency</th>
              <th className="p-4">Copyability</th>
              <th className="p-4">One-Hit Penalty</th>
              <th className="p-4">Global Score</th>
              <th className="p-4">Best Category</th>
              <th className="p-4">Reason</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {wallets.map((wallet, index) => (
              <tr key={wallet.id} className="hover:bg-gray-50">
                <td className="p-4 font-mono text-gray-500">{index + 1}</td>
                <td className="p-4">
                  <Link 
                    href={`/dashboard/wallets/${wallet.address}`}
                    className="font-mono text-blue-600 hover:underline"
                  >
                    {wallet.address.slice(0, 10)}...
                  </Link>
                </td>
                <td className="p-4">{wallet.label || '-'}</td>
                <td className="p-4">
                  <StatusBadge status={wallet.status} />
                </td>
                <td className="p-4 font-mono">
                  {wallet.roi30d >= 0 ? '+' : ''}{(wallet.roi30d * 100).toFixed(1)}%
                </td>
                <td className="p-4 font-mono">{wallet.consistencyScore.toFixed(2)}</td>
                <td className="p-4 font-mono">{wallet.copyabilityScore.toFixed(2)}</td>
                <td className="p-4 font-mono">{wallet.oneHitWonderPenalty.toFixed(2)}</td>
                <td className="p-4 font-bold">{wallet.globalScore.toFixed(3)}</td>
                <td className="p-4">{wallet.bestCategory || '-'}</td>
                <td className="p-4 text-gray-500 max-w-xs truncate">{wallet.status === 'IGNORE' ? 'Below threshold' : wallet.status === 'TRACK' ? 'High score, tracking' : 'Watching for opportunities'}</td>
                <td className="p-4">
                  <Link 
                    href={`/dashboard/wallets/${wallet.address}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    TRACK: 'bg-green-100 text-green-700',
    WATCH: 'bg-yellow-100 text-yellow-700',
    IGNORE: 'bg-gray-100 text-gray-700',
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}