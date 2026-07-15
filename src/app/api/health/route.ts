import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Simple health check - just verify API can respond
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'polymarket-bot-api'
    });
  } catch (err) {
    return NextResponse.json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 200 }); // Still return 200 for Vercel
  }
}