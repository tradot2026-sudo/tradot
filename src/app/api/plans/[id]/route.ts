import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { generatePayoutSchedule, calculateMaturityDate } from '@/lib/utils';
import type { PayoutFrequency } from '@/types';

async function getPlanOrForbid(id: string, userId: string) {
  return prisma.plan.findFirst({
    where: { id, createdBy: userId },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const plan = await prisma.plan.findFirst({
    where: { id, createdBy: userId },
    include: {
      client: true,
      payouts: { orderBy: { dueDate: 'asc' } },
    },
  });

  if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(plan);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const existing = await getPlanOrForbid(id, userId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();

  // Run in database transaction to prevent partial updates
  const result = await prisma.$transaction(async (tx) => {
    // 1. Update maturity date
    let maturityDate = body.maturityDate || null;
    if (!maturityDate && body.durationMonths) {
      maturityDate = calculateMaturityDate(body.startDate, parseInt(body.durationMonths));
    }

    // 2. Resolve payout amount
    let payoutAmount = body.payoutAmount ? parseFloat(body.payoutAmount) : null;
    let payoutPercentage = body.payoutPercentage ? parseFloat(body.payoutPercentage) / 100 : null;
    if (payoutPercentage && body.principalAmount) {
      payoutAmount = parseFloat(body.principalAmount) * payoutPercentage;
    }

    // 3. Update the Plan
    const updatedPlan = await tx.plan.update({
      where: { id },
      data: {
        planName: body.planName,
        principalAmount: parseFloat(body.principalAmount),
        payoutType: body.payoutType,
        payoutAmount,
        payoutPercentage,
        startDate: body.startDate,
        maturityDate,
        durationMonths: body.durationMonths ? parseInt(body.durationMonths) : null,
        defaultPaymentMode: body.defaultPaymentMode,
        status: body.status,
        notes: body.notes || null,
      },
    });

    // 4. Fetch current payouts to sync schedule
    const existingPayouts = await tx.payout.findMany({
      where: { planId: id },
    });

    const settledPayouts = existingPayouts.filter(
      p => p.status === 'paid' || p.status === 'partial'
    );
    const unsettledPayoutIds = existingPayouts
      .filter(p => p.status !== 'paid' && p.status !== 'partial')
      .map(p => p.id);

    // 5. Delete unsettled payouts
    if (unsettledPayoutIds.length > 0) {
      await tx.payout.deleteMany({
        where: { id: { in: unsettledPayoutIds } },
      });
    }

    // 6. Generate the new schedule based on updated values
    if (maturityDate && payoutAmount) {
      const fullSchedule = generatePayoutSchedule(
        id,
        body.startDate,
        maturityDate,
        body.payoutType as PayoutFrequency,
        payoutAmount
      );

      // Filter out payout numbers that are already settled (paid/partial)
      const settledPayoutNumbers = new Set(
        settledPayouts.map(p => p.payoutNumber).filter(Boolean) as number[]
      );
      const newPayoutsToCreate = fullSchedule.filter(
        p => !settledPayoutNumbers.has(p.payoutNumber ?? 0)
      );

      if (newPayoutsToCreate.length > 0) {
        await tx.payout.createMany({
          data: newPayoutsToCreate.map(p => ({
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

    return updatedPlan;
  });

  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const existing = await getPlanOrForbid(id, userId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.plan.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
