// app/dashboard/rules/page.tsx
// Rules page - shows active rule version and history

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function RulesPage() {
  const activeRuleSet = await prisma.ruleSet.findFirst({
    where: { active: true },
    orderBy: { version: 'desc' },
  });
  
  const allRuleSets = await prisma.ruleSet.findMany({
    orderBy: { version: 'desc' },
  });
  
  const ruleChanges = await prisma.ruleChange.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { oldRuleSet: true, newRuleSet: true },
  });
  
  const rules = activeRuleSet ? JSON.parse(activeRuleSet.rulesJson) : {};
  
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Rules Engine</h1>
      
      {/* Active Rules */}
      <Card title={`Active Rule Set v${activeRuleSet?.version || 0}`} className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(rules).map(([key, value]) => (
            <div key={key} className="bg-gray-50 p-4 rounded-lg">
              <p className="text-xs text-gray-500 font-mono">{key}</p>
              <p className="text-lg font-bold font-mono text-gray-900">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </p>
            </div>
          ))}
        </div>
      </Card>
      
      {/* Version History */}
      <Card title="Rule Version History">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="p-3">Version</th>
                <th className="p-3">Active</th>
                <th className="p-3">Created</th>
                <th className="p-3">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {allRuleSets.map((rs) => (
                <tr key={rs.id} className="hover:bg-gray-50">
                  <td className="p-3 font-mono font-bold">v{rs.version}</td>
                  <td className="p-3">
                    {rs.active ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Active</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">Inactive</span>
                    )}
                  </td>
                  <td className="p-3 text-gray-500">{new Date(rs.createdAt).toLocaleString()}</td>
                  <td className="p-3">
                    <button className="text-blue-600 hover:underline text-xs">
                      View changes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* Rule Changes */}
      <Card title="Recent Rule Changes" className="mt-8">
        <div className="space-y-4">
          {ruleChanges.map((change) => (
            <div key={change.id} className="p-4 bg-gray-50 rounded-lg border">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium">v{change.oldRuleSet.version} → v{change.newRuleSet.version}</p>
                  <p className="text-sm text-gray-500">{change.reason}</p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(change.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Before</p>
                  <pre className="bg-white p-2 rounded text-xs overflow-auto max-h-24">
                    {change.beforeJson}
                  </pre>
                </div>
                <div>
                  <p className="text-gray-500">After</p>
                  <pre className="bg-white p-2 rounded text-xs overflow-auto max-h-24">
                    {change.afterJson}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}

function Card({ title, children, className }: any) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className || ''}`}>
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}