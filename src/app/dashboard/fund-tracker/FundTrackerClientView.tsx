'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet, ArrowDownToLine, CheckCircle2, AlertTriangle,
  Clock, ChevronDown, RefreshCw, TrendingDown, IndianRupee,
  Calendar, Shield, Ban
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { api } from '@/lib/api';
import type { Payout, Plan, Client, FundStatus } from '@/types';
import { format, addDays } from 'date-fns';

type FilterTab = 'all' | 'no_action' | 'withdrawal_requested' | 'credited' | 'at_risk';

interface FundTrackerData {
  payouts: (Payout & { plan?: Plan & { client?: Client } })[];
  summary: {
    totalNeeded: number;
    withdrawalRequested: number;
    credited: number;
    atRisk: number;
    atRiskCount: number;
  };
  todayStr: string;
  tomorrowStr: string;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  bgColor,
  borderColor,
  pulseGlow,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  color: string;
  bgColor: string;
  borderColor: string;
  pulseGlow?: boolean;
}) {
  return (
    <div
      className="glass-card"
      style={{
        padding: '22px 24px',
        borderColor,
        background: bgColor,
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 12px 30px ${borderColor}`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
      }}
    >
      {pulseGlow && (
        <div style={{
          position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px',
          borderRadius: '50%', background: `radial-gradient(circle, ${borderColor} 0%, transparent 70%)`,
          animation: 'pulse-dot 2s ease-in-out infinite', pointerEvents: 'none',
        }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div
          style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: `${color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon size={22} color={color} />
        </div>
      </div>
      <div style={{
        fontSize: '1.5rem', fontWeight: 700, color: 'white',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        {value}
      </div>
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>{label}</div>
      {subValue && (
        <div style={{ fontSize: '0.75rem', color, marginTop: '8px', fontWeight: 500 }}>
          {subValue}
        </div>
      )}
    </div>
  );
}

function FundStatusBadge({ status, dueDate, todayStr, tomorrowStr }: {
  status: FundStatus | null | undefined;
  dueDate: string;
  todayStr: string;
  tomorrowStr: string;
}) {
  const isOverdue = dueDate < todayStr;
  const isDueSoon = dueDate <= tomorrowStr;
  const isAtRisk = (status !== 'credited') && isDueSoon;

  if (status === 'credited') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '3px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500,
        color: '#34d399', background: 'rgba(52,211,153,0.1)',
      }}>
        <CheckCircle2 size={12} /> Credited
      </span>
    );
  }

  if (status === 'withdrawal_requested') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '3px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500,
        color: isAtRisk ? '#fbbf24' : '#60a5fa',
        background: isAtRisk ? 'rgba(251,191,36,0.1)' : 'rgba(96,165,250,0.1)',
      }}>
        <Clock size={12} /> Withdrawal Placed
        {isAtRisk && <AlertTriangle size={11} />}
      </span>
    );
  }

  // No action
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500,
      color: isOverdue ? '#f87171' : isAtRisk ? '#fbbf24' : '#94a3b8',
      background: isOverdue ? 'rgba(248,113,113,0.1)' : isAtRisk ? 'rgba(251,191,36,0.1)' : 'rgba(148,163,184,0.1)',
    }}>
    {isOverdue ? <><AlertTriangle size={12} /> No Action!</> : 'No Action'}
    </span>
  );
}

function DueDateBadge({ dueDate, todayStr }: { dueDate: string; todayStr: string }) {
  const isOverdue = dueDate < todayStr;
  const isToday = dueDate === todayStr;
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const isTomorrow = dueDate === tomorrowStr;

  let label = formatDate(dueDate);
  let color = 'rgba(255,255,255,0.5)';

  if (isOverdue) { label = `OVERDUE · ${formatDate(dueDate)}`; color = '#f87171'; }
  else if (isToday) { label = `TODAY · ${formatDate(dueDate)}`; color = '#fbbf24'; }
  else if (isTomorrow) { label = `TOMORROW · ${formatDate(dueDate)}`; color = '#fb923c'; }

  return (
    <span style={{ fontSize: '0.8rem', fontWeight: isOverdue || isToday ? 600 : 400, color }}>
      {label}
    </span>
  );
}

