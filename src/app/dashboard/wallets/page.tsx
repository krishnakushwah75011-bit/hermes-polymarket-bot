// app/dashboard/wallets/page.tsx
// Wallets dashboard - shows tracked wallets

export const dynamic = 'force-dynamic';

export default function WalletsPage() {
  // Sample top wallets (would come from DB in full version)
  const trackedWallets = [
    { rank: 1, address: '0xcd91a549...', score: 0.0, roi: '0.0%', trades: 200, status: 'TRACK' },
    { rank: 2, address: '0xe9076a87...', score: 0.0, roi: '0.0%', trades: 200, status: 'TRACK' },
    { rank: 3, address: '0xf3ef6ac0...', score: 0.0, roi: '0.0%', trades: 200, status: 'TRACK' },
  ];
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">👛 Tracked Wallets</h1>
        
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-2">Total Wallets</h3>
            <p className="text-3xl font-bold text-blue-400">214</p>
          </div>
          
          <div className="bg-green-900/30 rounded-lg p-6 border border-green-700">
            <h3 className="text-green-400 text-sm mb-2">Actively Tracked</h3>
            <p className="text-3xl font-bold text-green-400">20</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-2">Pending</h3>
            <p className="text-3xl font-bold text-gray-400">194</p>
          </div>
        </div>
        
        {/* Wallet Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold">Top Tracked Wallets</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">ROI (30d)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Trades</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {trackedWallets.map((wallet) => (
                  <tr key={wallet.rank} className="hover:bg-gray-750">
                    <td className="px-6 py-4 text-sm text-gray-300">{wallet.rank}</td>
                    <td className="px-6 py-4 text-sm font-mono text-blue-400">{wallet.address}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{wallet.score.toFixed(4)}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{wallet.roi}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{wallet.trades}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-green-900 text-green-400 rounded text-xs">
                        {wallet.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Info */}
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">ℹ️ How Wallet Tracking Works</h2>
          <ol className="space-y-2 text-gray-300">
            <li className="flex items-start">
              <span className="text-green-400 mr-2">1.</span>
              Leaderboard scan identifies top 214 wallets from recent trades
            </li>
            <li className="flex items-start">
              <span className="text-green-400 mr-2">2.</span>
              Top 20 wallets by global score are set to TRACK status
            </li>
            <li className="flex items-start">
              <span className="text-green-400 mr-2">3.</span>
              Monitor script watches these 20 wallets for new trades
            </li>
            <li className="flex items-start">
              <span className="text-green-400 mr-2">4.</span>
              Each detected trade is scored and potentially copied
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}