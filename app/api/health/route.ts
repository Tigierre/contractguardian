/**
 * GET /api/health
 *
 * Health check endpoint for deployment verification.
 * Tests database connectivity and returns system status.
 *
 * @module app/api/health/route
 */

import { NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Test database connection with simple query
    await db.execute(sql`SELECT 1`);

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: 'Database connection failed',
      },
      { status: 503 }
    );
  }
}
