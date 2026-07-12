// app/dashboard/reports/page.tsx
// Reports - shows daily Telegram reports

export const dynamic = 'force-dynamic';

export default function ReportsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">📋 Daily Reports</h1>
        
        {/* Next Report */}
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">📅 Next Report</h2>
          <p className="text-2xl font-bold text-blue-400">Today at 6:30 PM IST</p>
          <p className="text-gray-400 mt-2">
            Daily performance report will be sent to Telegram (@TradHy_bot)
          </p>
        </div>
        
        {/* Report Schedule */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-semibold mb-4">📊 What's Included</h2>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start">
              <span className="text-green-400 mr-2">✓</span>
              <div>
                <strong>Today's Activity:</strong> Trades collected, wallets scanned
              </div>
            </li>
            <li className="flex items-start">
              <span className="text-green-400 mr-2">✓</span>
              <div>
                <strong>Performance:</strong> P&L, win rate, open positions
              </div>
            </li>
            <li className="flex items-start">
              <span className="text-green-400 mr-2">✓</span>
              <div>
                <strong>System Status:</strong> Database health, script status
              </div>
            </li>
            <li className="flex items-start">
              <span className="text-green-400 mr-2">✓</span>
              <div>
                <strong>Top Performers:</strong> Best and worst tracked wallets
              </div>
            </li>
          </ul>
        </div>
        
        {/* Telegram Info */}
        <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">📱 Telegram Bot</h2>
          <p className="text-gray-300 mb-4">
            Reports are sent to your Telegram chat via @TradHy_bot
          </p>
          <div className="bg-gray-900 rounded p-4 font-mono text-sm">
            <p className="text-green-400">Bot: @TradHy_bot</p>
            <p className="text-blue-400">Chat ID: 1463103481</p>
            <p className="text-gray-500 mt-2">Status: ✅ Verified & Working</p>
          </div>
        </div>
        
        <div className="mt-8 text-center text-gray-500">
          <p>Historical reports will appear here after the first daily report is sent.</p>
        </div>
      </div>
    </div>
  );
}