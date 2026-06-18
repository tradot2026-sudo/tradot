'use client';

import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Eye, EyeOff, Lock, Mail, AlertCircle, UserPlus } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (status === 'authenticated') router.push('/dashboard');
  }, [status, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      setSuccess('Account created! Signing you in...');
      await signIn('credentials', { email, password, redirect: false });
      router.push('/dashboard');
    } catch {
      setError('Registration failed. Please try again.');
      setLoading(false);
    }
  };

  if (status === 'loading') return null;

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1426 50%, #0a0f1e 100%)' }}>
      {/* Left decorative panel */}
      <div
        className="hidden lg:flex flex-col w-[45%]"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '80px 64px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '64px', width: '100%', maxWidth: '420px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={20} color="white" />
            </div>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '1.25rem', color: 'white' }}>Tradot</span>
          </div>

          <div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '2.5rem', fontWeight: 800, color: 'white', lineHeight: 1.2, marginBottom: '20px' }}>
              Manage your<br />
              <span style={{ background: 'linear-gradient(135deg, #a5b4fc, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                investment payouts
              </span><br />
              with ease.
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
              Track client investments, schedule payouts, monitor due dates, and export reports — all in one place.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '32px' }}>
            {[
              { label: 'Payout Tracking', value: '100%' },
              { label: 'Auto-Schedules', value: '∞' },
              { label: 'Report Exports', value: 'PDF & CSV' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#a5b4fc' }}>{item.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {/* Mobile logo */}
          <div className="lg:hidden" style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-start', marginBottom: '32px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={20} color="white" />
            </div>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '1.25rem', color: 'white' }}>Tradot</span>
          </div>

          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1.75rem', fontWeight: 800, color: 'white', marginBottom: '8px' }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '32px', fontSize: '0.9rem' }}>
            {mode === 'login' ? 'Sign in to your Tradot account' : 'Set up your Tradot admin account'}
          </p>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
              <AlertCircle size={16} /><span>{error}</span>
            </div>
          )}
          {success && (
            <div className="alert alert-success" style={{ marginBottom: '20px' }}>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
            {mode === 'register' && (
              <div style={{ marginBottom: '18px' }}>
                <label className="form-label">Your Name</label>
                <input id="name" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Manu Raj" />
              </div>
            )}

            <div style={{ marginBottom: '18px' }}>
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input id="email" type="email" className="form-input" style={{ paddingLeft: '42px' }} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input id="password" type={showPassword ? 'text' : 'password'} className="form-input" style={{ paddingLeft: '42px', paddingRight: '42px' }} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button id="submit-btn" type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '0.95rem' }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg style={{ animation: 'spin 1s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.3" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            {mode === 'login' ? (
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
                First time?{' '}
                <button onClick={() => { setMode('register'); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a5b4fc', fontWeight: 600 }}>
                  Create an account
                </button>
              </p>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
                Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a5b4fc', fontWeight: 600 }}>
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
