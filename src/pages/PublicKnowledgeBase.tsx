import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BookOpen, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SupportChatWidget } from '../components/SupportChatWidget';
import type { KbArticle } from '../lib/types';

export function PublicKnowledgeBase() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<KbArticle | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const { data } = await supabase.from('kb_articles').select('*').eq('tenant_id', tenantId).eq('is_public', true).order('title');
      setArticles(data || []);
      setLoading(false);
    })();
  }, [tenantId]);

  const filtered = articles.filter(a => a.title.toLowerCase().includes(query.toLowerCase()) || a.content.toLowerCase().includes(query.toLowerCase()));
  const grouped = filtered.reduce<Record<string, KbArticle[]>>((acc, a) => {
    const cat = a.category || 'Général';
    (acc[cat] = acc[cat] || []).push(a);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-2">
          <BookOpen size={24} className="text-coral-600" />
          <h1 className="text-2xl font-bold text-gray-900">Centre d'aide</h1>
        </div>

        {selected ? (
          <div className="rounded-xl bg-white p-6 shadow-card">
            <button onClick={() => setSelected(null)} className="mb-4 text-sm text-coral-600 hover:underline">← Retour</button>
            <h2 className="text-xl font-bold text-gray-900">{selected.title}</h2>
            <div className="mt-4 whitespace-pre-wrap text-sm text-gray-700">{selected.content}</div>
          </div>
        ) : (
          <>
            <div className="relative mb-6">
              <Search size={16} className="absolute left-3 top-3.5 text-gray-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un article…" className="input pl-9" />
            </div>

            {loading ? (
              <p className="text-sm text-gray-400">Chargement…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun article trouvé.</p>
            ) : (
              Object.entries(grouped).map(([cat, arts]) => (
                <div key={cat} className="mb-6">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{cat}</h3>
                  <div className="space-y-2">
                    {arts.map(a => (
                      <button key={a.id} onClick={() => setSelected(a)} className="block w-full rounded-lg bg-white p-4 text-left shadow-card hover:shadow-cardHover">
                        <p className="font-medium text-gray-900">{a.title}</p>
                        <p className="mt-1 line-clamp-1 text-sm text-gray-500">{a.content}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
      {tenantId && <SupportChatWidget tenantId={tenantId} />}
    </div>
  );
}
