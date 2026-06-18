import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;

    const body = await req.json();
    if (!body || !body.data) {
      return NextResponse.json({ error: 'Invalid backup structure' }, { status: 400 });
    }

    const { clients = [], plans = [], payouts = [] } = body.data;

    const result = await prisma.$transaction(async (tx) => {
      const clientIdMap: Record<string, string> = {};
      const planIdMap: Record<string, string> = {};

      let clientsImported = 0;
      let plansImported = 0;
      let payoutsImported = 0;

      // 1. Import Clients
      for (const c of clients) {
        const newClient = await tx.client.create({
          data: {
            name: c.name,
            phone: c.phone || null,
            email: c.email || null,
            address: c.address || null,
            notes: c.notes || null,
            createdBy: userId,
            createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
            updatedAt: c.updatedAt ? new Date(c.updatedAt) : undefined,
          },
        });
        clientIdMap[c.id] = newClient.id;
        clientsImported++;
      }

      // 2. Import Plans
      for (const p of plans) {
        const newClientId = clientIdMap[p.clientId];
        if (!newClientId) {
          // Skip if parent client doesn't exist in backup mapping
          continue;
        }

        const newPlan = await tx.plan.create({
          data: {
            clientId: newClientId,
            planName: p.planName,
            principalAmount: Number(p.principalAmount),
            payoutType: p.payoutType || 'monthly',
            payoutAmount: p.payoutAmount ? Number(p.payoutAmount) : null,
            payoutPercentage: p.payoutPercentage ? Number(p.payoutPercentage) : null,
            startDate: p.startDate,
            maturityDate: p.maturityDate || null,
            durationMonths: p.durationMonths ? Number(p.durationMonths) : null,
            totalPayouts: p.totalPayouts ? Number(p.totalPayouts) : null,
            payoutDay: p.payoutDay ? Number(p.payoutDay) : null,
            defaultPaymentMode: p.defaultPaymentMode || 'cash',
            status: p.status || 'active',
            notes: p.notes || null,
            createdBy: userId,
            createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
            updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
          },
        });
        planIdMap[p.id] = newPlan.id;
        plansImported++;
      }

      // 3. Import Payouts
      for (const py of payouts) {
        const newPlanId = planIdMap[py.planId];
        if (!newPlanId) {
          // Skip if parent plan doesn't exist in backup mapping
          continue;
        }

        await tx.payout.create({
          data: {
            planId: newPlanId,
            dueDate: py.dueDate,
            expectedAmount: Number(py.expectedAmount),
            paidAmount: Number(py.paidAmount || 0),
            paymentDate: py.paymentDate || null,
            modeOfPayment: py.modeOfPayment || null,
            referenceNo: py.referenceNo || null,
            status: py.status || 'pending',
            notes: py.notes || null,
            payoutNumber: py.payoutNumber ? Number(py.payoutNumber) : null,
            fundStatus: py.fundStatus || null,
            fundStatusDate: py.fundStatusDate || null,
            createdAt: py.createdAt ? new Date(py.createdAt) : undefined,
            updatedAt: py.updatedAt ? new Date(py.updatedAt) : undefined,
          },
        });
        payoutsImported++;
      }

      return {
        clientsImported,
        plansImported,
        payoutsImported,
      };
    });

    return NextResponse.json({
      message: 'Restore complete',
      ...result,
    });
  } catch (err) {
    console.error('Import data error:', err);
    return NextResponse.json({ error: 'Server error or invalid backup format' }, { status: 500 });
  }
}
