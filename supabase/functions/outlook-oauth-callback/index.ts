// Outlook OAuth Callback Edge Function — same pattern as gmail-oauth-callback, via Microsoft
// identity platform + Graph API.
//
// Required secrets: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET (Azure App Registrations —
// see supabase/EMAIL_INTEGRATIONS_SETUP.md), APP_URL.

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

  if (oauthError || !code || !state) return redirectToApp(appUrl, "error");

  try {
    const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
    const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");
    const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/outlook-oauth-callback`;
    if (!clientId || !clientSecret) return redirectToApp(appUrl, "not_configured");

    const { accessToken, tenantId } = JSON.parse(atob(decodeURIComponent(state)));
    const authedClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: { user }, error: userErr } = await authedClient.auth.getUser(accessToken);
    if (userErr || !user) return redirectToApp(appUrl, "error");

    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: functionUrl, grant_type: "authorization_code",
        scope: "offline_access Mail.Send User.Read",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) return redirectToApp(appUrl, "error");

    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();
    const emailAddress = profile.mail || profile.userPrincipalName;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Microsoft returns a refresh_token on every exchange (unlike Google), so no special
    // preservation logic is needed here.
    const { error: upsertErr } = await supabase.from("email_connections").upsert({
      user_id: user.id, tenant_id: tenantId, provider: "outlook", email_address: emailAddress,
      access_token: tokens.access_token, refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });
    if (upsertErr) return redirectToApp(appUrl, "error");

    return redirectToApp(appUrl, "success");
  } catch {
    return redirectToApp(appUrl, "error");
  }
});
