import { useEffect, useState } from 'react';
import { Edit2, Plus, Power } from 'lucide-react';
import { PageHeader, Card, Button, Badge, Modal, Input, Textarea } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { PLANS, formatMoney } from '../../lib/constants';
import type { Plan } from '../../lib/types';

export function PlansAdmin() {
  const [items, setItems] = useState<Plan[]>([]);
  const [edit, setEdit] = useState<Plan | null>(null);
  const [form, setForm] = useState({ id: '', name: '', price_monthly: 0, currency: 'USD', max_users: 2, max_deals: 100, is_active: true, features: '{}' });

  const load = async () => {
    const { data } = await supabase.from('plans').select('*').order('sort_order', { ascending: true });
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    await supabase.from('plans').update({
      name: form.name, price_monthly: Number(form.price_monthly), currency: form.currency,
      max_users: Number(form.max_users), max_deals: Number(form.max_deals), is_active: form.is_active,
    }).eq('id', edit.id);
    await supabase.from('audit_log').insert({ actor_id: (await supabase.auth.getUser()).data.user?.id, action: 'plan.update', target_type: 'plan', target_id: edit.id, details: form });
    setEdit(null); load();
  };

  const toggleActive = async (p: Plan) => {
    await supabase.from('plans').update({ is_active: !p.is_active }).eq('id', p.id);
    load();
  };

  return (
    <div>
      <PageHeader title="Forfaits" subtitle="Créez, éditez, désactivez des plans à chaud" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {items.map(p => (
          <Card key={p.id} className={`p-5 ${!p.is_active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between">
              <div><h3 className="font-bold text-gray-900">{p.name}</h3><p className="mt-1 text-2xl font-bold text-gray-900">{formatMoney(Number(p.price_monthly), p.currency)}<span className="text-sm font-normal text-gray-500">/mois</span></p></div>
              <Badge color={p.is_active ? 'green' : 'gray'}>{p.is_active ? 'Actif' : 'Inactif'}</Badge>
            </div>
            <p className="mt-2 text-xs text-gray-500">{p.max_users === 0 ? 'Illimité' : `${p.max_users} users`} · {p.max_deals === 0 ? 'Deals illimités' : `${p.max_deals} deals`}</p>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => { setEdit(p); setForm({ id: p.id, name: p.name, price_monthly: Number(p.price_monthly), currency: p.currency, max_users: p.max_users, max_deals: p.max_deals, is_active: p.is_active, features: '{}' }); }}><Edit2 size={14} /> Éditer</Button>
              <Button variant="ghost" onClick={() => toggleActive(p)}><Power size={15} /></Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Éditer le forfait">
        <div className="space-y-3">
          <Input label="Nom" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prix mensuel" type="number" value={form.price_monthly} onChange={e => setForm({ ...form, price_monthly: Number(e.target.value) })} />
            <Input label="Devise" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Max utilisateurs (0 = illimité)" type="number" value={form.max_users} onChange={e => setForm({ ...form, max_users: Number(e.target.value) })} />
            <Input label="Max deals (0 = illimité)" type="number" value={form.max_deals} onChange={e => setForm({ ...form, max_deals: Number(e.target.value) })} />
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => setEdit(null)}>Annuler</Button><Button onClick={save}>Enregistrer</Button></div>
        </div>
      </Modal>
    </div>
  );
}
