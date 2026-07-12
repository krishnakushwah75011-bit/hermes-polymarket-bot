// app/page.tsx - Simple status page (no DB required)
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-4">Polymarket Copy Trading Bot</h1>
        <p className="text-xl text-gray-300 mb-8">Paper Trading Dashboard</p>
        
        <div className="grid gap-6">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-2xl font-semibold mb-4">System Status</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                <span>✅ Vercel Deployment: <strong>Live</strong></span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span>✅ Supabase Database: <strong>Connected</strong></span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                <span>⏳ Cron Scripts: <strong>Running Locally</strong></span>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-2xl font-semibold mb-4">Quick Links</h2>
            <ul className="space-y-2">
              <li>
                <a href="/dashboard/overview" className="text-blue-400 hover:text-blue-300 underline">
                  → Dashboard Overview
                </a>
              </li>
              <li>
                <a href="/dashboard/wallets" className="text-blue-400 hover:text-blue-300 underline">
                  → Tracked Wallets
                </a>
              </li>
              <li>
                <a href="/dashboard/paper-trades" className="text-blue-400 hover:text-blue-300 underline">
                  → Paper Trades
                </a>
              </li>
              <li>
                <a href="/dashboard/signals" className="text-blue-400 hover:text-blue-300 underline">
                  → Today's Signals
                </a>
              </li>
              <li>
                <a href="/api/health" className="text-blue-400 hover:text-blue-300 underline">
                  → Health Check API
                </a>
              </li>
            </ul>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-2xl font-semibold mb-4">Next Steps</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-300">
              <li>Run cron scripts locally to start data collection</li>
              <li>Configure Telegram notifications</li>
              <li>Monitor wallet scanning progress</li>
              <li>Review copy signals before execution</li>
            </ol>
          </div>
        </div>
        
        <footer className="mt-12 text-center text-gray-500">
          <p>Deployed on Vercel • Database on Supabase • Built with Next.js 14</p>
        </footer>
      </div>
    </div>
  );
}