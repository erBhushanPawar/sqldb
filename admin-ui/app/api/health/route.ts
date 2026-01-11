import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const health = await healthCheck();

    return NextResponse.json({
      status: health.mysql && health.redis ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        mysql: health.mysql ? 'connected' : 'disconnected',
        redis: health.redis ? 'connected' : 'disconnected',
      },
      error: health.error,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
