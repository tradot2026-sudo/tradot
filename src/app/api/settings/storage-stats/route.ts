import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;

    // Get row counts for stats
    const [clientCount, planCount, payoutCount] = await Promise.all([
      prisma.client.count({ where: { createdBy: userId } }),
      prisma.plan.count({ where: { createdBy: userId } }),
      prisma.payout.count({ where: { plan: { createdBy: userId } } }),
    ]);

    let databaseSizeBytes = 0;
    let isMock = false;

    try {
      // Query PostgreSQL database size
      const dbSizeRaw = await prisma.$queryRawUnsafe<any[]>(
        'SELECT pg_database_size(current_database()) as size'
      );
      if (dbSizeRaw && dbSizeRaw[0]) {
        // Convert BigInt to Number safely
        databaseSizeBytes = Number(dbSizeRaw[0].size || 0);
      }
    } catch (err) {
      console.warn('Postgres database size query failed, using estimation fallback:', err);
      // Fallback: estimate database size based on counts (averaging 500 bytes per payout/plan/client + base size)
      const baseSize = 8 * 1024 * 1024; // 8MB base
      const entrySize = (clientCount + planCount + payoutCount) * 1024; // 1KB per record
      databaseSizeBytes = baseSize + entrySize;
      isMock = true;
    }

    // Free tier Supabase limit is 500 MB
    const freeTierLimitBytes = 500 * 1024 * 1024; 
    const usedPercentage = Math.min(100, Number(((databaseSizeBytes / freeTierLimitBytes) * 100).toFixed(2)));

    return NextResponse.json({
      databaseSizeBytes,
      freeTierLimitBytes,
      usedPercentage,
      isMock,
      counts: {
        clients: clientCount,
        plans: planCount,
        payouts: payoutCount,
      },
    });
  } catch (err) {
    console.error('Storage stats error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
