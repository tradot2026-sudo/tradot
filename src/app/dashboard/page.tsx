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
  const thirtyDaysAhead = format(addDays(new Date(), 30), 'yyyy-MM-dd');
  const startOfYearStr = `${new Date().getFullYear()}-01-01`;
  const endOfYearStr = `${new Date().getFullYear()}-12-31`;

  const dueTodayWhere = { dueDate: todayStr, status: { in: ['pending', 'partial', 'overdue'] as string[] }, plan: { createdBy: userId, status: 'active' } };
  const overdueWhere = { dueDate: { lt: todayStr }, status: { in: ['pending', 'overdue'] as string[] }, plan: { createdBy: userId, status: 'active' } };
  const upcomingWhere = { dueDate: { gt: todayStr, lte: weekAhead }, status: { in: ['pending', 'partial'] as string[] }, plan: { createdBy: userId, status: 'active' } };

  const [
    totalClients,
    plans,
    dueTodayPayouts,
    overduePayouts,
    upcomingPayouts,
    recentClients,
    paidPayouts,
    maturingPlans,
    yearlyPayouts,
    dueTodayAgg,
    overdueAgg,
    upcomingAgg,
  ] = await Promise.all([
    prisma.client.count({ where: { createdBy: userId } }),
    prisma.plan.findMany({ where: { createdBy: userId }, select: { principalAmount: true, status: true } }),
    prisma.payout.findMany({
      where: dueTodayWhere,
      include: { plan: { include: { client: true } } },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
    prisma.payout.findMany({
      where: overdueWhere,
      include: { plan: { include: { client: true } } },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
    prisma.payout.findMany({
      where: upcomingWhere,
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
    prisma.plan.findMany({
      where: {
        createdBy: userId,
        status: 'active',
        maturityDate: { gte: todayStr, lte: thirtyDaysAhead }
      },
      include: { client: true },
      orderBy: { maturityDate: 'asc' }
    }),
    prisma.payout.findMany({
      where: {
        dueDate: { gte: startOfYearStr, lte: endOfYearStr },
        plan: { createdBy: userId }
      },
      select: {
        dueDate: true,
        expectedAmount: true,
        paidAmount: true,
        status: true
      }
    }),
    // Aggregate queries for accurate counts & sums (not capped at 10)
    prisma.payout.aggregate({
      where: dueTodayWhere,
      _count: true,
      _sum: { expectedAmount: true, paidAmount: true },
    }),
    prisma.payout.aggregate({
      where: overdueWhere,
      _count: true,
      _sum: { expectedAmount: true, paidAmount: true },
    }),
    prisma.payout.aggregate({
      where: upcomingWhere,
      _count: true,
      _sum: { expectedAmount: true, paidAmount: true },
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

  const serializePlan = (p: any) => ({
    id: p.id,
    clientId: p.clientId,
    planName: p.planName,
    principalAmount: p.principalAmount,
    payoutType: p.payoutType,
    payoutAmount: p.payoutAmount ?? undefined,
    payoutPercentage: p.payoutPercentage ?? undefined,
    startDate: p.startDate,
    maturityDate: p.maturityDate ?? undefined,
    durationMonths: p.durationMonths ?? undefined,
    totalPayouts: p.totalPayouts ?? undefined,
    defaultPaymentMode: p.defaultPaymentMode,
    payoutDay: p.payoutDay ?? undefined,
    status: p.status,
    notes: p.notes ?? undefined,
    createdBy: p.createdBy,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    client: p.client ? serializeClient(p.client) : undefined
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
    maturingPlans: maturingPlans.map(serializePlan),
    yearlyPayouts: yearlyPayouts,
    // Accurate aggregate stats (not capped by take:10)
    dueTodayStats: { count: dueTodayAgg._count, totalAmount: (dueTodayAgg._sum.expectedAmount || 0) - (dueTodayAgg._sum.paidAmount || 0) },
    overdueStats: { count: overdueAgg._count, totalAmount: (overdueAgg._sum.expectedAmount || 0) - (overdueAgg._sum.paidAmount || 0) },
    upcomingStats: { count: upcomingAgg._count, totalAmount: (upcomingAgg._sum.expectedAmount || 0) - (upcomingAgg._sum.paidAmount || 0) },
  };

  return <DashboardClientView data={dashboardData} />;
}
