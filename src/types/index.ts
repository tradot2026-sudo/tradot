// Tradot — Type Definitions

export type PayoutFrequency = 'daily' | 'weekly' | 'monthly';
export type PlanStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type PaymentMode = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other';
export type PayoutStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'waived';
export type FundStatus = 'withdrawal_requested' | 'credited';

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Joined
  plans?: Plan[];
  _count?: { plans: number };
}

export interface Plan {
  id: string;
  clientId: string;
  planName: string;
  principalAmount: number;
  payoutType: PayoutFrequency;
  payoutAmount?: number;
  payoutPercentage?: number;
  startDate: string;
  maturityDate?: string;
  durationMonths?: number;
  totalPayouts?: number;
  payoutDay?: number;
  defaultPaymentMode: PaymentMode;
  status: PlanStatus;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Joined
  client?: Client;
  payouts?: Payout[];
}

export interface Payout {
  id: string;
  planId: string;
  dueDate: string;
  expectedAmount: number;
  paidAmount: number;
  paymentDate?: string;
  modeOfPayment?: PaymentMode;
  referenceNo?: string;
  status: PayoutStatus;
  notes?: string;
  payoutNumber?: number;
  fundStatus?: FundStatus | null;
  fundStatusDate?: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  plan?: Plan;
}

export interface DashboardStats {
  totalClients: number;
  totalInvested: number;
  totalPaid: number;
  totalPending: number;
  dueTodayCount: number;
  dueTodayAmount: number;
  overdueCount: number;
  overdueAmount: number;
  upcomingCount: number;
  upcomingAmount: number;
  activePlans: number;
}

export interface PaymentRecord {
  paidAmount: number;
  paymentDate: string;
  modeOfPayment: PaymentMode;
  referenceNo?: string;
  notes?: string;
}
