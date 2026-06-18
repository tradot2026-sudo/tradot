'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Users, AlertCircle, Clock, CheckCircle2,
  ArrowRight, IndianRupee, Calendar, Activity
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Payout, Client, Plan } from '@/types';
import { format } from 'date-fns';

interface DashboardData {
  totalClients: number;
  totalInvested: number;
  totalPaid: number;
  activePlans: number;
  dueTodayPayouts: Payout[];
  overduePayouts: Payout[];
  upcomingPayouts: Payout[];
  recentClients: Client[];
}

function StatCard({
  icon: Icon, label, value, sub, color, href
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
  href?: string;
}) {
  const content = (
    <div
      className="glass-card stat-card-glow"
      style={{
        padding: '24px',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: href ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => {
        if (href) {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 30px rgba(0,0,0,0.3)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div
          style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: `${color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon size={22} color={color} />
        </div>
        {href && <ArrowRight size={16} color="rgba(255,255,255,0.3)" />}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'white', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {value}
      </div>
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>{label}</div>
      {sub && <div style={{ fontSize: '0.75rem', color, marginTop: '8px', fontWeight: 500 }}>{sub}</div>}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link> : content;
}

function PayoutRow({ payout, label }: { payout: Payout & { plan?: Plan & { client?: Client } }; label?: string }) {
  const balance = payout.expectedAmount - (payout.paidAmount || 0);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', borderRadius: '10px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.05)',
      marginBottom: '8px',
      gap: '12px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {payout.plan?.client?.name || 'Unknown Client'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
          {payout.plan?.planName} · {formatDate(payout.dueDate)}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>
          {formatCurrency(balance)}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>
          {label || 'due'}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get<DashboardData>('/api/dashboard');
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) {
    return (
      <div style={{ padding: '32px', display: 'grid', gap: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass-card shimmer" style={{ height: '130px' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const overdueAmount = data.overduePayouts.reduce((s, p) => s + (p.expectedAmount - (p.paidAmount || 0)), 0);
  const dueTodayAmount = data.dueTodayPayouts.reduce((s, p) => s + (p.expectedAmount - (p.paidAmount || 0)), 0);

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: 0, marginBottom: '28px' }}>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          {format(new Date(), 'EEEE, dd MMMM yyyy')} — Overview of your investment portfolio
        </p>
      </div>

      {/* Overdue Alert */}
      {data.overduePayouts.length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: '24px' }}>
          <AlertCircle size={18} />
          <span>
            <strong>{data.overduePayouts.length} overdue payout{data.overduePayouts.length > 1 ? 's' : ''}</strong> totalling <strong>{formatCurrency(overdueAmount)}</strong> require immediate attention.
          </span>
          <Link href="/dashboard/payouts?filter=overdue" style={{ marginLeft: 'auto', color: '#fca5a5', textDecoration: 'none', fontSize: '0.85rem', whiteSpace: 'nowrap', fontWeight: 600 }}>
            View all →
          </Link>
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <StatCard icon={Users} label="Total Clients" value={String(data.totalClients)} color="#6366f1" href="/dashboard/clients" />
        <StatCard icon={IndianRupee} label="Total Invested" value={formatCurrency(data.totalInvested)} color="#10b981" />
        <StatCard icon={CheckCircle2} label="Total Paid Out" value={formatCurrency(data.totalPaid)} color="#3b82f6" />
        <StatCard icon={Activity} label="Active Plans" value={String(data.activePlans)} color="#f59e0b" />
      </div>

      {/* Alert Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <Link href="/dashboard/payouts?filter=overdue" style={{ textDecoration: 'none' }}>
          <div className="glass-card" style={{ padding: '20px', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f87171' }}>{data.overduePayouts.length}</div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>Overdue</div>
                <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '4px' }}>{formatCurrency(overdueAmount)}</div>
              </div>
              <AlertCircle size={32} color="#f87171" opacity={0.6} />
            </div>
          </div>
        </Link>

        <Link href="/dashboard/payouts?filter=today" style={{ textDecoration: 'none' }}>
          <div className="glass-card" style={{ padding: '20px', borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24' }}>{data.dueTodayPayouts.length}</div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>Due Today</div>
                <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '4px' }}>{formatCurrency(dueTodayAmount)}</div>
              </div>
              <Clock size={32} color="#fbbf24" opacity={0.6} />
            </div>
          </div>
        </Link>

        <Link href="/dashboard/payouts?filter=upcoming" style={{ textDecoration: 'none' }}>
          <div className="glass-card" style={{ padding: '20px', borderColor: 'rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a5b4fc' }}>{data.upcomingPayouts.length}</div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>Next 7 Days</div>
                <div style={{ fontSize: '0.75rem', color: '#a5b4fc', marginTop: '4px' }}>
                  {formatCurrency(data.upcomingPayouts.reduce((s, p) => s + (p.expectedAmount - (p.paidAmount || 0)), 0))}
                </div>
              </div>
              <Calendar size={32} color="#a5b4fc" opacity={0.6} />
            </div>
          </div>
        </Link>
      </div>

      {/* Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Due Today */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>
              <span style={{ color: '#fbbf24' }}>●</span> Due Today
            </h3>
            <Link href="/dashboard/payouts?filter=today" style={{ fontSize: '0.75rem', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>
              View all
            </Link>
          </div>
          {data.dueTodayPayouts.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <CheckCircle2 size={36} color="rgba(16,185,129,0.4)" />
              <p style={{ marginTop: '12px', fontSize: '0.875rem' }}>No payouts due today 🎉</p>
            </div>
          ) : (
            data.dueTodayPayouts.map(p => (
              <PayoutRow key={p.id} payout={p as Payout & { plan?: Plan & { client?: Client } }} label="due today" />
            ))
          )}
        </div>

        {/* Overdue */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>
              <span style={{ color: '#f87171' }}>●</span> Overdue Payouts
            </h3>
            <Link href="/dashboard/payouts?filter=overdue" style={{ fontSize: '0.75rem', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>
              View all
            </Link>
          </div>
          {data.overduePayouts.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <CheckCircle2 size={36} color="rgba(16,185,129,0.4)" />
              <p style={{ marginTop: '12px', fontSize: '0.875rem' }}>No overdue payouts!</p>
            </div>
          ) : (
            data.overduePayouts.map(p => (
              <PayoutRow key={p.id} payout={p as Payout & { plan?: Plan & { client?: Client } }} label="overdue" />
            ))
          )}
        </div>

        {/* Recent Clients */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>Recent Clients</h3>
            <Link href="/dashboard/clients" style={{ fontSize: '0.75rem', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>
              View all
            </Link>
          </div>
          {data.recentClients.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <Users size={36} color="rgba(255,255,255,0.15)" />
              <p style={{ marginTop: '12px', fontSize: '0.875rem' }}>No clients yet</p>
              <Link href="/dashboard/clients" className="btn btn-primary btn-sm" style={{ marginTop: '16px' }}>
                Add Client
              </Link>
            </div>
          ) : (
            data.recentClients.map(client => (
              <Link key={client.id} href={`/dashboard/clients/${client.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  marginBottom: '8px',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: '0.875rem', fontWeight: 700, color: 'white',
                  }}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'white' }}>{client.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{client.phone || client.email || 'No contact'}</div>
                  </div>
                  <ArrowRight size={14} color="rgba(255,255,255,0.2)" />
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Upcoming */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>
              <span style={{ color: '#a5b4fc' }}>●</span> Upcoming (Next 7 Days)
            </h3>
            <Link href="/dashboard/payouts?filter=upcoming" style={{ fontSize: '0.75rem', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>
              View all
            </Link>
          </div>
          {data.upcomingPayouts.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <Calendar size={36} color="rgba(255,255,255,0.15)" />
              <p style={{ marginTop: '12px', fontSize: '0.875rem' }}>No payouts in the next 7 days</p>
            </div>
          ) : (
            data.upcomingPayouts.map(p => (
              <PayoutRow key={p.id} payout={p as Payout & { plan?: Plan & { client?: Client } }} label="upcoming" />
            ))
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
