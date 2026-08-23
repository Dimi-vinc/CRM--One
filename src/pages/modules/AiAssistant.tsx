import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Loader2, Plus, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { timeAgo } from '../../lib/utils';

interface ChatMsg { role: 'user' | 'assistant'; content: string }
interface ConversationRow { id: string; title: string; updated_at: string }

// Free on every plan (Starter included) — see 'ai_assistant' in src/lib/constants.ts and the
// route in App.tsx, which carries no moduleKey/minPlan gate. A per-tenant daily message cap is
// enforced server-side (ai-assistant edge function) purely to keep the shared free Groq key
// sustainable — it is not a paywall.
export function AiAssistant() {
  const { session, tenant } = useAuth();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    const { data } = await supabase.from('ai_conversations').select('id, title, updated_at').order('updated_at', { ascending: false }).limit(30);
    setConversations(data || []);
  };
  useEffect(() => { loadConversations(); }, [tenant?.id]);

  const openConversation = async (id: string) => {
    setActiveId(id);
    setLoadingHistory(true);
    const { data } = await supabase.from('ai_messages').select('role, content').eq('conversation_id', id).order('created_at', { ascending: true });
    setMessages((data as ChatMsg[]) || []);
    setLoadingHistory(false);
  };

  const newConversation = () => { setActiveId(null); setMessages([]); setError(null); };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !session) return;
    setInput('');
    setError(null);
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: text, conversationId: activeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "L'assistant n'est pas disponible pour le moment.");
        setMessages(prev => prev.slice(0, -1)); // don't leave a dangling unanswered bubble
        return;
      }
      if (data.conversationId && data.conversationId !== activeId) {
        setActiveId(data.conversationId);
        loadConversations();
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
    } catch {
      setError('Connexion impossible. Réessayez.');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Assistant IA"
        subtitle="Gratuit, inclus dans votre plan — rédaction, résumés, conseils CRM"
        actions={<Button variant="secondary" onClick={newConversation}><Plus size={16} /> Nouvelle conversation</Button>}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="hidden max-h-[70vh] overflow-y-auto p-2 lg:block">
          {conversations.length === 0 ? (
            <p className="p-3 text-sm text-gray-400">Aucune conversation pour l'instant.</p>
          ) : conversations.map(c => (
            <button
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={`flex w-full items-start gap-2 rounded-lg p-2.5 text-left text-sm hover:bg-gray-50 ${activeId === c.id ? 'bg-coral-50 text-coral-700' : 'text-gray-700'}`}
            >
              <MessageSquare size={15} className="mt-0.5 shrink-0" />
              <span className="flex-1 truncate">{c.title}</span>
            </button>
          ))}
        </Card>

        <Card className="flex h-[70vh] flex-col p-0">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && !loadingHistory ? (
              <EmptyState icon={Sparkles} title="Posez votre première question" description="Demandez un brouillon d'email, un résumé de votre pipeline, ou des conseils pour relancer un contact." />
            ) : messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-coral-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-2.5 text-sm text-gray-500">
                  <Loader2 size={14} className="animate-spin" /> L'assistant réfléchit…
                </div>
              </div>
            )}
          </div>
          {error && <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-2 border-t border-gray-100 p-3">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Écrivez votre message…"
              className="flex-1 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-coral-400"
              disabled={loading}
            />
            <Button onClick={send} disabled={loading || !input.trim()}><Send size={16} /></Button>
          </div>
          {remaining != null && (
            <p className="px-4 pb-2 text-xs text-gray-400">{remaining} message{remaining === 1 ? '' : 's'} restant{remaining === 1 ? '' : 's'} aujourd'hui (quota d'équité gratuit, remis à zéro chaque jour)</p>
          )}
        </Card>
      </div>
      {conversations[0] && <p className="mt-2 text-xs text-gray-300">Dernière activité {timeAgo(conversations[0].updated_at)}</p>}
    </div>
  );
}
