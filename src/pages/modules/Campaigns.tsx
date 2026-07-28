import { useEffect, useMemo, useState } from 'react';
import { Mail, Plus, Send, Users, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input, Select, Textarea, Badge, EmptyState, Skeleton } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { timeAgo } from '../../lib/utils';
import { COUNTRIES } from '../../lib/constants';
import type { EmailCampaign, CampaignStatus, Contact } from '../../lib/types';

const STATUS_META: Record<CampaignStatus, { label: string; color: 'gray' | 'blue' | 'green' }> = {
  draft: { label: 'Brouillon', color: 'gray' },
  sending: { label: 'Envoi en cours…', color: 'blue' },
  sent: { label: 'Envoyée', color: 'green' },
};

export function Campaigns() {
  const { tenant } = useAuth();
  const [items, setItems] = useState<EmailCampaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', body_html: '', segment_country_code: '', segment_min_score: '' });
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ id: string; sent: number; failed: number } | null>(null);

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const [{ data: c }, { data: cts }] = await Promise.all([
      supabase.from('email_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('contacts').select('*'),
    ]);
    setItems(c || []);
    setContacts(cts || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [tenant]);

  const consentedCount = useMemo(() => contacts.filter(c => c.marketing_consent && c.email).length, [contacts]);

  const create = async () => {
    if (!tenant || !form.name.trim() || !form.subject.trim() || !form.body_html.trim()) return;
    setSaving(true);
    const { data } = await supabase.from('email_campaigns').insert({
      tenant_id: tenant.id, name: form.name, subject: form.subject, body_html: form.body_html,
      segment_country_code: form.segment_country_code || null,
      segment_min_score: form.segment_min_score ? Number(form.segment_min_score) : null,
      status: 'draft',
    }).select().single();
    setSaving(false);
    if (data) { setItems(prev => [data, ...prev]); setModal(false); setForm({ name: '', subject: '', body_html: '', segment_country_code: '', segment_min_score: '' }); }
  };

  const send = async (campaign: EmailCampaign) => {
    if (!confirm(`Envoyer "${campaign.name}" à tous les contacts avec consentement marketing correspondant au segment ?`)) return;
    setSendingId(campaign.id);
    const { data: sessionData } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-campaign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ campaign_id: campaign.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Échec de l\'envoi');
      setSendResult({ id: campaign.id, sent: json.sent, failed: json.failed });
      setItems(prev => prev.map(c => c.id === campaign.id ? { ...c, status: 'sent', sent_at: new Date().toISOString() } : c));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Échec de l\'envoi de la campagne.');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Campagnes email"
        subtitle="Marketing par email, segmenté et respectueux du consentement (RGPD)"
        actions={<Button onClick={() => setModal(true)}><Plus size={16} /> Nouvelle campagne</Button>}
      />

      <div className="mb-4 flex items-center gap-2 rounded-lg bg-mint-50 p-3 text-sm text-mint-800">
        <Users size={16} /> {consentedCount} contact(s) ont donné leur consentement marketing sur {contacts.length} au total.
        <span className="text-mint-600">(Gérable dans la fiche de chaque contact.)</span>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : items.length === 0 ? (
        <Card className="p-8"><EmptyState icon={Mail} title="Aucune campagne" description="Créez votre première campagne email." action={<Button onClick={() => setModal(true)}>Créer</Button>} /></Card>
      ) : (
        <div className="space-y-2">
          {items.map(c => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.subject} · {c.sent_at ? `Envoyée ${timeAgo(c.sent_at)}` : `Créée ${timeAgo(c.created_at)}`}</p>
                  {sendResult?.id === c.id && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-mint-700"><CheckCircle2 size={12} /> {sendResult.sent} envoyé(s), {sendResult.failed} échec(s)</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={STATUS_META[c.status].color}>{STATUS_META[c.status].label}</Badge>
                  {c.status === 'draft' && (
                    <Button size="sm" onClick={() => send(c)} disabled={sendingId === c.id}>
                      <Send size={13} /> {sendingId === c.id ? 'Envoi…' : 'Envoyer'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nouvelle campagne">
        <div className="space-y-3">
          <Input label="Nom (interne)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Relance rentrée 2026" />
          <Input label="Objet de l'email" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
          <Textarea label="Contenu (HTML, {{first_name}} pour personnaliser)" rows={6} value={form.body_html} onChange={e => setForm({ ...form, body_html: e.target.value })} placeholder="<p>Bonjour {{first_name}},</p>" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Segment : pays (optionnel)" value={form.segment_country_code} onChange={e => setForm({ ...form, segment_country_code: e.target.value })}>
              <option value="">Tous les pays</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
            <Input label="Score min. (optionnel, 0-100)" type="number" min={0} max={100} value={form.segment_min_score} onChange={e => setForm({ ...form, segment_min_score: e.target.value })} />
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            Seuls les contacts ayant explicitement donné leur consentement marketing recevront cet email, quel que soit le segment choisi.
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button onClick={create} disabled={saving || !form.name.trim() || !form.subject.trim() || !form.body_html.trim()}>{saving ? 'Création…' : 'Créer le brouillon'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
