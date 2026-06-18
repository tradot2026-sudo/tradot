'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  ArrowLeft, Phone, Mail, MapPin, FileText,
  Plus, Edit2, Trash2, TrendingUp, X, AlertCircle,
  CreditCard, Clock, CheckCircle2, IndianRupee
} from 'lucide-react';
import {
  formatCurrency, formatDate, calculateMaturityDate,
  getFrequencyLabel, getPaymentModeLabel, getPayoutStatus
} from '@/lib/utils';
import type { Client, Plan, PayoutFrequency, PaymentMode, PlanStatus } from '@/types';
import { format } from 'date-fns';

interface PlanForm {
  planName: string;
  principalAmount: string;
  payoutType: PayoutFrequency;
  payoutAmount: string;
  payoutPercentage: string;
  usePercentage: boolean;
  startDate: string;
  maturityDate: string;
  durationMonths: string;
  useDuration: boolean;
  defaultPaymentMode: PaymentMode;
  status: PlanStatus;
  notes: string;
}

const defaultPlanForm: PlanForm = {
  planName: '', principalAmount: '', payoutType: 'monthly',
  payoutAmount: '', payoutPercentage: '', usePercentage: false,
  startDate: format(new Date(), 'yyyy-MM-dd'),
  maturityDate: '', durationMonths: '', useDuration: true,
  default_payment_mode: 'cash' as any, // fallback for initialization below
  defaultPaymentMode: 'cash', status: 'active', notes: '',
} as any;

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(defaultPlanForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.get<Client & { plans: Plan[] }>(`/api/clients/${clientId}`);
      if (data) {
        setClient(data);
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error('Failed to load client details:', err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-calculate maturity or payout amount
  const updatePlanForm = (updates: Partial<PlanForm>) => {
    const newForm = { ...planForm, ...updates };

    // Auto-calculate maturity date from duration
    if (newForm.useDuration && newForm.startDate && newForm.durationMonths) {
      newForm.maturityDate = calculateMaturityDate(newForm.startDate, parseInt(newForm.durationMonths));
    }

    // Auto-calculate payout amount from percentage
    if (newForm.usePercentage && newForm.principalAmount && newForm.payoutPercentage) {
      const pct = parseFloat(newForm.payoutPercentage) / 100;
      newForm.payoutAmount = (parseFloat(newForm.principalAmount) * pct).toFixed(2);
    }

    setPlanForm(newForm);
  };

  const openAddPlan = () => {
    setEditPlan(null);
    setPlanForm({
      planName: '', principalAmount: '', payoutType: 'monthly',
      payoutAmount: '', payoutPercentage: '', usePercentage: false,
      startDate: format(new Date(), 'yyyy-MM-dd'),
      maturityDate: '', durationMonths: '', useDuration: true,
      defaultPaymentMode: 'cash', status: 'active', notes: '',
    } as any);
    setError('');
    setShowPlanModal(true);
  };

  const openEditPlan = (plan: Plan) => {
    setEditPlan(plan);
    setPlanForm({
      planName: plan.planName,
      principalAmount: String(plan.principalAmount),
      payoutType: plan.payoutType,
      payoutAmount: String(plan.payoutAmount || ''),
      payoutPercentage: plan.payoutPercentage ? String(plan.payoutPercentage * 100) : '',
      usePercentage: !!plan.payoutPercentage,
      startDate: plan.startDate,
      maturityDate: plan.maturityDate || '',
      durationMonths: plan.durationMonths ? String(plan.durationMonths) : '',
      useDuration: !!plan.durationMonths,
      defaultPaymentMode: plan.defaultPaymentMode,
      status: plan.status,
      notes: plan.notes || '',
    } as any);
    setError('');
    setShowPlanModal(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const principalAmount = parseFloat(planForm.principalAmount);
    let payoutAmount = parseFloat(planForm.payoutAmount);
    let payoutPercentage = null;

    if (planForm.usePercentage && planForm.payoutPercentage) {
      payoutPercentage = parseFloat(planForm.payoutPercentage);
      payoutAmount = principalAmount * (payoutPercentage / 100);
    }

    const planData = {
      clientId,
      planName: planForm.planName,
      principalAmount,
      payoutType: planForm.payoutType,
      payoutAmount,
      payoutPercentage,
      startDate: planForm.startDate,
      maturityDate: planForm.useDuration ? null : (planForm.maturityDate || null),
      durationMonths: planForm.useDuration && planForm.durationMonths ? parseInt(planForm.durationMonths) : null,
      defaultPaymentMode: planForm.defaultPaymentMode,
      status: planForm.status,
      notes: planForm.notes,
    };

    try {
      if (editPlan) {
        await api.put(`/api/plans/${editPlan.id}`, planData);
      } else {
        await api.post('/api/plans', planData);
      }
      setShowPlanModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await api.delete(`/api/plans/${id}`);
      setDeleteId(null);
      fetchData();
    } catch (err) {
      console.error('Failed to delete plan:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '32px' }}>
        <div className="shimmer glass-card" style={{ height: '160px', marginBottom: '24px' }} />
        <div className="shimmer glass-card" style={{ height: '300px' }} />
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Client not found.</p>
        <Link href="/dashboard/clients" className="btn btn-secondary" style={{ marginTop: '16px' }}>Back to Clients</Link>
      </div>
    );
  }

  // 1. Calculate aggregated customer-specific dashboard stats
  let totalInvested = 0;
  let totalPaid = 0;
  let totalDue = 0;
  let payoutsPending = 0;
  let payoutsOverdue = 0;
  let payoutsPaidCount = 0;
  let totalOverdue = 0;

  plans.forEach((plan) => {
    totalInvested += plan.principalAmount;
    if (plan.payouts) {
      plan.payouts.forEach((payout) => {
        const currentStatus = getPayoutStatus(payout);
        const unpaid = payout.expectedAmount - (payout.paidAmount || 0);

        totalPaid += payout.paidAmount || 0;

        if (currentStatus === 'paid') {
          payoutsPaidCount++;
        } else if (currentStatus === 'waived') {
          // Waived payouts are ignored
        } else if (currentStatus === 'overdue') {
          payoutsOverdue++;
          totalOverdue += unpaid;
          totalDue += unpaid;
        } else if (currentStatus === 'pending' || currentStatus === 'partial') {
          payoutsPending++;
          totalDue += unpaid;
        }
      });
    }
  });

  const totalExpected = totalPaid + totalDue;
  const paidPercentage = totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0;

  return (
    <div style={{ padding: '32px', maxWidth: '1100px' }}>
      {/* Back */}
      <Link href="/dashboard/clients" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '24px' }}>
        <ArrowLeft size={16} /> Back to Clients
      </Link>

      {/* Client Card */}
      <div className="glass-card" style={{ padding: '28px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: 700, color: 'white', flexShrink: 0,
          }}>
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>
              {client.name}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px' }}>
              {client.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                  <Phone size={14} />{client.phone}
                </span>
              )}
              {client.email && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                  <Mail size={14} />{client.email}
                </span>
              )}
              {client.address && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                  <MapPin size={14} />{client.address}
                </span>
              )}
            </div>
          </div>
        </div>
        {client.notes && (
          <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)' }}>
            <FileText size={14} style={{ display: 'inline', marginRight: '8px' }} />
            {client.notes}
          </div>
        )}
      </div>

      {/* Customer Insights Dashboard Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {/* Total Invested */}
        <div className="glass-card stat-card-glow" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={20} color="#6366f1" />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '99px' }}>Active</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {formatCurrency(totalInvested)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>Total Invested</div>
          <div style={{ fontSize: '0.72rem', color: '#a5b4fc', marginTop: '8px', fontWeight: 500 }}>
            {plans.length} plan{plans.length !== 1 ? 's' : ''} active
          </div>
        </div>

        {/* Total Paid Out */}
        <div className="glass-card stat-card-glow" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={20} color="#10b981" />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {formatCurrency(totalPaid)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>Total Paid Out</div>
          <div style={{ fontSize: '0.72rem', color: '#34d399', marginTop: '8px', fontWeight: 500 }}>
            {payoutsPaidCount} payouts paid
          </div>
        </div>

        {/* Total Due (Outstanding) */}
        <div className="glass-card stat-card-glow" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} color="#3b82f6" />
            </div>
            {payoutsPending > 0 && <span style={{ fontSize: '0.75rem', color: '#60a5fa', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '99px' }}>{payoutsPending} pending</span>}
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#60a5fa', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {formatCurrency(totalDue)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>Total Due (Outstanding)</div>
          <div style={{ fontSize: '0.72rem', color: '#93c5fd', marginTop: '8px', fontWeight: 500 }}>
            {payoutsPending + payoutsOverdue} payouts outstanding
          </div>
        </div>

        {/* Overdue Payouts */}
        <div className="glass-card stat-card-glow" style={{
          padding: '20px 24px',
          borderColor: payoutsOverdue > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
          background: payoutsOverdue > 0 ? 'rgba(239,68,68,0.03)' : 'rgba(17,24,39,0.7)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={20} color="#ef4444" className={payoutsOverdue > 0 ? "overdue-pulse" : ""} />
            </div>
            {payoutsOverdue > 0 && <span className="overdue-pulse" style={{ fontSize: '0.75rem', color: '#f87171', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: '99px', fontWeight: 600 }}>ACTION REQ</span>}
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: payoutsOverdue > 0 ? '#f87171' : 'white', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {formatCurrency(totalOverdue)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>Overdue Payouts</div>
          <div style={{ fontSize: '0.72rem', color: payoutsOverdue > 0 ? '#f87171' : 'rgba(255,255,255,0.4)', marginTop: '8px', fontWeight: 500 }}>
            {payoutsOverdue} payout{payoutsOverdue !== 1 ? 's' : ''} overdue
          </div>
        </div>
      </div>

      {/* Progress Bar Section */}
      {totalExpected > 0 && (
        <div className="glass-card" style={{ padding: '20px 24px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', fontWeight: 500 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IndianRupee size={14} /> Payout Disbursement Rate</span>
            <span>{paidPercentage}% disbursed ({formatCurrency(totalPaid)} / {formatCurrency(totalExpected)})</span>
          </div>
          <div className="progress-bar" style={{ height: '6px' }}>
            <div className="progress-fill" style={{ width: `${paidPercentage}%`, background: 'linear-gradient(90deg, #10b981, #3b82f6)' }} />
          </div>
        </div>
      )}

      {/* Plans Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontWeight: 700, color: 'white', fontSize: '1.1rem' }}>Payout Plans</h2>
        <button id="add-plan-btn" onClick={openAddPlan} className="btn btn-primary btn-sm">
          <Plus size={16} /> Add Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="empty-state glass-card" style={{ padding: '60px' }}>
          <TrendingUp size={48} color="rgba(255,255,255,0.15)" />
          <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.5)' }}>No plans yet for this client</p>
          <button onClick={openAddPlan} className="btn btn-primary" style={{ marginTop: '20px' }}>
            <Plus size={16} /> Create First Plan
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {plans.map((plan) => (
            <div key={plan.id} className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>{plan.planName}</h3>
                    <span className={`badge badge-${plan.status}`}>{plan.status}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginTop: '16px' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Principal</div>
                      <div style={{ fontWeight: 700, color: '#10b981', fontSize: '1rem', marginTop: '4px' }}>{formatCurrency(plan.principalAmount)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payout</div>
                      <div style={{ fontWeight: 600, color: 'white', marginTop: '4px' }}>
                        {formatCurrency(plan.payoutAmount || 0)}<span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>/ {getFrequencyLabel(plan.payoutType).toLowerCase()}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Date</div>
                      <div style={{ fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginTop: '4px', fontSize: '0.875rem' }}>{formatDate(plan.startDate)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Maturity</div>
                      <div style={{ fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginTop: '4px', fontSize: '0.875rem' }}>{plan.maturityDate ? formatDate(plan.maturityDate) : '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Mode</div>
                      <div style={{ fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginTop: '4px', fontSize: '0.875rem' }}>{getPaymentModeLabel(plan.defaultPaymentMode)}</div>
                    </div>
                  </div>
                  {plan.notes && (
                    <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>{plan.notes}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link href={`/dashboard/plans/${plan.id}`} className="btn btn-secondary btn-sm">
                    <CreditCard size={14} /> View Payouts
                  </Link>
                  <button onClick={() => openEditPlan(plan)} className="btn btn-secondary btn-sm">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteId(plan.id)} className="btn btn-danger btn-sm">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Plan Modal */}
      {showPlanModal && (
        <div className="modal-overlay" onClick={() => setShowPlanModal(false)}>
          <div className="modal-content" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontWeight: 700, color: 'white', fontSize: '1.1rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {editPlan ? 'Edit Plan' : 'Create Payout Plan'}
              </h2>
              <button onClick={() => setShowPlanModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSavePlan} style={{ padding: '20px 24px 24px' }}>
              {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}><AlertCircle size={16} /><span>{error}</span></div>}

              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label className="form-label">Plan Name *</label>
                  <input id="plan-name" className="form-input" value={planForm.planName} onChange={e => updatePlanForm({ planName: e.target.value })} required placeholder="e.g. Fixed Monthly 2%" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Invested Amount (₹) *</label>
                    <input id="plan-principal" className="form-input" type="number" min="1" step="0.01" value={planForm.principalAmount} onChange={e => updatePlanForm({ principalAmount: e.target.value })} required placeholder="100000" />
                  </div>
                  <div>
                    <label className="form-label">Payout Frequency *</label>
                    <select id="plan-frequency" className="form-input" value={planForm.payoutType} onChange={e => updatePlanForm({ payoutType: e.target.value as PayoutFrequency })}>
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="daily">Daily</option>
                    </select>
                  </div>
                </div>

                {/* Payout amount */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Payout Amount</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={planForm.usePercentage} onChange={e => updatePlanForm({ usePercentage: e.target.checked })} />
                      Use % of principal
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: planForm.usePercentage ? '1fr 1fr' : '1fr', gap: '12px' }}>
                    {planForm.usePercentage && (
                      <div>
                        <input id="plan-pct" className="form-input" type="number" min="0" max="100" step="0.01" value={planForm.payoutPercentage} onChange={e => updatePlanForm({ payoutPercentage: e.target.value })} placeholder="e.g. 2 for 2%" />
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '4px', display: 'block' }}>% of principal per payout</span>
                      </div>
                    )}
                    <div>
                      <input id="plan-amount" className="form-input" type="number" min="0" step="0.01" value={planForm.payoutAmount} onChange={e => updatePlanForm({ payoutAmount: e.target.value })} placeholder="Payout amount ₹" readOnly={planForm.usePercentage && !!planForm.payoutPercentage && !!planForm.principalAmount} />
                      {planForm.usePercentage && <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '4px', display: 'block' }}>Auto-calculated</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Start Date *</label>
                    <input id="plan-start" className="form-input" type="date" value={planForm.startDate} onChange={e => updatePlanForm({ startDate: e.target.value })} required />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <label className="form-label" style={{ margin: 0 }}>Maturity / End</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={planForm.useDuration} onChange={e => updatePlanForm({ useDuration: e.target.checked })} />
                        By duration
                      </label>
                    </div>
                    {planForm.useDuration ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input id="plan-duration" className="form-input" type="number" min="1" value={planForm.durationMonths} onChange={e => updatePlanForm({ durationMonths: e.target.value })} placeholder="e.g. 12" />
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>months</span>
                      </div>
                    ) : (
                      <input id="plan-maturity" className="form-input" type="date" value={planForm.maturityDate} onChange={e => updatePlanForm({ maturityDate: e.target.value })} />
                    )}
                    {planForm.maturityDate && (
                      <span style={{ fontSize: '0.72rem', color: '#a5b4fc', marginTop: '4px', display: 'block' }}>Maturity: {formatDate(planForm.maturityDate)}</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Default Payment Mode</label>
                    <select id="plan-payment-mode" className="form-input" value={planForm.defaultPaymentMode} onChange={e => updatePlanForm({ defaultPaymentMode: e.target.value as PaymentMode })}>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Status</label>
                    <select id="plan-status" className="form-input" value={planForm.status} onChange={e => updatePlanForm({ status: e.target.value as PlanStatus })}>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Notes</label>
                  <textarea id="plan-notes" className="form-input" style={{ minHeight: '70px', resize: 'vertical' }} value={planForm.notes} onChange={e => updatePlanForm({ notes: e.target.value })} placeholder="Any notes about this plan..." />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowPlanModal(false)} className="btn btn-secondary">Cancel</button>
                <button id="save-plan-btn" type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving...' : editPlan ? 'Save Changes' : 'Create Plan & Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Plan Confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '28px', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Trash2 size={24} color="#f87171" />
              </div>
              <h3 style={{ color: 'white', fontWeight: 700, marginBottom: '8px' }}>Delete Plan?</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginBottom: '24px' }}>
                This will permanently delete the plan and all its payout records.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button onClick={() => setDeleteId(null)} className="btn btn-secondary">Cancel</button>
                <button onClick={() => handleDeletePlan(deleteId)} className="btn btn-danger">Delete Plan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
