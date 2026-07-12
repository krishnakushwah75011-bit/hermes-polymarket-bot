// audit-scripts.js
// Test all cron scripts for errors
require('dotenv').config();

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const scripts = [
  { name: 'collect-trades', file: 'src/scripts/collect-trades.ts', expect: 'collect' },
  { name: 'scan-leaderboard', file: 'src/scripts/scan-leaderboard.ts', expect: 'scan' },
  { name: 'scan-wallets', file: 'src/scripts/scan-wallets.ts', expect: 'scan' },
  { name: 'score-trades', file: 'src/scripts/score-trades.ts', expect: 'score' },
  { name: 'monitor-trades', file: 'src/scripts/monitor-trades.ts', expect: 'monitor' },
  { name: 'update-paper-pnl', file: 'src/scripts/update-paper-pnl.ts', expect: 'update' },
  { name: 'review-outcomes', file: 'src/scripts/review-outcomes.ts', expect: 'review' },
  { name: 'update-rules', file: 'src/scripts/update-rules.ts', expect: 'update' },
  { name: 'generate-daily-report', file: 'src/scripts/generate-daily-report.ts', expect: 'report' },
];

async function testScript(script) {
  console.log(`\nTesting: ${script.name}...`);
  console.log('-'.repeat(50));
  
  const cmd = `node --dns-result-order=ipv4first -r dotenv/config src/scripts/${script.file.replace('src/scripts/', '')} 2>&1`;
  
  try {
    const { stdout, stderr } = await execAsync(cmd, { 
      timeout: 60000,
      cwd: 'C:/Users/krish/hermes-polymarket-bot'
    });
    
    const output = stdout + stderr;
    const lines = output.split('\n').filter(l => l.trim());
    
    // Check for errors
    const hasError = output.toLowerCase().includes('error') && !output.includes('error: 0');
    const hasException = output.includes('Exception') || output.includes('Error:');
    
    if (hasError || hasException) {
      console.log(`❌ FAILED`);
      lines.slice(-10).forEach(l => console.log(`   ${l}`));
      return { name: script.name, status: 'FAILED', error: output };
    }
    
    // Check if script ran (look for expected keywords)
    const ran = output.toLowerCase().includes(script.expect) || 
                output.includes('Starting') || 
                output.includes('Completed') ||
                output.includes('Collected') ||
                output.includes('0 records');
    
    if (ran) {
      console.log(`✅ PASSED`);
      const firstLine = lines.find(l => l.includes('Starting') || l.includes('Collected') || l.includes('Completed')) || 'Ran successfully';
      console.log(`   ${firstLine}`);
      return { name: script.name, status: 'PASSED', output: firstLine };
    }
    
    console.log(`⚠️  UNCLEAR - No expected output`);
    return { name: script.name, status: 'UNCLEAR', output: 'No recognizable output' };
    
  } catch (error) {
    if (error.killed || error.signal === 'SIGTERM') {
      console.log(`⏱️  TIMEOUT (>60s)`);
      return { name: script.name, status: 'TIMEOUT', error: 'Script took too long' };
    }
    
    console.log(`❌ CRASHED`);
    console.log(`   ${error.message.split('\n')[0]}`);
    return { name: script.name, status: 'CRASHED', error: error.message };
  }
}

async function auditScripts() {
  console.log('='.repeat(70));
  console.log('POLYMARKET BOT - SCRIPT AUDIT');
  console.log('='.repeat(70));
  console.log(`Testing ${scripts.length} cron scripts...`);
  
  const results = [];
  
  for (const script of scripts) {
    const result = await testScript(script);
    results.push(result);
  }
  
  console.log('');
  console.log('='.repeat(70));
  console.log('SUMMARY:');
  console.log('-'.repeat(70));
  
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED' || r.status === 'CRASHED').length;
  const timeout = results.filter(r => r.status === 'TIMEOUT').length;
  const unclear = results.filter(r => r.status === 'UNCLEAR').length;
  
  console.log(`✅ Passed:   ${passed}/${scripts.length}`);
  if (failed > 0) console.log(`❌ Failed:   ${failed}/${scripts.length}`);
  if (timeout > 0) console.log(`⏱️  Timeout: ${timeout}/${scripts.length}`);
  if (unclear > 0) console.log(`⚠️  Unclear: ${unclear}/${scripts.length}`);
  
  console.log('');
  if (failed === 0 && timeout === 0) {
    console.log('✅ ALL SCRIPTS OPERATIONAL');
  } else {
    console.log('❌ SOME SCRIPTS NEED ATTENTION');
  }
  console.log('='.repeat(70));
  
  return results;
}

auditScripts().then(results => {
  process.exit(results.filter(r => r.status === 'FAILED' || r.status === 'CRASHED').length > 0 ? 1 : 0);
}).catch(err => {
  console.error('AUDIT FAILED:', err.message);
  process.exit(1);
});