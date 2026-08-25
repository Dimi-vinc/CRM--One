// Generic API-key integration connector. One function handles every `authType: 'api_key'`
// provider in src/lib/integrations.ts (OpenAI, Anthropic, Stripe, Twilio, Zapier, the African
// PSPs, etc.) — no per-provider backend code needed, since "save a secret string associated with
// (tenant, user, provider)" is identical regardless of which provider it's for.
//
// Security: identity comes only from the caller's own JWT (verified via auth.getUser()), and
// every write goes through the caller's own RLS (anon key + JWT, not service role) — a user can
// only ever create/update/delete their OWN connection row, enforced at the database level by
// migration 0033's policies, not just by this function's logic.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { INTEGRATIONS } from "./integrations-catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: jsonHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: jsonHeaders });

    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    if (!profile?.tenant_id) return new Response(JSON.stringify({ error: "Aucune entreprise associée à ce compte." }), { status: 403, headers: jsonHeaders });

    if (req.method === "DELETE") {
      const { providerId } = await req.json();
      await supabase.from("integration_connections").delete().eq("provider_id", providerId).eq("user_id", user.id);
      return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
    }

    const { providerId, apiKey } = await req.json();
    const provider = INTEGRATIONS.find((p) => p.id === providerId);
    if (!provider) return new Response(JSON.stringify({ error: "Intégration inconnue" }), { status: 400, headers: jsonHeaders });
    if (provider.authType !== "api_key") return new Response(JSON.stringify({ error: "Cette intégration utilise OAuth, pas une clé API." }), { status: 400, headers: jsonHeaders });
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 6) {
      return new Response(JSON.stringify({ error: "Clé API invalide." }), { status: 400, headers: jsonHeaders });
    }

    const { data, error } = await supabase.from("integration_connections").upsert({
      tenant_id: profile.tenant_id, user_id: user.id, provider_id: providerId,
      auth_type: "api_key", api_key: apiKey.trim(), status: "connected", updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,user_id,provider_id" }).select().single();

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: jsonHeaders });
    return new Response(JSON.stringify({ ok: true, connection: { ...data, api_key: undefined } }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});
