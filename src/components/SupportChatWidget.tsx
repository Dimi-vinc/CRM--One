import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Loader2, LifeBuoy, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ChatMsg { role: 'user' | 'assistant'; content: string }

export function SupportChatWidget({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', content: "Bonjour 👋 Comment puis-je vous aider aujourd'hui ?" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketForm, setTicketForm] = useState({ name: '', email: '', subject: '' });
  const [ticketSent, setTicketSent] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, showTicketForm]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const nextMessages: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({
          tenantId,
          message: text,
          history: nextMessages.slice(-8).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.notConfigured) {
        setNotConfigured(true);
        setMessages(prev => [...prev, { role: 'assistant', content: "L'assistant n'est pas encore disponible. Je peux créer un ticket pour vous à la place." }]);
        setShowTicketForm(true);
        return;
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.escalate) setShowTicketForm(true);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Une erreur est survenue. Je peux créer un ticket pour vous à la place." }]);
      setShowTicketForm(true);
    } finally {
      setLoading(false);
    }
  };

  const submitTicket = async () => {
    if (!ticketForm.name.trim() || !ticketForm.email.trim() || !ticketForm.subject.trim()) {
      setTicketError('Merci de remplir tous les champs.');
      return;
    }
    setTicketError(null);
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-public-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({
          tenantId,
          name: ticketForm.name,
          email: ticketForm.email,
          subject: ticketForm.subject,
          description: messages.map(m => `${m.role === 'user' ? 'Client' : 'Assistant'}: ${m.content}`).join('\n'),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setTicketError(data.error || 'Échec de la création du ticket.'); return; }
      setTicketSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Ouvrir le chat de support"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700 hover:scale-105"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[70vh] max-h-[560px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center gap-2 bg-blue-600 px-4 py-3 text-white">
            <LifeBuoy size={18} />
            <p className="text-sm font-semibold">Support</p>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && !showTicketForm && (
              <div className="flex justify-start"><div className="rounded-2xl bg-gray-100 px-3.5 py-2"><Loader2 size={14} className="animate-spin text-gray-400" /></div></div>
            )}

            {showTicketForm && !ticketSent && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                <p className="mb-2 text-xs font-medium text-blue-900">Créer un ticket pour l'équipe support :</p>
                <div className="space-y-2">
                  <input className="input text-sm" placeholder="Votre nom" value={ticketForm.name} onChange={e => setTicketForm({ ...ticketForm, name: e.target.value })} />
                  <input className="input text-sm" placeholder="Votre email" type="email" value={ticketForm.email} onChange={e => setTicketForm({ ...ticketForm, email: e.target.value })} />
                  <input className="input text-sm" placeholder="Sujet" value={ticketForm.subject} onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })} />
                  {ticketError && <p className="text-xs text-red-600">{ticketError}</p>}
                  <button onClick={submitTicket} disabled={loading} className="btn-primary-landing w-full text-sm">
                    {loading ? 'Envoi…' : 'Envoyer le ticket'}
                  </button>
                </div>
              </div>
            )}
            {ticketSent && (
              <div className="flex items-start gap-2 rounded-xl border border-mint-200 bg-mint-50 p-3 text-sm text-mint-800">
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                <span>Ticket créé ! L'équipe support vous répondra par email.</span>
              </div>
            )}
          </div>

          {!showTicketForm && !notConfigured && (
            <div className="flex items-center gap-2 border-t border-gray-100 p-3">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Écrivez votre message…"
                className="input flex-1 text-sm"
              />
              <button onClick={send} disabled={loading || !input.trim()} className="rounded-lg bg-blue-600 p-2.5 text-white disabled:opacity-40">
                <Send size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
