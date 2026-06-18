import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { generatePayoutSchedule, calculateMaturityDate, calculateTotalPayouts } from '@/lib/utils';
import type { PayoutFrequency, PaymentMode, PlanStatus } from '@/types';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await req.json();
  const rows = body.rows || [];

  const results = {
    clientsCreated: 0,
    plansCreated: 0,
    payoutsCreated: 0,
    errors: [] as string[],
  };

  const validPayoutTypes = ['daily', 'weekly', 'monthly'];
  const validPaymentModes = ['cash', 'bank_transfer', 'upi', 'cheque', 'other'];
  const validPlanStatuses = ['active', 'paused', 'completed', 'cancelled'];

  for (const row of rows) {
    try {
      const name = row.client_name || row.clientName || row.name;
      if (!name || !String(name).trim()) {
        results.errors.push('Skipped row: Client Name is missing.');
        continue;
      }

      const clientName = String(name).trim();

      // Check if client exists
      let client = await prisma.client.findFirst({
        where: {
          createdBy: userId,
          name: { equals: clientName, mode: 'insensitive' },
        },
      });

      if (!client) {
        client = await prisma.client.create({
          data: {
            name: clientName,
            phone: row.client_phone || row.clientPhone || row.phone ? String(row.client_phone || row.clientPhone || row.phone).trim() : null,
            email: row.client_email || row.clientEmail || row.email ? String(row.client_email || row.clientEmail || row.email).trim() : null,
            address: row.client_address || row.clientAddress || row.address ? String(row.client_address || row.clientAddress || row.address).trim() : null,
            notes: row.client_notes || row.clientNotes || row.notes ? String(row.client_notes || row.clientNotes || row.notes).trim() : null,
            createdBy: userId,
          },
        });
        results.clientsCreated++;
      }

      // If plan fields exist, create plan
      const planName = row.plan_name || row.planName;
      const principalStr = row.principal_amount || row.principalAmount || row.principal;
      
      if (planName && principalStr) {
        const principalAmount = parseFloat(String(principalStr).replace(/[^\d.]/g, ''));
        if (isNaN(principalAmount) || principalAmount <= 0) {
          results.errors.push(`Skipped plan for "${clientName}": Invalid principal amount.`);
          continue;
        }

        // Sanitize payoutType
        let payoutType = String(row.payout_frequency || row.payoutFrequency || row.payoutType || 'monthly').trim().toLowerCase();
        if (!validPayoutTypes.includes(payoutType)) {
          payoutType = 'monthly';
        }

        const startDate = row.start_date || row.startDate || new Date().toISOString().split('T')[0];
        
        let durationMonths = null;
        const durationVal = row.duration_months || row.durationMonths || row.duration;
        if (durationVal) {
          durationMonths = parseInt(String(durationVal).replace(/[^\d]/g, ''));
        }

        let maturityDate = row.maturity_date || row.maturityDate || null;
        if (!maturityDate && durationMonths && !isNaN(durationMonths)) {
          maturityDate = calculateMaturityDate(startDate, durationMonths);
        }

        if (!maturityDate) {
          results.errors.push(`Skipped plan for "${clientName}": Duration or Maturity Date is required.`);
          continue;
        }

        // Payout amount calculations
        let payoutAmount = null;
        let payoutPercentage = null;
        const pctStr = row.payout_percentage || row.payoutPercentage || row.percentage;
        const amtStr = row.payout_amount || row.payoutAmount || row.amount;

        if (pctStr) {
          payoutPercentage = parseFloat(String(pctStr).replace(/[^\d.]/g, '')) / 100;
          payoutAmount = principalAmount * payoutPercentage;
        } else if (amtStr) {
          payoutAmount = parseFloat(String(amtStr).replace(/[^\d.]/g, ''));
          payoutPercentage = payoutAmount / principalAmount;
        }

        if (payoutAmount === null || isNaN(payoutAmount) || payoutAmount <= 0) {
          results.errors.push(`Skipped plan for "${clientName}": Payout amount or percentage is invalid.`);
          continue;
        }

        const dayVal = row.payout_day || row.payoutDay;
        const payoutDay = dayVal ? parseInt(String(dayVal).replace(/[^\d]/g, '')) : null;
        
        // Sanitize defaultPaymentMode
        let defaultPaymentMode = String(row.default_payment_mode || row.defaultPaymentMode || row.payment_mode || row.paymentMode || 'cash').trim().toLowerCase();
        if (!validPaymentModes.includes(defaultPaymentMode)) {
          defaultPaymentMode = 'cash';
        }

        // Sanitize planStatus
        let planStatus = String(row.status || row.planStatus || 'active').trim().toLowerCase();
        if (!validPlanStatuses.includes(planStatus)) {
          planStatus = 'active';
        }

        let totalPayouts = calculateTotalPayouts(
          startDate,
          maturityDate,
          payoutType as PayoutFrequency,
          payoutDay
        );

        const plan = await prisma.plan.create({
          data: {
            clientId: client.id,
            planName: String(planName).trim(),
            principalAmount,
            payoutType,
            payoutAmount,
            payoutPercentage,
            startDate,
            maturityDate,
            durationMonths,
            totalPayouts,
            payoutDay,
            defaultPaymentMode,
            status: planStatus,
            notes: row.plan_notes || row.planNotes || null,
            createdBy: userId,
          },
        });
        results.plansCreated++;

        // Generate Payout Schedule
        const schedule = generatePayoutSchedule(
          plan.id,
          startDate,
          maturityDate,
          payoutType as PayoutFrequency,
          payoutAmount,
          payoutDay
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
          results.payoutsCreated += schedule.length;
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      results.errors.push(`Failed to import row: ${errMsg}`);
    }
  }

  return NextResponse.json({ success: true, results });
}
