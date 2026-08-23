import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import type { DocumentRow } from '../../lib/types';

export function Documents() {
  const { tenant, profile } = useAuth();
  const [items, setItems] = useState<DocumentRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!tenant) return;
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false }).limit(2000);
    setItems(data || []);
  };
  // load() only reads `tenant` (already a dependency below) — intentionally omitted to avoid
  // recreating the effect trigger on every render, since a new `load` closure is made each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [tenant]);

  const upload = async (file: File) => {
    if (!tenant) return;
    const { data, error } = await supabase.from('documents').insert({
      tenant_id: tenant.id, name: file.name, type: file.type, size: file.size, uploaded_by: profile?.id, url: '',
    }).select().single();
    if (!error && data) setItems(prev => [data, ...prev]);
  };

  const remove = async (id: string) => {
    setItems(prev => prev.filter(d => d.id !== id));
    await supabase.from('documents').delete().eq('id', id);
  };

  return (
    <div>
      <PageHeader title="Documents" subtitle="Vos fichiers partagés au sein du tenant"
        actions={<Button onClick={() => inputRef.current?.click()}><Upload size={16} /> Téléverser</Button>} />
      <input ref={inputRef} type="file" className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />

      {items.length === 0 ? (
        <Card className="p-8"><EmptyState icon={FileText} title="Aucun document" description="Téléversez vos documents pour les partager avec votre équipe." /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(d => (
            <Card key={d.id} className="group p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-mint-50 p-2.5 text-mint-700"><FileText size={20} /></div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{d.name}</p>
                  <p className="text-xs text-gray-500">{d.type || 'fichier'} · {formatDate(d.created_at)}</p>
                </div>
                <button onClick={() => remove(d.id)} className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
