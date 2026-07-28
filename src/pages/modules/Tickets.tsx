import { useEffect, useMemo, useState } from 'react';
import { Plus, LifeBuoy, Send, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input, Select, Textarea, Badge, EmptyState, Skeleton } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';
import type { Ticket, TicketComment, TicketStatus, TicketPriority, Contact } from '../../lib/types';

const STATUSES: { id: TicketStatus; label: string; color: 'gray' | 'orange' | 'green' | 'blue' }[] = [
  { id: 'open', label: 'Ouvert', color: 'blue' },
  { id: 'pending', label: 'En attente', color: 'orange' },
  { id: 'resolved', label: 'Résolu', color: 'green' },
  { id: 'closed', label: 'Fermé', color: 'gray' },
];
const PRIORITIES: { id: TicketPriority; label: string; color: 'gray' | 'blue' | 'orange' | 'red' }[] = [
  { id: 'low', label: 'Basse', color: 'gray' },
  { id: 'medium', label: 'Moyenne', color: 'blue' },
  { id: 'high', label: 'Haute', color: 'orange' },
  { id: 'urgent', label: 'Urgente', color: 'red' },
];

export function Tickets() {
  const { tenant, profile } = useAuth();
  const [items, setItems] = useState<Ticket[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', priority: 'medium' as TicketPriority, contact_id: '' });
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from('tickets').select('*').order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').order('first_name'),
    ]);
    setItems(t || []);
    setContacts(c || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [tenant]);

  const byStatus = useMemo(() => {
    const g: Record<TicketStatus, Ticket[]> = { open: [], pending: [], resolved: [], closed: [] };
    items.forEach(t => g[t.status].push(t));
    return g;
  }, [items]);

  const contactName = (id: string | null) => {
    const c = contacts.find(x => x.id === id);
    return c ? `${c.first_name} ${c.last_name || ''}`.trim() : '—';
  };

  const create = async () => {
    if (!tenant || !form.subject.trim()) return;
    const { data } = await supabase.from('tickets').insert({
      tenant_id: tenant.id,
      subject: form.subject,
      description: form.description || null,
      priority: form.priority,
      contact_id: form.contact_id || null,
    }).select().single();
    if (data) setItems(prev => [data, ...prev]);
    setModal(false);
    setForm({ subject: '', description: '', priority: 'medium', contact_id: '' });
  };

  const updateStatus = async (t: Ticket, status: TicketStatus) => {
    setItems(prev => prev.map(x => x.id === t.id ? { ...x, status } : x));
    if (detail?.id === t.id) setDetail(prev => prev ? { ...prev, status } : prev);
    await supabase.from('tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', t.id);
  };

  const openDetail = async (t: Ticket) => {
    setDetail(t);
    const { data } = await supabase.from('ticket_comments').select('*').eq('ticket_id', t.id).order('created_at', { ascending: true });
    setComments(data || []);
  };

  const addComment = async () => {
    if (!detail || !commentBody.trim() || !tenant) return;
    const { data } = await supabase.from('ticket_comments').insert({
      ticket_id: detail.id, tenant_id: tenant.id, author_id: profile?.id,
      body: commentBody, is_internal: internalNote,
    }).select().single();
    if (data) setComments(prev => [...prev, data]);

    // Actually email the contact for real replies (not internal notes)
    if (!internalNote && detail.contact_id) {
      const contact = contacts.find(c => c.id === detail.contact_id);
      if (contact?.email) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          try {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: contact.email,
                subject: `Re: ${detail.subject}`,
                html: `<p>${commentBody.replace(/\n/g, '<br/>')}</p>`,
                contact_id: contact.id,
              }),
            });
          } catch {
            setEmailWarning("La réponse a été enregistrée, mais l'email n'a pas pu être envoyé (fonction d'envoi non déployée ou clé Resend absente).");
          }
        }
      }
    }
    setCommentBody('');
    if (detail.status === 'open') await updateStatus(detail, 'pending');
  };

  const prio = (p: TicketPriority) => PRIORITIES.find(x => x.id === p)!;

  return (
    <div>
      <PageHeader
        title="Tickets support"
        subtitle="Suivi des demandes clients par statut"
        actions={<Button onClick={() => setModal(true)}><Plus size={16} /> Nouveau ticket</Button>}
      />

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-4">{STATUSES.map(s => <Card key={s.id} className="h-40 animate-pulse bg-gray-50" />)}</div>
      ) : items.length === 0 ? (
        <Card className="p-8"><EmptyState icon={LifeBuoy} title="Aucun ticket" description="Les demandes clients apparaîtront ici." action={<Button onClick={() => setModal(true)}>Créer un ticket</Button>} /></Card>
      ) : (
        <div className="grid gap-3 overflow-x-auto pb-2 lg:grid-cols-4">
          {STATUSES.map(s => (
            <div key={s.id} className="min-w-[260px]">
              <div className="mb-2 flex items-center justify-between px-1">
                <Badge color={s.color}>{s.label}</Badge>
                <span className="text-xs text-gray-400">{byStatus[s.id].length}</span>
              </div>
              <div className="space-y-2">
                {byStatus[s.id].map(t => (
                  <Card key={t.id} className="cursor-pointer p-3 hover:shadow-cardHover" onClick={() => openDetail(t)}>
                    <p className="text-sm font-medium text-gray-900">{t.subject}</p>
                    <p className="mt-1 text-xs text-gray-500">{contactName(t.contact_id)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge color={prio(t.priority).color}>{prio(t.priority).label}</Badge>
                      <span className="text-[11px] text-gray-400">{formatDateTime(t.created_at)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nouveau ticket">
        <div className="space-y-3">
          <Input label="Sujet" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Résumé du problème" />
          <Select label="Contact" value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value })}>
            <option value="">— Aucun —</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </Select>
          <Select label="Priorité" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as TicketPriority })}>
            {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
          <Textarea label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button onClick={create} disabled={!form.subject.trim()}>Créer</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.subject || ''} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {STATUSES.map(s => (
                <button key={s.id} onClick={() => updateStatus(detail, s.id)}>
                  <Badge color={detail.status === s.id ? s.color : 'gray'}>{s.label}</Badge>
                </button>
              ))}
              <span className="ml-auto"><Badge color={prio(detail.priority).color}>{prio(detail.priority).label}</Badge></span>
            </div>
            {detail.description && <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{detail.description}</p>}

            <div className="max-h-64 space-y-2 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-400">Aucun échange pour l'instant.</p>
              ) : comments.map(c => (
                <div key={c.id} className={`rounded-lg p-3 text-sm ${c.is_internal ? 'bg-amber-50' : 'bg-gray-50'}`}>
                  {c.is_internal && <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-amber-700"><Lock size={11} /> Note interne</p>}
                  <p className="text-gray-700">{c.body}</p>
                  <p className="mt-1 text-[11px] text-gray-400">{formatDateTime(c.created_at)}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-gray-100 pt-3">
              {emailWarning && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">{emailWarning}</p>}
              <Textarea value={commentBody} onChange={e => setCommentBody(e.target.value)} rows={2} placeholder="Répondre au client…" />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs text-gray-500">
                  <input type="checkbox" checked={internalNote} onChange={e => setInternalNote(e.target.checked)} /> Note interne (non envoyée au client)
                </label>
                <Button size="sm" onClick={addComment} disabled={!commentBody.trim()}><Send size={14} /> Envoyer</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
