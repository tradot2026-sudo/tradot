'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings, Database, Download, Upload, Trash2,
  AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw, Lock
} from 'lucide-react';
import { api } from '@/lib/api';

interface StorageStats {
  databaseSizeBytes: number;
  freeTierLimitBytes: number;
  usedPercentage: number;
  isMock: boolean;
  counts: {
    clients: number;
    plans: number;
    payouts: number;
  };
}

export default function SettingsClientView({
  initialCounts
}: {
  initialCounts: { clients: number; plans: number; payouts: number }
}) {
  const router = useRouter();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Backup & Restore State
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Clear Data Modal State
  const [showClearModal, setShowClearModal] = useState(false);
  const [password, setPassword] = useState('');
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  // WhatsApp Templates State
  const [whatsappTemplatePaid, setWhatsappTemplatePaid] = useState('');
  const [whatsappTemplateReminder, setWhatsappTemplateReminder] = useState('');
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [templateStatus, setTemplateStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await api.get<StorageStats>('/api/settings/storage-stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch storage stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get<{ whatsappTemplatePaid: string | null; whatsappTemplateReminder: string | null }>('/api/settings/templates');
      setWhatsappTemplatePaid(res.whatsappTemplatePaid || '');
      setWhatsappTemplateReminder(res.whatsappTemplateReminder || '');
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      await Promise.resolve();
      if (!active) return;
      fetchStats();
      fetchTemplates();
    };
    load();
    return () => {
      active = false;
    };
  }, [fetchStats, fetchTemplates]);

  const handleSaveTemplates = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTemplates(true);
    setTemplateStatus(null);
    try {
      await api.post('/api/settings/templates', {
        whatsappTemplatePaid: whatsappTemplatePaid || null,
        whatsappTemplateReminder: whatsappTemplateReminder || null,
      });
      setTemplateStatus({ type: 'success', message: 'WhatsApp templates updated successfully!' });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to update templates.';
      setTemplateStatus({ type: 'error', message: errMsg });
    } finally {
      setSavingTemplates(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await api.get<any>('/api/settings/export-data');
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `tradot_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Failed to export backup:', err);
      alert('Failed to export backup data.');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.app || !json.data) {
          throw new Error('Invalid Tradot backup file format');
        }

        const res = await api.post<{
          message: string;
          clientsImported: number;
          plansImported: number;
          payoutsImported: number;
        }>('/api/settings/import-data', json);

        setImportStatus({
          type: 'success',
          message: `Backup restored successfully! Imported ${res.clientsImported} clients, ${res.plansImported} plans, and ${res.payoutsImported} payouts.`,
        });
        fetchStats();
        router.refresh();
      } catch (err: any) {
        setImportStatus({
          type: 'error',
          message: err.message || 'Failed to parse or restore backup file.',
        });
      } finally {
        setImporting(false);
        // Reset file input
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setClearError('Password is required');
      return;
    }

    setClearing(true);
    setClearError(null);

    try {
      await api.post('/api/settings/clear-data', { password });
      setShowClearModal(false);
      setPassword('');
      alert('All your data has been cleared successfully.');
      fetchStats();
      router.refresh();
    } catch (err: any) {
      setClearError(err.message || 'Incorrect password or server error.');
    } finally {
      setClearing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const currentCounts = stats?.counts || initialCounts;

  return (
    <div style={{ padding: '32px', maxWidth: '1000px' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: 0, marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Settings size={20} color="white" />
          </div>
          <h1 className="page-title">Settings</h1>
        </div>
        <p className="page-subtitle">
          Manage database backups, restore data, and monitor account storage usage
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        {/* Storage Analyser */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: 'white', fontSize: '1rem' }}>
              <Database size={18} color="#6366f1" /> Supabase Storage Analyser
            </h3>
            <button
              onClick={fetchStats}
              disabled={loadingStats}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem',
              }}
            >
              <RefreshCw size={12} className={loadingStats ? 'spin-anim' : ''} /> Refresh
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'center' }} className="responsive-grid">
            {/* Visual Gauge */}
            <div style={{ padding: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Database Usage</span>
                <span style={{ fontWeight: 600, color: '#a5b4fc' }}>
                  {stats ? `${stats.usedPercentage}%` : 'Calculating...'}
                </span>
              </div>
              <div className="progress-bar" style={{ height: '8px', background: 'rgba(255,255,255,0.05)' }}>
                <div
                  className="progress-fill"
                  style={{
                    width: stats ? `${stats.usedPercentage}%` : '0%',
                    background: stats && stats.usedPercentage > 80 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'linear-gradient(90deg, #6366f1, #3b82f6)',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                <span>{stats ? formatSize(stats.databaseSizeBytes) : '-'} used</span>
                <span>{stats ? formatSize(stats.freeTierLimitBytes) : '-'} limit (Free Tier)</span>
              </div>
            </div>

            {/* Table Row breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>Clients</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>{currentCounts.clients}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>Plans</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>{currentCounts.plans}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>Payouts</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>{currentCounts.payouts}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Data Backup & Restore */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: 'white', fontSize: '1rem', marginBottom: '20px' }}>
            <Download size={18} color="#10b981" /> Data Export & Import
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="responsive-grid">
            {/* Export */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white', marginBottom: '6px' }}>Export Backup File</h4>
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: '16px' }}>
                  Download a full backup of all your clients, plans, and payouts to a JSON file. Use this file to restore your portfolio state later or transfer it to another account.
                </p>
              </div>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="btn btn-primary"
                style={{ width: 'fit-content' }}
              >
                {exporting ? (
                  <>
                    <RefreshCw size={16} className="spin-anim" /> Generating Backup...
                  </>
                ) : (
                  <>
                    <Download size={16} /> Export Backup JSON
                  </>
                )}
              </button>
            </div>

            {/* Import */}
            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '24px' }} className="import-box-border">
              <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white', marginBottom: '6px' }}>Import Backup File</h4>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: '16px' }}>
                Upload a previously exported Tradot `.json` backup file. The system will automatically map records and link them safely under your current session.
              </p>

              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                  border: '2px dashed rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.01)',
                  cursor: importing ? 'not-allowed' : 'pointer',
                  transition: 'border-color 0.2s',
                  textAlign: 'center',
                }}
                onMouseEnter={e => {
                  if (!importing) e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                <Upload size={24} color="rgba(255,255,255,0.3)" style={{ marginBottom: '8px' }} />
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                  {importing ? 'Restoring backup...' : 'Click to select JSON backup file'}
                </span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  disabled={importing}
                  style={{ display: 'none' }}
                />
              </label>

              {importStatus && (
                <div
                  className={`alert ${importStatus.type === 'success' ? 'alert-success' : 'alert-danger'}`}
                  style={{ marginTop: '14px', padding: '8px 12px', fontSize: '0.75rem', gap: '8px' }}
                >
                  {importStatus.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  <span>{importStatus.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* WhatsApp Notification Templates */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: 'white', fontSize: '1rem', marginBottom: '20px' }}>
            <Settings size={18} color="#25D366" /> WhatsApp Notification Templates
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: '20px' }}>
            Customize the default messages sent to clients. Leave templates blank to use the system default messages.
          </p>

          <form onSubmit={handleSaveTemplates}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '20px' }} className="responsive-grid">
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Due / Overdue Payout Reminder</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '140px', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.4 }}
                  value={whatsappTemplateReminder}
                  onChange={e => setWhatsappTemplateReminder(e.target.value)}
                  placeholder="Hello {client_name},&#10;&#10;This is a friendly reminder that a payout of {payout_amount} for your investment '{plan_name}' is scheduled for {due_date}.&#10;&#10;Thank you,&#10;- Tradot"
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Payment Receipt / Confirmation</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '140px', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.4 }}
                  value={whatsappTemplatePaid}
                  onChange={e => setWhatsappTemplatePaid(e.target.value)}
                  placeholder="Hello {client_name},&#10;&#10;We have successfully processed your payout of {payout_amount} for the investment '{plan_name}'.&#10;&#10;Transaction Details:&#10;- Date: {payment_date}&#10;- Mode: {payment_mode}&#10;- Ref No: {reference_no}&#10;&#10;Thank you!&#10;- Tradot"
                />
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '18px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
              <strong style={{ color: 'rgba(255,255,255,0.7)' }}>💡 Placeholders available:</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', marginTop: '6px' }}>
                <code>{`{client_name}`}</code>
                <code>{`{plan_name}`}</code>
                <code>{`{payout_amount}`}</code>
                <code>{`{due_date}`}</code>
                <code>{`{payout_number}`}</code>
                <code>{`{payment_date}`}</code>
                <code>{`{payment_mode}`}</code>
                <code>{`{reference_no}`}</code>
              </div>
            </div>

            {templateStatus && (
              <div
                className={`alert ${templateStatus.type === 'success' ? 'alert-success' : 'alert-danger'}`}
                style={{ marginBottom: '16px', padding: '8px 12px', fontSize: '0.75rem', gap: '8px' }}
              >
                {templateStatus.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                <span>{templateStatus.message}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={savingTemplates} style={{ background: '#25D366', borderColor: '#22c35e' }}>
              {savingTemplates ? 'Saving...' : 'Save Templates'}
            </button>
          </form>
        </div>

        {/* Danger Zone */}
        <div className="glass-card" style={{ padding: '24px', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.02)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: '#f87171', fontSize: '1rem', marginBottom: '10px' }}>
            <Trash2 size={18} color="#ef4444" /> Danger Zone
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: '20px' }}>
            Wipe all Clients, Plans, and Payout data associated with this account. This action is irreversible. It is highly recommended to export a backup file first.
          </p>

          <button
            onClick={() => {
              setClearError(null);
              setPassword('');
              setShowClearModal(true);
            }}
            className="btn btn-danger"
          >
            <Trash2 size={16} /> Clear All Data
          </button>
        </div>
      </div>

      {/* Clear Data Confirmation Modal */}
      {showClearModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#f87171' }}>
                <ShieldAlert size={24} />
                <h3 style={{ fontWeight: 700, fontSize: '1.2rem', color: 'white' }}>Clear All Account Data</h3>
              </div>
            </div>

            <form onSubmit={handleClearData}>
              <div style={{ padding: '24px 28px' }}>
                <div
                  className="alert alert-danger"
                  style={{
                    marginBottom: '20px',
                    fontSize: '0.8rem',
                    background: 'rgba(239,68,68,0.08)',
                    borderColor: 'rgba(239,68,68,0.2)',
                  }}
                >
                  <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                  <span>
                    This will delete all of your records permanently. Your account configuration and login credentials will remain intact, but all portfolio data will be wiped out.
                  </span>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={13} /> Confirm Account Password
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your account password to verify"
                    disabled={clearing}
                    required
                  />
                </div>

                {clearError && (
                  <div className="alert alert-danger" style={{ padding: '8px 12px', fontSize: '0.75rem', gap: '8px' }}>
                    <AlertTriangle size={14} />
                    <span>{clearError}</span>
                  </div>
                )}
              </div>

              <div style={{ padding: '16px 28px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowClearModal(false)}
                  className="btn btn-secondary"
                  disabled={clearing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={clearing}
                >
                  {clearing ? (
                    <>
                      <RefreshCw size={16} className="spin-anim" /> Clearing...
                    </>
                  ) : (
                    <>
                      Wipe All Data
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Responsive Styles & Animation keyframes */}
      <style>{`
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .responsive-grid {
            grid-template-columns: 1fr !important;
          }
          .import-box-border {
            border-left: none !important;
            padding-left: 0 !important;
            border-top: 1px solid rgba(255,255,255,0.06);
            padding-top: 24px;
            margin-top: 12px;
          }
        }
      `}</style>
    </div>
  );
}
