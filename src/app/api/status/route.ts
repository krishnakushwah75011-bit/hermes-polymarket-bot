// Disable DNS caching that causes Airtel IPv4 issues
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json({
      status: 'healthy',
      service: 'polymarket-bot',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return Response.json({
      status: 'degraded',
      timestamp: new Date().toISOString()
    }, { status: 200 });
  }
}