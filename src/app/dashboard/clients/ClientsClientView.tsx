'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Users, Plus, Search, Phone, Mail, ArrowRight, Edit2, Trash2, X, AlertCircle, Upload, CheckCircle2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Client } from '@/types';
import Papa from 'papaparse';

interface ClientForm {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

interface ClientWithPlanStats extends Client {
  planCount: number;
  totalInvested: number;
}

const defaultForm: ClientForm = { name: '', phone: '', email: '', address: '', notes: '' };

export default function ClientsClientView({ initialClients }: { initialClients: ClientWithPlanStats[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [clients, setClients] = useState<ClientWithPlanStats[]>(initialClients);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Bulk CSV Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState<{
    clientsCreated: number;
    plansCreated: number;
    payoutsCreated: number;
    errors: string[];
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setImportError('');
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsedRows(results.data);
      },
      error: (err) => {
        setImportError(`Failed to parse CSV: ${err.message}`);
      }
    });
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedRows.length === 0) return;
    setImporting(true);
    setImportError('');
    setImportResult(null);

    try {
      const res = await api.post<{
        success: boolean;
        results: {
          clientsCreated: number;
          plansCreated: number;
          payoutsCreated: number;
          errors: string[];
        }
      }>('/api/clients/bulk', { rows: parsedRows });

      if (res.success) {
        setImportResult(res.results);
        startTransition(() => {
          router.refresh();
        });
      } else {
        setImportError('Import failed');
      }
    } catch (err: any) {
      setImportError(err.message || 'Server error occurred during import.');
    } finally {
      setImporting(false);
    }
  };

  // Keep state synchronized with server data changes
  useEffect(() => {
    setClients(initialClients);
  }, [initialClients]);

  const openAdd = () => { setEditClient(null); setForm(defaultForm); setError(''); setShowModal(true); };
  const openEdit = (c: Client) => {
    setEditClient(c);
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', notes: c.notes || '' });
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editClient) {
        await api.put(`/api/clients/${editClient.id}`, form);
      } else {
        await api.post('/api/clients', form);
      }
      setShowModal(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save client');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/clients/${id}`);
      setDeleteId(null);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error('Failed to delete client', err);
    }
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">{clients.length} client{clients.length !== 1 ? 's' : ''} registered</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => { setShowImportModal(true); setCsvFile(null); setParsedRows([]); setImportResult(null); setImportError(''); }} className="btn btn-secondary" style={{ opacity: isPending ? 0.7 : 1 }}>
            <Upload size={16} /> Bulk Import CSV
          </button>
          <button id="add-client-btn" onClick={openAdd} className="btn btn-primary" style={{ opacity: isPending ? 0.7 : 1 }}>
            <Plus size={18} /> Add Client
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '24px', maxWidth: '420px' }}>
        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
        <input
          id="client-search"
          className="form-input"
          style={{ paddingLeft: '42px' }}
          placeholder="Search by name, phone, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="empty-state glass-card" style={{ padding: '60px' }}>
          <Users size={48} color="rgba(255,255,255,0.15)" />
          <p style={{ marginTop: '16px', fontSize: '1rem', color: 'rgba(255,255,255,0.5)' }}>
            {search ? 'No clients match your search' : 'No clients yet'}
          </p>
          {!search && (
            <button onClick={openAdd} className="btn btn-primary" style={{ marginTop: '20px' }}>
              <Plus size={16} /> Add your first client
            </button>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Plans</th>
                <th>Total Invested</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr key={client.id} style={{ opacity: isPending ? 0.8 : 1 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.875rem', fontWeight: 700, color: 'white', flexShrink: 0,
                      }}>
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <Link href={`/dashboard/clients/${client.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ fontWeight: 600, color: 'white' }}>{client.name}</div>
                        {client.address && <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{client.address}</div>}
                      </Link>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                      {client.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={12} />{client.phone}</div>}
                      {client.email && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}><Mail size={12} />{client.email}</div>}
                      {!client.phone && !client.email && <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'white' }}>{client.planCount}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginLeft: '4px' }}>plan{client.planCount !== 1 ? 's' : ''}</span>
                  </td>
                  <td style={{ fontWeight: 600, color: '#10b981' }}>
                    {client.totalInvested > 0
                      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(client.totalInvested)
                      : '—'}
                  </td>
                  <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>{formatDate(client.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Link href={`/dashboard/clients/${client.id}`} className="btn btn-secondary btn-sm">
                        <ArrowRight size={14} />
                      </Link>
                      <button onClick={() => openEdit(client)} className="btn btn-secondary btn-sm">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleteId(client.id)} className="btn btn-danger btn-sm">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontWeight: 700, color: 'white', fontSize: '1.1rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {editClient ? 'Edit Client' : 'Add New Client'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} style={{ padding: '20px 24px 24px' }}>
              {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}><AlertCircle size={16} />{error}</div>}

              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label className="form-label">Full Name *</label>
                  <input id="client-name" className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Ramesh Kumar" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Phone</label>
                    <input id="client-phone" className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" />
                  </div>
                  <div>
                    <label className="form-label">Email</label>
                    <input id="client-email" className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Address</label>
                  <input id="client-address" className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="City, State" />
                </div>
                <div>
                  <label className="form-label">Notes</label>
                  <textarea
                    id="client-notes"
                    className="form-input"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Any notes about this client..."
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button id="save-client-btn" type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving...' : editClient ? 'Save Changes' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '28px', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Trash2 size={24} color="#f87171" />
              </div>
              <h3 style={{ color: 'white', fontWeight: 700, marginBottom: '8px' }}>Delete Client?</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginBottom: '24px' }}>
                This will permanently delete the client and all their plans and payout history.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button onClick={() => setDeleteId(null)} className="btn btn-secondary">Cancel</button>
                <button onClick={() => handleDelete(deleteId)} className="btn btn-danger">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" style={{ maxWidth: '750px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontWeight: 700, color: 'white', fontSize: '1.1rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Bulk Import Clients & Plans
              </h2>
              <button onClick={() => setShowImportModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: '20px 24px 24px' }}>
              {!importResult ? (
                <form onSubmit={handleImportSubmit}>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: '16px' }}>
                    Upload a CSV file containing columns for client registration and optional payout plans. 
                    If client names match existing records (case-insensitive), their details will be updated and plans appended.
                  </p>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                    <strong>Expected CSV Columns:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: '6px', fontFamily: 'monospace' }}>
                      <span>client_name *</span>
                      <span>client_phone</span>
                      <span>client_email</span>
                      <span>client_address</span>
                      <span>plan_name</span>
                      <span>principal_amount</span>
                      <span>payout_frequency</span>
                      <span>payout_percentage</span>
                      <span>payout_amount</span>
                      <span>start_date</span>
                      <span>duration_months</span>
                      <span>payment_mode</span>
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                        border: '2px dashed rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.01)',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <Upload size={28} color="rgba(255,255,255,0.4)" style={{ marginBottom: '10px' }} />
                      <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                        {csvFile ? csvFile.name : 'Click to select CSV file'}
                      </span>
                      {csvFile && (
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                          ({parsedRows.length} rows parsed)
                        </span>
                      )}
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        required
                      />
                    </label>
                  </div>

                  {importError && (
                    <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
                      <AlertCircle size={16} />
                      <span>{importError}</span>
                    </div>
                  )}

                  {parsedRows.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Data Preview (First 5 Rows)</label>
                      <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        <table style={{ fontSize: '0.75rem' }}>
                          <thead>
                            <tr>
                              <th>Client Name</th>
                              <th>Phone</th>
                              <th>Plan</th>
                              <th>Principal</th>
                              <th>Start Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedRows.slice(0, 5).map((row, idx) => (
                              <tr key={idx}>
                                <td style={{ fontWeight: 600 }}>{row.client_name || row.clientName || row.name || '—'}</td>
                                <td>{row.client_phone || row.clientPhone || row.phone || '—'}</td>
                                <td>{row.plan_name || row.planName || '—'}</td>
                                <td>{row.principal_amount || row.principalAmount || row.principal || '—'}</td>
                                <td>{row.start_date || row.startDate || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setShowImportModal(false)} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={importing || parsedRows.length === 0}>
                      {importing ? 'Importing...' : `Import ${parsedRows.length} Records`}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <CheckCircle2 size={32} color="#34d399" />
                  </div>
                  <h3 style={{ color: 'white', fontWeight: 700, fontSize: '1.2rem', marginBottom: '8px' }}>Import Complete!</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '20px' }}>
                    CSV file has been processed successfully. Here is the summary:
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', maxWidth: '480px', margin: '0 auto 24px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#6366f1' }}>{importResult.clientsCreated}</div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Clients Added</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{importResult.plansCreated}</div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Plans Created</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24' }}>{importResult.payoutsCreated}</div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Payouts Scheduled</div>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                      <label className="form-label" style={{ fontWeight: 600, color: '#ef4444' }}>Warnings / Skipped Rows ({importResult.errors.length})</label>
                      <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', padding: '12px 16px', maxHeight: '150px', overflowY: 'auto', fontSize: '0.75rem', color: '#fca5a5', lineHeight: 1.5 }}>
                        {importResult.errors.map((err, i) => (
                          <div key={i} style={{ marginBottom: '4px' }}>⚠️ {err}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={() => { setShowImportModal(false); setCsvFile(null); setParsedRows([]); setImportResult(null); }} className="btn btn-primary" style={{ minWidth: '120px' }}>
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
