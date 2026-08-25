// Generic OAuth callback: exchanges the authorization code for tokens and stores the connection
// in integration_connections. Mirrors gmail-oauth-callback/outlook-oauth-callback's pattern
// exactly (verify the access token via auth.getUser(token) before trusting anything from state).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { OAUTH_PROVIDERS, envKeyFor } from "../_shared/oauth-providers.ts";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  if (!code || !stateRaw) return new Response("Paramètres manquants", { status: 400 });

  let state: { accessToken: string; tenantId: string; providerId: string; returnUrl?: string };
  try {
    state = JSON.parse(atob(stateRaw));
  } catch {
    return new Response("État invalide", { status: 400 });
  }

  const config = OAUTH_PROVIDERS[state.providerId];
  if (!config) return new Response("Intégration inconnue", { status: 400 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Verify the access token actually belongs to a real, current session before trusting anything
  // else in `state` — the state blob round-trips through the user's own browser and provider
  // redirect, so it must never be trusted on its own (same rule as gmail/outlook callbacks).
  const { data: { user }, error: authErr } = await admin.auth.getUser(state.accessToken);
  if (authErr || !user) return new Response("Session invalide ou expirée", { status: 401 });

  const clientId = Deno.env.get(`${envKeyFor(state.providerId)}_CLIENT_ID`);
  const clientSecret = Deno.env.get(`${envKeyFor(state.providerId)}_CLIENT_SECRET`);
  if (!clientId || !clientSecret) return new Response(`${state.providerId} n'est pas configuré.`, { status: 503 });

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-integration-callback`;
  const tokenRes = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code, redirect_uri: redirectUri,
      client_id: clientId, client_secret: clientSecret,
    }),
  });
  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    return new Response(`Échec de l'échange du jeton : ${detail}`, { status: 502 });
  }
  const tokens = await tokenRes.json();
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;

  await admin.from("integration_connections").upsert({
    tenant_id: state.tenantId, user_id: user.id, provider_id: state.providerId, auth_type: "oauth",
    access_token: tokens.access_token, refresh_token: tokens.refresh_token || null, expires_at: expiresAt,
    status: "connected", updated_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,user_id,provider_id" });

  const dest = state.returnUrl || "/integrations";
  return new Response(null, { status: 302, headers: { Location: dest } });
});
