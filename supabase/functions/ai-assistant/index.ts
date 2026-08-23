// AI Assistant Edge Function — free real AI (Groq/Llama 3.3, same free provider as the public
// support chatbot) available to every authenticated CRM user, on every plan (Starter included).
// This is NOT plan-gated: see src/lib/constants.ts where 'ai_assistant' is listed in every
// PlanDef.modules array, and src/App.tsx where the route carries no `moduleKey`, so it is never
// redirected to /billing for lacking a plan tier.
//
// Isolation model (defense in depth):
//   1. The caller's identity comes ONLY from their JWT (verified server-side via
//      `userClient.auth.getUser()`), never from a client-supplied tenantId/userId in the body.
//   2. All reads of the tenant's own CRM data (for grounding the assistant's answers) go through
//      `userClient`, i.e. under the caller's own RLS — so even a bug in this function's logic
//      cannot leak another tenant's rows; the database itself is the real boundary.
//   3. Conversation/message writes are also done via `userClient`, so the same RLS `WITH CHECK`
//      clauses (tenant_id = current_tenant_id() AND user_id = auth.uid()) apply to inserts too.
//   4. Only the per-tenant daily usage counter is written with the service role (`admin`), by
//      design — see migration 0026 for why (clients must never be able to edit their own quota).
//
// Required secret: GROQ_API_KEY (free, no credit card — see supabase/CHATBOT_SETUP.md).
// Optional secret: AI_ASSISTANT_DAILY_LIMIT (default 100 messages/tenant/day) — keeps the shared
// free Groq key sustainable so this stays free for every tenant, not just the first one to use it.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const MAX_MESSAGE_LEN = 2000;
const MAX_HISTORY = 12; // last N turns kept for continuity, bounding token usage/cost
const DEFAULT_DAILY_LIMIT = 100;

