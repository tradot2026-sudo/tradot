import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { generatePayoutSchedule, calculateMaturityDate, calculateTotalPayouts } from '@/lib/utils';
import type { PayoutFrequency } from '@/types';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');

  const plans = await prisma.plan.findMany({
    where: { createdBy: userId, ...(clientId ? { clientId } : {}) },
    include: {
      client: true,
      payouts: { orderBy: { dueDate: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(plans);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await req.json();

  // Verify client belongs to user
  const client = await prisma.client.findFirst({ where: { id: body.clientId, createdBy: userId } });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  // Resolve maturity date
  let maturityDate = body.maturityDate || null;
  if (!maturityDate && body.durationMonths) {
    maturityDate = calculateMaturityDate(body.startDate, parseInt(body.durationMonths));
  }

  // Resolve total payouts
  let totalPayouts = null;
  if (maturityDate && body.payoutType) {
    totalPayouts = calculateTotalPayouts(
      body.startDate,
      maturityDate,
      body.payoutType as PayoutFrequency,
      body.payoutDay ? parseInt(body.payoutDay) : null
    );
  }

  // Resolve payout amount
  let payoutAmount = body.payoutAmount ? parseFloat(body.payoutAmount) : null;
  let payoutPercentage = body.payoutPercentage ? parseFloat(body.payoutPercentage) / 100 : null;
  if (payoutPercentage && body.principalAmount) {
    payoutAmount = parseFloat(body.principalAmount) * payoutPercentage;
  }

  const plan = await prisma.plan.create({
    data: {
      clientId: body.clientId,
      planName: body.planName,
      principalAmount: parseFloat(body.principalAmount),
      payoutType: body.payoutType,
      payoutAmount,
      payoutPercentage,
      startDate: body.startDate,
      maturityDate,
      durationMonths: body.durationMonths ? parseInt(body.durationMonths) : null,
      totalPayouts,
      payoutDay: body.payoutDay ? parseInt(body.payoutDay) : null,
      defaultPaymentMode: body.defaultPaymentMode || 'cash',
      status: body.status || 'active',
      notes: body.notes || null,
      createdBy: userId,
    },
  });

  // Auto-generate payout schedule
  if (maturityDate && payoutAmount) {
    const schedule = generatePayoutSchedule(
      plan.id,
      body.startDate,
      maturityDate,
      body.payoutType as PayoutFrequency,
      payoutAmount,
      body.payoutDay ? parseInt(body.payoutDay) : null
    );

    if (schedule.length > 0) {
      await prisma.payout.createMany({
        data: schedule.map(p => ({
          planId: p.planId,
          dueDate: p.dueDate,
          expectedAmount: p.expectedAmount,
          paidAmount: 0,
          status: 'pending',
          payoutNumber: p.payoutNumber ?? null,
        })),
      });
    }
  }

  const planWithPayouts = await prisma.plan.findUnique({
    where: { id: plan.id },
    include: { payouts: true },
  });

  return NextResponse.json(planWithPayouts, { status: 201 });
}
