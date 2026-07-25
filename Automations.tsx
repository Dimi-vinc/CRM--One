import { useEffect, useState } from 'react';
import { Plus, Phone, Mail, Users, FileText, CheckSquare, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input, Select, Textarea, Badge, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { ACTIVITY_TYPES, formatDate } from '../../lib/constants';
import type { Activity, Contact } from '../../lib/types';

const ICONS: Record<string, any> = { call: Phone, email: Mail, meeting: Users, task: CheckSquare, note: FileText };

export function Activities() {
  const { tenant, profile } = useAuth();
  const [items, setItems] = useState<Activity[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ type: 'call', title: '', description: '', due_at: '', contact_id: '' });

  const load = async () => {
    if (!tenant) return;
    const [a, c] = await Promise.all([
      supabase.from('activities').select('*').order('due_at', { ascending: true }),
      supabase.from('contacts').select('*'),
    ]);
    setItems(a.data || []); setContacts(c.data || []);
  };
  useEffect(() => { load(); }, [tenant]);

  const save = async () => {
    if (!tenant || !form.title.trim()) return;
    const { data } = await supabase.from('activities').insert({
      ...form, tenant_id: tenant.id, contact_id: form.contact_id || null, user_id: profile?.id, due_at: form.due_at || null,
    }).select().single();
    if (data) setItems(prev => [data, ...prev]);
    setModal(false); setForm({ type: 'call', title: '', description: '', due_at: '', contact_id: '' });
  };

  const toggle = async (a: Activity) => {
    setItems(prev => prev.map(x => x.id === a.id ? { ...x, completed: !x.completed } : x));
    await supabase.from('activities').update({ completed: !a.completed }).eq('id', a.id);
  };

  const remove = async (id: string) => {
    setItems(prev => prev.filter(x => x.id !== id));
    await supabase.from('activities').delete().eq('id', id);
  };

  return (
    <div>
      <PageHeader title="Activités" subtitle="Appels, emails, réunions, tâches"
        actions={<Button onClick={() => setModal(true)}><Plus size={16} /> Nouvelle activité</Button>} />

      {items.length === 0 ? (
        <Card className="p-8"><EmptyState icon={Phone} title="Aucune activité" description="Planifiez un appel, un email ou une réunion." action={<Button onClick={() => setModal(true)}>Ajouter</Button>} /></Card>
      ) : (
        <Card className="divide-y divide-gray-50">
          {items.map(a => {
            const Icon = ICONS[a.type] || FileText;
            return (
              <div key={a.id} className="flex items-center gap-3 p-4 hover:bg-gray-50/60">
                <button onClick={() => toggle(a)} className={`rounded-lg p-2.5 ${a.completed ? 'bg-mint-100 text-mint-700' : 'bg-gray-100 text-gray-500'}`}><Icon size={18} /></button>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${a.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>{a.title}</p>
                  {a.description && <p className="text-xs text-gray-500">{a.description}</p>}
                  <p className="mt-0.5 text-xs text-gray-400">{a.type} · {formatDate(a.due_at)}</p>
                </div>
                <Badge color={a.completed ? 'green' : 'orange'}>{a.completed ? 'Fait' : 'À faire'}</Badge>
                <button onClick={() => remove(a.id)} className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvelle activité">
        <div className="space-y-3">
          <Select label="Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input label="Titre" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Description" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Échéance" type="datetime-local" value={form.due_at} onChange={e => setForm({ ...form, due_at: e.target.value })} />
            <Select label="Contact" value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value })}>
              <option value="">—</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button onClick={save}>Créer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
