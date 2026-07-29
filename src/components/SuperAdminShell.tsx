import { type ReactNode, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, CreditCard, Ticket, Trophy, ScrollText, Megaphone, ShieldCheck, LogOut, Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import { classNames } from '../lib/utils';
import { Avatar } from './ui';

const NAV = [
  { to: '/super-admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/super-admin/tenants', label: 'Tenants', icon: Building2 },
  { to: '/super-admin/plans', label: 'Forfaits', icon: CreditCard },
  { to: '/super-admin/codes', label: 'Codes commerciaux', icon: Ticket },
  { to: '/super-admin/tracking', label: 'Tracking', icon: Trophy },
  { to: '/super-admin/audit', label: 'Journal d\'audit', icon: ScrollText },
  { to: '/super-admin/announcements', label: 'Annonces', icon: Megaphone },
  { to: '/super-admin/team', label: 'Équipe Super Admin', icon: ShieldCheck },
];

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { t } = useLanguage();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => { document.title = 'Super Admin · CRM-One'; }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-gray-100 bg-gradient-to-b from-coral-50/60 to-mint-50/40 transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between px-4">
          <Logo size="md" />
          <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 lg:hidden"><X size={18} /></button>
        </div>
        <div className="px-3 pb-2">
          <div className="rounded-xl bg-coral-50 px-3 py-2 text-xs"><p className="font-semibold text-coral-700">Super Admin</p><p className="text-coral-600/80">LiAfrik — Dubaï & Yaoundé</p></div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => classNames('sidebar-link', isActive && 'sidebar-link-active')}>
              <n.icon size={18} /><span className="flex-1">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-gray-100 p-3">
          <button onClick={() => { signOut(); nav('/'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut size={15} /> {t('nav.logout')}</button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-gray-900/30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-gray-100 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"><Menu size={18} /></button>
            <h1 className="text-sm font-semibold text-gray-900">Espace Super Admin · LiAfrik — Dubaï & Yaoundé</h1>
          </div>
          <div className="flex items-center gap-2"><LanguageSelector /><Avatar name={profile?.full_name || profile?.email} size={32} color="orange" /><span className="hidden text-sm text-gray-600 sm:inline">{profile?.email}</span></div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
