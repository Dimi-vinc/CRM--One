// Support Chat Edge Function — free real AI via Groq (Llama 3.3), grounded in the tenant's own
// public Knowledge Base articles (lightweight RAG: relevant articles are fetched by keyword
// match and injected into the system prompt). No login required — this powers the public
// customer support widget on /help/:tenantId, so a tenant's customers get self-service help
// without a staff member manually assisting every request.
//
// Required secret: GROQ_API_KEY (free, no credit card — see supabase/CHATBOT_SETUP.md).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const MAX_MESSAGE_LEN = 1000;
const MAX_HISTORY = 8; // last N turns kept, to bound token usage/cost even on a free tier

interface ChatMessage { role: "user" | "assistant"; content: string }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) {
      return new Response(JSON.stringify({ error: "L'assistant n'est pas encore configuré.", notConfigured: true }), { status: 503, headers: jsonHeaders });
    }

    const { tenantId, message, history } = await req.json();
    if (!tenantId || !message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "tenantId et message requis" }), { status: 400, headers: jsonHeaders });
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return new Response(JSON.stringify({ error: "Message trop long." }), { status: 400, headers: jsonHeaders });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: tenant } = await supabase.from("tenants").select("id, name").eq("id", tenantId).maybeSingle();
    if (!tenant) return new Response(JSON.stringify({ error: "Entreprise introuvable" }), { status: 404, headers: jsonHeaders });

    // Lightweight RAG: pull public KB articles and keep the ones whose title/content share
    // words with the question — cheap, no embeddings/vector DB needed, but keeps answers
    // grounded in the tenant's real content instead of the model inventing policies.
    const { data: articles } = await supabase
      .from("kb_articles")
      .select("title, content")
      .eq("tenant_id", tenantId)
      .eq("is_public", true)
      .limit(200);

    const queryWords = new Set(message.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3));
    const scored = (articles || []).map(a => {
      const text = `${a.title} ${a.content}`.toLowerCase();
      let score = 0;
      for (const w of queryWords) if (text.includes(w)) score++;
      return { ...a, score };
    }).filter(a => a.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);

    const context = scored.length > 0
      ? scored.map(a => `### ${a.title}\n${a.content.slice(0, 1200)}`).join("\n\n")
      : "(Aucun article pertinent trouvé dans la base de connaissances.)";

    const systemPrompt = `Tu es l'assistant support de "${tenant.name}", une entreprise utilisant CRM-One. Réponds UNIQUEMENT à partir des articles ci-dessous. Sois bref, clair, en français par défaut (adapte à la langue du client si besoin). Si la réponse ne se trouve pas dans ces articles, ou si le client demande explicitement un humain, réponds EXACTEMENT par la phrase "ESCALATE_TO_HUMAN" suivie d'une courte explication empathique — cela déclenchera la création d'un ticket vers l'équipe support.

Articles disponibles :
${context}`;

    const history_: ChatMessage[] = Array.isArray(history) ? history.slice(-MAX_HISTORY) : [];

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
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return new Response(JSON.stringify({ error: `Groq a refusé la requête (${res.status}): ${errBody}` }), { status: 502, headers: jsonHeaders });
    }

    const data = await res.json();
    const reply: string = data.choices?.[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";
    const escalate = reply.includes("ESCALATE_TO_HUMAN");
    const cleanReply = reply.replace("ESCALATE_TO_HUMAN", "").trim();

    return new Response(JSON.stringify({ reply: cleanReply, escalate }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});
