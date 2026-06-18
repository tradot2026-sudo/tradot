import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const { searchParams } = new URL(req.url);
  const planId = searchParams.get('planId');
  const status = searchParams.get('status');
  const clientId = searchParams.get('clientId');

  const payouts = await prisma.payout.findMany({
    where: {
      ...(planId ? { planId } : {}),
      ...(status && status !== 'all' ? { status } : {}),
      plan: {
        createdBy: userId,
        ...(clientId ? { clientId } : {}),
      },
    },
    include: {
      plan: {
        include: { client: true },
      },
      transactions: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { dueDate: 'asc' },
  });

  return NextResponse.json(payouts);
}
