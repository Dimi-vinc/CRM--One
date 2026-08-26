// DEPLOY WITH: supabase functions deploy gmail-oauth-callback --no-verify-jwt
// Required because reached via a plain browser redirect from Google — no Authorization header is attached. Without this flag, Supabase's gateway rejects every call with a
// 401 before this function's own code ever runs — a failure that won't show up in these logs.
// Gmail OAuth Callback Edge Function
// Google redirects the user's browser here after they approve access, with `code` and `state`
// query params. `state` carries the user's own Supabase access token (base64-encoded) so this
// function can identify who's connecting — set by the frontend right before redirecting to
// Google (see Settings.tsx). This is a standard OAuth pattern; state is short-lived (single
// round-trip) and never logged.
//
// Required secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (from Google Cloud Console — see
// supabase/EMAIL_INTEGRATIONS_SETUP.md), APP_URL (your app's public URL, e.g.
// https://votredomaine.com, used to redirect back after connecting).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

function redirectToApp(appUrl: string, status: string): Response {
  return new Response(null, { status: 302, headers: { Location: `${appUrl}/#/settings?email_connect=${status}` } });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const appUrl = Deno.env.get("APP_URL") || "";
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError || !code || !state) {
    return redirectToApp(appUrl, "error");
  }

  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gmail-oauth-callback`;
    if (!clientId || !clientSecret) return redirectToApp(appUrl, "not_configured");

    // Identify the connecting user from the access token carried in `state`.
    const { accessToken, tenantId } = JSON.parse(atob(decodeURIComponent(state)));
    const authedClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: { user }, error: userErr } = await authedClient.auth.getUser(accessToken);
    if (userErr || !user) return redirectToApp(appUrl, "error");

    // Exchange the authorization code for real tokens.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: functionUrl, grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) return redirectToApp(appUrl, "error");

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const upsertData: Record<string, unknown> = {
      user_id: user.id,
      tenant_id: tenantId,
      provider: "gmail",
      email_address: profile.email,
      access_token: tokens.access_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Google only returns a refresh_token on the very first consent (or with prompt=consent).
    // Don't overwrite a previously stored valid one with an absent value on reconnect.
    if (tokens.refresh_token) upsertData.refresh_token = tokens.refresh_token;
    else {
      const { data: existing } = await supabase.from("email_connections").select("refresh_token").eq("user_id", user.id).eq("provider", "gmail").maybeSingle();
      if (!existing?.refresh_token) return redirectToApp(appUrl, "error"); // no refresh token at all — force a fresh consent
      upsertData.refresh_token = existing.refresh_token;
    }
    const { error: upsertErr } = await supabase.from("email_connections").upsert(upsertData, { onConflict: "user_id,provider" });
    if (upsertErr) return redirectToApp(appUrl, "error");

    return redirectToApp(appUrl, "success");
  } catch {
    return redirectToApp(appUrl, "error");
  }
});
