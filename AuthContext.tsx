import { useEffect, useState } from 'react';
import { Search, Edit2, Ban, CheckCircle2, Trash2 } from 'lucide-react';
import { PageHeader, Card, Button, Badge, Select, Modal, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { COUNTRIES, COUNTRY_BY_CODE, PLANS, PLAN_BY_ID } from '../../lib/constants';
import { formatDate } from '../../lib/utils';
import type { Tenant } from '../../lib/types';

export function TenantsAdmin() {
  const [items, setItems] = useState<Tenant[]>([]);
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<Tenant | null>(null);
  const [form, setForm] = useState({ name: '', plan_id: 'starter', status: 'trial', country_code: 'CM', currency_code: 'XAF' });

  const load = async () => {
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  const save = async () => {
    if (!edit) return;
    await supabase.from('tenants').update(form).eq('id', edit.id);
    await supabase.from('audit_log').insert({ actor_id: (await supabase.auth.getUser()).data.user?.id, action: 'tenant.update', target_type: 'tenant', target_id: edit.id, tenant_id: edit.id, details: form });
    setItems(prev => prev.map(t => t.id === edit.id ? { ...t, ...form } : t));
    setEdit(null);
  };

  const setStatus = async (t: Tenant, status: string) => {
    await supabase.from('tenants').update({ status }).eq('id', t.id);
    await supabase.from('audit_log').insert({ actor_id: (await supabase.auth.getUser()).data.user?.id, action: `tenant.${status}`, target_type: 'tenant', target_id: t.id, tenant_id: t.id, details: { status } });
    setItems(prev => prev.map(x => x.id === t.id ? { ...x, status } : x));
  };

  const remove = async (t: Tenant) => {
    if (!confirm(`Supprimer le tenant "${t.name}" ? Cette action est irréversible.`)) return;
    await supabase.from('audit_log').insert({ actor_id: (await supabase.auth.getUser()).data.user?.id, action: 'tenant.delete', target_type: 'tenant', target_id: t.id, tenant_id: t.id, details: { name: t.name } });
    await supabase.from('tenants').delete().eq('id', t.id);
    setItems(prev => prev.filter(x => x.id !== t.id));
  };

  return (
    <div>
      <PageHeader title="Tenants" subtitle={`${items.length} entreprises clientes`} />
      <div className="mb-4 relative max-w-md">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" className="input pl-9" />
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Entreprise</th><th className="px-4 py-3">Pays</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Créé</th><th className="px-4 py-3"></th></tr></thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-gray-50/60">
                <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                <td className="px-4 py-3 text-gray-600">{COUNTRY_BY_CODE[t.country_code]?.name || t.country_code}</td>
                <td className="px-4 py-3"><Badge color="orange">{PLAN_BY_ID[t.plan_id]?.name || t.plan_id}</Badge></td>
                <td className="px-4 py-3"><Badge color={t.status === 'active' ? 'green' : t.status === 'trial' ? 'orange' : 'red'}>{t.status}</Badge></td>
                <td className="px-4 py-3 text-gray-500">{formatDate(t.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => { setEdit(t); setForm({ name: t.name, plan_id: t.plan_id, status: t.status, country_code: t.country_code, currency_code: t.currency_code }); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><Edit2 size={15} /></button>
                    {t.status !== 'suspended' ? <button onClick={() => setStatus(t, 'suspended')} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Ban size={15} /></button> : <button onClick={() => setStatus(t, 'active')} className="rounded-lg p-1.5 text-gray-400 hover:bg-mint-50 hover:text-mint-600"><CheckCircle2 size={15} /></button>}
                    <button onClick={() => remove(t)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Modifier le tenant">
        <div className="space-y-3">
          <Input label="Nom" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Plan" value={form.plan_id} onChange={e => setForm({ ...form, plan_id: e.target.value })}>{PLANS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
            <Select label="Statut" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="trial">trial</option><option value="active">active</option><option value="suspended">suspended</option><option value="cancelled">cancelled</option></Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Pays" value={form.country_code} onChange={e => setForm({ ...form, country_code: e.target.value })}>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</Select>
            <Input label="Devise" value={form.currency_code} onChange={e => setForm({ ...form, currency_code: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => setEdit(null)}>Annuler</Button><Button onClick={save}>Enregistrer</Button></div>
        </div>
      </Modal>
    </div>
  );
}
