import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { generatePayoutSchedule, calculateMaturityDate, calculateTotalPayouts } from '@/lib/utils';
import type { PayoutFrequency } from '@/types';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  // Verify old plan exists and belongs to user
  const oldPlan = await prisma.plan.findFirst({
    where: { id, createdBy: userId },
  });
  if (!oldPlan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

  const body = await req.json();

  // Validate inputs
  const principalAmount = parseFloat(body.principalAmount);
  if (isNaN(principalAmount) || principalAmount <= 0) {
    return NextResponse.json({ error: 'Invalid principal amount' }, { status: 400 });
  }

  const startDate = body.startDate || new Date().toISOString().split('T')[0];
  let durationMonths = body.durationMonths ? parseInt(body.durationMonths) : null;
  let maturityDate = body.maturityDate || null;

  if (!maturityDate && durationMonths) {
    maturityDate = calculateMaturityDate(startDate, durationMonths);
  }

  if (!maturityDate) {
    return NextResponse.json({ error: 'Maturity date or duration is required' }, { status: 400 });
  }

  // Calculate payouts
  let payoutAmount = body.payoutAmount ? parseFloat(body.payoutAmount) : null;
  let payoutPercentage = body.payoutPercentage ? parseFloat(body.payoutPercentage) / 100 : null;
  if (payoutPercentage) {
    payoutAmount = principalAmount * payoutPercentage;
  }

  if (payoutAmount === null || isNaN(payoutAmount) || payoutAmount <= 0) {
    return NextResponse.json({ error: 'Invalid payout rate or amount' }, { status: 400 });
  }

  const payoutDay = body.payoutDay ? parseInt(body.payoutDay) : null;
  const payoutType = (body.payoutType || 'monthly') as PayoutFrequency;

  const totalPayouts = calculateTotalPayouts(
    startDate,
    maturityDate,
    payoutType,
    payoutDay
  );

  const result = await prisma.$transaction(async (tx) => {
    // 1. Mark old plan as completed
    await tx.plan.update({
      where: { id },
      data: { status: 'completed' },
    });

    // 2. Create new plan
    const newPlan = await tx.plan.create({
      data: {
        clientId: oldPlan.clientId,
        planName: body.planName || `Renewed - ${oldPlan.planName}`,
        principalAmount,
        payoutType,
        payoutAmount,
        payoutPercentage,
        startDate,
        maturityDate,
        durationMonths,
        totalPayouts,
        payoutDay,
        defaultPaymentMode: body.defaultPaymentMode || oldPlan.defaultPaymentMode,
        status: 'active',
        notes: body.notes || `Rollover from plan: ${oldPlan.planName}`,
        createdBy: userId,
      },
    });

    // 3. Generate schedule
    const schedule = generatePayoutSchedule(
      newPlan.id,
      startDate,
      maturityDate,
      payoutType,
      payoutAmount,
      payoutDay
    );

    if (schedule.length > 0) {
      await tx.payout.createMany({
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

    return newPlan;
  });

  return NextResponse.json(result);
}
