// app/dashboard/overview/page.tsx
// Dashboard Overview - REAL-TIME data from Supabase

import { getDashboardStatsDirect } from '../../lib/supabase-direct';

async function getDashboardData() {
  return await getDashboardStatsDirect();
}

export default async function OverviewPage() {
  const stats = await getDashboardData();
  
  // Fallback defaults if API fails
  const openTrades = stats?.open_trades || 0;
  const trackedWallets = stats?.tracked_wallets || 0;
  const totalTrades = stats?.total_trades || 0;
  const paperCopyDecisions = stats?.paper_copy_decisions || 0;
  const recentActivity = stats?.trades_last_30min || 0;
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">📊 Dashboard Overview</h1>
        
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-2">System Status</h3>
            <p className={`text-2xl font-bold ${recentActivity > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
              {recentActivity > 0 ? '✅ Live & Active' : '⏳ Starting Up'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {recentActivity > 0 ? `${recentActivity} trades in 30min` : 'Waiting for pipeline'}
            </p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-2">Wallets Tracked</h3>
            <p className="text-2xl font-bold text-blue-400">{trackedWallets}</p>
            <p className="text-xs text-gray-500 mt-1">Top performers on TRACK</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-2">Trades Collected</h3>
            <p className="text-2xl font-bold text-purple-400">{totalTrades}</p>
            <p className="text-xs text-gray-500 mt-1">From Polymarket API</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-2">Open Paper Trades</h3>
            <p className={`text-2xl font-bold ${openTrades > 0 ? 'text-green-400' : 'text-gray-400'}`}>
              {openTrades}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {openTrades > 0 ? 'Active positions' : 'Waiting for signals'}
            </p>
          </div>
        </div>
        
        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-2">PAPER_COPY Decisions</h3>
            <p className="text-2xl font-bold text-cyan-400">{paperCopyDecisions}</p>
            <p className="text-xs text-gray-500 mt-1">Total trades approved for copying</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-2">Last Pipeline Run</h3>
            <p className="text-2xl font-bold text-orange-400">
              {stats?.last_run ? new Date(stats.last_run).toLocaleString() : 'Never'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Autonomous (every 10 min)</p>
          </div>
        </div>
        
        {/* Recent Activity */}
        {openTrades > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
            <h2 className="text-xl font-semibold mb-4">📈 Open Paper Trades</h2>
            {stats?.open_positions?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400">Trade ID</th>
                      <th className="text-left py-2 px-3 text-gray-400">Market</th>
                      <th className="text-left py-2 px-3 text-gray-400">Side</th>
                      <th className="text-right py-2 px-3 text-gray-400">Size</th>
                      <th className="text-right py-2 px-3 text-gray-400">Entry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.open_positions.map((t: any, i: number) => (
                      <tr key={t.id} className={i % 2 === 0 ? 'bg-gray-900/50' : ''}>
                        <td className="py-2 px-3 font-mono text-xs">{t.id.substring(0, 20)}...</td>
                        <td className="py-2 px-3">{t.market_id?.substring(0, 25)}...</td>
                        <td className={`py-2 px-3 ${t.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{t.side}</td>
                        <td className="text-right py-2 px-3">${t.simulated_position_size}</td>
                        <td className="text-right py-2 px-3">${t.entry_price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No open positions</p>
            )}
          </div>
        )}
        
        {/* Info Box */}
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">ℹ️ System Status</h2>
          <ul className="space-y-2 text-gray-300">
            <li>✅ Trade collection: {recentActivity > 0 ? 'Active (every 10 min)' : 'Starting...'}</li>
            <li>✅ Wallet scanning: {trackedWallets} wallets on TRACK</li>
            <li>✅ Paper trading: {openTrades > 0 ? `${openTrades} active positions` : 'Waiting for first signals'}</li>
            <li>⏳ Performance tracking: Will show after trades close</li>
          </ul>
        </div>
        
        {/* What's Next */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">🔄 Autonomous Pipeline</h2>
          <ol className="space-y-3 text-gray-300">
            <li className="flex items-start">
              <span className="text-green-400 mr-2">✓</span>
              <span>Collects trades from 20 tracked wallets every 10 minutes</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-400 mr-2">✓</span>
              <span>Scores each trade based on wallet quality and market conditions</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-400 mr-2">✓</span>
              <span>High-score trades (≥0.60) → automatically copied as paper trades</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-400 mr-2">✓</span>
              <span>Updates P&L hourly and sends daily Telegram reports at 6:30 PM</span>
            </li>
          </ol>
        </div>
        
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Real-time data from Supabase (postgres://iaxfwsjjmwvlqyqvzvfb)</p>
          <p className="mt-2">Last updated: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}