interface ChatMessage { role: "user" | "assistant"; content: string }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) {
      return new Response(JSON.stringify({ error: "L'assistant IA n'est pas encore configuré.", notConfigured: true }), { status: 503, headers: jsonHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: jsonHeaders });

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: jsonHeaders });

    const { data: profile } = await userClient.from("profiles").select("tenant_id, role, full_name").eq("id", user.id).maybeSingle();
    const tenantId: string | null = profile?.tenant_id ?? null;
    const isSuperAdmin = profile?.role === "super_admin";
    if (!tenantId && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Aucune entreprise associée à ce compte." }), { status: 403, headers: jsonHeaders });
    }

    const { message, conversationId } = await req.json();
    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ error: "message requis" }), { status: 400, headers: jsonHeaders });
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return new Response(JSON.stringify({ error: "Message trop long." }), { status: 400, headers: jsonHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const dailyLimit = Number(Deno.env.get("AI_ASSISTANT_DAILY_LIMIT")) || DEFAULT_DAILY_LIMIT;

    // ---- Free-but-fair usage cap: protects the shared free Groq key from being exhausted by a
    // single tenant, so the feature stays genuinely free and available for everyone else too.
    // Super admins (platform staff) are exempt, same as they are exempt from billing everywhere.
    if (tenantId && !isSuperAdmin) {
      const { data: usageRow } = await admin.from("ai_usage_daily").select("message_count").eq("tenant_id", tenantId).eq("usage_date", new Date().toISOString().slice(0, 10)).maybeSingle();
      if ((usageRow?.message_count || 0) >= dailyLimit) {
        return new Response(JSON.stringify({ error: `Limite quotidienne gratuite atteinte (${dailyLimit} messages/jour). Réessayez demain.`, limitReached: true }), { status: 429, headers: jsonHeaders });
      }
    }

    // ---- Conversation: reuse an existing one (ownership checked under the caller's own RLS —
    // if it's not really theirs, this simply returns nothing and we fall through to creating a
    // fresh one) or create a new one.
    let convId: string | undefined = conversationId;
    if (convId) {
      const { data: conv } = await userClient.from("ai_conversations").select("id").eq("id", convId).maybeSingle();
      if (!conv) convId = undefined;
    }
    if (!convId) {
      const { data: newConv, error: convErr } = await userClient
        .from("ai_conversations")
        .insert({ tenant_id: tenantId, user_id: user.id, title: message.slice(0, 60) })
        .select("id")
        .single();
      if (convErr || !newConv) {
        return new Response(JSON.stringify({ error: "Impossible de créer la conversation." }), { status: 500, headers: jsonHeaders });
      }
      convId = newConv.id;
    }

    // ---- Ground the assistant in this tenant's own CRM data. Every read below goes through
    // userClient, i.e. under the caller's own RLS, so this can never surface another tenant's
    // rows even if a bug crept into this function.
    const [{ count: contactsCount }, { count: openDealsCount }, { count: overdueTasksCount }, { count: openTicketsCount }] = await Promise.all([
      userClient.from("contacts").select("*", { count: "exact", head: true }),
      userClient.from("deals").select("*", { count: "exact", head: true }).not("stage", "in", "(won,lost)"),
      userClient.from("tasks").select("*", { count: "exact", head: true }).lt("due_date", new Date().toISOString().slice(0, 10)).neq("status", "done"),
      userClient.from("tickets").select("*", { count: "exact", head: true }).eq("status", "open"),
    ]).catch(() => [{ count: null }, { count: null }, { count: null }, { count: null }] as never);

    const contextLines = [
      contactsCount != null ? `- Contacts enregistrés : ${contactsCount}` : null,
      openDealsCount != null ? `- Opportunités en cours (non gagnées/perdues) : ${openDealsCount}` : null,
      overdueTasksCount != null ? `- Tâches en retard : ${overdueTasksCount}` : null,
      openTicketsCount != null ? `- Tickets support ouverts : ${openTicketsCount}` : null,
    ].filter(Boolean).join("\n");

    const systemPrompt = `Tu es l'assistant IA intégré de CRM-One pour ${profile?.full_name || "cet utilisateur"}. Tu aides à rédiger des emails/messages, résumer des situations, prioriser le travail et donner des conseils CRM concrets. Réponds en français par défaut (adapte à la langue du message si besoin), de façon brève et actionnable.

Aperçu actuel de l'entreprise (chiffres réels, ne les invente jamais s'ils manquent) :
${contextLines || "(Aucune donnée chiffrée disponible pour le moment.)"}

Si une question porte sur des données précises (un contact, un deal en particulier) que tu ne peux pas voir dans cet aperçu, dis-le clairement au lieu d'inventer une réponse, et suggère d'ouvrir la fiche correspondante dans le CRM.`;

    const { data: history } = await userClient
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY);
    const history_: ChatMessage[] = (history || []) as ChatMessage[];

    // Persist the user's message before calling the model, so it's saved even if Groq fails.
    await userClient.from("ai_messages").insert({ conversation_id: convId, tenant_id: tenantId, user_id: user.id, role: "user", content: message });

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...history_,
          { role: "user", content: message },
        ],
        temperature: 0.4,
        max_tokens: 700,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return new Response(JSON.stringify({ error: `Groq a refusé la requête (${res.status}): ${errBody}`, conversationId: convId }), { status: 502, headers: jsonHeaders });
    }

    const data = await res.json();
    const reply: string = data.choices?.[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";

    await userClient.from("ai_messages").insert({ conversation_id: convId, tenant_id: tenantId, user_id: user.id, role: "assistant", content: reply });
    await userClient.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);

    let remaining: number | null = null;
    if (tenantId && !isSuperAdmin) {
      const { data: newCount } = await admin.rpc("increment_ai_usage", { p_tenant_id: tenantId });
      remaining = Math.max(0, dailyLimit - (typeof newCount === "number" ? newCount : 0));
    }

    return new Response(JSON.stringify({ reply, conversationId: convId, remaining }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});
