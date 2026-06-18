import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { format, addDays } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const threeDaysAhead = format(addDays(new Date(), 3), 'yyyy-MM-dd');

  // Fetch: overdue + due today through next 3 days, only pending/partial payouts from active plans
  const payouts = await prisma.payout.findMany({
    where: {
      status: { in: ['pending', 'partial', 'overdue'] },
      dueDate: { lte: threeDaysAhead },
      plan: {
        createdBy: userId,
        status: 'active',
      },
    },
    include: {
      plan: {
        include: { client: true },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  // Compute summary stats
  const summary = {
    totalNeeded: 0,
    withdrawalRequested: 0,
    credited: 0,
    atRisk: 0,
    atRiskCount: 0,
    overdueCount: 0,
    overdueAmount: 0,
  };

  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  for (const p of payouts) {
    const balance = p.expectedAmount - (p.paidAmount || 0);
    summary.totalNeeded += balance;

    if (p.fundStatus === 'credited') {
      summary.credited += balance;
    } else if (p.fundStatus === 'withdrawal_requested') {
      summary.withdrawalRequested += balance;
      // At risk if due tomorrow or earlier and not credited
      if (p.dueDate <= tomorrowStr) {
        summary.atRisk += balance;
        summary.atRiskCount++;
      }
    } else {
      // No action taken — at risk if due within 1 day or overdue
      if (p.dueDate <= tomorrowStr) {
        summary.atRisk += balance;
        summary.atRiskCount++;
      }
    }

    if (p.dueDate < todayStr) {
      summary.overdueCount++;
      summary.overdueAmount += balance;
    }
  }

  return NextResponse.json({ payouts, summary });
}
