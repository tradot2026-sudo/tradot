'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard, Users, CreditCard, BarChart3,
  TrendingUp, LogOut, Menu, ChevronRight, Wallet, Settings
} from 'lucide-react';

const navItems = [
  { href: '/dashboard/fund-tracker', label: 'Fund Tracker', icon: Wallet },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
  { href: '/dashboard/payouts', label: 'Payouts', icon: CreditCard },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => signOut({ callbackUrl: '/login' });

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={18} color="white" />
          </div>
          <div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>Tradot</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: '1px' }}>Investment Tracker</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '16px 12px', flex: 1 }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 8px', marginBottom: '8px' }}>
          Main Menu
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`sidebar-nav-item ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <Icon size={18} />
              <span>{item.label}</span>
              {isActive && <ChevronRight size={14} style={{ marginLeft: 'auto', color: '#6366f1' }} />}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {session?.user && (
          <div style={{ padding: '8px 16px', marginBottom: '4px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.user.name || session.user.email}
          </div>
        )}
        <button onClick={handleLogout} className="sidebar-nav-item" style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}>
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop Sidebar */}
      <div className="sidebar">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setSidebarOpen(false)}>
          <div style={{ width: '260px', height: '100%', background: 'rgba(13,20,38,0.98)', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="main-content" style={{ flex: 1 }}>
        {/* Mobile topbar */}
        <div style={{ display: 'none', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(13,20,38,0.95)', position: 'sticky', top: 0, zIndex: 30, alignItems: 'center', justifyContent: 'space-between' }} className="mobile-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}>
              <Menu size={22} />
            </button>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: 'white' }}>Tradot</span>
          </div>
        </div>
        <style>{`@media (max-width: 768px) { .mobile-topbar { display: flex !important; } }`}</style>
        {children}
      </div>
    </div>
  );
}
