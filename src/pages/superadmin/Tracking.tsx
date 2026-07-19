import { useEffect, useMemo, useState } from 'react';
import { Trophy, Download, Filter } from 'lucide-react';
import { PageHeader, Card, Button, Badge, Select, Avatar } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { COUNTRIES, COUNTRY_BY_CODE } from '../../lib/constants';
import { formatMoney, convertToUsd, downloadCsv } from '../../lib/utils';
import type { SalesTracking, CommercialCode } from '../../lib/types';

export function Tracking() {
  const [sales, setSales] = useState<SalesTracking[]>([]);
  const [codes, setCodes] = useState<CommercialCode[]>([]);
  const [country, setCountry] = useState('all');

  useEffect(() => {
    (async () => {
      const [s, c] = await Promise.all([
        supabase.from('sales_tracking').select('*'),
        supabase.from('commercial_codes').select('*'),
      ]);
      setSales(s.data || []); setCodes(c.data || []);
    })();
  }, []);

  const byCode = useMemo(() => {
    const map: Record<string, { code?: CommercialCode; count: number; totalUsd: number; }> = {};
    sales.forEach(s => {
      const key = s.commercial_code_id || 'none';
      if (!map[key]) map[key] = { code: codes.find(c => c.id === s.commercial_code_id), count: 0, totalUsd: 0 };
      map[key].count += 1;
      map[key].totalUsd += convertToUsd(Number(s.amount || 0), s.currency);
    });
    return Object.values(map).sort((a, b) => b.totalUsd - a.totalUsd);
  }, [sales, codes]);

  const filtered = country === 'all' ? byCode : byCode.filter(b => b.code?.country_code === country);
  const totalUsd = filtered.reduce((s, b) => s + b.totalUsd, 0);

  const exportCsv = () => {
    const rows: (string|number)[][] = [['Commercial','Code','Email','Pays','Ventes','Total USD']];
    filtered.forEach(b => rows.push([b.code?.label || '—', b.code?.code || '—', b.code?.owner_email || '—', b.code?.country_code || '—', b.count, b.totalUsd.toFixed(2)]));
    downloadCsv('tracking-commerciaux.csv', rows);
  };

  return (
    <div>
      <PageHeader title="Tracking des commerciaux" subtitle="Ventes générées par code commercial"
        actions={<Button variant="secondary" onClick={exportCsv}><Download size={16} /> Export CSV</Button>} />

      <div className="mb-4 flex items-center gap-2">
        <Filter size={16} className="text-gray-400" />
        <Select value={country} onChange={e => setCountry(e.target.value)} className="w-56">
          <option value="all">Tous les pays</option>
          {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </Select>
      </div>

      <Card edge="orange" className="mb-6 p-5">
        <p className="text-sm text-gray-500">Total ventes tracées (USD équivalent)</p>
        <p className="mt-1 text-3xl font-bold text-gray-900">{formatMoney(totalUsd, 'USD')}</p>
        <p className="mt-1 text-xs text-gray-500">{filtered.length} commerciaux · {sales.length} ventes</p>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3 flex items-center gap-2"><Trophy size={16} className="text-coral-500" /><h3 className="text-sm font-semibold text-gray-900">Classement</h3></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-2.5">#</th><th className="px-4 py-2.5">Commercial</th><th className="px-4 py-2.5">Code</th><th className="px-4 py-2.5">Pays</th><th className="px-4 py-2.5">Ventes</th><th className="px-4 py-2.5">Total USD</th></tr></thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((b, i) => (
              <tr key={i} className="hover:bg-gray-50/60">
                <td className="px-4 py-3"><Badge color={i === 0 ? 'orange' : 'gray'}>{i + 1}</Badge></td>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar name={b.code?.label || '?'} size={28} /><div><p className="font-medium text-gray-900">{b.code?.label || 'Inconnu'}</p><p className="text-xs text-gray-500">{b.code?.owner_email || '—'}</p></div></div></td>
                <td className="px-4 py-3"><code className="rounded bg-coral-50 px-2 py-0.5 font-mono text-xs text-coral-700">{b.code?.code || '—'}</code></td>
                <td className="px-4 py-3 text-gray-600">{b.code?.country_code ? COUNTRY_BY_CODE[b.code.country_code]?.name || b.code.country_code : '—'}</td>
                <td className="px-4 py-3 text-gray-700">{b.count}</td>
                <td className="px-4 py-3 font-semibold text-gray-900">{formatMoney(b.totalUsd, 'USD')}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Aucune vente tracée. Créez des codes commerciaux et invitez des clients à les utiliser à l'inscription.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
