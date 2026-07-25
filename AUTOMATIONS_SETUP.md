import { useEffect, useState } from 'react';
import { Megaphone, Plus, Trash2, Power, Edit2 } from 'lucide-react';
import { PageHeader, Card, Button, Badge, Modal, Input, Textarea, Select, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';
import type { Announcement } from '../../lib/types';

export function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState({ title: '', body: '', type: 'info', is_active: true });

  const load = async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    if (editing) {
      const { data } = await supabase.from('announcements').update(form).eq('id', editing.id).select().single();
      if (data) setItems(prev => prev.map(a => a.id === editing.id ? data : a));
    } else {
      const { data } = await supabase.from('announcements').insert(form).select().single();
      if (data) setItems(prev => [data, ...prev]);
    }
    await supabase.from('audit_log').insert({ actor_id: (await supabase.auth.getUser()).data.user?.id, action: editing ? 'announcement.update' : 'announcement.create', target_type: 'announcement', details: form });
    setModal(false); setEditing(null); setForm({ title: '', body: '', type: 'info', is_active: true });
  };

  const toggle = async (a: Announcement) => {
    setItems(prev => prev.map(x => x.id === a.id ? { ...x, is_active: !x.is_active } : x));
    await supabase.from('announcements').update({ is_active: !a.is_active }).eq('id', a.id);
  };

  const remove = async (id: string) => {
    setItems(prev => prev.filter(a => a.id !== id));
    await supabase.from('announcements').delete().eq('id', id);
  };

  return (
    <div>
      <PageHeader title="Annonces globales" subtitle="Communiquez avec tous les clients (maintenance, nouveautés)"
        actions={<Button onClick={() => { setEditing(null); setForm({ title: '', body: '', type: 'info', is_active: true }); setModal(true); }}><Plus size={16} /> Nouvelle annonce</Button>} />
      {items.length === 0 ? (
        <Card className="p-8"><EmptyState icon={Megaphone} title="Aucune annonce" description="Publiez une annonce visible par tous les tenants." action={<Button onClick={() => setModal(true)}>Créer</Button>} /></Card>
      ) : (
        <div className="space-y-3">
          {items.map(a => (
            <Card key={a.id} className="group p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2.5 ${a.type === 'warning' ? 'bg-coral-50 text-coral-700' : a.type === 'success' ? 'bg-mint-50 text-mint-700' : 'bg-blue-50 text-blue-700'}`}><Megaphone size={18} /></div>
                  <div><p className="font-semibold text-gray-900">{a.title}</p><p className="text-sm text-gray-600">{a.body}</p><p className="mt-1 text-xs text-gray-400">{formatDateTime(a.created_at)}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={a.is_active ? 'green' : 'gray'}>{a.is_active ? 'Active' : 'Inactive'}</Badge>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={() => { setEditing(a); setForm({ title: a.title, body: a.body, type: a.type, is_active: a.is_active }); setModal(true); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><Edit2 size={14} /></button>
                    <button onClick={() => toggle(a)} className="rounded-lg p-1.5 text-gray-400 hover:bg-mint-50 hover:text-mint-600"><Power size={14} /></button>
                    <button onClick={() => remove(a.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier l\'annonce' : 'Nouvelle annonce'}>
        <div className="space-y-3">
          <Input label="Titre" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Message" rows={3} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
          <Select label="Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            <option value="info">Info</option><option value="warning">Warning</option><option value="success">Success</option>
          </Select>
          <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button><Button onClick={save}>{editing ? 'Enregistrer' : 'Publier'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
