import { type ComponentType, type ReactNode, useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { ChevronDown, LogOut, Settings, Crown, Menu, X, Bell, Search, Building2 } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';
import { MODULES, type ModuleDef, planIncludes, type ModuleKey, PLAN_BY_ID } from '../lib/constants';
import { classNames, daysUntil } from '../lib/utils';
import { hasModuleAccess } from '../lib/permissions';
import { Avatar } from './ui';
import { supabase } from '../lib/supabase';
import type { Announcement } from '../lib/types';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from './LanguageSelector';

type LucideIconComponent = ComponentType<{ size?: number | string }>; 

function LucIcon({ name, size = 18 }: { name: string; size?: number }) {
  const C = (Icons as unknown as Record<string, LucideIconComponent>)[name] || Icons.Circle;
  return <C size={size} />;
}

const ALWAYS_VISIBLE: ModuleKey[] = ['dashboard', 'settings', 'security', 'privacy', 'notifications'];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, tenant, permissions, signOut } = useAuth();
  const { t } = useLanguage();
  const nav = useNavigate();
  const [openSidebar, setOpenSidebar] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [unread, setUnread] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

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

  // Modules that are personal/universal — always visible regardless of a custom role's granted
  // business-module permissions (they don't touch tenant data access).

  const visibleModules: ModuleDef[] = useMemo(() => {
    if (isSuperAdmin) return MODULES.filter(m => m.key === 'dashboard');
    return MODULES.filter(m => {
      if (m.key === 'super_admin') return false;
      if (m.key === 'admin' || m.key === 'developers') return profile?.role === 'admin'; // Espace Admin, API & Webhooks : tenant admins only
      if (ALWAYS_VISIBLE.includes(m.key)) return true;
      // Real enforcement: a 'custom' role user only sees modules their assigned role grants
      // 'view' on. admin/super_admin already returned true above or are handled elsewhere.
      return hasModuleAccess(profile, permissions, m.key, 'view');
    });
  }, [isSuperAdmin, profile, permissions]);

  // Super Admin entry: visible in sidebar only for super_admin role
  const showSuperAdmin = isSuperAdmin;

  const grouped = useMemo(() => {
    const groups: Record<string, ModuleDef[]> = { crm: [], insights: [], system: [], admin: [] };
    visibleModules.forEach(m => groups[m.group].push(m));
    return groups;
  }, [visibleModules]);

  const link = (m: ModuleDef) => {
    const included = isSuperAdmin || planIncludes(planId, m.key);
    const upgrade = !included ? `${t('common.unlock')} ${PLAN_BY_ID[upgradePlanFor(m.key)]?.name || 'Premium'}` : null;
    const label = t(`mod.${m.key}`) !== `mod.${m.key}` ? t(`mod.${m.key}`) : m.label;
    return (
      <NavLink
        key={m.key}
        to={routeFor(m.key)}
        className={({ isActive }) => classNames('sidebar-link', isActive && 'sidebar-link-active')}
      >
        <LucIcon name={m.icon} />
        <span className="flex-1">{label}</span>
        {upgrade && <span className="rounded-full bg-coral-100 px-1.5 py-0.5 text-[9px] font-semibold text-coral-700">{upgrade}</span>}
      </NavLink>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-gray-100 bg-gradient-to-b from-mint-50/80 to-white transition-transform lg:static lg:translate-x-0 ${openSidebar ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between border-b border-gray-100/60 px-4">
          <Logo size="md" />
          <button onClick={() => setOpenSidebar(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 lg:hidden"><X size={18} /></button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {['crm', 'insights', 'system', 'admin'].map(group => (
            grouped[group].length > 0 && (
              <div key={group}>
                <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{groupLabel(group, t)}</p>
                <div className="space-y-0.5">{grouped[group].map(link)}</div>
              </div>
            )
          ))}
          {showSuperAdmin && (
            <div className="mt-3">
              <div className="mb-1.5 h-px bg-gradient-to-r from-transparent via-red-200 to-transparent" />
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-red-500">{t('group.admin')}</p>
              <div className="rounded-xl border border-red-100 bg-gradient-to-br from-red-50/80 to-red-50/30 p-1.5">
                <NavLink to="/super-admin" className={({ isActive }) => classNames('sidebar-link', isActive && 'sidebar-link-active', 'border-l-2 border-red-400 bg-red-100/50')}>
                  <Crown size={18} className="text-red-500" />
                  <span className="flex-1 font-semibold text-red-700">{t('mod.super_admin')}</span>
                </NavLink>
              </div>
            </div>
          )}
        </nav>
        <div className="border-t border-gray-100/60 p-3">
          <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100/80">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint-100 text-mint-700">
                <Building2 size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-gray-900">{tenant?.name || (isSuperAdmin ? 'Super Admin' : '—')}</p>
                <p className="truncate text-[11px] text-gray-500">{t('common.plan')} {PLAN_BY_ID[planId]?.name || '—'}</p>
              </div>
            </div>
            {trialDaysLeft !== null && trialDaysLeft >= 0 && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-coral-50 px-2 py-1">
                <Icons.Timer size={12} className="text-coral-600" />
                <span className="text-[11px] font-medium text-coral-700">{t('common.trial')}: {trialDaysLeft}{t('common.daysLeft')}</span>
              </div>
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
              <input placeholder={t('nav.search')} className="w-64 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm outline-none focus:border-coral-400 focus:bg-white" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {trialDaysLeft !== null && trialDaysLeft >= 0 && trialDaysLeft <= 7 && (
              <button onClick={() => nav('/billing')} className="hidden items-center gap-2 rounded-full bg-coral-50 px-3 py-1.5 text-xs font-medium text-coral-700 hover:bg-coral-100 sm:flex">
                <Icons.Timer size={14} /> {t('common.trial')}: {trialDaysLeft}{t('common.daysLeft')}
              </button>
            )}
            <LanguageSelector />
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
                    <button onClick={() => { setUserMenu(false); nav('/security'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"><Settings size={15} /> {t('nav.security')}</button>
                    {isSuperAdmin && <button onClick={() => { setUserMenu(false); nav('/super-admin'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"><Crown size={15} /> {t('nav.superAdmin')}</button>}
                    <button onClick={() => { signOut(); nav('/'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut size={15} /> {t('nav.logout')}</button>
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

function groupLabel(g: string, t: (k: string) => string) {
  return { crm: t('group.crm'), insights: t('group.insights'), system: t('group.system'), admin: t('group.admin') }[g] || g;
}

const ROUTE_OVERRIDES: Partial<Record<ModuleKey, string>> = {
  dashboard: '/dashboard',
  privacy: '/data-privacy', // avoid collision with the public /privacy legal policy page
  quotes_invoices: '/quotes-invoices',
  knowledge_base: '/knowledge-base',
  web_forms: '/web-forms',
};

function routeFor(key: ModuleKey): string {
  return ROUTE_OVERRIDES[key] || `/${key}`;
}

function upgradePlanFor(key: ModuleKey): 'starter' | 'pro' | 'premium' | 'entreprise' {
  const m = MODULES.find(x => x.key === key);
  return m?.minPlan || 'premium';
}
