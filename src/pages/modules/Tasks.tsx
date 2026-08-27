import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, CheckSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input, Select, Textarea, Badge, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { ColorKey } from '../../lib/utils';
import { TASK_PRIORITIES, TASK_STATUSES, formatDate } from '../../lib/constants';
import type { Task } from '../../lib/types';

const STATUS_COLORS: Record<string, ColorKey> = { todo: 'gray', in_progress: 'orange', done: 'green' };
const PRIO_COLORS: Record<string, ColorKey> = { low: 'gray', medium: 'blue', high: 'orange', urgent: 'red' };

export function Tasks() {
  const { tenant, profile } = useAuth();
  const [items, setItems] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', due_date: '', priority: 'medium', status: 'todo' });

  const load = useCallback(async () => {
    if (!tenant) return;
    const { data } = await supabase.from('tasks').select('*').order('due_date', { ascending: true });
    setItems(data || []);
  }, [tenant]);
  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? items : items.filter(t => t.status === filter);

  const save = async () => {
    if (!tenant || !form.title.trim()) return;
    const { data } = await supabase.from('tasks').insert({
      ...form, tenant_id: tenant.id, assigned_to: profile?.id, due_date: form.due_date || null,
    }).select().single();
    if (data) setItems(prev => [data, ...prev]);
    setModal(false); setForm({ title: '', description: '', due_date: '', priority: 'medium', status: 'todo' });
  };

  const cycleStatus = async (t: Task) => {
    const next = t.status === 'todo' ? 'in_progress' : t.status === 'in_progress' ? 'done' : 'todo';
    setItems(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x));
    await supabase.from('tasks').update({ status: next }).eq('id', t.id);
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer cette tâche ?')) return;
    setItems(prev => prev.filter(x => x.id !== id));
    await supabase.from('tasks').delete().eq('id', id);
  };

  return (
    <div>
      <PageHeader title="Tâches" subtitle={`${items.length} tâche${items.length > 1 ? 's' : ''}`}
        actions={<Button onClick={() => setModal(true)}><Plus size={16} /> Nouvelle tâche</Button>} />

      <div className="mb-4 flex gap-2">
        {([{ k: 'all', l: 'Toutes' }, { k: 'todo', l: 'À faire' }, { k: 'in_progress', l: 'En cours' }, { k: 'done', l: 'Terminées' }] as const).map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filter === f.k ? 'bg-coral-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{f.l}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8"><EmptyState icon={CheckSquare} title="Aucune tâche" description="Créez votre première tâche." action={<Button onClick={() => setModal(true)}>Ajouter</Button>} /></Card>
      ) : (
        <Card className="divide-y divide-gray-50">
          {filtered.map(t => (
            <div key={t.id} className="flex items-center gap-3 p-4">
              <button onClick={() => cycleStatus(t)} className={`h-5 w-5 rounded-md border-2 ${t.status === 'done' ? 'border-mint-500 bg-mint-500 text-white' : 'border-gray-300'}`}>{t.status === 'done' && '✓'}</button>
              <div className="flex-1">
                <p className={`text-sm font-medium ${t.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{t.title}</p>
                {t.description && <p className="text-xs text-gray-500">{t.description}</p>}
                <p className="mt-0.5 text-xs text-gray-400">Échéance : {formatDate(t.due_date)}</p>
              </div>
              <Badge color={STATUS_COLORS[t.status]}>{t.status}</Badge>
              <Badge color={PRIO_COLORS[t.priority]}>{t.priority}</Badge>
              <button onClick={() => remove(t.id)} className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvelle tâche">
        <div className="space-y-3">
          <Input label="Titre" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Description" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Échéance" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            <Select label="Priorité" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
          <Select label="Statut" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