export default function FundTrackerClientView({ data }: { data: FundTrackerData }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const updateFundStatus = useCallback(async (payoutId: string, newStatus: FundStatus | null) => {
    setLoadingIds(prev => new Set(prev).add(payoutId));
    setOpenDropdown(null);
    try {
      await api.patch(`/api/payouts/${payoutId}`, { fundStatus: newStatus });
      router.refresh();
    } catch (err) {
      console.error('Failed to update fund status:', err);
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(payoutId);
        return next;
      });
    }
  }, [router]);

  const filteredPayouts = data.payouts.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'no_action') return !p.fundStatus;
    if (filter === 'withdrawal_requested') return p.fundStatus === 'withdrawal_requested';
    if (filter === 'credited') return p.fundStatus === 'credited';
    if (filter === 'at_risk') {
      return p.fundStatus !== 'credited' && p.dueDate <= data.tomorrowStr;
    }
    return true;
  });

  const tabs: { key: FilterTab; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: data.payouts.length, color: '#94a3b8' },
    { key: 'no_action', label: 'No Action', count: data.payouts.filter(p => !p.fundStatus).length, color: '#94a3b8' },
    { key: 'withdrawal_requested', label: 'Withdrawal Placed', count: data.payouts.filter(p => p.fundStatus === 'withdrawal_requested').length, color: '#60a5fa' },
    { key: 'credited', label: 'Credited', count: data.payouts.filter(p => p.fundStatus === 'credited').length, color: '#34d399' },
    { key: 'at_risk', label: 'At Risk', count: data.summary.atRiskCount, color: '#f87171' },
  ];

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: 0, marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Wallet size={20} color="white" />
          </div>
          <h1 className="page-title">Fund Tracker</h1>
        </div>
        <p className="page-subtitle">
          {format(new Date(), 'EEEE, dd MMMM yyyy')} — Track fund withdrawals for upcoming payouts
        </p>
      </div>

      {/* At Risk Alert */}
      {data.summary.atRiskCount > 0 && (
        <div
          className="alert alert-danger"
          style={{
            marginBottom: '24px',
            animation: 'fadeIn 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            <strong>🚨 {data.summary.atRiskCount} payout{data.summary.atRiskCount > 1 ? 's' : ''} at risk!</strong>{' '}
            <strong>{formatCurrency(data.summary.atRisk)}</strong> due within 24 hours without confirmed funds.
          </span>
          <button
            className="btn btn-sm"
            onClick={() => setFilter('at_risk')}
            style={{
              background: 'rgba(248,113,113,0.2)',
              color: '#fca5a5',
              border: '1px solid rgba(248,113,113,0.3)',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            View at risk
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <SummaryCard
          icon={IndianRupee}
          label="Total Funds Needed"
          value={formatCurrency(data.summary.totalNeeded)}
          subValue={`${data.payouts.length} payout${data.payouts.length !== 1 ? 's' : ''} in next 3 days`}
          color="#f59e0b"
          bgColor="rgba(245,158,11,0.05)"
          borderColor="rgba(245,158,11,0.15)"
        />
        <SummaryCard
          icon={ArrowDownToLine}
          label="Withdrawal Requested"
          value={formatCurrency(data.summary.withdrawalRequested)}
          subValue="Sell order placed, waiting for credit"
          color="#3b82f6"
          bgColor="rgba(59,130,246,0.05)"
          borderColor="rgba(59,130,246,0.15)"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Credited to Account"
          value={formatCurrency(data.summary.credited)}
          subValue="Funds confirmed in your account"
          color="#10b981"
          bgColor="rgba(16,185,129,0.05)"
          borderColor="rgba(16,185,129,0.15)"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="At Risk"
          value={formatCurrency(data.summary.atRisk)}
          subValue={data.summary.atRiskCount > 0 ? `${data.summary.atRiskCount} payout${data.summary.atRiskCount !== 1 ? 's' : ''} need attention` : 'All clear ✨'}
          color="#ef4444"
          bgColor="rgba(239,68,68,0.05)"
          borderColor="rgba(239,68,68,0.15)"
          pulseGlow={data.summary.atRiskCount > 0}
        />
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '20px', overflowX: 'auto',
        padding: '4px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: filter === tab.key ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: filter === tab.key ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
            }}
          >
            {tab.label}
            <span style={{
              fontSize: '0.7rem',
              padding: '1px 6px',
              borderRadius: '9999px',
              background: filter === tab.key ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
              color: filter === tab.key ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Payouts List */}
      {filteredPayouts.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px 24px' }}>
          <div className="empty-state">
            {filter === 'at_risk' ? (
              <>
                <Shield size={48} color="rgba(16,185,129,0.4)" />
                <p style={{ marginTop: '16px', fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  No at-risk payouts! 🎉
                </p>
                <p style={{ marginTop: '4px', fontSize: '0.85rem' }}>
                  All upcoming payouts have confirmed funds
                </p>
              </>
            ) : filter === 'all' ? (
              <>
                <Calendar size={48} color="rgba(255,255,255,0.15)" />
                <p style={{ marginTop: '16px', fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  No upcoming payouts
                </p>
                <p style={{ marginTop: '4px', fontSize: '0.85rem' }}>
                  No pending payouts due in the next 3 days
                </p>
              </>
            ) : (
              <>
                <Ban size={48} color="rgba(255,255,255,0.15)" />
                <p style={{ marginTop: '16px', fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  No payouts in this category
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Plan</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Fund Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayouts.map(payout => {
                  const balance = payout.expectedAmount - (payout.paidAmount || 0);
                  const isAtRisk = payout.fundStatus !== 'credited' && payout.dueDate <= data.tomorrowStr;
                  const isOverdue = payout.dueDate < data.todayStr;
                  const isLoading = loadingIds.has(payout.id);

                  return (
                    <tr
                      key={payout.id}
                      style={{
                        background: isOverdue && payout.fundStatus !== 'credited'
                          ? 'rgba(239,68,68,0.04)'
                          : isAtRisk
                          ? 'rgba(245,158,11,0.03)'
                          : undefined,
                      }}
                    >
                      {/* Client */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, fontSize: '0.8rem', fontWeight: 700, color: 'white',
                          }}>
                            {payout.plan?.client?.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            {payout.plan?.client?.name || 'Unknown'}
                          </span>
                        </div>
                      </td>

                      {/* Plan */}
                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                          {payout.plan?.planName || '-'}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td>
                        <DueDateBadge dueDate={payout.dueDate} todayStr={data.todayStr} />
                      </td>

                      {/* Amount */}
                      <td style={{ textAlign: 'right' }}>
                        <span style={{
                          fontSize: '0.9rem', fontWeight: 700, color: 'white',
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                        }}>
                          {formatCurrency(balance)}
                        </span>
                      </td>

                      {/* Fund Status Badge */}
                      <td>
                        <FundStatusBadge
                          status={payout.fundStatus ?? null}
                          dueDate={payout.dueDate}
                          todayStr={data.todayStr}
                          tomorrowStr={data.tomorrowStr}
                        />
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            disabled={isLoading}
                            onClick={() => setOpenDropdown(openDropdown === payout.id ? null : payout.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)',
                              fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => {
                              if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                            }}
                          >
                            {isLoading ? (
                              <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <>
                                Update <ChevronDown size={13} />
                              </>
                            )}
                          </button>

                          {/* Dropdown */}
                          {openDropdown === payout.id && (
                            <>
                              {/* Backdrop to close dropdown */}
                              <div
                                style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                                onClick={() => setOpenDropdown(null)}
                              />
                              <div style={{
                                position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                                background: '#1a2540', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px', overflow: 'hidden', zIndex: 50,
                                boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                                minWidth: '200px',
                                animation: 'slideUp 0.15s ease',
                              }}>
                                {!payout.fundStatus && (
                                  <button
                                    onClick={() => updateFundStatus(payout.id, 'withdrawal_requested')}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                                      padding: '10px 14px', border: 'none', background: 'none',
                                      color: '#60a5fa', fontSize: '0.8rem', cursor: 'pointer',
                                      transition: 'background 0.15s', textAlign: 'left',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.1)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                  >
                                    <ArrowDownToLine size={14} />
                                    Mark Withdrawal Requested
                                  </button>
                                )}
                                {payout.fundStatus === 'withdrawal_requested' && (
                                  <button
                                    onClick={() => updateFundStatus(payout.id, 'credited')}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                                      padding: '10px 14px', border: 'none', background: 'none',
                                      color: '#34d399', fontSize: '0.8rem', cursor: 'pointer',
                                      transition: 'background 0.15s', textAlign: 'left',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.1)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                  >
                                    <CheckCircle2 size={14} />
                                    Mark Credited to Account
                                  </button>
                                )}
                                {payout.fundStatus === 'credited' && (
                                  <div style={{
                                    padding: '10px 14px', fontSize: '0.8rem',
                                    color: 'rgba(255,255,255,0.4)',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                  }}>
                                    <CheckCircle2 size={14} color="#34d399" />
                                    Funds confirmed ✓
                                  </div>
                                )}
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
                                {payout.fundStatus && (
                                  <button
                                    onClick={() => updateFundStatus(payout.id, null)}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                                      padding: '10px 14px', border: 'none', background: 'none',
                                      color: '#f87171', fontSize: '0.8rem', cursor: 'pointer',
                                      transition: 'background 0.15s', textAlign: 'left',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.1)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                  >
                                    <TrendingDown size={14} />
                                    Reset to No Action
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div style={{
        marginTop: '20px', padding: '16px 20px', borderRadius: '12px',
        background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)',
        fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6,
      }}>
        <strong style={{ color: 'rgba(255,255,255,0.7)' }}>💡 How it works:</strong>{' '}
        Payouts due within the next 3 days appear here. Since stock market withdrawals take 2–3 days to credit,
        mark them as <strong style={{ color: '#60a5fa' }}>Withdrawal Requested</strong> when you place a sell order,
        then <strong style={{ color: '#34d399' }}>Credited</strong> once funds arrive.
        Payouts due within 24 hours without confirmed funds are flagged as <strong style={{ color: '#f87171' }}>At Risk</strong>.
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 900px) {
          table { font-size: 0.8rem; }
          th, td { padding: 10px 12px !important; }
        }
      `}</style>
    </div>
  );
}
