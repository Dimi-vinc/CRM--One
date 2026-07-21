import { useEffect, useMemo, useState } from 'react';
import { Building2, Users, DollarSign, TrendingUp, Globe2, Filter, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { PageHeader, Card, Button, Badge, Select, Skeleton } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { COUNTRIES, COUNTRY_BY_CODE, PLAN_BY_ID, PLANS } from '../../lib/constants';
import { formatMoney as fmt, formatDate, convertToUsd, downloadCsv, COLOR_RAMPS } from '../../lib/utils';
import type { Tenant, Profile, SalesTracking } from '../../lib/types';

export function SuperAdminDashboard() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sales, setSales] = useState<SalesTracking[]>([]);
  const [countryFilter, setCountryFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const [t, p, st] = await Promise.all([
        supabase.from('tenants').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('sales_tracking').select('*'),
      ]);
      setTenants(t.data || []); setProfiles(p.data || []); setSales(st.data || []);
      setLoading(false);
    })();
  }, []);

  const filteredTenants = useMemo(() => tenants.filter(t => countryFilter === 'all' || t.country_code === countryFilter), [tenants, countryFilter]);

  const mrrUsd = useMemo(() => {
    return filteredTenants.reduce((sum, t) => {
      const plan = PLAN_BY_ID[t.plan_id];
      return sum + (plan ? convertToUsd(plan.price, plan.currency) : 0);
    }, 0);
  }, [filteredTenants]);

  const byPlan = PLANS.map(p => ({ ...p, count: filteredTenants.filter(t => t.plan_id === p.id).length }));
  const byCountry = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTenants.forEach(t => { map[t.country_code] = (map[t.country_code] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [filteredTenants]);

  const totalUsers = profiles.filter(p => p.tenant_id && filteredTenants.some(t => t.id === p.tenant_id)).length;
  const totalSales = sales.reduce((s, x) => s + convertToUsd(Number(x.amount || 0), x.currency), 0);

  const cards = [
    { l: t('sa.tenants'), v: String(filteredTenants.length), i: Building2, c: 'blue' as const },
    { l: t('sa.users'), v: String(totalUsers), i: Users, c: 'teal' as const },
    { l: t('sa.mrr'), v: fmt(mrrUsd, 'USD'), i: DollarSign, c: 'orange' as const },
    { l: t('sa.sales'), v: fmt(totalSales, 'USD'), i: TrendingUp, c: 'violet' as const },
  ];

  return (
    <div>
      <PageHeader title={`${t('sa.title')} — ${profile?.email}`} subtitle={t('sa.subtitle')} />

      <div className="mb-4 flex items-center gap-2">
        <Filter size={16} className="text-gray-400" />
        <Select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="w-56">
          <option value="all">{t('common.allCountries')}</option>
          {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </Select>
        <Button variant="secondary" onClick={() => {
          const rows: (string|number)[][] = [['Entreprise','Pays','Devise','Plan','Statut','Créé le']];
          filteredTenants.forEach(t => rows.push([t.name, t.country_code, t.currency_code, t.plan_id, t.status, formatDate(t.created_at)]));
          downloadCsv('tenants.csv', rows);
        }}><Download size={14} /> {t('common.exportCsv')}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-28" />) : cards.map(c => {
          const r = COLOR_RAMPS[c.c as keyof typeof COLOR_RAMPS]; const Icon = c.i;
          return (
            <Card key={c.l} edge={c.c as any} className="p-5">
              <div className="flex items-start justify-between">
                <div><p className="text-sm text-gray-500">{c.l}</p><p className="mt-1 text-2xl font-bold text-gray-900">{c.v}</p></div>
                <div className={`rounded-xl ${r.bg} ${r.text} p-2.5`}><Icon size={20} /></div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="text-base font-semibold text-gray-900">{t('sa.byPlan')}</h3>
          <div className="mt-4 space-y-2">
            {byPlan.map(p => {
              const max = Math.max(...byPlan.map(x => x.count), 1);
              return (
                <div key={p.id}>
                  <div className="flex justify-between text-sm"><span className="font-medium text-gray-700">{p.name}</span><span className="text-gray-900">{p.count}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full bg-coral-500" style={{ width: `${(p.count / max) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Globe2 size={16} className="text-mint-600" /> {t('sa.topCountries')}</h3>
          <div className="mt-3 space-y-2">
            {byCountry.map(([code, count]) => (
              <div key={code} className="flex justify-between text-sm"><span>{COUNTRY_BY_CODE[code]?.name || code}</span><Badge color="blue">{count}</Badge></div>
            ))}
            {byCountry.length === 0 && <p className="text-sm text-gray-400">{t('common.noData')}</p>}
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3"><h3 className="text-sm font-semibold text-gray-900">{t('sa.recentTenants')}</h3></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-2.5">{t('sa.company')}</th><th className="px-4 py-2.5">{t('common.country')}</th><th className="px-4 py-2.5">{t('common.plan')}</th><th className="px-4 py-2.5">{t('common.status')}</th><th className="px-4 py-2.5">{t('common.created')}</th></tr></thead>
          <tbody className="divide-y divide-gray-50">
            {filteredTenants.slice(0, 10).map(t => (
              <tr key={t.id} className="hover:bg-gray-50/60">
                <td className="px-4 py-2.5 font-medium text-gray-900">{t.name}</td>
                <td className="px-4 py-2.5 text-gray-600">{COUNTRY_BY_CODE[t.country_code]?.name || t.country_code}</td>
                <td className="px-4 py-2.5"><Badge color="orange">{PLAN_BY_ID[t.plan_id]?.name || t.plan_id}</Badge></td>
                <td className="px-4 py-2.5"><Badge color={t.status === 'active' ? 'green' : t.status === 'trial' ? 'orange' : 'red'}>{t.status}</Badge></td>
                <td className="px-4 py-2.5 text-gray-500">{formatDate(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
