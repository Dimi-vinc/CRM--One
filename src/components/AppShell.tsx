import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { ChevronDown, LogOut, Settings, Crown, Menu, X, Bell, Search } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';
import { MODULES, type ModuleDef, planIncludes, type ModuleKey, PLATFORM_NAME, PLAN_BY_ID, formatMoney } from '../lib/constants';
import { classNames, daysUntil, COLOR_RAMPS } from '../lib/utils';
import { Avatar } from './ui';
import { supabase } from '../lib/supabase';

function LucIcon({ name, size = 18 }: { name: string; size?: number }) {
  const C = (Icons as any)[name] || Icons.Circle;
  return <C size={size} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, tenant, signOut } = useAuth();
  const nav = useNavigate();
  const [openSidebar, setOpenSidebar] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [unread, setUnread] = useState(0);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  const planId = tenant?.plan_id || 'starter';
  const trialDaysLeft = tenant?.trial_ends_at ? daysUntil(tenant.trial_ends_at) : null;
  const isSuperAdmin = profile?.role === 'super_admin';

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('read', false).eq('user_id', profile?.id);
      setUnread(count || 0);
      const { data: ann } = await supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3);
      setAnnouncements(ann || []);
    })();
  }, [tenant, profile?.id]);

  const visibleModules: ModuleDef[] = useMemo(() => {
    if (isSuperAdmin) return MODULES.filter(m => m.key === 'super_admin' || m.key === 'dashboard');
    return MODULES.filter(m => m.key !== 'super_admin' && m.key !== 'admin');
  }, [isSuperAdmin]);

  const grouped = useMemo(() => {
    const groups: Record<string, ModuleDef[]> = { crm: [], insights: [], system: [], admin: [] };
    visibleModules.forEach(m => groups[m.group].push(m));
    return groups;
  }, [visibleModules]);

  const link = (m: ModuleDef) => {
    const included = isSuperAdmin || planIncludes(planId, m.key);
    const upgrade = !included ? `Débloquer avec ${PLAN_BY_ID[upgradePlanFor(m.key)]?.name || 'Premium'}` : null;
    return (
      <NavLink
        key={m.key}
        to={routeFor(m.key)}
        className={({ isActive }) => classNames('sidebar-link', isActive && 'sidebar-link-active')}
      >
        <LucIcon name={m.icon} />
        <span className="flex-1">{m.label}</span>
        {upgrade && <span className="rounded-full bg-coral-100 px-1.5 py-0.5 text-[9px] font-semibold text-coral-700">{upgrade}</span>}
      </NavLink>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-gray-100 bg-mint-50/60 transition-transform lg:static lg:translate-x-0 ${openSidebar ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between px-4">
          <Logo size="md" />
          <button onClick={() => setOpenSidebar(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 lg:hidden"><X size={18} /></button>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {['crm', 'insights', 'system', 'admin'].map(group => (
            grouped[group].length > 0 && (
              <div key={group}>
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{groupLabel(group)}</p>
                <div className="space-y-0.5">{grouped[group].map(link)}</div>
              </div>
            )
          ))}
        </nav>
        <div className="border-t border-gray-100 p-3">
          <div className="rounded-xl bg-white p-3 text-xs">
            <p className="font-semibold text-gray-900">{tenant?.name || 'Super Admin'}</p>
            <p className="mt-0.5 text-gray-500">Plan {PLAN_BY_ID[planId]?.name || '—'}</p>
            {trialDaysLeft !== null && trialDaysLeft >= 0 && (
              <p className="mt-1.5"><span className="badge bg-coral-50 text-coral-700">Essai : {trialDaysLeft}j restants</span></p>
            )}
          </div>
        </div>
      </aside>
      {openSidebar && <div className="fixed inset-0 z-30 bg-gray-900/30 lg:hidden" onClick={() => setOpenSidebar(false)} />}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-gray-100 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpenSidebar(true)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"><Menu size={18} /></button>
            <div className="relative hidden sm:block">
              <Search size={16} className="absolute left-3 top-3 text-gray-400" />
              <input placeholder="Rechercher…" className="w-64 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm outline-none focus:border-coral-400 focus:bg-white" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {trialDaysLeft !== null && trialDaysLeft >= 0 && trialDaysLeft <= 7 && (
              <button onClick={() => nav('/billing')} className="hidden items-center gap-2 rounded-full bg-coral-50 px-3 py-1.5 text-xs font-medium text-coral-700 hover:bg-coral-100 sm:flex">
                <Icons.Timer size={14} /> Essai : {trialDaysLeft}j
              </button>
            )}
            <button onClick={() => nav('/notifications')} className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <Bell size={18} />
              {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-coral-500" />}
            </button>
            <div className="relative">
              <button onClick={() => setUserMenu(v => !v)} className="flex items-center gap-2 rounded-lg p-1 hover:bg-gray-100">
                <Avatar name={profile?.full_name || profile?.email} size={32} />
                <ChevronDown size={14} className="text-gray-400" />
              </button>
              {userMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)} />
                  <div className="absolute right-0 top-12 z-20 w-56 rounded-xl border border-gray-100 bg-white p-1.5 shadow-cardHover">
                    <div className="border-b border-gray-100 px-3 py-2">
                      <p className="truncate text-sm font-medium text-gray-900">{profile?.full_name || profile?.email}</p>
                      <p className="truncate text-xs text-gray-500">{profile?.email}</p>
                    </div>
                    <button onClick={() => { setUserMenu(false); nav('/security'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"><Settings size={15} /> Sécurité</button>
                    {isSuperAdmin && <button onClick={() => { setUserMenu(false); nav('/super-admin'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"><Crown size={15} /> Super Admin</button>}
                    <button onClick={() => { signOut(); nav('/'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut size={15} /> Déconnexion</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {announcements.length > 0 && (
          <div className="border-b border-coral-100 bg-coral-50/60 px-4 py-2 sm:px-6">
            {announcements.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-xs text-coral-800">
                <Icons.Megaphone size={14} />
                <span className="font-medium">{a.title}:</span> <span>{a.body}</span>
              </div>
            ))}
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function groupLabel(g: string) {
  return { crm: 'CRM', insights: 'Analyses', system: 'Système', admin: 'Administration' }[g] || g;
}

function routeFor(key: ModuleKey): string {
  return key === 'dashboard' ? '/dashboard' : `/${key}`;
}

function upgradePlanFor(key: ModuleKey): 'starter' | 'pro' | 'premium' | 'entreprise' {
  const m = MODULES.find(x => x.key === key);
  return (m?.minPlan as any) || 'premium';
}
