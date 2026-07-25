import { useEffect, useState } from 'react';
import { TrendingUp, Target, Trophy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Skeleton } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatMoney, COLOR_RAMPS } from '../../lib/utils';
import { DEAL_STAGES } from '../../lib/constants';
import type { Deal } from '../../lib/types';

export function Forecast() {
  const { tenant } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      const { data } = await supabase.from('deals').select('*');
      setDeals(data || []); setLoading(false);
    })();
  }, [tenant]);

  const cur = tenant?.currency_code || 'USD';
  const open = deals.filter(d => !['won','lost'].includes(d.stage));
  const won = deals.filter(d => d.stage === 'won');
  const lost = deals.filter(d => d.stage === 'lost');
  const totalOpen = open.reduce((s, d) => s + Number(d.amount || 0), 0);
  const totalWon = won.reduce((s, d) => s + Number(d.amount || 0), 0);

  // Weighted forecast: each stage has a probability
  const PROB: Record<string, number> = { lead: 0.1, qualified: 0.3, proposal: 0.5, negotiation: 0.75, won: 1, lost: 0 };
  const weighted = open.reduce((s, d) => s + Number(d.amount || 0) * (PROB[d.stage] || 0), 0);

  const byStage = DEAL_STAGES.map(s => {
    const items = open.filter(d => d.stage === s.id);
    return { ...s, count: items.length, total: items.reduce((sum, d) => sum + Number(d.amount || 0), 0), weighted: items.reduce((sum, d) => sum + Number(d.amount || 0) * (PROB[s.id] || 0), 0) };
  });
  const maxTotal = Math.max(...byStage.map(s => s.total), 1);

  return (
    <div>
      <PageHeader title="Forecast" subtitle="Prévisions de revenus pondérées par probabilité de closing" />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { l: 'Pipeline ouvert', v: formatMoney(totalOpen, cur), i: TrendingUp, c: 'blue' },
          { l: 'Forecast pondéré', v: formatMoney(weighted, cur), i: Target, c: 'orange' },
          { l: 'Gagné', v: formatMoney(totalWon, cur), i: Trophy, c: 'teal' },
        ].map(c => {
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

      <Card className="mt-6 p-5">
        <h3 className="text-base font-semibold text-gray-900">Pipeline par étape</h3>
        {loading ? <Skeleton className="mt-4 h-40" /> : (
          <div className="mt-4 space-y-3">
            {byStage.map(s => (
              <div key={s.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{s.label} <span className="text-gray-400">({s.count})</span></span>
                  <span className="text-gray-900">{formatMoney(s.total, cur)} <span className="text-gray-400">· pondéré {formatMoney(s.weighted, cur)}</span></span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full ${COLOR_RAMPS[(s.color as keyof typeof COLOR_RAMPS)]?.dot || 'bg-gray-400'}`} style={{ width: `${(s.total / maxTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-6 p-5">
        <h3 className="text-base font-semibold text-gray-900">Conversion</h3>
        <div className="mt-3 grid grid-cols-3 gap-4 text-center">
          <div><p className="text-2xl font-bold text-gray-900">{deals.length}</p><p className="text-xs text-gray-500">Total</p></div>
          <div><p className="text-2xl font-bold text-mint-600">{won.length}</p><p className="text-xs text-gray-500">Gagnés</p></div>
          <div><p className="text-2xl font-bold text-red-500">{lost.length}</p><p className="text-xs text-gray-500">Perdus</p></div>
        </div>
      </Card>
    </div>
  );
}
