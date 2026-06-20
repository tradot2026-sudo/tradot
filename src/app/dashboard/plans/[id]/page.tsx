'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  ArrowLeft, CheckCircle2, Clock, AlertCircle, X,
  RotateCcw, MessageCircle, Printer
} from 'lucide-react';
import {
  formatCurrency, formatDate, getPaymentModeLabel,
  getPayoutStatusLabel, today, getDelayLabel, calculateDelayDays,
  getOrdinalSuffix
} from '@/lib/utils';
import type { Plan, Client, Payout, PayoutStatus, PaymentMode } from '@/types';

interface PaymentForm {
  paidAmount: string;
  paymentDate: string;
  modeOfPayment: PaymentMode;
  referenceNo: string;
  notes: string;
}

export default function PlanDetailPage() {
  const params = useParams();
  const planId = params.id as string;

  const [plan, setPlan] = useState<Plan & { client?: Client } | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePayoutId, setActivePayoutId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    paidAmount: '', paymentDate: today(), modeOfPayment: 'cash', referenceNo: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'partial'>('all');

  // Plan Rollover State
  const [showRolloverModal, setShowRolloverModal] = useState(false);
  const [rolloverForm, setRolloverForm] = useState({
    planName: '', principalAmount: '', payoutType: 'monthly',
    payoutAmount: '', payoutPercentage: '', usePercentage: false,
    startDate: '', durationMonths: '', payoutDay: '',
    defaultPaymentMode: 'cash', notes: '',
  });
  const [rollingOver, setRollingOver] = useState(false);
  const [rolloverError, setRolloverError] = useState('');

  const openRollover = () => {
    if (!plan) return;
    setRolloverForm({
      planName: `Renewed - ${plan.planName}`,
      principalAmount: String(plan.principalAmount),
      payoutType: plan.payoutType,
      payoutAmount: String(plan.payoutAmount || ''),
      payoutPercentage: plan.payoutPercentage ? String(plan.payoutPercentage * 100) : '',
      usePercentage: !!plan.payoutPercentage,
      startDate: plan.maturityDate || today(),
      durationMonths: plan.durationMonths ? String(plan.durationMonths) : '12',
      payoutDay: plan.payoutDay ? String(plan.payoutDay) : '',
      defaultPaymentMode: plan.defaultPaymentMode,
      notes: `Rollover renewal of plan "${plan.planName}"`,
    });
    setRolloverError('');
    setShowRolloverModal(true);
  };

  const updateRolloverForm = (updates: Partial<typeof rolloverForm>) => {
    const newForm = { ...rolloverForm, ...updates };
    if (newForm.usePercentage && newForm.principalAmount && newForm.payoutPercentage) {
      const pct = parseFloat(newForm.payoutPercentage) / 100;
      newForm.payoutAmount = (parseFloat(newForm.principalAmount) * pct).toFixed(2);
    }
    setRolloverForm(newForm);
  };

  const handleRolloverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRollingOver(true);
    setRolloverError('');

    const principalAmount = parseFloat(rolloverForm.principalAmount);
    let payoutAmount = parseFloat(rolloverForm.payoutAmount);
    let payoutPercentage = null;

    if (rolloverForm.usePercentage && rolloverForm.payoutPercentage) {
      payoutPercentage = parseFloat(rolloverForm.payoutPercentage);
      payoutAmount = principalAmount * (payoutPercentage / 100);
    }

    const rolloverData = {
      planName: rolloverForm.planName,
      principalAmount,
      payoutType: rolloverForm.payoutType,
      payoutAmount,
      payoutPercentage,
      startDate: rolloverForm.startDate,
      durationMonths: rolloverForm.durationMonths ? parseInt(rolloverForm.durationMonths) : null,
      payoutDay: rolloverForm.payoutType === 'monthly' && rolloverForm.payoutDay ? parseInt(rolloverForm.payoutDay) : null,
      defaultPaymentMode: rolloverForm.defaultPaymentMode,
      notes: rolloverForm.notes,
    };

    try {
      const newPlan = await api.post<{ id: string }>(`/api/plans/${planId}/rollover`, rolloverData);
      setShowRolloverModal(false);
      window.location.href = `/dashboard/plans/${newPlan.id}`;
    } catch (err: any) {
      setRolloverError(err.message || 'Failed to roll over plan.');
    } finally {
      setRollingOver(false);
    }
  };

  const [whatsappTemplates, setWhatsappTemplates] = useState<{ whatsappTemplatePaid: string | null; whatsappTemplateReminder: string | null } | null>(null);

  const compileTemplate = (template: string, payout: Payout) => {
    const client = plan?.client;
    return template
      .replace(/{client_name}/g, client?.name || '')
      .replace(/{plan_name}/g, plan?.planName || '')
      .replace(/{payout_amount}/g, formatCurrency(payout.expectedAmount))
      .replace(/{due_date}/g, payout.dueDate ? formatDate(payout.dueDate) : '')
      .replace(/{payout_number}/g, payout.payoutNumber ? String(payout.payoutNumber) : '')
      .replace(/{payment_date}/g, payout.paymentDate ? formatDate(payout.paymentDate) : '')
      .replace(/{payment_mode}/g, payout.modeOfPayment ? getPaymentModeLabel(payout.modeOfPayment) : '')
      .replace(/{reference_no}/g, payout.referenceNo || 'N/A');
  };

  const sendWhatsAppNotification = (payout: Payout) => {
    const client = plan?.client;
    if (!client || !client.phone) {
      alert("This client does not have a phone number registered.");
      return;
    }

    const cleanPhone = client.phone.replace(/\D/g, '');
    const formattedAmount = formatCurrency(payout.expectedAmount);
    
    let message = '';
    if (payout.status === 'paid') {
      const customTemplate = whatsappTemplates?.whatsappTemplatePaid;
      if (customTemplate) {
        message = compileTemplate(customTemplate, payout);
      } else {
        message = `Hello ${client.name},\n\nWe have successfully processed your payout of ${formattedAmount} for the investment "${plan.planName}".\n\nTransaction Details:\n- Date: ${payout.paymentDate ? formatDate(payout.paymentDate) : 'N/A'}\n- Mode: ${payout.modeOfPayment ? getPaymentModeLabel(payout.modeOfPayment) : 'N/A'}\n- Reference No: ${payout.referenceNo || 'N/A'}\n\nThank you for investing with us!\n- Tradot`;
      }
    } else {
      const customTemplate = whatsappTemplates?.whatsappTemplateReminder;
      if (customTemplate) {
        message = compileTemplate(customTemplate, payout);
      } else {
        message = `Hello ${client.name},\n\nThis is a friendly reminder that a payout of ${formattedAmount} for your investment "${plan.planName}" is scheduled for ${formatDate(payout.dueDate)}.\n\nThank you,\n- Tradot`;
      }
    }

    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const printReceipt = (payout: Payout) => {
    const client = plan?.client;
    if (!client) return;

    const receiptWindow = window.open('', '_blank');
    if (!receiptWindow) {
      alert("Please allow popups to print receipts");
      return;
    }

    const formattedAmount = formatCurrency(payout.expectedAmount);
    const formattedPaid = formatCurrency(payout.paidAmount || 0);
    const balance = payout.expectedAmount - (payout.paidAmount || 0);
    const formattedBalance = formatCurrency(balance);

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payout Receipt - #${payout.payoutNumber || ''}</title>
        <style>
          body {
            font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
            color: #1e293b;
            padding: 40px;
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #6366f1;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .title {
            font-size: 24px;
            font-weight: 800;
            color: #4f46e5;
            letter-spacing: -0.025em;
          }
          .meta {
            text-align: right;
            font-size: 14px;
            color: #64748b;
          }
          .section {
            margin-bottom: 24px;
          }
          .section-title {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            color: #94a3b8;
            margin-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
            letter-spacing: 0.05em;
          }
          .grid {
            display: grid;
            grid-template-columns: 140px 1fr;
            gap: 8px;
            font-size: 14px;
            line-height: 1.5;
          }
          .label {
            color: #64748b;
          }
          .value {
            font-weight: 600;
            color: #0f172a;
          }
          .amount-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
            font-size: 14px;
          }
          .amount-table th, .amount-table td {
            padding: 8px 12px;
            border-bottom: 1px solid #e2e8f0;
          }
          .amount-table th {
            text-align: left;
            background-color: #f8fafc;
            color: #64748b;
            font-weight: 600;
          }
          .amount-table td.right {
            text-align: right;
          }
          .total-row {
            font-weight: 700;
            font-size: 15px;
            background-color: #f5f3ff;
          }
          .total-row td {
            color: #4f46e5;
            border-bottom: 2px solid #4f46e5;
          }
          .footer {
            margin-top: 60px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
          }
          .btn-print {
            display: block;
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #6366f1, #4f46e5);
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            text-align: center;
            margin-bottom: 20px;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
            font-family: inherit;
            font-size: 14px;
            transition: opacity 0.2s;
          }
          .btn-print:hover {
            opacity: 0.95;
          }
          @media print {
            .btn-print {
              display: none;
            }
            body {
              padding: 0;
              background-color: transparent;
            }
          }
        </style>
      </head>
      <body>
        <button class="btn-print" onclick="window.print()">Print Payout Voucher</button>
        <div class="header">
          <div>
            <div class="title">TRADOT</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">Payout Receipt Voucher</div>
          </div>
          <div class="meta">
            <div>Voucher ID: <strong>TR-${payout.id.slice(-8).toUpperCase()}</strong></div>
            <div>Date: ${payout.paymentDate ? formatDate(payout.paymentDate) : formatDate(today())}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Client Details</div>
          <div class="grid">
            <div class="label">Client Name</div>
            <div class="value">${client.name}</div>
            <div class="label">Email Address</div>
            <div class="value">${client.email || '—'}</div>
            <div class="label">Phone Number</div>
            <div class="value">${client.phone || '—'}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Investment & Plan Details</div>
          <div class="grid">
            <div class="label">Investment Plan</div>
            <div class="value">${plan.planName}</div>
            <div class="label">Principal Amount</div>
            <div class="value">${formatCurrency(plan.principalAmount)}</div>
            <div class="label">Payout Type</div>
            <div class="value" style="text-transform: capitalize;">${plan.payoutType}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Receipt Breakdown</div>
          <table class="amount-table">
            <thead>
              <tr>
                <th>Description</th>
                <th class="right" style="width: 150px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Scheduled Interest Payout (Payout #${payout.payoutNumber || ''})</td>
                <td class="right">${formattedAmount}</td>
              </tr>
              <tr>
                <td style="color: #0f172a; font-weight: 500;">Amount Settled</td>
                <td class="right" style="color: #10b981; font-weight: 700;">${formattedPaid}</td>
              </tr>
              <tr class="total-row">
                <td>Outstanding Balance</td>
                <td class="right">${formattedBalance}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section" style="margin-top: 24px;">
          <div class="section-title">Transaction Info</div>
          <div class="grid">
            <div class="label">Payment Mode</div>
            <div class="value" style="text-transform: capitalize;">${payout.modeOfPayment ? getPaymentModeLabel(payout.modeOfPayment) : 'N/A'}</div>
            <div class="label">Reference ID</div>
            <div class="value">${payout.referenceNo || 'N/A'}</div>
            <div class="label">Remarks / Notes</div>
            <div class="value">${payout.notes || 'No remarks.'}</div>
          </div>
        </div>

        <div class="footer">
          This is a system generated payout receipt voucher verifying transaction completion on Tradot.
        </div>
      </body>
      </html>
    `;

    receiptWindow.document.write(receiptHtml);
    receiptWindow.document.close();
  };

  const fetchData = useCallback(async () => {
    try {
      const data = await api.get<Plan & { client: Client; payouts: Payout[] }>(`/api/plans/${planId}`);
      if (data) {
        setPlan(data);
        setPayouts(data.payouts || []);
      }
    } catch (err) {
      console.error('Failed to load plan details:', err);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get<{ whatsappTemplatePaid: string | null; whatsappTemplateReminder: string | null }>('/api/settings/templates');
      setWhatsappTemplates(res);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }, []);

  const searchParams = useSearchParams();

  useEffect(() => {
    fetchData();
    fetchTemplates();
  }, [fetchData, fetchTemplates]);

  useEffect(() => {
    if (searchParams.get('rollover') === 'true' && plan) {
      openRollover();
    }
  }, [searchParams, plan]);

  const openPayment = (payout: Payout) => {
    setActivePayoutId(payout.id);
    setPaymentForm({
      paidAmount: String(payout.expectedAmount - (payout.paidAmount || 0)),
      paymentDate: today(),
      modeOfPayment: plan?.defaultPaymentMode || 'cash',
      referenceNo: '',
      notes: '',
    });
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePayoutId) return;
    setSaving(true);

    try {
      await api.patch(`/api/payouts/${activePayoutId}`, {
        paidAmount: parseFloat(paymentForm.paidAmount),
        paymentDate: paymentForm.paymentDate,
        modeOfPayment: paymentForm.modeOfPayment,
        referenceNo: paymentForm.referenceNo || null,
        notes: paymentForm.notes || null,
      });
      setActivePayoutId(null);
      fetchData();
    } catch (err) {
      console.error('Failed to record payment:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (payoutId: string) => {
    try {
      await api.patch(`/api/payouts/${payoutId}`, {
        resetPayment: true,
      });
      fetchData();
    } catch (err) {
      console.error('Failed to reset payout:', err);
    }
  };

  const getStatusBadge = (payout: Payout) => {
    const status = payout.status;
    return <span className={`badge badge-${status}`}>{getPayoutStatusLabel(status)}</span>;
  };

  const filteredPayouts = filter === 'all' ? payouts : payouts.filter(p => p.status === filter);

  const stats = {
    total: payouts.length,
    paid: payouts.filter(p => p.status === 'paid').length,
    partial: payouts.filter(p => p.status === 'partial').length,
    overdue: payouts.filter(p => p.status === 'overdue').length,
    pending: payouts.filter(p => p.status === 'pending').length,
    totalPaid: payouts.reduce((s, p) => s + (p.paidAmount || 0), 0),
    totalExpected: payouts.reduce((s, p) => s + p.expectedAmount, 0),
    totalRemaining: payouts.reduce((s, p) => s + Math.max(0, p.expectedAmount - (p.paidAmount || 0)), 0),
  };

  const progress = stats.totalExpected > 0 ? Math.min(100, (stats.totalPaid / stats.totalExpected) * 100) : 0;

  if (loading) {
    return <div style={{ padding: '32px' }}><div className="shimmer glass-card" style={{ height: '200px' }} /></div>;
  }

  if (!plan) {
    return <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>Plan not found.</div>;
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1100px' }}>
      {/* Back */}
      <Link
        href={`/dashboard/clients/${plan.clientId}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '24px' }}
      >
        <ArrowLeft size={16} /> {plan.client?.name || 'Client'}
      </Link>

      {/* Plan Mature Alert */}
      {plan.status === 'active' && plan.maturityDate && plan.maturityDate <= today() && (
        <div className="alert alert-warning" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={20} />
          <span style={{ flex: 1 }}>
            <strong>🎓 This plan matured on {formatDate(plan.maturityDate)}.</strong> Select Roll Over to transition this investment to a new payout cycle.
          </span>
          <button onClick={openRollover} className="btn btn-primary btn-sm" style={{ background: '#f59e0b', borderColor: '#d97706', color: 'white' }}>
            Roll Over Plan
          </button>
        </div>
      )}

      {/* Plan Header */}
      <div className="glass-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1.3rem', fontWeight: 800, color: 'white' }}>
                {plan.planName}
              </h1>
              <span className={`badge badge-${plan.status}`}>{plan.status}</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginTop: '6px' }}>
              Client: <Link href={`/dashboard/clients/${plan.clientId}`} style={{ color: '#a5b4fc', textDecoration: 'none' }}>{plan.client?.name}</Link>
            </p>
          </div>
        </div>

        {/* Plan Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          {[
            { label: 'Principal', value: formatCurrency(plan.principalAmount), color: '#10b981' },
            { label: 'Per Payout', value: formatCurrency(plan.payoutAmount || 0), color: 'white' },
            { label: 'Frequency', value: plan.payoutType.charAt(0).toUpperCase() + plan.payoutType.slice(1), color: 'white' },
            ...(plan.payoutType === 'monthly' ? [{ label: 'Payout Day', value: plan.payoutDay ? `${plan.payoutDay}${getOrdinalSuffix(plan.payoutDay)} of month` : 'Same as start day', color: 'white' }] : []),
            { label: 'Start Date', value: formatDate(plan.startDate), color: 'white' },
            { label: 'Maturity', value: plan.maturityDate ? formatDate(plan.maturityDate) : '—', color: 'white' },
            { label: 'Payment Mode', value: getPaymentModeLabel(plan.defaultPaymentMode), color: 'white' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontWeight: 600, color: item.color, marginTop: '6px', fontSize: '0.95rem' }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Payout Progress</span>
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
            {formatCurrency(stats.totalPaid)} / {formatCurrency(stats.totalExpected)} ({progress.toFixed(1)}%)
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #6366f1, #10b981)' }} />
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
          {[
            { label: 'Total Paid', value: formatCurrency(stats.totalPaid), color: '#10b981' },
            { label: 'Remaining', value: formatCurrency(stats.totalRemaining), color: '#f59e0b' },
            { label: `${stats.paid}/${stats.total} payouts`, value: 'completed', color: 'rgba(255,255,255,0.5)' },
            stats.overdue > 0 ? { label: `${stats.overdue} overdue`, value: '', color: '#f87171' } : null,
          ].filter(Boolean).map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: item!.color }}>{item!.label}</span>
              {item!.value && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>{item!.value}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(['all', 'pending', 'overdue', 'partial', 'paid'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="btn btn-sm"
            style={{
              background: filter === f ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
              border: filter === f ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: filter === f ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
            }}
          >
            {f === 'all' ? `All (${stats.total})` :
             f === 'pending' ? `Pending (${stats.pending})` :
             f === 'overdue' ? `Overdue (${stats.overdue})` :
             f === 'partial' ? `Partial (${stats.partial})` :
             `Paid (${stats.paid})`}
          </button>
        ))}
      </div>

      {/* Payout Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Due Date</th>
              <th>Expected</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Payment Details</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayouts.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No payouts in this filter</td></tr>
            ) : filteredPayouts.map((payout) => {
              const balance = payout.expectedAmount - (payout.paidAmount || 0);
              const isPaid = payout.status === 'paid';
              return (
                <tr key={payout.id}>
                  <td style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>#{payout.payoutNumber || '—'}</td>
                  <td style={{ fontWeight: 500 }}>
                    <div>{formatDate(payout.dueDate)}</div>
                    {payout.status !== 'paid' && payout.dueDate < today() && (
                      <div style={{ fontSize: '0.7rem', color: '#f87171', marginTop: '2px', fontWeight: 500 }}>
                        {getDelayLabel(payout.dueDate, payout.paymentDate, payout.status)}
                      </div>
                    )}
                    {payout.dueDate === today() && <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '0.65rem', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '2px 6px', borderRadius: '4px' }}>TODAY</span>}
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(payout.expectedAmount)}</td>
                  <td style={{ color: payout.paidAmount > 0 ? '#10b981' : 'rgba(255,255,255,0.3)' }}>
                    {payout.paidAmount > 0 ? formatCurrency(payout.paidAmount) : '—'}
                  </td>
                  <td style={{ color: balance > 0 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                    {balance > 0 ? formatCurrency(balance) : '✓'}
                  </td>
                  <td>
                    {payout.paymentDate ? (
                      <>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 500 }}>{formatDate(payout.paymentDate)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                          {payout.modeOfPayment ? getPaymentModeLabel(payout.modeOfPayment) : '—'}
                          {payout.referenceNo ? ` (${payout.referenceNo})` : ''}
                        </div>
                        <div style={{
                          fontSize: '0.7rem',
                          color: calculateDelayDays(payout.dueDate, payout.paymentDate) > 0 ? '#fb923c' : '#34d399',
                          marginTop: '2px',
                          fontWeight: 500
                        }}>
                          {getDelayLabel(payout.dueDate, payout.paymentDate, payout.status)}
                        </div>
                      </>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>
                    )}

                    {/* Transaction history log */}
                    {(payout as any).transactions && (payout as any).transactions.length > 0 && (
                      <div style={{ 
                        marginTop: '8px', 
                        padding: '6px 8px', 
                        background: 'rgba(255,255,255,0.02)', 
                        border: '1px solid rgba(255,255,255,0.05)', 
                        borderRadius: '6px', 
                        fontSize: '0.7rem', 
                        maxWidth: '220px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word'
                      }}>
                        <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '3px', marginBottom: '3px' }}>Ledger logs:</div>
                        {(payout as any).transactions.map((tx: any) => (
                          <div key={tx.id} style={{ color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                            • {formatCurrency(tx.amountPaid)} on {formatDate(tx.paymentDate)} via {getPaymentModeLabel(tx.modeOfPayment)}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>{getStatusBadge(payout)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {!isPaid && (
                        <button
                          id={`pay-btn-${payout.id}`}
                          onClick={() => openPayment(payout)}
                          className="btn btn-success btn-sm"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          <CheckCircle2 size={13} /> Pay
                        </button>
                      )}
                      {(isPaid || payout.status === 'partial') && (
                        <button onClick={() => handleReset(payout.id)} className="btn btn-secondary btn-sm" title="Reset payment">
                          <RotateCcw size={13} />
                        </button>
                      )}
                      {plan.client?.phone && (
                        <button
                          onClick={() => sendWhatsAppNotification(payout)}
                          className="btn btn-secondary btn-sm"
                          style={{
                            borderColor: 'rgba(37,211,102,0.3)',
                            background: 'rgba(37,211,102,0.1)',
                            color: '#25D366'
                          }}
                          title="Send WhatsApp Notification"
                        >
                          <MessageCircle size={13} />
                        </button>
                      )}
                      {isPaid && (
                        <button
                          onClick={() => printReceipt(payout)}
                          className="btn btn-secondary btn-sm"
                          style={{
                            borderColor: 'rgba(99,102,241,0.3)',
                            background: 'rgba(99,102,241,0.1)',
                            color: '#a5b4fc'
                          }}
                          title="Print Receipt"
                        >
                          <Printer size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Payment Modal */}
      {activePayoutId && (
        <div className="modal-overlay" onClick={() => setActivePayoutId(null)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontWeight: 700, color: 'white', fontSize: '1.1rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Record Payment
              </h2>
              <button onClick={() => setActivePayoutId(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {(() => {
              const payout = payouts.find(p => p.id === activePayoutId)!;
              const balance = payout.expectedAmount - (payout.paidAmount || 0);
              const olderOutstanding = payouts.filter(p => p.dueDate < payout.dueDate && p.status !== 'paid');
              const olderOutstandingAmount = olderOutstanding.reduce((s, p) => s + (p.expectedAmount - (p.paidAmount || 0)), 0);

              return (
                <form onSubmit={handlePayment} style={{ padding: '20px 24px 24px' }}>
                  {/* Older Outstanding Alert */}
                  {olderOutstandingAmount > 0 && (
                    <div style={{ 
                      background: 'rgba(245,158,11,0.1)', 
                      border: '1px solid rgba(245,158,11,0.25)', 
                      borderRadius: '8px', 
                      padding: '10px 12px', 
                      marginBottom: '16px', 
                      fontSize: '0.8rem', 
                      color: '#fbbf24', 
                      lineHeight: '1.4' 
                    }}>
                      ⚠️ <strong>Older outstanding balance of {formatCurrency(olderOutstandingAmount)} exists.</strong> 
                      <br />Any payment recorded will automatically be allocated to the oldest unpaid payouts first.
                    </div>
                  )}

                  {/* Summary */}
                  <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Due Date</span>
                      <span style={{ color: 'white', fontWeight: 600 }}>{formatDate(payout.dueDate)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Expected</span>
                      <span style={{ color: 'white', fontWeight: 600 }}>{formatCurrency(payout.expectedAmount)}</span>
                    </div>
                    {payout.paidAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Already Paid</span>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(payout.paidAmount)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Balance Due</span>
                      <span style={{ color: '#fbbf24', fontWeight: 700 }}>{formatCurrency(balance)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '14px' }}>
                    <div>
                      <label className="form-label">Amount Paid (₹) *</label>
                      <input
                        id="payment-amount"
                        className="form-input"
                        type="number"
                        min="0.01"
                        max={stats.totalRemaining}
                        step="0.01"
                        value={paymentForm.paidAmount}
                        onChange={e => setPaymentForm({ ...paymentForm, paidAmount: e.target.value })}
                        required
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPaymentForm({ ...paymentForm, paidAmount: String(balance) })}>
                          This Payout ({formatCurrency(balance)})
                        </button>
                        {stats.totalRemaining > balance && (
                          <button type="button" className="btn btn-secondary btn-sm" style={{ borderColor: 'rgba(245,158,11,0.3)', color: '#fbbf24' }} onClick={() => setPaymentForm({ ...paymentForm, paidAmount: String(stats.totalRemaining) })}>
                            All Outstanding ({formatCurrency(stats.totalRemaining)})
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label className="form-label">Payment Date *</label>
                        <input id="payment-date" className="form-input" type="date" value={paymentForm.paymentDate} onChange={e => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} required />
                      </div>
                      <div>
                        <label className="form-label">Payment Mode</label>
                        <select id="payment-mode" className="form-input" value={paymentForm.modeOfPayment} onChange={e => setPaymentForm({ ...paymentForm, modeOfPayment: e.target.value as PaymentMode })}>
                          <option value="cash">Cash</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="upi">UPI</option>
                          <option value="cheque">Cheque</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Reference / Transaction ID</label>
                      <input id="payment-ref" className="form-input" value={paymentForm.referenceNo} onChange={e => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })} placeholder="UPI Ref / Cheque No. (optional)" />
                    </div>
                    <div>
                      <label className="form-label">Notes</label>
                      <textarea id="payment-notes" className="form-input" style={{ minHeight: '60px' }} value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} placeholder="Optional notes..." />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setActivePayoutId(null)} className="btn btn-secondary">Cancel</button>
                    <button id="confirm-payment-btn" type="submit" disabled={saving} className="btn btn-primary">
                      {saving ? 'Recording...' : 'Record Payment'}
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* Rollover Modal */}
      {showRolloverModal && (
        <div className="modal-overlay" onClick={() => setShowRolloverModal(false)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontWeight: 700, color: 'white', fontSize: '1.1rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Roll Over Plan
              </h2>
              <button onClick={() => setShowRolloverModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleRolloverSubmit} style={{ padding: '20px 24px 24px' }}>
              {rolloverError && <div className="alert alert-danger" style={{ marginBottom: '16px' }}><AlertCircle size={16} /><span>{rolloverError}</span></div>}

              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label className="form-label">New Plan Name *</label>
                  <input className="form-input" value={rolloverForm.planName} onChange={e => updateRolloverForm({ planName: e.target.value })} required />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Rollover Principal (₹) *</label>
                    <input className="form-input" type="number" min="1" step="0.01" value={rolloverForm.principalAmount} onChange={e => updateRolloverForm({ principalAmount: e.target.value })} required />
                  </div>
                  <div>
                    <label className="form-label">Payout Frequency *</label>
                    <select className="form-input" value={rolloverForm.payoutType} onChange={e => updateRolloverForm({ payoutType: e.target.value as any })}>
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="daily">Daily</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Payout Amount</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={rolloverForm.usePercentage} onChange={e => updateRolloverForm({ usePercentage: e.target.checked })} />
                      Use % of principal
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: rolloverForm.usePercentage ? '1fr 1fr' : '1fr', gap: '12px' }}>
                    {rolloverForm.usePercentage && (
                      <div>
                        <input className="form-input" type="number" min="0" max="100" step="0.01" value={rolloverForm.payoutPercentage} onChange={e => updateRolloverForm({ payoutPercentage: e.target.value })} placeholder="Percentage" />
                      </div>
                    )}
                    <div>
                      <input className="form-input" type="number" min="0" step="0.01" value={rolloverForm.payoutAmount} onChange={e => updateRolloverForm({ payoutAmount: e.target.value })} placeholder="Payout amount ₹" readOnly={rolloverForm.usePercentage} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Start Date *</label>
                    <input className="form-input" type="date" value={rolloverForm.startDate} onChange={e => updateRolloverForm({ startDate: e.target.value })} required />
                  </div>
                  <div>
                    <label className="form-label">Duration (months) *</label>
                    <input className="form-input" type="number" min="1" value={rolloverForm.durationMonths} onChange={e => updateRolloverForm({ durationMonths: e.target.value })} required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Default Payment Mode</label>
                    <select className="form-input" value={rolloverForm.defaultPaymentMode} onChange={e => updateRolloverForm({ defaultPaymentMode: e.target.value as any })}>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {rolloverForm.payoutType === 'monthly' && (
                    <div>
                      <label className="form-label">Payout Day</label>
                      <select className="form-input" value={rolloverForm.payoutDay} onChange={e => updateRolloverForm({ payoutDay: e.target.value })}>
                        <option value="">Same as start day</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" style={{ minHeight: '60px' }} value={rolloverForm.notes} onChange={e => updateRolloverForm({ notes: e.target.value })} placeholder="Optional rollover notes..." />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowRolloverModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={rollingOver} className="btn btn-primary">
                  {rollingOver ? 'Processing...' : 'Complete Rollover'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
