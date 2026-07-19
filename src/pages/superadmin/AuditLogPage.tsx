import { useEffect, useState } from 'react';
import { Shield, Search } from 'lucide-react';
import { PageHeader, Card, Badge, Select } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';
import type { AuditLog } from '../../lib/types';

export function AuditLogPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(500).then(({ data }) => setItems(data || []));
  }, []);

  const actions = Array.from(new Set(items.map(i => i.action)));
  const filtered = items.filter(i =>
    (actionFilter === 'all' || i.action === actionFilter) &&
    (i.action.toLowerCase().includes(search.toLowerCase()) || (i.target_id || '').includes(search))
  );

  return (
    <div>
      <PageHeader title="Journal d'audit" subtitle="Traçabilité des actions sensibles (cross-tenant, suspensions, plans, promotions)" />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" className="input pl-9" />
        </div>
        <Select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="w-48">
          <option value="all">Toutes les actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </Select>
      </div>
      <Card className="divide-y divide-gray-50">
        {filtered.map(i => (
          <div key={i.id} className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-gray-100 p-2 text-gray-500"><Shield size={16} /></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{i.action}</p>
              <p className="text-xs text-gray-500">
                {i.target_type} {i.target_id && `· ${i.target_id.slice(0, 8)}`} {i.tenant_id && `· tenant ${i.tenant_id.slice(0, 8)}`}
              </p>
              {i.details && <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-[10px] text-gray-600">{JSON.stringify(i.details)}</pre>}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{formatDateTime(i.created_at)}</p>
              <p className="text-[10px] text-gray-400">{i.actor_id?.slice(0, 8)}</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="p-8 text-center text-sm text-gray-400">Aucune entrée</div>}
      </Card>
    </div>
  );
}
