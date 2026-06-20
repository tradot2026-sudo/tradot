'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Search, CheckCircle2, Clock, RotateCcw, X, Filter, MessageCircle } from 'lucide-react';
import { formatCurrency, formatDate, getPayoutStatusLabel, getPaymentModeLabel, today, getDelayLabel, calculateDelayDays } from '@/lib/utils';
import type { Payout, Plan, Client, PayoutStatus, PaymentMode } from '@/types';
import { addDays, format } from 'date-fns';

type FilterType = 'all' | 'today' | 'overdue' | 'upcoming' | 'pending' | 'partial' | 'paid';

interface EnrichedPayout extends Payout {
  plan?: Plan & { client?: Client };
}

function PayoutsContent() {
  const searchParams = useSearchParams();
  const [payouts, setPayouts] = useState<EnrichedPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>((searchParams.get('filter') as FilterType) || 'all');
  const [search, setSearch] = useState('');
  const [activePayoutId, setActivePayoutId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paidAmount: '', paymentDate: today(), modeOfPayment: 'cash' as PaymentMode, referenceNo: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [whatsappTemplates, setWhatsappTemplates] = useState<{ whatsappTemplatePaid: string | null; whatsappTemplateReminder: string | null } | null>(null);

  const compileTemplate = (template: string, payout: EnrichedPayout) => {
    const client = payout.plan?.client;
    const plan = payout.plan;
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

  const sendWhatsAppNotification = (payout: EnrichedPayout) => {
    const client = payout.plan?.client;
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
        message = `Hello ${client.name},\n\nWe have successfully processed your payout of ${formattedAmount} for the investment "${payout.plan?.planName}".\n\nTransaction Details:\n- Date: ${payout.paymentDate ? formatDate(payout.paymentDate) : 'N/A'}\n- Mode: ${payout.modeOfPayment ? getPaymentModeLabel(payout.modeOfPayment) : 'N/A'}\n- Reference No: ${payout.referenceNo || 'N/A'}\n\nThank you for investing with us!\n- Tradot`;
      }
    } else {
      const customTemplate = whatsappTemplates?.whatsappTemplateReminder;
      if (customTemplate) {
        message = compileTemplate(customTemplate, payout);
      } else {
        message = `Hello ${client.name},\n\nThis is a friendly reminder that a payout of ${formattedAmount} for your investment "${payout.plan?.planName}" is scheduled for ${formatDate(payout.dueDate)}.\n\nThank you,\n- Tradot`;
      }
    }

    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const fetchPayouts = useCallback(async () => {
    try {
      const data = await api.get<EnrichedPayout[]>('/api/payouts');
      if (data) {
        const todayStr = today();
        const enriched = data.map((p: EnrichedPayout) => ({
          ...p,
          status: p.status === 'pending' && p.dueDate < todayStr ? 'overdue' as PayoutStatus : p.status,
        }));
        setPayouts(enriched);
      }
    } catch (err) {
      console.error('Failed to load payouts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get<{ whatsappTemplatePaid: string | null; whatsappTemplateReminder: string | null }>('/api/settings/templates');
      setWhatsappTemplates(res);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }, []);

  useEffect(() => {
    fetchPayouts();
    fetchTemplates();
  }, [fetchPayouts, fetchTemplates]);

  const filterPayouts = (p: EnrichedPayout): boolean => {
    const todayStr = today();
    const weekAhead = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    switch (filter) {
      case 'today': return p.dueDate === todayStr && p.status !== 'paid' && p.plan?.status === 'active';
      case 'overdue': return p.status === 'overdue' && p.plan?.status === 'active';
      case 'upcoming': return p.dueDate > todayStr && p.dueDate <= weekAhead && p.status !== 'paid' && p.plan?.status === 'active';
      case 'pending': return p.status === 'pending' && p.plan?.status === 'active';
      case 'partial': return p.status === 'partial' && p.plan?.status === 'active';
      case 'paid': return p.status === 'paid';
      default: return true;
    }
  };

  const filteredPayouts = payouts.filter(p => {
    const matchFilter = filterPayouts(p);
    if (!search) return matchFilter;
    const s = search.toLowerCase();
    const clientName = (p.plan?.client?.name || '').toLowerCase();
    const planName = (p.plan?.planName || '').toLowerCase();
    return matchFilter && (clientName.includes(s) || planName.includes(s));
  });

  const counts = {
    all: payouts.length,
    today: payouts.filter(p => p.dueDate === today() && p.status !== 'paid' && p.plan?.status === 'active').length,
    overdue: payouts.filter(p => p.status === 'overdue' && p.plan?.status === 'active').length,
    upcoming: payouts.filter(p => { const wa = format(addDays(new Date(), 7), 'yyyy-MM-dd'); return p.dueDate > today() && p.dueDate <= wa && p.status !== 'paid' && p.plan?.status === 'active'; }).length,
    pending: payouts.filter(p => p.status === 'pending' && p.plan?.status === 'active').length,
    partial: payouts.filter(p => p.status === 'partial' && p.plan?.status === 'active').length,
    paid: payouts.filter(p => p.status === 'paid').length,
  };

  const openPayment = (payout: EnrichedPayout) => {
    setActivePayoutId(payout.id);
    setPaymentForm({
      paidAmount: String(payout.expectedAmount - (payout.paidAmount || 0)),
      paymentDate: today(),
      modeOfPayment: (payout.plan?.defaultPaymentMode as PaymentMode) || 'cash',
      referenceNo: '', notes: '',
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
      setSaving(false);
      setActivePayoutId(null);
      fetchPayouts();
    } catch (err) {
      console.error('Failed to record payout payment:', err);
      setSaving(false);
    }
  };

  const handleReset = async (id: string) => {
    try {
      await api.patch(`/api/payouts/${id}`, { resetPayment: true });
      fetchPayouts();
    } catch (err) {
      console.error('Failed to reset payout payment:', err);
    }
  };

  const getStatusBadge = (status: PayoutStatus) => (
    <span className={`badge badge-${status}`}>{getPayoutStatusLabel(status)}</span>
  );

  const filterButtons: { key: FilterType; label: string; color?: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'overdue', label: `Overdue (${counts.overdue})`, color: '#f87171' },
    { key: 'today', label: `Due Today (${counts.today})`, color: '#fbbf24' },
    { key: 'upcoming', label: `Upcoming (${counts.upcoming})`, color: '#a5b4fc' },
    { key: 'partial', label: `Partial (${counts.partial})`, color: '#fbbf24' },
    { key: 'pending', label: `Pending (${counts.pending})` },
    { key: 'paid', label: `Paid (${counts.paid})`, color: '#34d399' },
  ];

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">All Payouts</h1>
          <p className="page-subtitle">Global view of all payout records across all clients</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {filterButtons.map(fb => (
          <button
            key={fb.key}
            onClick={() => setFilter(fb.key)}
            className="btn btn-sm"
            style={{
              background: filter === fb.key ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
              border: filter === fb.key ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: filter === fb.key ? (fb.color || '#a5b4fc') : (fb.color || 'rgba(255,255,255,0.5)'),
            }}
          >
            {fb.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '380px' }}>
        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
        <input id="payout-search" className="form-input" style={{ paddingLeft: '42px' }} placeholder="Search by client or plan..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      {loading ? (
        <div className="glass-card shimmer" style={{ height: '300px' }} />
      ) : filteredPayouts.length === 0 ? (
        <div className="empty-state glass-card" style={{ padding: '60px' }}>
          <Filter size={48} color="rgba(255,255,255,0.15)" />
          <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.5)' }}>No payouts found for this filter</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Plan</th>
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
              {filteredPayouts.map(payout => {
                const balance = payout.expectedAmount - (payout.paidAmount || 0);
                const isPaid = payout.status === 'paid';
                return (
                  <tr key={payout.id}>
                    <td>
                      <Link href={`/dashboard/clients/${payout.plan?.client?.id}`} style={{ color: '#a5b4fc', textDecoration: 'none', fontWeight: 600 }}>
                        {payout.plan?.client?.name || '—'}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/dashboard/plans/${payout.planId}`} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.85rem' }}>
                        {payout.plan?.planName || '—'}
                      </Link>
                    </td>
                    <td style={{ color: 'rgba(255,255,255,0.4)' }}>#{payout.payoutNumber || '—'}</td>
                    <td>
                      <div>{formatDate(payout.dueDate)}</div>
                      {payout.status !== 'paid' && payout.dueDate < today() && (
                        <div style={{ fontSize: '0.7rem', color: '#f87171', marginTop: '2px', fontWeight: 500 }}>
                          {getDelayLabel(payout.dueDate, payout.paymentDate, payout.status)}
                        </div>
                      )}
                      {payout.dueDate === today() && <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '0.65rem', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '2px 5px', borderRadius: '4px' }}>TODAY</span>}
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
                    <td>{getStatusBadge(payout.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {!isPaid && (
                          <button id={`payout-pay-${payout.id}`} onClick={() => openPayment(payout)} className="btn btn-success btn-sm">
                            <CheckCircle2 size={13} /> Pay
                          </button>
                        )}
                        {(isPaid || payout.status === 'partial') && (
                          <button onClick={() => handleReset(payout.id)} className="btn btn-secondary btn-sm" title="Reset">
                            <RotateCcw size={13} />
                          </button>
                        )}
                        {payout.plan?.client?.phone && (
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Modal */}
      {activePayoutId && (
        <div className="modal-overlay" onClick={() => setActivePayoutId(null)}>
          <div className="modal-content" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontWeight: 700, color: 'white', fontSize: '1.1rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Record Payment</h2>
              <button onClick={() => setActivePayoutId(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            {(() => {
              const payout = payouts.find(p => p.id === activePayoutId)!;
              const balance = payout.expectedAmount - (payout.paidAmount || 0);
              const planPayouts = payouts.filter(p => p.planId === payout.planId);
              const planRemaining = planPayouts.reduce((s, p) => s + Math.max(0, p.expectedAmount - (p.paidAmount || 0)), 0);
              const olderOutstanding = planPayouts.filter(p => p.dueDate < payout.dueDate && p.status !== 'paid');
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

                  <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '14px', marginBottom: '18px', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Client</span>
                      <span style={{ color: 'white', fontWeight: 600 }}>{payout.plan?.client?.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Due</span>
                      <span style={{ color: '#fbbf24', fontWeight: 600 }}>{formatDate(payout.dueDate)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Balance</span>
                      <span style={{ color: '#f59e0b', fontWeight: 700 }}>{formatCurrency(balance)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: '14px' }}>
                    <div>
                      <label className="form-label">Amount Paid (₹) *</label>
                      <input
                        id="global-payment-amount"
                        className="form-input"
                        type="number"
                        min="0.01"
                        max={planRemaining}
                        step="0.01"
                        value={paymentForm.paidAmount}
                        onChange={e => setPaymentForm({ ...paymentForm, paidAmount: e.target.value })}
                        required
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPaymentForm({ ...paymentForm, paidAmount: String(balance) })}>
                          This Payout ({formatCurrency(balance)})
                        </button>
                        {planRemaining > balance && (
                          <button type="button" className="btn btn-secondary btn-sm" style={{ borderColor: 'rgba(245,158,11,0.3)', color: '#fbbf24' }} onClick={() => setPaymentForm({ ...paymentForm, paidAmount: String(planRemaining) })}>
                            All Outstanding ({formatCurrency(planRemaining)})
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label className="form-label">Date *</label>
                        <input id="global-payment-date" className="form-input" type="date" value={paymentForm.paymentDate} onChange={e => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} required />
                      </div>
                      <div>
                        <label className="form-label">Mode</label>
                        <select id="global-payment-mode" className="form-input" value={paymentForm.modeOfPayment} onChange={e => setPaymentForm({ ...paymentForm, modeOfPayment: e.target.value as PaymentMode })}>
                          <option value="cash">Cash</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="upi">UPI</option>
                          <option value="cheque">Cheque</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Reference</label>
                      <input id="global-payment-ref" className="form-input" value={paymentForm.referenceNo} onChange={e => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })} placeholder="Optional" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setActivePayoutId(null)} className="btn btn-secondary">Cancel</button>
                    <button id="global-confirm-payment" type="submit" disabled={saving} className="btn btn-primary">
                      {saving ? 'Saving...' : 'Record Payment'}
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PayoutsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '32px', color: 'rgba(255,255,255,0.5)' }}>Loading...</div>}>
      <PayoutsContent />
    </Suspense>
  );
}
