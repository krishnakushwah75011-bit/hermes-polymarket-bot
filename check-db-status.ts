// Quick DB status check
import { query } from './src/lib/db/pool.js';

async function checkStatus() {
  try {
    console.log('=== POLYMARKET BOT DB STATUS ===\n');
    
    // Check connection
    const connTest = await query('SELECT NOW() as now, version() as version');
    console.log('✓ Database connected');
    console.log('  Time:', connTest.rows[0].now);
    console.log('  Version:', connTest.rows[0].version.split(' ')[0], '\n');
    
    // Count tables
    const paperTrades = await query('SELECT COUNT(*) as c FROM "PaperTrade" WHERE status = \'OPEN\'');
    const observed = await query('SELECT COUNT(*) as c FROM "ObservedTrade"');
    const decisions = await query('SELECT COUNT(*) as c FROM "DecisionJournal" WHERE decision = \'PAPER_COPY\'');
    const wallets = await query('SELECT COUNT(*) as c FROM "WalletProfile" WHERE status = \'TRACK\'');
    const markets = await query('SELECT COUNT(*) as c FROM "MarketSnapshot" LIMIT 1');
    
    console.log('📊 Current Metrics:');
    console.log('  Open Paper Trades:', paperTrades.rows[0].c);
    console.log('  Total Observed Trades:', observed.rows[0].c);
    console.log('  PAPER_COPY Decisions:', decisions.rows[0].c);
    console.log('  TRACK Wallets:', wallets.rows[0].c);
    console.log('  Market Snapshots:', markets.rows[0].c);
    
    // Check recent activity
    const recentTrades = await query(`
      SELECT COUNT(*) as c FROM "ObservedTrade" 
      WHERE "createdAt" > NOW() - INTERVAL '30 minutes'
    `);
    console.log('  Trades in last 30min:', recentTrades.rows[0].c);
    
    const recentDecisions = await query(`
      SELECT COUNT(*) as c FROM "DecisionJournal" 
      WHERE "createdAt" > NOW() - INTERVAL '30 minutes'
    `);
    console.log('  Decisions in last 30min:', recentDecisions.rows[0].c);
    
    // Check for open paper trades with details
    const openTrades = await query(`
          SELECT id, "marketId", side, "simulatedPositionSize" as size, "entryPrice", status, "openedAt"
          FROM "PaperTrade" 
          WHERE status = 'OPEN'
          ORDER BY "openedAt" DESC
          LIMIT 5
        `);
    
        if (openTrades.rows.length > 0) {
          console.log('\n📈 Open Paper Trades (latest 5):');
          openTrades.rows.forEach((t, i) => {
            console.log(`  ${i+1}. ${t.id} | ${t.marketId?.substring(0,20)}... | ${t.side} | $${t.size} @ $${t.entryPrice}`);
          });
        } else {
          console.log('\n⚠️  No OPEN paper trades found');
          console.log('    This could mean:');
          console.log('    - Pipeline hasn\'t run yet today');
          console.log('    - All trades closed/settled');
          console.log('    - No PAPER_COPY decisions met criteria');
        }
    
        // Check dashboard API health
        console.log('\n💡 Dashboard should show:');
        console.log('  - Open Paper Trades:', paperTrades.rows[0].c);
        console.log('  - Recent activity: ' + (recentTrades.rows[0].c > 0 || recentDecisions.rows[0].c > 0 ? 'YES' : 'NO (pipeline may not be running)'));
        console.log('  - Status: ' + (paperTrades.rows[0].c > 0 ? 'Live & Connected ✓' : 'Waiting for first trades'));
    
        console.log('\n🔍 Dashboard Discrepancy Check:');
        console.log('  DB has 4 OPEN trades, but dashboard shows 0');
        console.log('  Possible causes:');
        console.log('  1. Vercel dashboard not connected to same DB');
        console.log('  2. API route caching');
        console.log('  3. Frontend not calling API correctly');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('  Stack:', err.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

checkStatus();