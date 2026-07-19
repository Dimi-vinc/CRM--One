import { useEffect, useState } from 'react';
import { Plus, Zap, Trash2, Power } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input, Select, Textarea, Badge, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Automation } from '../../lib/types';

const TRIGGERS = ['Deal créé','Deal gagné','Contact ajouté','Tâche en retard','Activité terminée'];
const ACTIONS = ['Envoyer email','Créer tâche','Notifier l\'équipe','Mettre à jour le deal'];

export function Automations() {
  const { tenant } = useAuth();
  const [items, setItems] = useState<Automation[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', trigger: TRIGGERS[0], action: ACTIONS[0] });

  const load = async () => {
    if (!tenant) return;
    const { data } = await supabase.from('automations').select('*').order('created_at', { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, [tenant]);

  const save = async () => {
    if (!tenant || !form.name.trim()) return;
    const { data } = await supabase.from('automations').insert({ ...form, tenant_id: tenant.id, is_active: true }).select().single();
    if (data) setItems(prev => [data, ...prev]);
    setModal(false); setForm({ name: '', trigger: TRIGGERS[0], action: ACTIONS[0] });
  };

  const toggle = async (a: Automation) => {
    setItems(prev => prev.map(x => x.id === a.id ? { ...x, is_active: !x.is_active } : x));
    await supabase.from('automations').update({ is_active: !a.is_active }).eq('id', a.id);
  };

  const remove = async (id: string) => {
    setItems(prev => prev.filter(x => x.id !== id));
    await supabase.from('automations').delete().eq('id', id);
  };

  return (
    <div>
      <PageHeader title="Automatisations" subtitle="Déclencheurs et actions sans code"
        actions={<Button onClick={() => setModal(true)}><Plus size={16} /> Nouvelle automatisation</Button>} />

      {items.length === 0 ? (
        <Card className="p-8"><EmptyState icon={Zap} title="Aucune automatisation" description="Créez votre première automatisation pour gagner du temps." action={<Button onClick={() => setModal(true)}>Créer</Button>} /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(a => (
            <Card key={a.id} className="group p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 ${a.is_active ? 'bg-coral-50 text-coral-700' : 'bg-gray-100 text-gray-400'}`}><Zap size={20} /></div>
                  <div><p className="font-semibold text-gray-900">{a.name}</p><p className="text-xs text-gray-500">Si <b>{a.trigger}</b> → {a.action}</p></div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggle(a)} className={`rounded-lg p-1.5 ${a.is_active ? 'text-mint-600 hover:bg-mint-50' : 'text-gray-400 hover:bg-gray-100'}`}><Power size={15} /></button>
                  <button onClick={() => remove(a.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="mt-2"><Badge color={a.is_active ? 'green' : 'gray'}>{a.is_active ? 'Active' : 'Inactive'}</Badge></div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvelle automatisation">
        <div className="space-y-3">
          <Input label="Nom" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Select label="Déclencheur" value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value })}>
            {TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select label="Action" value={form.action} onChange={e => setForm({ ...form, action: e.target.value })}>
            {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button onClick={save}>Créer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
