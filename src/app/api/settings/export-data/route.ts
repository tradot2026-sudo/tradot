import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;

    // Fetch all related entities
    const clients = await prisma.client.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'asc' },
    });

    const plans = await prisma.plan.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'asc' },
    });

    const payouts = await prisma.payout.findMany({
      where: { plan: { createdBy: userId } },
      orderBy: { dueDate: 'asc' },
    });

    return NextResponse.json({
      app: 'Tradot Payout Tracker',
      exportDate: new Date().toISOString(),
      version: '1.0',
      data: {
        clients,
        plans,
        payouts,
      },
    });
  } catch (err) {
    console.error('Export data error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
