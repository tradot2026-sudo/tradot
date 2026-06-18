import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, addDays, addWeeks, addMonths, isAfter, isBefore, isEqual, parseISO, differenceInDays } from 'date-fns';
import type { PayoutFrequency, Payout, PayoutStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM yyyy');
}

export function formatDateShort(date: string | Date): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy');
}

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function calculateMaturityDate(
  startDate: string,
  durationMonths: number
): string {
  const start = parseISO(startDate);
  const maturity = addMonths(start, durationMonths);
  return format(maturity, 'yyyy-MM-dd');
}

export function calculateTotalPayouts(
  startDate: string,
  maturityDate: string,
  frequency: PayoutFrequency
): number {
  const start = parseISO(startDate);
  const end = parseISO(maturityDate);

  let count = 0;
  let current = start;

  while (isBefore(current, end) || isEqual(current, end)) {
    count++;
    if (frequency === 'daily') current = addDays(current, 1);
    else if (frequency === 'weekly') current = addWeeks(current, 1);
    else current = addMonths(current, 1);
    if (count > 10000) break; // safety
  }

  return count;
}

export function generatePayoutSchedule(
  planId: string,
  startDate: string,
  maturityDate: string,
  frequency: PayoutFrequency,
  expectedAmount: number
): Omit<Payout, 'id' | 'createdAt' | 'updatedAt'>[] {
  const start = parseISO(startDate);
  const end = parseISO(maturityDate);
  const schedule: Omit<Payout, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  let current = start;
  let number = 1;

  while (isBefore(current, end) || isEqual(current, end)) {
    schedule.push({
      planId,
      dueDate: format(current, 'yyyy-MM-dd'),
      expectedAmount,
      paidAmount: 0,
      status: 'pending',
      payoutNumber: number,
    });
    number++;
    if (frequency === 'daily') current = addDays(current, 1);
    else if (frequency === 'weekly') current = addWeeks(current, 1);
    else current = addMonths(current, 1);
    if (number > 10000) break;
  }

  return schedule;
}

export function getPayoutStatus(payout: Payout): PayoutStatus {
  const todayStr = today();
  if (payout.status === 'paid' || payout.status === 'waived') return payout.status;
  if (payout.paidAmount > 0 && payout.paidAmount < payout.expectedAmount) return 'partial';
  if (payout.dueDate < todayStr && payout.status === 'pending') return 'overdue';
  return payout.status;
}

export function getStatusColor(status: PayoutStatus | string): string {
  switch (status) {
    case 'paid': return 'text-emerald-400 bg-emerald-400/10';
    case 'partial': return 'text-amber-400 bg-amber-400/10';
    case 'overdue': return 'text-red-400 bg-red-400/10';
    case 'pending': return 'text-slate-400 bg-slate-400/10';
    case 'waived': return 'text-purple-400 bg-purple-400/10';
    case 'active': return 'text-emerald-400 bg-emerald-400/10';
    case 'paused': return 'text-amber-400 bg-amber-400/10';
    case 'completed': return 'text-blue-400 bg-blue-400/10';
    case 'cancelled': return 'text-red-400 bg-red-400/10';
    default: return 'text-slate-400 bg-slate-400/10';
  }
}

export function getPlanStatusLabel(status: string): string {
  switch (status) {
    case 'active': return 'Active';
    case 'paused': return 'Paused';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}

export function getPayoutStatusLabel(status: string): string {
  switch (status) {
    case 'paid': return 'Paid';
    case 'partial': return 'Partial';
    case 'overdue': return 'Overdue';
    case 'pending': return 'Pending';
    case 'waived': return 'Waived';
    default: return status;
  }
}

export function getPaymentModeLabel(mode: string): string {
  switch (mode) {
    case 'cash': return 'Cash';
    case 'bank_transfer': return 'Bank Transfer';
    case 'upi': return 'UPI';
    case 'cheque': return 'Cheque';
    case 'other': return 'Other';
    default: return mode;
  }
}

export function getFrequencyLabel(freq: string): string {
  switch (freq) {
    case 'daily': return 'Daily';
    case 'weekly': return 'Weekly';
    case 'monthly': return 'Monthly';
    default: return freq;
  }
}

export function isOverdue(payout: Payout): boolean {
  return payout.dueDate < today() && payout.status === 'pending';
}

export function isDueToday(payout: Payout): boolean {
  return payout.dueDate === today();
}

export function isDueThisWeek(payout: Payout): boolean {
  const todayStr = today();
  const weekAhead = format(addDays(new Date(), 7), 'yyyy-MM-dd');
  return payout.dueDate >= todayStr && payout.dueDate <= weekAhead;
}

export function calculateDelayDays(dueDate: string, paymentDate?: string | null): number {
  if (paymentDate) {
    const due = parseISO(dueDate);
    const actual = parseISO(paymentDate);
    const diff = differenceInDays(actual, due);
    return diff > 0 ? diff : 0;
  }
  
  const todayStr = today();
  if (dueDate < todayStr) {
    const due = parseISO(dueDate);
    const current = parseISO(todayStr);
    const diff = differenceInDays(current, due);
    return diff > 0 ? diff : 0;
  }

  return 0;
}

export function getDelayLabel(dueDate: string, paymentDate?: string | null, status?: string): string {
  const isPaid = status === 'paid';
  const delay = calculateDelayDays(dueDate, paymentDate);

  if (isPaid) {
    return delay > 0 ? `Delayed by ${delay}d` : 'On time';
  }

  const todayStr = today();
  if (dueDate < todayStr && status !== 'paid') {
    return `Overdue by ${delay}d`;
  }

  return '';
}
