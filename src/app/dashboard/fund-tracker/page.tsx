import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { format, addDays } from 'date-fns';
import FundTrackerClientView from './FundTrackerClientView';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function FundTrackerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }
  const userId = (session.user as { id: string }).id;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const threeDaysAhead = format(addDays(new Date(), 3), 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  // Fetch overdue + next 3 days, only pending/partial from active plans
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

  // Compute summary
  let totalNeeded = 0;
  let withdrawalRequested = 0;
  let credited = 0;
  let atRisk = 0;
  let atRiskCount = 0;

  for (const p of payouts) {
    const balance = p.expectedAmount - (p.paidAmount || 0);
    totalNeeded += balance;

    if (p.fundStatus === 'credited') {
      credited += balance;
    } else if (p.fundStatus === 'withdrawal_requested') {
      withdrawalRequested += balance;
      if (p.dueDate <= tomorrowStr) {
        atRisk += balance;
        atRiskCount++;
      }
    } else {
      if (p.dueDate <= tomorrowStr) {
        atRisk += balance;
        atRiskCount++;
      }
    }
  }

  const serializePayout = (p: any) => ({
    id: p.id,
    planId: p.planId,
    dueDate: p.dueDate,
    expectedAmount: p.expectedAmount,
    paidAmount: p.paidAmount,
    paymentDate: p.paymentDate ?? undefined,
    modeOfPayment: p.modeOfPayment ?? undefined,
    referenceNo: p.referenceNo ?? undefined,
    status: p.status,
    notes: p.notes ?? undefined,
    payoutNumber: p.payoutNumber ?? undefined,
    fundStatus: p.fundStatus ?? null,
    fundStatusDate: p.fundStatusDate ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    plan: p.plan ? {
      id: p.plan.id,
      clientId: p.plan.clientId,
      planName: p.plan.planName,
      principalAmount: p.plan.principalAmount,
      payoutType: p.plan.payoutType,
      payoutAmount: p.plan.payoutAmount ?? undefined,
      payoutPercentage: p.plan.payoutPercentage ?? undefined,
      startDate: p.plan.startDate,
      maturityDate: p.plan.maturityDate ?? undefined,
      durationMonths: p.plan.durationMonths ?? undefined,
      totalPayouts: p.plan.totalPayouts ?? undefined,
      defaultPaymentMode: p.plan.defaultPaymentMode,
      status: p.plan.status,
      notes: p.plan.notes ?? undefined,
      createdBy: p.plan.createdBy,
      createdAt: p.plan.createdAt.toISOString(),
      updatedAt: p.plan.updatedAt.toISOString(),
      client: p.plan.client ? {
        id: p.plan.client.id,
        name: p.plan.client.name,
        phone: p.plan.client.phone ?? undefined,
        email: p.plan.client.email ?? undefined,
        address: p.plan.client.address ?? undefined,
        notes: p.plan.client.notes ?? undefined,
        createdBy: p.plan.client.createdBy,
        createdAt: p.plan.client.createdAt.toISOString(),
        updatedAt: p.plan.client.updatedAt.toISOString(),
      } : undefined
    } : undefined,
  });

  const data = {
    payouts: payouts.map(serializePayout),
    summary: {
      totalNeeded,
      withdrawalRequested,
      credited,
      atRisk,
      atRiskCount,
    },
    todayStr,
    tomorrowStr,
  };

  return <FundTrackerClientView data={data} />;
}
