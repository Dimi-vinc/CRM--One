import { useEffect, useMemo, useState } from 'react';
import { Search, ExternalLink, Check, Key, X, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Input, Modal, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import {
  INTEGRATIONS, INTEGRATION_CATEGORIES, PAYMENT_SUBCATEGORIES,
  type IntegrationDef, type IntegrationCategory, type PaymentSubcategory,
} from '../../lib/integrations';

// Real official brand marks via Simple Icons (https://simpleicons.org, MIT-licensed) — resolved
// in the browser, not bundled. Falls back to a colored initials badge if a slug is missing/wrong
// so the UI never shows a broken image, even for brands not in that set (e.g. our own products,
// or smaller regional providers).
function IntegrationLogo({ item }: { item: IntegrationDef }) {
  const [failed, setFailed] = useState(!item.logoSlug);
  if (failed || !item.logoSlug) {
    const color = item.logoColor || '0070E0';
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: `#${color}` }}>
        {item.name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white p-2">
      <img
        src={`https://cdn.simpleicons.org/${item.logoSlug}${item.logoColor ? `/${item.logoColor}` : ''}`}
        alt={item.name}
        className="h-full w-full object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function Integrations() {
  const { session } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<IntegrationCategory | 'all'>('all');
  const [paymentSub, setPaymentSub] = useState<PaymentSubcategory | 'all'>('all');
  const [connections, setConnections] = useState<Record<string, { status: string }>>({});
  const [keyModal, setKeyModal] = useState<IntegrationDef | null>(null);
  const [keyValue, setKeyValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = async () => {
    const { data } = await supabase.from('integration_connections').select('provider_id, status');
    const map: Record<string, { status: string }> = {};
    (data || []).forEach(c => { map[c.provider_id] = { status: c.status }; });
    setConnections(map);
  };
  useEffect(() => { loadConnections(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return INTEGRATIONS.filter(item => {
      if (category !== 'all' && item.category !== category) return false;
      if (category === 'payments' && paymentSub !== 'all' && !item.paymentSubcategories?.includes(paymentSub)) return false;
      if (q && !item.name.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, category, paymentSub]);

  const connect = async (item: IntegrationDef) => {
    setError(null);
    if (item.authType === 'api_key') {
      setKeyValue('');
      setKeyModal(item);
      return;
    }
    // OAuth: ask the backend for the correct provider authorize URL (fails gracefully with a
    // clear message if the platform operator hasn't configured this provider's app yet).
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-integration-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ providerId: item.id, returnUrl: '/integrations' }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || `${item.name} n'est pas encore configuré sur cette instance.`);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Connexion impossible pour le moment.');
    }
  };

  const saveKey = async () => {
    if (!keyModal || !keyValue.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-integration-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ providerId: keyModal.id, apiKey: keyValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Échec de la connexion.'); setSaving(false); return; }
      setConnections(prev => ({ ...prev, [keyModal.id]: { status: 'connected' } }));
      setKeyModal(null);
    } catch {
      setError('Connexion impossible pour le moment.');
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async (item: IntegrationDef) => {
    setConnections(prev => { const next = { ...prev }; delete next[item.id]; return next; });
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-integration-key`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ providerId: item.id }),
    }).catch(() => {});
  };

  const categoryLabel = INTEGRATION_CATEGORIES.find(c => c.id === category)?.label || '';

  return (
    <div>
      <PageHeader title="Intégrations" subtitle="Connectez CRM-One à vos outils préférés" />

      <div className="relative mb-4">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une application…"
          className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-coral-400"
        />
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {INTEGRATION_CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => { setCategory(c.id); setPaymentSub('all'); }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${category === c.id ? 'bg-coral-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {category === 'payments' && (
        <div className="mb-4 flex flex-wrap gap-2 rounded-xl bg-gray-50 p-2">
          {PAYMENT_SUBCATEGORIES.map(s => (
            <button
              key={s.id}
              onClick={() => setPaymentSub(s.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${paymentSub === s.id ? 'bg-blue-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <p className="mb-4 text-sm text-gray-500">{filtered.length} intégration{filtered.length === 1 ? '' : 's'}{category !== 'all' ? ` ${categoryLabel}` : ''}</p>

      {error && <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {filtered.length === 0 ? (
        <Card className="p-8"><EmptyState icon={Search} title="Aucune intégration trouvée" description="Essayez un autre terme de recherche ou une autre catégorie." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(item => {
            const connected = connections[item.id]?.status === 'connected';
            return (
              <Card key={item.id} className="flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <IntegrationLogo item={item} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-400">{INTEGRATION_CATEGORIES.find(c => c.id === item.category)?.label}</p>
                  </div>
                  {connected && <span className="flex items-center gap-1 rounded-full bg-mint-50 px-2 py-0.5 text-[10px] font-semibold text-mint-700"><Check size={11} /> Connecté</span>}
                </div>
                <p className="mt-3 flex-1 text-xs text-gray-600">{item.description}</p>
                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                  {item.authType === 'api_key' ? <Key size={11} /> : null}
                  {item.authType === 'api_key' ? 'Clé API' : 'OAuth'}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {connected ? (
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => disconnect(item)}><X size={13} /> Déconnecter</Button>
                  ) : (
                    <Button size="sm" className="flex-1" onClick={() => connect(item)}>Connecter</Button>
                  )}
                  <a href={item.docsUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600" title="Docs">
                    <ExternalLink size={14} />
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!keyModal} onClose={() => setKeyModal(null)} title={keyModal ? `Connecter ${keyModal.name}` : ''}>
        {keyModal && (
          <div>
            <p className="mb-3 text-sm text-gray-600">Collez votre clé API {keyModal.name}. Elle est stockée de façon privée, visible uniquement par vous.</p>
            <Input label="Clé API" type="password" value={keyValue} onChange={e => setKeyValue(e.target.value)} placeholder="sk-..." autoFocus />
            <a href={keyModal.docsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-coral-600 hover:underline">Où trouver ma clé ? <ExternalLink size={11} /></a>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setKeyModal(null)}>Annuler</Button>
              <Button onClick={saveKey} disabled={saving || !keyValue.trim()}>{saving ? <Loader2 size={14} className="animate-spin" /> : null} Connecter</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
