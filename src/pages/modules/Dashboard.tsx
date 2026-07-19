import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Users, Building2, Trophy, Target, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Badge, Skeleton } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatMoney, formatDate, COLOR_RAMPS, type ColorKey } from '../../lib/utils';
import { DEAL_STAGES, PLAN_BY_ID } from '../../lib/constants';
import type { Deal, Task, Activity } from '../../lib/types';

export function Dashboard() {
  const { tenant, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      setLoading(true);
      const [d, t, a] = await Promise.all([
        supabase.from('deals').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('tasks').select('*').order('due_date', { ascending: true }).limit(5),
        supabase.from('activities').select('*').order('due_at', { ascending: true }).limit(5),
      ]);
      setDeals(d.data || []);
      setTasks(t.data || []);
      setActivities(a.data || []);
      setLoading(false);
    })();
  }, [tenant]);

  const stats = useMemo(() => {
    const won = deals.filter(d => d.stage === 'won');
    const open = deals.filter(d => !['won','lost'].includes(d.stage));
    const totalPipeline = open.reduce((s, d) => s + Number(d.amount || 0), 0);
    const totalWon = won.reduce((s, d) => s + Number(d.amount || 0), 0);
    const conv = deals.length > 0 ? Math.round((won.length / deals.length) * 100) : 0;
    return { totalPipeline, totalWon, openCount: open.length, wonCount: won.length, conv, total: deals.length };
  }, [deals]);

  const cur = tenant?.currency_code || 'USD';
  const cards: { label: string; value: string; icon: any; color: ColorKey; sub?: string }[] = [
    { label: 'Pipeline ouvert', value: formatMoney(stats.totalPipeline, cur), icon: TrendingUp, color: 'blue', sub: `${stats.openCount} deals` },
    { label: 'Gagné', value: formatMoney(stats.totalWon, cur), icon: Trophy, color: 'teal', sub: `${stats.wonCount} deals` },
    { label: 'Taux de conversion', value: `${stats.conv}%`, icon: Target, color: 'violet', sub: `${stats.total} deals total` },
    { label: 'Tâches à venir', value: String(tasks.length), icon: Clock, color: 'orange', sub: '7 prochains jours' },
  ];

  const stageCounts = DEAL_STAGES.map(s => ({ ...s, count: deals.filter(d => d.stage === s.id).length }));

  return (
    <div>
      <PageHeader
        title={`Bonjour ${profile?.full_name?.split(' ')[0] || ''} 👋`}
        subtitle={`Vue d'ensemble · ${tenant?.name || ''} · Plan ${PLAN_BY_ID[tenant?.plan_id || 'starter']?.name}`}
        actions={<Link to="/pipeline"><Button>Voir le pipeline <ArrowRight size={16} /></Button></Link>}
      />

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          cards.map(c => {
            const r = COLOR_RAMPS[c.color];
            const Icon = c.icon;
            return (
              <Card key={c.label} edge={c.color} className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{c.label}</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{c.value}</p>
                    {c.sub && <p className="mt-1 text-xs text-gray-400">{c.sub}</p>}
                  </div>
                  <div className={`rounded-xl ${r.bg} ${r.text} p-2.5`}><Icon size={20} /></div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Pipeline overview */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Pipeline par étape</h3>
            <Link to="/pipeline" className="text-xs font-medium text-coral-600 hover:underline">Détails</Link>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {stageCounts.map(s => {
              const r = COLOR_RAMPS[(s.color as ColorKey)] || COLOR_RAMPS.gray;
              return (
                <div key={s.id} className="rounded-xl bg-gray-50 p-3 text-center">
                  <div className={`mx-auto mb-2 h-1.5 w-8 rounded-full ${r.dot}`} />
                  <p className="text-lg font-bold text-gray-900">{s.count}</p>
                  <p className="text-[10px] text-gray-500">{s.label}</p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-gray-900">Tâches à venir</h3>
          <div className="mt-3 space-y-2">
            {tasks.length === 0 && <p className="py-6 text-center text-sm text-gray-400">Aucune tâche</p>}
            {tasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2.5">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-coral-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{t.title}</p>
                  <p className="text-xs text-gray-400">{formatDate(t.due_date)}</p>
                </div>
                <Badge color={t.priority === 'urgent' ? 'red' : t.priority === 'high' ? 'orange' : 'gray'}>{t.priority}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent deals + activities */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-base font-semibold text-gray-900">Deals récents</h3>
          <div className="mt-3 divide-y divide-gray-50">
            {deals.slice(0, 5).map(d => (
              <div key={d.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800">{d.title}</p>
                  <p className="text-xs text-gray-400">{formatDate(d.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatMoney(d.amount, d.currency_code)}</p>
                  <Badge color={d.stage === 'won' ? 'green' : d.stage === 'lost' ? 'red' : 'blue'}>{d.stage}</Badge>
                </div>
              </div>
            ))}
            {deals.length === 0 && <p className="py-6 text-center text-sm text-gray-400">Aucun deal. Créez-en un depuis le Pipeline.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-gray-900">Activités à venir</h3>
          <div className="mt-3 divide-y divide-gray-50">
            {activities.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-2.5">
                <div className="rounded-lg bg-mint-50 p-2 text-mint-700"><Users size={16} /></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{a.title}</p>
                  <p className="text-xs text-gray-400">{a.type} · {formatDate(a.due_at)}</p>
                </div>
              </div>
            ))}
            {activities.length === 0 && <p className="py-6 text-center text-sm text-gray-400">Aucune activité planifiée.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
