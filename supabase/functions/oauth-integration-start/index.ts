// Generic OAuth "start" endpoint: builds the correct authorize redirect URL for any provider
// listed below, requiring that the platform operator has already
// registered an app with that provider and set its CLIENT_ID as a Supabase secret. If not
// configured, returns a clear `notConfigured` response instead of a broken redirect — same
// honest pattern as every other unconfigured provider in this codebase.

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
