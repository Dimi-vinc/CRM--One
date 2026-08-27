import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, Trash2, Download, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import type { DocumentRow } from '../../lib/types';

function formatBytes(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function Documents() {
  const { tenant, profile } = useAuth();
  const [items, setItems] = useState<DocumentRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    setUploading(true);
    // Path is prefixed by tenant_id, matching the storage RLS policy (migration 0032) — this is
    // what stops another tenant from ever reading or overwriting this file.
    const path = `${tenant.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file);
    if (uploadErr) {
      setError(`Échec du téléversement : ${uploadErr.message}`);
      setUploading(false);
      return;
    }
    const { data, error: insertErr } = await supabase.from('documents').insert({
      tenant_id: tenant.id, name: file.name, type: file.type, size: file.size, uploaded_by: profile?.id, url: path,
    }).select().single();
    if (insertErr) {
      // Roll back the orphaned storage object rather than leaving a file with no matching record.
      await supabase.storage.from('documents').remove([path]);
      setError(`Échec de l'enregistrement : ${insertErr.message}`);
      setUploading(false);
      return;
    }
    if (data) setItems(prev => [data, ...prev]);
    setUploading(false);
  };

  const download = async (d: DocumentRow) => {
    if (!d.url) return;
    setError(null);
    const { data, error: signErr } = await supabase.storage.from('documents').createSignedUrl(d.url, 60);
    if (signErr || !data) {
      setError("Impossible de générer le lien de téléchargement. Le fichier existe peut-être encore en base mais plus dans le stockage.");
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const remove = async (d: DocumentRow) => {
    if (!confirm(`Supprimer "${d.name}" ?`)) return;
    setItems(prev => prev.filter(x => x.id !== d.id));
    await supabase.from('documents').delete().eq('id', d.id);
    if (d.url) await supabase.storage.from('documents').remove([d.url]);
  };

  return (
    <div>
      <PageHeader title="Documents" subtitle="Vos fichiers partagés au sein du tenant"
        actions={<Button onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {uploading ? 'Téléversement…' : 'Téléverser'}</Button>} />
      <input ref={inputRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = ''; }} />
      {error && <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {items.length === 0 ? (
        <Card className="p-8"><EmptyState icon={FileText} title="Aucun document" description="Téléversez vos documents pour les partager avec votre équipe." /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(d => (
            <Card key={d.id} className="group p-4">
              <div className="flex items-start gap-3">
                <button onClick={() => download(d)} className="rounded-xl bg-mint-50 p-2.5 text-mint-700 hover:bg-mint-100" title="Télécharger"><FileText size={20} /></button>
                <button onClick={() => download(d)} className="flex-1 min-w-0 text-left">
                  <p className="truncate text-sm font-medium text-gray-900 hover:underline">{d.name}</p>
                  <p className="text-xs text-gray-500">{d.type || 'fichier'}{d.size ? ` · ${formatBytes(d.size)}` : ''} · {formatDate(d.created_at)}</p>
                </button>
                <button onClick={() => download(d)} className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-gray-400 hover:bg-mint-50 hover:text-mint-700" title="Télécharger"><Download size={14} /></button>
                <button onClick={() => remove(d)} className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Supprimer"><Trash2 size={14} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
