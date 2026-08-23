import { useEffect, useState } from 'react';
import { Plus, Trash2, Copy, Check, Key, Webhook as WebhookIcon, AlertCircle, ScrollText, Power } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';
import type { ApiKey, Webhook, WebhookDelivery, WebhookEvent } from '../../lib/types';

const EVENTS: { value: WebhookEvent; label: string }[] = [
  { value: 'contact_added', label: 'Contact ajouté' },
  { value: 'deal_created', label: 'Deal créé' },
  { value: 'deal_won', label: 'Deal gagné' },
  { value: 'activity_done', label: 'Activité terminée' },
];

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function Developers() {
  const { tenant } = useAuth();
  const [tab, setTab] = useState<'keys' | 'webhooks'>('keys');

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keyModal, setKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [whModal, setWhModal] = useState(false);
  const [whForm, setWhForm] = useState({ name: '', url: '', events: [] as WebhookEvent[] });
  const [deliveriesFor, setDeliveriesFor] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);

  const apiBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-v1`;

  const load = async () => {
    if (!tenant) return;
    const [{ data: k }, { data: w }] = await Promise.all([
      supabase.from('api_keys').select('*').is('revoked_at', null).order('created_at', { ascending: false }),
      supabase.from('webhooks').select('*').order('created_at', { ascending: false }),
    ]);
    setKeys(k || []);
    setWebhooks(w || []);
  };
  // load() only reads `tenant` (already a dependency below) — intentionally omitted to avoid
  // recreating the effect trigger on every render, since a new `load` closure is made each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [tenant]);

  const createKey = async () => {
    if (!tenant || !newKeyName.trim()) return;
    const rawKey = `crm1_${randomHex(24)}`;
    const enc = new TextEncoder().encode(rawKey);
    const hashBuf = await crypto.subtle.digest('SHA-256', enc);
    const keyHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    const { data, error } = await supabase.from('api_keys').insert({
      tenant_id: tenant.id, name: newKeyName, key_hash: keyHash, key_prefix: rawKey.slice(0, 12),
    }).select().single();
    if (!error && data) {
      setKeys(prev => [data, ...prev]);
      setRevealedKey(rawKey); // shown ONCE — never retrievable again after this
      setNewKeyName('');
    }
  };
  const revokeKey = async (id: string) => {
    setKeys(prev => prev.filter(k => k.id !== id));
    await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  };
  const copyKey = async () => {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const createWebhook = async () => {
    if (!tenant || !whForm.name.trim() || !whForm.url.trim() || whForm.events.length === 0) return;
    const { data, error } = await supabase.from('webhooks').insert({
      tenant_id: tenant.id, name: whForm.name, url: whForm.url, events: whForm.events, secret: randomHex(32),
    }).select().single();
    if (!error && data) {
      setWebhooks(prev => [data, ...prev]);
      setWhModal(false);
      setWhForm({ name: '', url: '', events: [] });
    }
  };
  const toggleWebhook = async (w: Webhook) => {
    setWebhooks(prev => prev.map(x => x.id === w.id ? { ...x, is_active: !x.is_active } : x));
    await supabase.from('webhooks').update({ is_active: !w.is_active }).eq('id', w.id);
  };
  const removeWebhook = async (id: string) => {
    setWebhooks(prev => prev.filter(w => w.id !== id));
    await supabase.from('webhooks').delete().eq('id', id);
  };
  const openDeliveries = async (w: Webhook) => {
    setDeliveriesFor(w);
    const { data } = await supabase.from('webhook_deliveries').select('*').eq('webhook_id', w.id).order('created_at', { ascending: false }).limit(50);
    setDeliveries(data || []);
  };
  const toggleEvent = (ev: WebhookEvent) => setWhForm(f => ({ ...f, events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev] }));

  return (
    <div>
      <PageHeader title="API & Webhooks" subtitle="Connectez CRM-One à Zapier, Make, n8n, ou vos propres scripts" />

      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab('keys')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'keys' ? 'bg-coral-600 text-white' : 'bg-gray-100 text-gray-600'}`}><Key size={14} className="mr-1.5 inline" />Clés API</button>
        <button onClick={() => setTab('webhooks')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'webhooks' ? 'bg-coral-600 text-white' : 'bg-gray-100 text-gray-600'}`}><WebhookIcon size={14} className="mr-1.5 inline" />Webhooks</button>
      </div>

      {tab === 'keys' ? (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Clés API</h3>
              <p className="text-sm text-gray-500">Base URL : <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{apiBaseUrl}</code></p>
            </div>
            <Button onClick={() => setKeyModal(true)}><Plus size={16} /> Nouvelle clé</Button>
          </div>
          <div className="mt-4 divide-y divide-gray-50">
            {keys.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Aucune clé API active.</p>
            ) : keys.map(k => (
              <div key={k.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{k.name}</p>
                  <p className="text-xs text-gray-400"><code>{k.key_prefix}…</code> · créée le {formatDateTime(k.created_at)} · {k.last_used_at ? `utilisée le ${formatDateTime(k.last_used_at)}` : 'jamais utilisée'}</p>
                </div>
                <button onClick={() => revokeKey(k.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Documentation complète : voir <code className="mx-1 rounded bg-gray-100 px-1">supabase/API_DOCUMENTATION.md</code> dans le dépôt.
          </p>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Webhooks sortants</h3>
              <p className="text-sm text-gray-500">Fonctionne avec "Webhooks by Zapier", Make.com "Catch Hook", n8n, ou toute URL HTTP.</p>
            </div>
            <Button onClick={() => setWhModal(true)}><Plus size={16} /> Nouveau webhook</Button>
          </div>
          <div className="mt-4 divide-y divide-gray-50">
            {webhooks.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Aucun webhook configuré.</p>
            ) : webhooks.map(w => (
              <div key={w.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{w.name}</p>
                    <p className="text-xs text-gray-500 break-all">{w.url}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {w.events.map(ev => <Badge key={ev} color="blue">{EVENTS.find(e => e.value === ev)?.label || ev}</Badge>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge color={w.is_active ? 'green' : 'gray'}>{w.is_active ? 'Actif' : 'Inactif'}</Badge>
                    <Button size="sm" variant="secondary" onClick={() => openDeliveries(w)}><ScrollText size={13} /></Button>
                    <button onClick={() => toggleWebhook(w)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><Power size={15} /></button>
                    <button onClick={() => removeWebhook(w.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={keyModal} onClose={() => { setKeyModal(false); setRevealedKey(null); }} title="Nouvelle clé API">
        {revealedKey ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>Copiez cette clé maintenant — elle ne sera plus jamais affichée en entier.</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
              <code className="flex-1 break-all text-xs">{revealedKey}</code>
              <button onClick={copyKey} className="text-gray-400 hover:text-gray-700">{copiedKey ? <Check size={16} className="text-mint-600" /> : <Copy size={16} />}</button>
            </div>
            <Button className="w-full" onClick={() => { setKeyModal(false); setRevealedKey(null); }}>Terminé</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Input label="Nom (ex: Zapier)" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setKeyModal(false)}>Annuler</Button>
              <Button onClick={createKey} disabled={!newKeyName.trim()}>Créer</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={whModal} onClose={() => setWhModal(false)} title="Nouveau webhook">
        <div className="space-y-3">
          <Input label="Nom" value={whForm.name} onChange={e => setWhForm({ ...whForm, name: e.target.value })} placeholder="Ex: Zapier - nouveaux contacts" />
          <Input label="URL de destination" value={whForm.url} onChange={e => setWhForm({ ...whForm, url: e.target.value })} placeholder="https://hooks.zapier.com/hooks/catch/..." />
          <div>
            <p className="label mb-1">Événements</p>
            <div className="space-y-1">
              {EVENTS.map(ev => (
                <label key={ev.value} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={whForm.events.includes(ev.value)} onChange={() => toggleEvent(ev.value)} />
                  {ev.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setWhModal(false)}>Annuler</Button>
            <Button onClick={createWebhook} disabled={!whForm.name.trim() || !whForm.url.trim() || whForm.events.length === 0}>Créer</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deliveriesFor} onClose={() => setDeliveriesFor(null)} title={`Livraisons — ${deliveriesFor?.name || ''}`} size="lg">
        {deliveries.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Aucune livraison pour l'instant.</p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {deliveries.map(d => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{d.event}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(d.created_at)} {d.status_code && `· HTTP ${d.status_code}`}</p>
                </div>
                <Badge color={d.success ? 'green' : 'red'}>{d.success ? 'Livré' : 'Échec'}</Badge>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
