// DEPLOY WITH: supabase functions deploy oauth-integration-callback --no-verify-jwt
// Required because reached via a plain browser redirect from the OAuth provider — no Authorization header is attached. Without this flag, Supabase's gateway rejects every call with a
// 401 before this function's own code ever runs — a failure that won't show up in these logs.
// Generic OAuth callback: exchanges the authorization code for tokens and stores the connection
// in integration_connections. Mirrors gmail-oauth-callback/outlook-oauth-callback's pattern
// exactly (verify the access token via auth.getUser(token) before trusting anything from state).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// Standard OAuth2 endpoints for every `authType: 'oauth'` integration in src/lib/integrations.ts
// that doesn't already have its own dedicated callback (Gmail and Outlook keep their existing
// gmail-oauth-callback/outlook-oauth-callback functions). Inlined (not imported from a shared
// folder) because Supabase's function bundler has a known, currently-active issue resolving
// relative imports into `_shared/` folders in some deployment paths, producing a "Module not
// found ... _shared/..." error at deploy time even when the file is present. This means
// oauth-integration-start and oauth-integration-callback each carry their own copy — if you add
// or change a provider here, mirror the change in BOTH files.
//
// Each provider needs its own registered OAuth app and its client ID/secret set as Supabase
// secrets named `{PROVIDER_ID_UPPER}_CLIENT_ID` / `{PROVIDER_ID_UPPER}_CLIENT_SECRET` (e.g.
// SLACK_CLIENT_ID). Until those are set, oauth-integration-start reports `notConfigured` rather
// than pretending a connection worked.
//
// A few of these (Shopify, Intuit/QuickBooks in particular) have provider-specific quirks
// (per-shop authorize domain, realm IDs, etc.) simplified here to their standard case — verify
// against that provider's current docs before enabling it for real traffic.
interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  extraAuthorizeParams?: Record<string, string>;
}

const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  paypal: { authorizeUrl: "https://www.paypal.com/signin/authorize", tokenUrl: "https://api-m.paypal.com/v1/oauth2/token", scope: "openid email https://uri.paypal.com/services/payments/futurepayments" },
  gocardless: { authorizeUrl: "https://connect.gocardless.com/oauth/authorize", tokenUrl: "https://connect.gocardless.com/oauth/access_token", scope: "read_write" },
  "revolut-business": { authorizeUrl: "https://business.revolut.com/app-confirm", tokenUrl: "https://b2b.revolut.com/api/1.0/auth/token", scope: "" },
  slack: { authorizeUrl: "https://slack.com/oauth/v2/authorize", tokenUrl: "https://slack.com/api/oauth.v2.access", scope: "chat:write,channels:read" },
  messenger: { authorizeUrl: "https://www.facebook.com/v19.0/dialog/oauth", tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token", scope: "pages_messaging,pages_show_list" },
  "instagram-dm": { authorizeUrl: "https://www.facebook.com/v19.0/dialog/oauth", tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token", scope: "instagram_manage_messages,pages_show_list" },
  "google-meet": { authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", scope: "https://www.googleapis.com/auth/meetings.space.created", extraAuthorizeParams: { access_type: "offline", prompt: "consent" } },
  "microsoft-teams": { authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token", scope: "OnlineMeetings.ReadWrite offline_access" },
  "google-calendar": { authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", scope: "https://www.googleapis.com/auth/calendar", extraAuthorizeParams: { access_type: "offline", prompt: "consent" } },
  shopify: { authorizeUrl: "https://{shop}.myshopify.com/admin/oauth/authorize", tokenUrl: "https://{shop}.myshopify.com/admin/oauth/access_token", scope: "read_orders,read_customers" },
  quickbooks: { authorizeUrl: "https://appcenter.intuit.com/connect/oauth2", tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", scope: "com.intuit.quickbooks.accounting" },
  xero: { authorizeUrl: "https://login.xero.com/identity/connect/authorize", tokenUrl: "https://identity.xero.com/connect/token", scope: "openid profile email accounting.transactions offline_access" },
  zendesk: { authorizeUrl: "https://{subdomain}.zendesk.com/oauth/authorizations/new", tokenUrl: "https://{subdomain}.zendesk.com/oauth/tokens", scope: "read write" },
  intercom: { authorizeUrl: "https://app.intercom.com/oauth", tokenUrl: "https://api.intercom.io/auth/eagle/token", scope: "" },
  "meta-ads": { authorizeUrl: "https://www.facebook.com/v19.0/dialog/oauth", tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token", scope: "ads_read,leads_retrieval" },
  "google-ads": { authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", scope: "https://www.googleapis.com/auth/adwords", extraAuthorizeParams: { access_type: "offline", prompt: "consent" } },
  "linkedin-ads": { authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization", tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken", scope: "r_ads r_ads_reporting" },
  "google-drive": { authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", scope: "https://www.googleapis.com/auth/drive.file", extraAuthorizeParams: { access_type: "offline", prompt: "consent" } },
  dropbox: { authorizeUrl: "https://www.dropbox.com/oauth2/authorize", tokenUrl: "https://api.dropboxapi.com/oauth2/token", scope: "files.content.write files.content.read", extraAuthorizeParams: { token_access_type: "offline" } },
  docusign: { authorizeUrl: "https://account.docusign.com/oauth/auth", tokenUrl: "https://account.docusign.com/oauth/token", scope: "signature" },
  notion: { authorizeUrl: "https://api.notion.com/v1/oauth/authorize", tokenUrl: "https://api.notion.com/v1/oauth/token", scope: "" },
  asana: { authorizeUrl: "https://app.asana.com/-/oauth_authorize", tokenUrl: "https://app.asana.com/-/oauth_token", scope: "default" },
  trello: { authorizeUrl: "https://trello.com/1/authorize", tokenUrl: "", scope: "read,write" }, // Trello uses a legacy token flow, not standard OAuth2 — verify before enabling.
};

function envKeyFor(providerId: string): string {
  return providerId.toUpperCase().replace(/-/g, "_");
}


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
