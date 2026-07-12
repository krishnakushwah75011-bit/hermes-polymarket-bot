// scripts/run-cron.ts
// Wrapper for all cron scripts - forces IPv4 DNS resolution for Supabase
// This bypasses Airtel Fiber's IPv6-only DNS for supabase.co domains

import 'dotenv/config';
import * as dns from 'dns';
import { Resolver } from 'dns';

// Create a custom DNS resolver that prefers IPv4
const resolver = new Resolver();
resolver.setServers(['8.8.8.8', '8.8.4.4']);

// Override dns.lookup to use our resolver with IPv4 preference
const originalLookup = dns.getDefaultResultOrder ? dns.getDefaultResultOrder() : 'ipv4first';

// Set IPv4-first globally
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Now import and run the target script
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const scriptPath = process.argv[2];
if (!scriptPath) {
  console.error('Usage: npx tsx run-cron.ts <script-path>');
  console.error('Example: npx tsx run-cron.ts src/scripts/scan-leaderboard.ts');
  process.exit(1);
}

console.log(`[run-cron] Starting ${scriptPath} with IPv4 DNS override...`);
console.log(`[run-cron] Using DNS servers: 8.8.8.8, 8.8.4.4`);
console.log(`[run-cron] DNS order: ipv4first`);
console.log('');

// Import and execute the target script
import(scriptPath).then((module) => {
  const main = module.main || module.default;
  if (main && typeof main === 'function') {
    main().catch((error: Error) => {
      console.error('[run-cron] Script failed:', error.message);
      process.exit(1);
    });
  } else {
    console.error('[run-cron] No main() function found in', scriptPath);
    process.exit(1);
  }
}).catch((error: Error) => {
  console.error('[run-cron] Failed to load script:', error.message);
  process.exit(1);
});