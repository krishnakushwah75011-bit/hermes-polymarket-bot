// app/api/stats/route.ts
// Real-time dashboard statistics from Supabase (direct PG connection)
import { NextResponse } from 'next/server';
import { getDashboardStatsDirect } from '../../lib/supabase-direct';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = await getDashboardStatsDirect();
    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Stats API error:', error);
    return NextResponse.json({
      status: 'error',
      error: error.message,
      open_trades: 0,
      tracked_wallets: 0,
      total_trades: 0,
      paper_copy_decisions: 0,
      trades_last_30min: 0,
      last_run: null,
      open_positions: [],
      timestamp: new Date().toISOString()
    }, { status: 200 });
  }
}