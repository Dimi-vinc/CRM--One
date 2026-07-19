import { useEffect, useState } from 'react';
import { Plus, Trash2, Ticket, Edit2 } from 'lucide-react';
import { PageHeader, Card, Button, Badge, Modal, Input, Select, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { COUNTRIES } from '../../lib/constants';
import { formatDate } from '../../lib/utils';
import type { CommercialCode } from '../../lib/types';

function randomCode() {
  return 'LA-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function CommercialCodes() {
  const [items, setItems] = useState<CommercialCode[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<CommercialCode | null>(null);
  const [form, setForm] = useState({ code: '', label: '', owner_email: '', country_code: '', region: '', is_active: true });

  const load = async () => {
    const { data } = await supabase.from('commercial_codes').select('*').order('created_at', { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (editing) {
      const { data } = await supabase.from('commercial_codes').update(form).eq('id', editing.id).select().single();
      if (data) setItems(prev => prev.map(c => c.id === editing.id ? data : c));
    } else {
      const code = form.code || randomCode();
      const { data } = await supabase.from('commercial_codes').insert({ ...form, code }).select().single();
      if (data) setItems(prev => [data, ...prev]);
    }
    await supabase.from('audit_log').insert({ actor_id: (await supabase.auth.getUser()).data.user?.id, action: editing ? 'code.update' : 'code.create', target_type: 'commercial_code', details: form });
    setModal(false); setEditing(null); setForm({ code: '', label: '', owner_email: '', country_code: '', region: '', is_active: true });
  };

  const edit = (c: CommercialCode) => {
    setEditing(c);
    setForm({ code: c.code, label: c.label || '', owner_email: c.owner_email || '', country_code: c.country_code || '', region: c.region || '', is_active: c.is_active });
    setModal(true);
  };

  const remove = async (id: string) => {
    setItems(prev => prev.filter(c => c.id !== id));
    await supabase.from('commercial_codes').delete().eq('id', id);
  };

  return (
    <div>
      <PageHeader title="Codes commerciaux" subtitle="Codes pour tracer les ventes des commerciaux"
        actions={<Button onClick={() => { setEditing(null); setForm({ code: '', label: '', owner_email: '', country_code: '', region: '', is_active: true }); setModal(true); }}><Plus size={16} /> Nouveau code</Button>} />

      {items.length === 0 ? (
        <Card className="p-8"><EmptyState icon={Ticket} title="Aucun code commercial" description="Créez un code pour chaque commercial afin de tracer ses ventes." action={<Button onClick={() => setModal(true)}>Créer</Button>} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Code</th><th className="px-4 py-3">Label</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Pays</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Créé</th><th className="px-4 py-3"></th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3"><code className="rounded bg-coral-50 px-2 py-0.5 font-mono text-coral-700">{c.code}</code></td>
                  <td className="px-4 py-3 text-gray-700">{c.label || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.owner_email || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.country_code || '—'}</td>
                  <td className="px-4 py-3"><Badge color={c.is_active ? 'green' : 'gray'}>{c.is_active ? 'Actif' : 'Inactif'}</Badge></td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-1"><button onClick={() => edit(c)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><Edit2 size={15} /></button><button onClick={() => remove(c.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier le code' : 'Nouveau code commercial'}>
        <div className="space-y-3">
          <Input label="Code (laisser vide pour générer)" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="LA-XXXXXX" />
          <Input label="Label / Nom du commercial" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
          <Input label="Email du commercial" type="email" value={form.owner_email} onChange={e => setForm({ ...form, owner_email: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Pays" value={form.country_code} onChange={e => setForm({ ...form, country_code: e.target.value })}><option value="">—</option>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</Select>
            <Input label="Région" value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button><Button onClick={save}>{editing ? 'Enregistrer' : 'Créer'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
