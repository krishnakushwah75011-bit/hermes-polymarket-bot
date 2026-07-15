#!/usr/bin/env node
/**
 * Polymarket Bot - Master Health Check & Auto-Recovery
 * Runs before every cron job to ensure prerequisites are met
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function checkEnv() {
    console.log('[health] Checking environment...');
    
    const envFile = join(PROJECT_ROOT, '.env');
    if (!existsSync(envFile)) {
        console.error('✗ .env file not found');
        return false;
    }
    
    const env = readFileSync(envFile, 'utf-8');
    const dbMatch = env.match(/DATABASE_URL=["']?(.+)/);
    
    if (!dbMatch) {
        console.error('✗ DATABASE_URL not set in .env');
        return false;
    }
    
    const dbUrl = dbMatch[1].split(/["'\s]/)[0];
    console.log(`✓ DATABASE_URL: ${dbUrl.substring(0, 30)}...`);
    
    // Check if using Supabase and warn about Airtel DNS
    if (dbUrl.includes('supabase.co')) {
        console.warn('⚠ Supabase detected - Airtel DNS may block');
        console.warn('  Ensure all scripts use: node --dns-result-order=ipv4first');
    }
    
    return true;
}

async function checkDbConnection() {
    console.log('[health] Testing database connection...');
    
    try {
        // Import dynamically to avoid bundling issues
        const { query } = await import('../src/lib/db/pool.js');
        const result = await query('SELECT NOW() as db_time, current_database() as db_name, 1 as test');
        const row = result.rows[0];
        
        console.log(`✓ Database: ${row.db_name} @ ${row.db_time}`);
        return true;
    } catch (error) {
        console.error(`✗ Database connection failed: ${error.message}`);
        console.error('');
        console.error('TROUBLESHOOTING:');
        console.error('1. Check DATABASE_URL in .env is valid');
        console.error('2. If using Supabase on Airtel: add --dns-result-order=ipv4first flag');
        console.error('3. For local Postgres: ensure service is running');
        console.error('4. Test manually: node -e "require(\"./lib/db/pool\").query(\"SELECT 1\").then(console.log)"');
        return false;
    }
}

async function sendTelegram(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.log('[telegram] Not configured - skipping');
        return false;
    }
    
    try {
        const https = await import('https');
        
        return new Promise((resolve) => {
            const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
            const data = JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            });
            
            const req = https.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            }, (res) => {
                resolve(res.statusCode === 200);
            });
            
            req.on('error', (e) => {
                console.log(`[telegram] Error: ${e.message}`);
                resolve(false);
            });
            
            req.write(data);
            req.end();
        });
    } catch (error) {
        console.log(`[telegram] Error: ${error.message}`);
        return false;
    }
}

async function healthCheck() {
    console.log('='.repeat(60));
    console.log('POLYMARKET BOT - HEALTH CHECK');
    console.log('='.repeat(60));
    console.log('');
    
    const checks = {
        env: await checkEnv(),
        db: false
    };
    
    if (checks.env) {
        checks.db = await checkDbConnection();
    }
    
    console.log('');
    console.log('Results:');
    console.log(`  Environment: ${checks.env ? '✓' : '✗'}`);
    console.log(`  Database:    ${checks.db ? '✓' : '✗'}`);
    console.log('');
    
    const allHealthy = checks.env && checks.db;
    
    if (allHealthy) {
        console.log('✓ All health checks passed');
        console.log('='.repeat(60));
        return true;
    } else {
        console.log('✗ Health check FAILED');
        console.log('='.repeat(60));
        
        // Send alert
        await sendTelegram(
            `❌ <b>Polymarket Bot - Health Check Failed</b>\n\n` +
            `Environment: ${checks.env ? '✓' : '✗'}\n` +
            `Database:    ${checks.db ? '✓' : '✗'}\n\n` +
            `Check logs and .env configuration`
        );
        
        return false;
    }
}

// CLI interface
(async () => {
    const args = process.argv.slice(2);

    if (args.includes('--check')) {
        // Just check and exit
        const healthy = await healthCheck();
        process.exit(healthy ? 0 : 1);
        
    } else if (args.includes('--fix')) {
    // Attempt fixes
    console.log('[fix] Running auto-fix...');
    
    if (!checks.env) {
        console.log('[fix] Environment cannot be auto-fixed - check .env manually');
    }
    
    if (!checks.db) {
        console.log('[fix] Attempting database reconnection...');
        await delay(2000);
        checks.db = await checkDbConnection();
    }
    
    const fixed = checks.env && checks.db;
    console.log(`[fix] Auto-fix ${fixed ? 'successful' : 'failed'}`);
    process.exit(fixed ? 0 : 1);
    
} else if (args.includes('--telegram-test')) {
        // Test Telegram
        console.log('[telegram] Sending test message...');
        const ok = await sendTelegram(
            `✅ <b>Polymarket Bot - Telegram Test</b>\n\n` +
            `Bot is configured and working\n` +
            `Time: ${new Date().toISOString()}`
        );
        console.log(`Telegram: ${ok ? '✓ sent' : '✗ failed'}`);
        process.exit(ok ? 0 : 1);
        
    } else {
        // Default: run health check for cron wrapper
        const healthy = await healthCheck();
        process.exit(healthy ? 0 : 1);
    }
})();
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}