// app/dashboard/reports/page.tsx
// Reports page - daily and weekly reports

import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export default async function ReportsPage() {
  const dailyReports = await prisma.dailyReport.findMany({
    orderBy: { date: 'desc' },
    take: 30,
  });
  
  const weeklyReports = await prisma.dailyReport.findMany({
    where: {
      // In production, this would be a separate WeeklyReport model
      // For now, we'll just show daily reports
    },
    orderBy: { date: 'desc' },
    take: 12,
  });
  
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Reports</h1>
      
      {/* Daily Reports */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Daily Reports</h2>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="p-4">Date</th>
                <th className="p-4">Paper PnL</th>
                <th className="p-4">Win Rate</th>
                <th className="p-4">Open Positions</th>
                <th className="p-4">Signals</th>
                <th className="p-4">Best Wallet</th>
                <th className="p-4">Worst Wallet</th>
                <th className="p-4">Rule Changes</th>
                <th className="p-4">Telegram</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dailyReports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="p-4 font-mono text-gray-500">
                    {format(new Date(report.date), 'MMM d, yyyy')}
                  </td>
                  <td className="p-4 font-mono font-medium {report.paperPnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${report.paperPnl.toFixed(2)}
                  </td>
                  <td className="p-4 font-mono">{(report.winRate * 100).toFixed(1)}%</td>
                  <td className="p-4 text-gray-600">{report.openPositions}</td>
                  <td className="p-4 text-gray-600">
                    {report.newSignals} ({report.copiedSignals} copied, {report.watchedSignals} watched)
                  </td>
                  <td className="p-4">
                    {JSON.parse(report.bestWalletsJson || '[]').map((w: any, i: number) => (
                      <div key={i} className="text-xs font-mono text-green-600">
                        {w.address.slice(0, 8)}: $${w.pnl.toFixed(2)}
                      </div>
                    ))}
                  </td>
                  <td className="p-4">
                    {JSON.parse(report.worstWalletsJson || '[]').map((w: any, i: number) => (
                      <div key={i} className="text-xs font-mono text-red-600">
                        {w.address.slice(0, 8)}: $${w.pnl.toFixed(2)}
                      </div>
                    ))}
                  </td>
                  <td className="p-4">
                    {JSON.parse(report.ruleChangesJson || '[]').length > 0 ? (
                      <span className="text-yellow-600 font-medium">
                        {JSON.parse(report.ruleChangesJson || '[]').length} changes
                      </span>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${report.sentToTelegram ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {report.sentToTelegram ? 'Sent' : 'Not Sent'}
                    </span>
                  </td>
                  <td className="p-4">
                    <button 
                      className="text-blue-600 hover:underline text-sm"
                      onClick={() => alert(report.summary)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      
      {/* Weekly Summary */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Weekly Summary</h2>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-gray-500">Weekly reports will be generated automatically every Sunday at 8 PM.</p>
        </div>
      </section>
    </main>
  );
}