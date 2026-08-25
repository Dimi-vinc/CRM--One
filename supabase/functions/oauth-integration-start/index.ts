// Generic OAuth "start" endpoint: builds the correct authorize redirect URL for any provider
// listed in _shared/oauth-providers.ts, requiring that the platform operator has already
// registered an app with that provider and set its CLIENT_ID as a Supabase secret. If not
// configured, returns a clear `notConfigured` response instead of a broken redirect — same
// honest pattern as every other unconfigured provider in this codebase.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { OAUTH_PROVIDERS, envKeyFor } from "../_shared/oauth-providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    if (!profile?.tenant_id) return new Response(JSON.stringify({ error: "Aucune entreprise associée." }), { status: 403, headers: jsonHeaders });

    const { providerId, returnUrl } = await req.json();
    const config = OAUTH_PROVIDERS[providerId];
    if (!config) return new Response(JSON.stringify({ error: "Intégration OAuth inconnue" }), { status: 400, headers: jsonHeaders });

    const clientId = Deno.env.get(`${envKeyFor(providerId)}_CLIENT_ID`);
    if (!clientId || !config.tokenUrl) {
      return new Response(JSON.stringify({ error: `${providerId} n'est pas encore configuré sur cette instance.`, notConfigured: true }), { status: 503, headers: jsonHeaders });
    }

    const state = btoa(JSON.stringify({ accessToken: authHeader.replace("Bearer ", ""), tenantId: profile.tenant_id, providerId, returnUrl }));
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-integration-callback`;
    const params = new URLSearchParams({
      client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: config.scope, state,
      ...(config.extraAuthorizeParams || {}),
    });

    return new Response(JSON.stringify({ url: `${config.authorizeUrl}?${params.toString()}` }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});
