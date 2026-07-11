// lib/telegram/bot.ts
// Telegram bot integration for alerts and reports

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.warn('[telegram] Bot token or chat ID not configured');
}

const API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export async function sendTelegramMessage(text: string, parseMode: 'HTML' | 'Markdown' = 'Markdown'): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('[telegram] Not configured, skipping send');
    return false;
  }
  
  try {
    const response = await fetch(`${API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[telegram] Send failed:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[telegram] Send error:', error);
    return false;
  }
}

export async function sendTelegramAlert(
  title: string,
  details: Record<string, string | number>,
  severity: 'info' | 'warning' | 'critical' = 'info'
): Promise<boolean> {
  const emoji = severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️';
  
  let text = `${emoji} *${title}*\n\n`;
  for (const [key, value] of Object.entries(details)) {
    text += `• ${key}: ${value}\n`;
  }
  text += `\n_${new Date().toLocaleString()}_`;
  
  return sendTelegramMessage(text);
}

// Specific alert functions
export async function alertHighConfidenceTrade(
  wallet: string,
  market: string,
  score: number,
  positionSize: number
) {
  return sendTelegramAlert('High Confidence Paper Trade', {
    Wallet: wallet.slice(0, 10) + '...',
    Market: market.length > 50 ? market.slice(0, 50) + '...' : market,
    Score: score.toFixed(2),
    Position: `$${positionSize.toFixed(2)}`,
  }, 'info');
}

export async function alertMajorRuleChange(parameter: string, before: any, after: any, reason: string) {
  return sendTelegramAlert('Rule Changed', {
    Parameter: parameter,
    Before: JSON.stringify(before),
    After: JSON.stringify(after),
    Reason: reason,
  }, 'warning');
}

export async function alertWalletStatusChange(address: string, oldStatus: string, newStatus: string) {
  return sendTelegramAlert('Wallet Status Changed', {
    Wallet: address.slice(0, 10) + '...',
    Old: oldStatus,
    New: newStatus,
  }, 'info');
}

export async function alertDrawdownWarning(currentPnl: number, maxDrawdown: number) {
  return sendTelegramAlert('Drawdown Warning', {
    Current_PnL: `$${currentPnl.toFixed(2)}`,
    Max_Drawdown: `$${maxDrawdown.toFixed(2)}`,
    Threshold: 'Exceeded 10% portfolio drawdown',
  }, 'critical');
}

export async function alertEngineHealth(status: 'running' | 'stopped' | 'error', details: string) {
  return sendTelegramAlert(`Engine ${status.toUpperCase()}`, {
    Status: status,
    Details: details,
  }, status === 'error' ? 'critical' : 'info');
}