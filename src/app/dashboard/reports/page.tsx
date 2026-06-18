'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Download, FileText, Table2, Filter } from 'lucide-react';
import { formatCurrency, formatDate, getPayoutStatusLabel, getPaymentModeLabel, today, calculateDelayDays } from '@/lib/utils';
import type { Client, Plan, Payout } from '@/types';
import { format } from 'date-fns';

interface ReportData {
  clients: (Client & { plans?: Plan[] })[];
  allPayouts: (Payout & { plan?: Plan & { client?: Client } })[];
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [clients, payouts] = await Promise.all([
        api.get<Client[]>('/api/clients'),
        api.get<Payout[]>('/api/payouts'),
      ]);

      const todayStr = today();
      const enrichedPayouts = payouts.map((p) => ({
        ...p,
        status: p.status === 'pending' && p.dueDate < todayStr ? 'overdue' as any : p.status,
      }));

      setData({
        clients: clients || [],
        allPayouts: enrichedPayouts || [],
      });
    } catch (err) {
      console.error('Failed to load reports data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getFilteredPayouts = () => {
    if (!data) return [];
    return data.allPayouts.filter(p => {
      if (selectedClient !== 'all' && p.plan?.client?.id !== selectedClient) return false;
      if (dateFrom && p.dueDate < dateFrom) return false;
      if (dateTo && p.dueDate > dateTo) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      return true;
    });
  };

  const filteredPayouts = getFilteredPayouts();

  const summaryStats = {
    totalExpected: filteredPayouts.reduce((s, p) => s + p.expectedAmount, 0),
    totalPaid: filteredPayouts.reduce((s, p) => s + (p.paidAmount || 0), 0),
    totalBalance: filteredPayouts.reduce((s, p) => s + Math.max(0, p.expectedAmount - (p.paidAmount || 0)), 0),
    paid: filteredPayouts.filter(p => p.status === 'paid').length,
    overdue: filteredPayouts.filter(p => p.status === 'overdue').length,
    partial: filteredPayouts.filter(p => p.status === 'partial').length,
    pending: filteredPayouts.filter(p => p.status === 'pending').length,
  };

  const exportCSV = () => {
    setExporting('csv');
    const headers = ['Client', 'Plan', 'Payout #', 'Due Date', 'Expected Amount', 'Paid Amount', 'Balance', 'Payment Date', 'Delay (Days)', 'Payment Mode', 'Reference', 'Status'];
    const rows = filteredPayouts.map(p => [
      p.plan?.client?.name || '',
      p.plan?.planName || '',
      p.payoutNumber || '',
      p.dueDate,
      p.expectedAmount,
      p.paidAmount || 0,
      Math.max(0, p.expectedAmount - (p.paidAmount || 0)),
      p.paymentDate || '',
      p.status === 'paid' ? calculateDelayDays(p.dueDate, p.paymentDate) : (p.dueDate < today() ? calculateDelayDays(p.dueDate, null) : 0),
      p.modeOfPayment ? getPaymentModeLabel(p.modeOfPayment) : '',
      p.referenceNo || '',
      getPayoutStatusLabel(p.status),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tradot-payouts-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExporting(null);
  };

  const exportPDF = async () => {
    setExporting('pdf');
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Title
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text('Tradot — Payout Report', 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 28);

      const filterDesc = [
        selectedClient !== 'all' ? `Client: ${data?.clients.find(c => c.id === selectedClient)?.name}` : 'All Clients',
        dateFrom ? `From: ${dateFrom}` : '',
        dateTo ? `To: ${dateTo}` : '',
        statusFilter !== 'all' ? `Status: ${statusFilter}` : '',
      ].filter(Boolean).join(' | ');
      doc.text(filterDesc, 14, 34);

      // Summary box
      doc.setFillColor(245, 247, 250);
      doc.rect(14, 38, 267, 22, 'F');
      doc.setFontSize(9);
      doc.setTextColor(60);
      const summaryItems = [
        `Total Expected: ${formatCurrency(summaryStats.totalExpected)}`,
        `Total Paid: ${formatCurrency(summaryStats.totalPaid)}`,
        `Total Balance: ${formatCurrency(summaryStats.totalBalance)}`,
        `Paid: ${summaryStats.paid}  |  Partial: ${summaryStats.partial}  |  Overdue: ${summaryStats.overdue}  |  Pending: ${summaryStats.pending}`,
      ];
      summaryItems.forEach((item, i) => doc.text(item, 18, 45 + i * 5));

      // Table
      autoTable(doc, {
        startY: 65,
        head: [['Client', 'Plan', '#', 'Due Date', 'Expected', 'Paid', 'Balance', 'Pay Date', 'Delay', 'Mode', 'Status']],
        body: filteredPayouts.map(p => [
          p.plan?.client?.name || '',
          p.plan?.planName || '',
          p.payoutNumber || '',
          formatDate(p.dueDate),
          formatCurrency(p.expectedAmount),
          p.paidAmount > 0 ? formatCurrency(p.paidAmount) : '—',
          Math.max(0, p.expectedAmount - (p.paidAmount || 0)) > 0
            ? formatCurrency(Math.max(0, p.expectedAmount - (p.paidAmount || 0)))
            : '✓',
          p.paymentDate ? formatDate(p.paymentDate) : '—',
          p.status === 'paid'
            ? (calculateDelayDays(p.dueDate, p.paymentDate) > 0 ? `${calculateDelayDays(p.dueDate, p.paymentDate)}d late` : 'On time')
            : (p.dueDate < today() ? `${calculateDelayDays(p.dueDate, null)}d late` : '—'),
          p.modeOfPayment ? getPaymentModeLabel(p.modeOfPayment) : '—',
          getPayoutStatusLabel(p.status),
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 252] },
        columnStyles: {
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
        },
      });

      doc.save(`tradot-payouts-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    }
    setExporting(null);
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Reports & Export</h1>
          <p className="page-subtitle">Filter payouts and export as PDF or CSV</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button id="export-csv-btn" onClick={exportCSV} disabled={!!exporting || filteredPayouts.length === 0} className="btn btn-secondary">
            <Table2 size={16} /> {exporting === 'csv' ? 'Exporting...' : 'Export CSV'}
          </button>
          <button id="export-pdf-btn" onClick={exportPDF} disabled={!!exporting || filteredPayouts.length === 0} className="btn btn-primary">
            <FileText size={16} /> {exporting === 'pdf' ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontWeight: 600, color: 'white', marginBottom: '20px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} color="#6366f1" /> Filters
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label className="form-label">Client</label>
            <select id="report-client" className="form-input" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
              <option value="all">All Clients</option>
              {(data?.clients || []).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select id="report-status" className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="waived">Waived</option>
            </select>
          </div>
          <div>
            <label className="form-label">Due Date From</label>
            <input id="report-from" className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Due Date To</label>
            <input id="report-to" className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Expected', value: formatCurrency(summaryStats.totalExpected), color: 'white' },
          { label: 'Total Paid', value: formatCurrency(summaryStats.totalPaid), color: '#10b981' },
          { label: 'Balance Due', value: formatCurrency(summaryStats.totalBalance), color: '#f59e0b' },
          { label: 'Paid Records', value: String(summaryStats.paid), color: '#10b981' },
          { label: 'Overdue', value: String(summaryStats.overdue), color: '#f87171' },
          { label: 'Partial', value: String(summaryStats.partial), color: '#fbbf24' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Results count */}
      <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
        Showing {filteredPayouts.length} payout{filteredPayouts.length !== 1 ? 's' : ''}
      </div>

      {/* Table */}
      {loading ? (
        <div className="shimmer glass-card" style={{ height: '300px' }} />
      ) : filteredPayouts.length === 0 ? (
        <div className="empty-state glass-card" style={{ padding: '60px' }}>
          <Download size={48} color="rgba(255,255,255,0.15)" />
          <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.5)' }}>No records match your filters</p>
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
                <th>Payment Date</th>
                <th>Delay</th>
                <th>Mode</th>
                <th>Reference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayouts.map(p => {
                const balance = Math.max(0, p.expectedAmount - (p.paidAmount || 0));
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, color: '#a5b4fc' }}>{p.plan?.client?.name || '—'}</td>
                    <td style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>{p.plan?.planName || '—'}</td>
                    <td style={{ color: 'rgba(255,255,255,0.4)' }}>#{p.payoutNumber || '—'}</td>
                    <td>{formatDate(p.dueDate)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(p.expectedAmount)}</td>
                    <td style={{ color: (p.paidAmount || 0) > 0 ? '#10b981' : 'rgba(255,255,255,0.3)' }}>
                      {(p.paidAmount || 0) > 0 ? formatCurrency(p.paidAmount) : '—'}
                    </td>
                    <td style={{ color: balance > 0 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                      {balance > 0 ? formatCurrency(balance) : '✓'}
                    </td>
                    <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                      {p.paymentDate ? formatDate(p.paymentDate) : '—'}
                    </td>
                    <td style={{
                      fontSize: '0.85rem',
                      color: p.status === 'paid'
                        ? (calculateDelayDays(p.dueDate, p.paymentDate) > 0 ? '#fb923c' : '#34d399')
                        : (p.dueDate < today() ? '#f87171' : 'rgba(255,255,255,0.3)'),
                      fontWeight: 500
                    }}>
                      {p.status === 'paid'
                        ? (calculateDelayDays(p.dueDate, p.paymentDate) > 0 ? `${calculateDelayDays(p.dueDate, p.paymentDate)}d late` : 'On time')
                        : (p.dueDate < today() ? `${calculateDelayDays(p.dueDate, null)}d late` : '—')}
                    </td>
                    <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                      {p.modeOfPayment ? getPaymentModeLabel(p.modeOfPayment) : '—'}
                    </td>
                    <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>{p.referenceNo || '—'}</td>
                    <td><span className={`badge badge-${p.status}`}>{getPayoutStatusLabel(p.status)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
