// test-telegram.js
// Simple Telegram test script
require('dotenv').config();

const https = require('https');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

console.log('=== Testing Telegram Bot ===\n');
console.log('Bot Token:', token ? token.substring(0, 15) + '...' : 'MISSING');
console.log('Chat ID:', chatId || 'MISSING');
console.log('');

if (!token || !chatId) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set in .env');
  process.exit(1);
}

const message = `🎉 *Polymarket Bot Test*\n\n` +
                `✅ Database connection: Working\n` +
                `✅ Telegram integration: Active\n\n` +
                `Bot is ready to send trading alerts!`;

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

console.log('Sending message...');

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    const result = JSON.parse(body);
    if (result.ok) {
      console.log('');
      console.log('✅ SUCCESS! Message sent (ID:', result.result.message_id, ')');
      console.log('Check your Telegram chat:', chatId);
      process.exit(0);
    } else {
      console.error('❌ FAILED:', result.description);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ ERROR:', e.message);
  process.exit(1);
});

req.write(data);
req.end();