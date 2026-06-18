import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { format, addDays } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekAhead = format(addDays(new Date(), 7), 'yyyy-MM-dd');

  const [
    totalClients,
    plans,
    dueTodayPayouts,
    overduePayouts,
    upcomingPayouts,
    recentClients,
    paidPayouts,
  ] = await Promise.all([
    prisma.client.count({ where: { createdBy: userId } }),
    prisma.plan.findMany({ where: { createdBy: userId }, select: { principalAmount: true, status: true } }),
    prisma.payout.findMany({
      where: { dueDate: todayStr, status: { in: ['pending', 'partial', 'overdue'] }, plan: { createdBy: userId, status: 'active' } },
      include: { plan: { include: { client: true } } },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
    prisma.payout.findMany({
      where: { dueDate: { lt: todayStr }, status: { in: ['pending', 'overdue'] }, plan: { createdBy: userId, status: 'active' } },
      include: { plan: { include: { client: true } } },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
    prisma.payout.findMany({
      where: { dueDate: { gt: todayStr, lte: weekAhead }, status: { in: ['pending', 'partial'] }, plan: { createdBy: userId, status: 'active' } },
      include: { plan: { include: { client: true } } },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
    prisma.client.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.payout.findMany({
      where: { status: { in: ['paid', 'partial'] }, plan: { createdBy: userId } },
      select: { paidAmount: true },
    }),
  ]);

  return NextResponse.json({
    totalClients,
    totalInvested: plans.reduce((s, p) => s + p.principalAmount, 0),
    totalPaid: paidPayouts.reduce((s, p) => s + p.paidAmount, 0),
    activePlans: plans.filter(p => p.status === 'active').length,
    dueTodayPayouts,
    overduePayouts,
    upcomingPayouts,
    recentClients,
  });
}
