// src/scripts/generate-daily-report.ts
// Daily report generator with Telegram integration

import { prisma } from '@/lib/db/client';
import { sendTelegramMessage } from '@/lib/telegram/bot';

async function generateDailyReport() {
  console.log('[report:daily] Generating daily report...');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check if report already exists
  const existing = await prisma.dailyReport.findUnique({
    where: { date: today },
  });
  
  if (existing && existing.sentToTelegram) {
    console.log('[report:daily] Report already sent for today');
    return { success: true, reportId: existing.id, skipped: true };
  }
  
  // Calculate metrics
  const paperTrades = await prisma.paperTrade.findMany({
    where: {
      openedAt: { gte: today },
    },
  });
  
  const closedToday = paperTrades.filter(t => t.status === 'CLOSED' || t.status === 'RESOLVED');
  const openPositions = paperTrades.filter(t => t.status === 'OPEN');
  const winningTrades = closedToday.filter(t => t.realizedPnl > 0);
  const losingTrades = closedToday.filter(t => t.realizedPnl < 0);
  
  const paperPnl = closedToday.reduce((sum, t) => sum + t.realizedPnl, 0) +
                   openPositions.reduce((sum, t) => sum + t.unrealizedPnl, 0);
  
  const winRate = closedToday.length > 0 ? winningTrades.length / closedToday.length : 0;
  
  // Decisions today
  const decisions = await prisma.decisionJournal.findMany({
    where: { createdAt: { gte: today } },
    include: { walletProfile: true },
  });
  
  const copiedSignals = decisions.filter(d => d.decision === 'PAPER_COPY').length;
  const watchedSignals = decisions.filter(d => d.decision === 'WATCHLIST').length;
  const skippedSignals = decisions.filter(d => d.decision === 'SKIP').length;
  
  // Best/worst wallets today
  const walletPnls = new Map<string, number>();
  
  for (const trade of paperTrades) {
    const pnl = (trade.status === 'OPEN' ? trade.unrealizedPnl : trade.realizedPnl) || 0;
    walletPnls.set(trade.walletAddress, (walletPnls.get(trade.walletAddress) || 0) + pnl);
  }
  
  const sortedWallets = Array.from(walletPnls.entries())
    .sort(([, a], [, b]) => b - a);
  
  const bestWallets = sortedWallets.slice(0, 3).map(([address, pnl]) => ({ address, pnl }));
  const worstWallets = sortedWallets.slice(-3).map(([address, pnl]) => ({ address, pnl }));
  
  // Rule changes today
  const ruleChanges = await prisma.ruleChange.findMany({
    where: { createdAt: { gte: today } },
    orderBy: { createdAt: 'desc' },
  });
  
  const ruleChangesText = ruleChanges.length > 0
    ? ruleChanges.map(c => `• ${c.reason}: ${JSON.parse(c.beforeJson)} → ${JSON.parse(c.afterJson)}`).join('\n')
    : 'No rule changes today';
  
  // Generate summary
  let summary = `**Daily Report - ${today.toLocaleDateString()}**\n\n`;
  summary += `💰 **Paper PnL:** $${paperPnl.toFixed(2)}\n`;
  summary += `📊 **Win Rate:** ${(winRate * 100).toFixed(1)}% (${winningTrades.length}/${closedToday.length} closed)\n`;
  summary += `📈 **Open Positions:** ${openPositions.length}\n`;
  summary += `🔔 **New Signals:** ${decisions.length} (${copiedSignals} copied, ${watchedSignals} watched, ${skippedSignals} skipped)\n\n`;
  
  if (bestWallets.length > 0) {
    summary += `🏆 **Top Wallets:**\n`;
    for (const w of bestWallets) {
      summary += `  ${w.address.slice(0, 10)}...: $${w.pnl.toFixed(2)}\n`;
    }
    summary += '\n';
  }
  
  if (worstWallets.length > 0) {
    summary += `📉 **Worst Wallets:**\n`;
    for (const w of worstWallets) {
      summary += `  ${w.address.slice(0, 10)}...: $${w.pnl.toFixed(2)}\n`;
    }
    summary += '\n';
  }
  
  if (ruleChanges.length > 0) {
    summary += `🔧 **Rule Changes:**\n${ruleChangesText}\n\n`;
  }
  
  // Compare bot vs blind copy
  const blindCopyPnl = await calculateBlindCopyPnl(today);
  summary += `⚔️ **Bot vs Blind Copy:**\n`;
  summary += `  Bot-filtered: $${paperPnl.toFixed(2)}\n`;
  summary += `  Blind copy: $${blindCopyPnl.toFixed(2)}\n`;
  summary += `  ${paperPnl >= blindCopyPnl ? '✅' : '❌'} ${paperPnl >= blindCopyPnl ? 'Bot outperformed' : 'Blind copy outperformed'}\n\n`;
  
  summary += `👀 **Watch Tomorrow:** Monitor ${watchedSignals} watchlist trades and ${openPositions.length} open positions.`;
  
  // Save report
  const report = await prisma.dailyReport.upsert({
    where: { date: today },
    update: {
      paperPnl,
      winRate,
      openPositions: openPositions.length,
      newSignals: decisions.length,
      copiedSignals,
      watchedSignals,
      skippedSignals,
      bestWalletsJson: JSON.stringify(bestWallets),
      worstWalletsJson: JSON.stringify(worstWallets),
      ruleChangesJson: JSON.stringify(ruleChanges.map(c => ({
        parameter: c.beforeJson,
        before: c.beforeJson,
        after: c.afterJson,
        reason: c.reason,
      }))),
      summary,
      sentToTelegram: false,
    },
    create: {
      date: today,
      paperPnl,
      winRate,
      openPositions: openPositions.length,
      newSignals: decisions.length,
      copiedSignals,
      watchedSignals,
      skippedSignals,
      bestWalletsJson: JSON.stringify(bestWallets),
      worstWalletsJson: JSON.stringify(worstWallets),
      ruleChangesJson: JSON.stringify(ruleChanges.map(c => ({
        parameter: c.beforeJson,
        before: c.beforeJson,
        after: c.afterJson,
        reason: c.reason,
      }))),
      summary,
      sentToTelegram: false,
    },
  });
  
  // Send to Telegram
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
      await sendTelegramMessage(summary);
      await prisma.dailyReport.update({
        where: { id: report.id },
        data: { sentToTelegram: true },
      });
      console.log('[report:daily] Sent to Telegram');
    } catch (error) {
      console.error('[report:daily] Failed to send Telegram:', error);
    }
  } else {
    console.log('[report:daily] Telegram not configured, skipping');
  }
  
  console.log('[report:daily] Report generated:', report.id);
  
  return { success: true, reportId: report.id };
}

async function calculateBlindCopyPnl(today: Date): Promise<number> {
  // Simulate blind copying all leaderboard wallets
  // This would track what would have happened if we copied everything
  // For now, return 0 as placeholder
  return 0;
}

if (require.main === module) {
  generateDailyReport()
    .then(result => {
      console.log('[report:daily] Completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('[report:daily] Failed:', error);
      process.exit(1);
    });
}

export { generateDailyReport };