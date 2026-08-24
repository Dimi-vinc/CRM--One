import { useEffect, useMemo, useState } from 'react';
import { Download, Filter } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Select, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatMoney, formatDate, downloadCsv, sumDealAmounts } from '../../lib/utils';
import { COUNTRIES } from '../../lib/constants';
import type { Deal } from '../../lib/types';

export function Reports() {
  const { tenant } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [countryFilter, setCountryFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');

  useEffect(() => {
    if (!tenant) return;
    supabase.from('deals').select('*').then(({ data }) => setDeals(data || []));
  }, [tenant]);

  const filtered = useMemo(() => deals.filter(d =>
    (stageFilter === 'all' || d.stage === stageFilter)
  ), [deals, stageFilter]);

  const cur = tenant?.currency_code || 'USD';
  const total = sumDealAmounts(filtered, cur);
  const won = sumDealAmounts(filtered.filter(d => d.stage === 'won'), cur);

  const exportCsv = () => {
    const rows: (string | number)[][] = [['Titre','Montant','Devise','Étape','Date de clôture','Créé le']];
    filtered.forEach(d => rows.push([d.title, d.amount, d.currency_code, d.stage, d.expected_close_date || '', formatDate(d.created_at)]));
    downloadCsv('rapport-deals.csv', rows);
  };

  return (
    <div>
      <PageHeader title="Rapports" subtitle="Analyse par étape et zone géographique"
        actions={<Button onClick={exportCsv}><Download size={16} /> Exporter CSV</Button>} />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex items-center gap-2"><Filter size={16} className="text-gray-400" />
          <Select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="w-48">
            <option value="all">Tous les pays</option>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
          <Select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="w-40">
            <option value="all">Toutes étapes</option>
            {['lead','qualified','proposal','negotiation','won','lost'].map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card edge="blue" className="p-5"><p className="text-sm text-gray-500">Total deals</p><p className="mt-1 text-2xl font-bold text-gray-900">{filtered.length}</p></Card>
        <Card edge="orange" className="p-5"><p className="text-sm text-gray-500">Montant total</p><p className="mt-1 text-2xl font-bold text-gray-900">{formatMoney(total, cur)}</p></Card>
        <Card edge="teal" className="p-5"><p className="text-sm text-gray-500">Gagné</p><p className="mt-1 text-2xl font-bold text-gray-900">{formatMoney(won, cur)}</p></Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3"><h3 className="text-sm font-semibold text-gray-900">Détail des deals</h3></div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr><th className="px-4 py-2.5">Titre</th><th className="px-4 py-2.5">Montant</th><th className="px-4 py-2.5">Étape</th><th className="px-4 py-2.5">Échéance</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(d => (
              <tr key={d.id} className="hover:bg-gray-50/60">
                <td className="px-4 py-2.5 font-medium text-gray-800">{d.title}</td>
                <td className="px-4 py-2.5 text-gray-700">{formatMoney(d.amount, d.currency_code)}</td>
                <td className="px-4 py-2.5"><Badge color={d.stage === 'won' ? 'green' : d.stage === 'lost' ? 'red' : 'blue'}>{d.stage}</Badge></td>
                <td className="px-4 py-2.5 text-gray-500">{formatDate(d.expected_close_date)}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Aucun deal</td></tr>}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
