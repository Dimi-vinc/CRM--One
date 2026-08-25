// Standard OAuth2 endpoints for every `authType: 'oauth'` integration in src/lib/integrations.ts
// that doesn't already have its own dedicated callback (Gmail and Outlook keep their existing
// gmail-oauth-callback/outlook-oauth-callback functions — this generic pair handles the rest).
//
// Each provider needs its own registered OAuth app (the platform operator creates one in that
// provider's developer console) and its client ID/secret set as Supabase secrets named
// `{PROVIDER_ID_UPPER}_CLIENT_ID` / `{PROVIDER_ID_UPPER}_CLIENT_SECRET` (e.g. SLACK_CLIENT_ID).
// Until those are set, oauth-integration-start reports `notConfigured` — same honest pattern
// used everywhere else in this codebase (Stripe, PayUnit, ai-assistant) rather than pretending a
// connection worked.
//
// A few of these (Shopify, Intuit/QuickBooks in particular) have provider-specific quirks
// (per-shop authorize domain, realm IDs, etc.) simplified here to their standard case — verify
// against that provider's current docs before enabling it for real traffic.

export interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  extraAuthorizeParams?: Record<string, string>;
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
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

export function envKeyFor(providerId: string): string {
  return providerId.toUpperCase().replace(/-/g, "_");
}
