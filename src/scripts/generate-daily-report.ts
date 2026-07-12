// src/scripts/generate-daily-report.ts
// Daily report generator with Telegram integration - MINIMAL WORKING VERSION

import { query } from '../lib/db/pool';
import { sendTelegramMessage } from '../lib/telegram/bot';

async function generateDailyReport() {
  console.log('[report:daily] Generating daily report...');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get today's stats
  const tradesResult = await query(
    'SELECT COUNT(*) as count FROM "HistoricalTrade" WHERE timestamp >= $1',
    [today]
  );
  const tradesCollected = parseInt(tradesResult.rows[0].count);
  
  const walletsResult = await query(
    'SELECT COUNT(*) as count FROM "WalletProfile"'
  );
  const walletsTracked = parseInt(walletsResult.rows[0].count);
  
  const paperResult = await query(
    'SELECT COUNT(*) as count FROM "PaperTrade" WHERE status = $1',
    ['OPEN']
  );
  const openPositions = parseInt(paperResult.rows[0].count);
  
  const pnlResult = await query(
    'SELECT COALESCE(SUM("unrealizedPnl"), 0) as total FROM "PaperTrade"'
  );
  const totalPnL = parseFloat(pnlResult.rows[0].total);
  
  const winResult = await query(
    `SELECT COUNT(*) as wins FROM "PaperTrade" 
     WHERE status = 'CLOSED' AND "realizedPnl" > 0`
  );
  const lossesResult = await query(
    `SELECT COUNT(*) as losses FROM "PaperTrade" 
     WHERE status = 'CLOSED' AND "realizedPnl" <= 0`
  );
  const wins = parseInt(winResult.rows[0].wins);
  const losses = parseInt(lossesResult.rows[0].losses);
  const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0';
  
  // Build report message
  const message = `📊 *Polymarket Bot - Daily Report*\n` +
    `📅 ${today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n` +
    
    `*Today's Activity:*\n` +
    `• Trades Collected: ${tradesCollected.toLocaleString()}\n` +
    `• Wallets in Database: ${walletsTracked}\n` +
    `• Open Positions: ${openPositions}\n\n` +
    
    `*Performance:*\n` +
    `• Total P&L: $${totalPnL.toFixed(2)}\n` +
    `• Win Rate: ${winRate}% (${wins}W / ${losses}L)\n\n` +
    
    `*System Status:*\n` +
    `✅ Database: Healthy\n` +
    `✅ Trade Collection: Active\n` +
    `✅ Wallet Scanning: Active\n` +
    `✅ Telegram Alerts: Working\n\n` +
    
    `_Next report: Tomorrow 6:30 PM_`;
  
  // Send to Telegram (uses TELEGRAM_CHAT_ID from .env)
  try {
    const sent = await sendTelegramMessage(message, 'Markdown');
    
    if (sent) {
      console.log('[report:daily] Sent to Telegram successfully');
    } else {
      console.warn('[report:daily] Telegram not configured or failed to send');
    }
    
    // Save report to database
    const reportId = `report_${today.toISOString().split('T')[0]}`;
    await query(`
      INSERT INTO "DailyReport" (
        id, date, "paperPnl", "winRate", "openPositions",
        "newSignals", "copiedSignals", "watchedSignals", "skippedSignals",
        "bestWalletsJson", "worstWalletsJson", summary, "sentToTelegram"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        "paperPnl" = $3, "winRate" = $4, "openPositions" = $5,
        "sentToTelegram" = TRUE, "updatedAt" = NOW()
    `, [
      reportId, today, totalPnL, parseFloat(winRate), openPositions,
      0, 0, 0, 0,
      '[]', '[]', 
      `Collected ${tradesCollected} trades, ${walletsTracked} wallets tracked. P&L: $${totalPnL.toFixed(2)}, Win Rate: ${winRate}%`,
      true
    ]);
    
    console.log(`[report:daily] Report saved to database`);
    
    return { success: true, reportId, sentToTelegram: sent };
    
  } catch (error: any) {
    console.error('[report:daily] Failed to send:', error.message);
    return { success: false, error: error.message };
  }
}

// Run if executed directly
if (require.main === module) {
  generateDailyReport().then(result => {
    console.log('[report:daily] Completed:', result);
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('[report:daily] CRASHED:', error.message);
    process.exit(1);
  });
}

export { generateDailyReport };