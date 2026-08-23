import { useEffect, useState } from 'react';
import { BookOpen, Plus, Pencil, Trash2, Globe, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input, Textarea, Badge, EmptyState, Skeleton } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { KbArticle } from '../../lib/types';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function KnowledgeBase() {
  const { tenant } = useAuth();
  const [items, setItems] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<KbArticle | null>(null);
  const [form, setForm] = useState({ title: '', category: '', content: '', is_public: false });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase.from('kb_articles').select('*').order('updated_at', { ascending: false }).limit(1000);
    setItems(data || []);
    setLoading(false);
  };
  // load() only reads `tenant` (already a dependency below) — intentionally omitted to avoid
  // recreating the effect trigger on every render, since a new `load` closure is made each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [tenant]);

  const openCreate = () => { setEditing(null); setForm({ title: '', category: '', content: '', is_public: false }); setModal(true); };
  const openEdit = (a: KbArticle) => { setEditing(a); setForm({ title: a.title, category: a.category || '', content: a.content, is_public: a.is_public }); setModal(true); };

  const save = async () => {
    if (!tenant || !form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    if (editing) {
      const { data } = await supabase.from('kb_articles').update({
        title: form.title, category: form.category || null, content: form.content, is_public: form.is_public,
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id).select().single();
      if (data) setItems(prev => prev.map(x => x.id === editing.id ? data : x));
    } else {
      const { data } = await supabase.from('kb_articles').insert({
        tenant_id: tenant.id, title: form.title, slug: slugify(form.title) + '-' + Math.random().toString(36).slice(2, 6),
        category: form.category || null, content: form.content, is_public: form.is_public,
      }).select().single();
      if (data) setItems(prev => [data, ...prev]);
    }
    setSaving(false);
    setModal(false);
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer cet article ?')) return;
    setItems(prev => prev.filter(x => x.id !== id));
    await supabase.from('kb_articles').delete().eq('id', id);
  };

  return (
    <div>
      <PageHeader
        title="Base de connaissances"
        subtitle="Articles internes ou publics pour vos clients (portail en libre-service)"
        actions={<Button onClick={openCreate}><Plus size={16} /> Nouvel article</Button>}
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}</div>
      ) : items.length === 0 ? (
        <Card className="p-8"><EmptyState icon={BookOpen} title="Aucun article" description="Documentez vos réponses aux questions fréquentes." action={<Button onClick={openCreate}>Créer</Button>} /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(a => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{a.title}</p>
                  {a.category && <p className="text-xs text-gray-500">{a.category}</p>}
                </div>
                <Badge color={a.is_public ? 'green' : 'gray'}>{a.is_public ? <><Globe size={11} className="mr-1 inline" />Public</> : <><Lock size={11} className="mr-1 inline" />Interne</>}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-gray-600">{a.content}</p>
              <div className="mt-3 flex gap-1">
                <button onClick={() => openEdit(a)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil size={14} /></button>
                <button onClick={() => remove(a.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Modifier l'article" : 'Nouvel article'} size="lg">
        <div className="space-y-3">
          <Input label="Titre" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Input label="Catégorie (optionnel)" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ex: Facturation" />
          <Textarea label="Contenu" rows={8} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.is_public} onChange={e => setForm({ ...form, is_public: e.target.checked })} />
            Visible publiquement (portail libre-service, sans connexion)
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.title.trim() || !form.content.trim()}>{saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
