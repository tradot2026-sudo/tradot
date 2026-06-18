import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  // Ownership check via join
  const payout = await prisma.payout.findFirst({
    where: { id, plan: { createdBy: userId } },
  });
  if (!payout) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();

  // Handle Reset Payment
  if (body.resetPayment) {
    const updated = await prisma.payout.update({
      where: { id },
      data: {
        paidAmount: 0,
        paymentDate: null,
        modeOfPayment: null,
        referenceNo: null,
        notes: null,
        status: 'pending',
      },
    });
    return NextResponse.json(updated);
  }

  const inputPaidAmount = parseFloat(body.paidAmount || '0');
  const paymentDate = body.paymentDate || null;
  const modeOfPayment = body.modeOfPayment || null;
  const referenceNo = body.referenceNo || null;
  const notes = body.notes || null;

  if (inputPaidAmount <= 0) {
    // If no paid amount is passed (e.g. just updating notes/references), update selected payout directly
    const updated = await prisma.payout.update({
      where: { id },
      data: {
        paymentDate,
        modeOfPayment,
        referenceNo,
        notes,
      },
    });
    return NextResponse.json(updated);
  }

  // Load all payouts for this plan to apply FIFO/waterfall rollover
  const allPayouts = await prisma.payout.findMany({
    where: { planId: payout.planId },
    orderBy: [
      { dueDate: 'asc' },
      { payoutNumber: 'asc' },
    ],
  });

  const selectedIndex = allPayouts.findIndex(p => p.id === id);
  if (selectedIndex === -1) return NextResponse.json({ error: 'Payout index error' }, { status: 500 });

  const updates: { id: string; paidAmount: number; status: string; notes: string | null }[] = [];
  let overflow = inputPaidAmount;
  let firstUpdated = true;

  for (let i = 0; i < allPayouts.length; i++) {
    const p = allPayouts[i];

    // Only apply to unpaid/partial payouts
    if (p.status !== 'paid') {
      const balance = p.expectedAmount - (p.paidAmount || 0);
      if (balance <= 0) continue;

      const currentNotes = firstUpdated ? notes : `Rollover from payout #${payout.payoutNumber || ''}`;
      firstUpdated = false;

      if (overflow >= balance) {
        // Fully satisfy this payout
        updates.push({
          id: p.id,
          paidAmount: p.expectedAmount,
          status: 'paid',
          notes: currentNotes,
        });
        overflow -= balance;
      } else {
        // Partially satisfy this payout
        updates.push({
          id: p.id,
          paidAmount: (p.paidAmount || 0) + overflow,
          status: 'partial',
          notes: currentNotes,
        });
        overflow = 0;
        break; // overflow exhausted
      }
    }

    if (overflow <= 0) break;
  }

  // If there's still overflow left after processing all payouts,
  // apply the remainder to the last updated payout as an overpayment (or selected if none updated)
  if (overflow > 0) {
    if (updates.length > 0) {
      updates[updates.length - 1].paidAmount += overflow;
    } else {
      updates.push({
        id,
        paidAmount: payout.expectedAmount + overflow,
        status: 'paid',
        notes: notes,
      });
    }
  }

  // Perform updates inside an atomic transaction
  const result = await prisma.$transaction(async (tx) => {
    let lastUpdated = null;
    for (const u of updates) {
      lastUpdated = await tx.payout.update({
        where: { id: u.id },
        data: {
          paidAmount: u.paidAmount,
          status: u.status,
          paymentDate,
          modeOfPayment,
          referenceNo,
          notes: u.notes,
        },
      });
    }
    return lastUpdated || payout;
  });

  return NextResponse.json(result);
}
