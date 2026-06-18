import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { format, addDays } from 'date-fns';
import DashboardClientView from './DashboardClientView';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }
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
    } : undefined
  });

  const serializeClient = (c: any) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    address: c.address ?? undefined,
    notes: c.notes ?? undefined,
    createdBy: c.createdBy,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  });

  const dashboardData = {
    totalClients,
    totalInvested: plans.reduce((s, p) => s + p.principalAmount, 0),
    totalPaid: paidPayouts.reduce((s, p) => s + p.paidAmount, 0),
    activePlans: plans.filter(p => p.status === 'active').length,
    dueTodayPayouts: dueTodayPayouts.map(serializePayout),
    overduePayouts: overduePayouts.map(serializePayout),
    upcomingPayouts: upcomingPayouts.map(serializePayout),
    recentClients: recentClients.map(serializeClient),
  };

  return <DashboardClientView data={dashboardData} />;
}
