// Sends an email FROM the user's own connected Gmail/Outlook account (not from Resend) — this
// is what makes replying to a contact feel native, with delivery from the salesperson's real
// address, not a generic no-reply. Falls back with a clear error if nothing is connected
// (callers should offer the Resend-based path instead in that case).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

// getValidConnection()/sendViaGmail()/sendViaOutlook() below are inlined (not imported from a
// shared folder) because Supabase's function bundler has a known, currently-active issue
// resolving relative imports into `_shared/` folders in some deployment paths, producing a
// "Module not found ... _shared/..." error at deploy time even when the file is present.

// Shared helper: returns a currently-valid access token for a user's connected email account,
// automatically refreshing it via the stored refresh_token if it has expired. Used by any
// function that needs to send email "as" a connected Gmail/Outlook account.

interface Connection {
  id: string; user_id: string; provider: "gmail" | "outlook";
  email_address: string; access_token: string; refresh_token: string; expires_at: string;
}

async function getValidConnection(supabase: SupabaseClient, userId: string, provider: "gmail" | "outlook"): Promise<Connection | null> {
  const { data: conn } = await supabase.from("email_connections").select("*").eq("user_id", userId).eq("provider", provider).maybeSingle();
  if (!conn) return null;

  const expiresInMs = new Date(conn.expires_at).getTime() - Date.now();
  if (expiresInMs > 60_000) return conn as Connection; // still valid for at least another minute

  // Expired (or about to) — refresh it.
  const refreshed = provider === "gmail" ? await refreshGoogleToken(conn.refresh_token) : await refreshMicrosoftToken(conn.refresh_token);
  if (!refreshed) return null;

  await supabase.from("email_connections").update({
    access_token: refreshed.access_token,
    expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", conn.id);

  return { ...conn, access_token: refreshed.access_token } as Connection;
}

async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function refreshMicrosoftToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
  const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken,
      grant_type: "refresh_token", scope: "offline_access Mail.Send User.Read",
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

// Sends an email via the Gmail API using a raw base64url-encoded RFC 2822 message.
async function sendViaGmail(accessToken: string, fromEmail: string, to: string, subject: string, bodyHtml: string): Promise<void> {
  const message = [
    `From: ${fromEmail}`, `To: ${to}`, `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0", "Content-Type: text/html; charset=UTF-8", "", bodyHtml,
  ].join("\r\n");
  const raw = btoa(unescape(encodeURIComponent(message))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`Gmail a refusé l'envoi (${res.status}): ${body}`); }
}

// Sends an email via Microsoft Graph's sendMail endpoint.
async function sendViaOutlook(accessToken: string, to: string, subject: string, bodyHtml: string): Promise<void> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: { subject, body: { contentType: "HTML", content: bodyHtml }, toRecipients: [{ emailAddress: { address: to } }] },
    }),
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`Outlook a refusé l'envoi (${res.status}): ${body}`); }
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: jsonHeaders });

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: jsonHeaders });

  const { to, subject, html, contactId, provider } = await req.json();
  if (!to || !subject || !html || !provider) {
    return new Response(JSON.stringify({ error: "to, subject, html, provider requis" }), { status: 400, headers: jsonHeaders });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // If a contactId is given, verify (under the caller's own RLS) that this contact is really
  // visible to them (their tenant) before sending — same anti-cross-tenant pattern as send-email.
  if (contactId) {
    const { data: contact, error: contactErr } = await userClient.from("contacts").select("id, tenant_id").eq("id", contactId).maybeSingle();
    if (contactErr || !contact) {
      return new Response(JSON.stringify({ error: "Contact non trouvé ou non autorisé" }), { status: 403, headers: jsonHeaders });
    }
  }

  const conn = await getValidConnection(admin, user.id, provider);
  if (!conn) {
    return new Response(JSON.stringify({ error: `Aucun compte ${provider === "gmail" ? "Gmail" : "Outlook"} connecté (ou jeton expiré, reconnectez-le dans Paramètres).`, notConnected: true }), { status: 400, headers: jsonHeaders });
  }

  const { data: profile } = await userClient.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();

  try {
    if (provider === "gmail") await sendViaGmail(conn.access_token, conn.email_address, to, subject, html);
    else await sendViaOutlook(conn.access_token, to, subject, html);

    await admin.from("sent_emails_log").insert({
      tenant_id: profile?.tenant_id, user_id: user.id, contact_id: contactId || null,
      provider, subject, to_email: to, status: "sent",
    });
    return new Response(JSON.stringify({ ok: true, from: conn.email_address }), { headers: jsonHeaders });
  } catch (err) {
    await admin.from("sent_emails_log").insert({
      tenant_id: profile?.tenant_id, user_id: user.id, contact_id: contactId || null,
      provider, subject, to_email: to, status: "failed", error_detail: err?.message,
    });
    return new Response(JSON.stringify({ error: err?.message || "Échec de l'envoi" }), { status: 502, headers: jsonHeaders });
  }
});
