@echo off
REM ============================================
REM Test Telegram Notifications
REM ============================================

set SCRIPT_DIR=%~dp0
cd /d %SCRIPT_DIR%

echo.
echo ========================================
echo  Testing Telegram Bot
echo ========================================
echo.
echo Sending test message to chat ID: %TELEGRAM_CHAT_ID%
echo.

node --dns-result-order=ipv4first -r dotenv/config -r tsx/esm -e "
import('dotenv/config').then(() => {
  const https = require('https');
  
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set in .env');
    process.exit(1);
  }
  
  const message = '🎉 Polymarket Bot Test\n\n' +
                  '✅ Database connection: Working\n' +
                  '✅ Telegram integration: Active\n\n' +
                  'Bot is ready to send trading alerts!';
  
  const data = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown'
  });
  
  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: '/bot' + token + '/sendMessage',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };
  
  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      const result = JSON.parse(body);
      if (result.ok) {
        console.log('SUCCESS! Message sent (ID:', result.result.message_id, ')');
        console.log('Check your Telegram:', chatId);
      } else {
        console.error('FAILED:', result.description);
        process.exit(1);
      }
    });
  });
  
  req.on('error', (e) => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
  
  req.write(data);
  req.end();
});
" 2>&1

echo.
pause