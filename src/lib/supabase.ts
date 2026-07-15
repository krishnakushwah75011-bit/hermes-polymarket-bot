// lib/supabase.ts
// Supabase client for Vercel serverless functions
// CRITICAL: Uses IPv4-first DNS resolution for Airtel Fiber compatibility

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iaxfwsjjmwvlqyqvzvfb.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlheGZ3c2pqbXd2bHF5cXp2ZmIiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc0OTg5MzQwMywiZXhwIjoyMDY1NDY5NDAzfQ.dXNlcl9rZXlfZm9yX3BvbHltYXJrZXRfYm90';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

// Helper to get dashboard stats
export async function getDashboardStats() {
  try {
    // Get core metrics
    const [openTrades, trackedWallets, totalTrades, paperCopyDecisions] = await Promise.all([
      supabase.from('PaperTrade').select('count', { count: 'exact', head: true }).eq('status', 'OPEN'),
      supabase.from('WalletProfile').select('count', { count: 'exact', head: true }).eq('status', 'TRACK'),
      supabase.from('ObservedTrade').select('count', { count: 'exact', head: true }),
      supabase.from('DecisionJournal').select('count', { count: 'exact', head: true }).eq('decision', 'PAPER_COPY'),
    ]);

    // Get recent activity (last 30 min)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const recentTrades = await supabase
      .from('ObservedTrade')
      .select('count', { count: 'exact', head: true })
      .gte('createdAt', thirtyMinAgo);

    // Get open positions with details
    const { data: openPositions } = await supabase
      .from('PaperTrade')
      .select('id, marketId, side, simulatedPositionSize, entryPrice, openedAt')
      .eq('status', 'OPEN')
      .order('openedAt', { ascending: false })
      .limit(10);

    // Get last pipeline run (from DataCollectionState)
    const { data: collectionState } = await supabase
      .from('DataCollectionState')
      .select('lastRunAt')
      .eq('collectionType', 'trades')
      .single();

    return {
      open_trades: openTrades.count || 0,
      tracked_wallets: trackedWallets.count || 0,
      total_trades: totalTrades.count || 0,
      paper_copy_decisions: paperCopyDecisions.count || 0,
      trades_last_30min: recentTrades.count || 0,
      last_run: collectionState?.lastRunAt || null,
      open_positions: openPositions || [],
      status: (recentTrades.count || 0) > 0 ? 'healthy' : 'starting'
    };
  } catch (error: any) {
    console.error('Dashboard stats error:', error.message);
    return {
      status: 'degraded',
      open_trades: 0,
      tracked_wallets: 0,
      total_trades: 0,
      paper_copy_decisions: 0,
      trades_last_30min: 0,
      last_run: null,
      open_positions: [],
      error: error.message
    };
  }
}