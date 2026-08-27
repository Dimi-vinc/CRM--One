import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BookOpen, Search, ChevronLeft, LifeBuoy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SupportChatWidget } from '../components/SupportChatWidget';
import type { KbArticle } from '../lib/types';

const STRINGS = {
  fr: {
    helpCenter: 'Centre d\'aide', searchPlaceholder: 'Rechercher un article…', back: '← Retour',
    noResults: 'Aucun article trouvé.', noResultsHint: 'Essayez un autre terme de recherche.',
    poweredBy: 'Propulsé par', contactSupport: 'Besoin d\'aide supplémentaire ?', general: 'Général',
    article: (n: number) => n === 1 ? '1 article' : `${n} articles`,
  },
  en: {
    helpCenter: 'Help Center', searchPlaceholder: 'Search for an article…', back: '← Back',
    noResults: 'No articles found.', noResultsHint: 'Try a different search term.',
    poweredBy: 'Powered by', contactSupport: 'Need more help?', general: 'General',
    article: (n: number) => n === 1 ? '1 article' : `${n} articles`,
  },
};

// Public, unauthenticated portal — any visitor with a valid tenantId in the URL can land here.
// Uses the narrow tenant_public_info view (migration 0036) for branding, since the real
// public.tenants table is (correctly) fully locked down to tenant members only.
export function PublicKnowledgeBase() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [locale, setLocale] = useState<'fr' | 'en'>('fr');
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<KbArticle | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const t = STRINGS[locale];

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const [{ data: tenantInfo }, { data: kb }] = await Promise.all([
        supabase.from('tenant_public_info').select('name, locale').eq('id', tenantId).maybeSingle(),
        supabase.from('kb_articles').select('*').eq('tenant_id', tenantId).eq('is_public', true).order('title'),
      ]);
      if (tenantInfo?.name) setTenantName(tenantInfo.name);
      if (tenantInfo?.locale === 'en') setLocale('en');
      setArticles(kb || []);
      setLoading(false);
    })();
  }, [tenantId]);

  useEffect(() => {
    document.title = tenantName ? `${t.helpCenter} · ${tenantName}` : t.helpCenter;
  }, [tenantName, t.helpCenter]);

  const filtered = useMemo(
    () => articles.filter(a => a.title.toLowerCase().includes(query.toLowerCase()) || a.content.toLowerCase().includes(query.toLowerCase())),
    [articles, query],
  );

  const grouped = useMemo(() => {
    const map: Record<string, KbArticle[]> = {};
    filtered.forEach(a => {
      const cat = a.category || t.general;
      (map[cat] ||= []).push(a);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, t.general]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center sm:px-6">
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <LifeBuoy size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">{t.helpCenter}</span>
          </div>
          <h1 className="mt-2 flex items-center justify-center gap-2 text-2xl font-bold text-gray-900">
            <BookOpen size={22} className="text-coral-500" />
            {tenantName || '…'}
          </h1>
          <div className="relative mx-auto mt-5 max-w-lg">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null); setActiveCategory(null); }}
              placeholder={t.searchPlaceholder}
              className="input w-full pl-10 shadow-sm"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}
          </div>
        ) : selected ? (
          <div>
            <button onClick={() => setSelected(null)} className="mb-4 text-sm font-medium text-coral-600 hover:underline">{t.back}</button>
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h2 className="text-xl font-bold text-gray-900">{selected.title}</h2>
              <div className="prose prose-sm mt-4 max-w-none whitespace-pre-wrap text-gray-700">{selected.content}</div>
            </div>
          </div>
        ) : activeCategory ? (
          <div>
            <button onClick={() => setActiveCategory(null)} className="mb-4 flex items-center gap-1 text-sm font-medium text-coral-600 hover:underline"><ChevronLeft size={15} /> {t.back}</button>
            <h2 className="mb-4 text-lg font-bold text-gray-900">{activeCategory}</h2>
            <div className="space-y-2">
              {(grouped.find(([c]) => c === activeCategory)?.[1] || []).map(a => (
                <button key={a.id} onClick={() => setSelected(a)} className="block w-full rounded-xl bg-white p-4 text-left shadow-sm transition hover:shadow-card">
                  <p className="font-medium text-gray-900">{a.title}</p>
                  <p className="mt-1 line-clamp-1 text-sm text-gray-500">{a.content}</p>
                </button>
              ))}
            </div>
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-card">
            <BookOpen size={28} className="mx-auto text-gray-300" />
            <p className="mt-3 font-medium text-gray-700">{t.noResults}</p>
            <p className="mt-1 text-sm text-gray-400">{t.noResultsHint}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {grouped.map(([cat, items]) => (
              <button key={cat} onClick={() => setActiveCategory(cat)} className="rounded-2xl bg-white p-5 text-left shadow-sm transition hover:shadow-card">
                <BookOpen size={18} className="text-coral-500" />
                <p className="mt-2.5 font-semibold text-gray-900">{cat}</p>
                <p className="mt-0.5 text-xs text-gray-400">{t.article(items.length)}</p>
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-100 bg-white py-6 text-center text-xs text-gray-400">
        <p>{t.contactSupport}</p>
        <p className="mt-1">{t.poweredBy} <Link to="/" className="font-medium text-gray-500 hover:text-coral-600">CRM-One</Link></p>
      </footer>

      {tenantId && <SupportChatWidget tenantId={tenantId} />}
    </div>
  );
}

