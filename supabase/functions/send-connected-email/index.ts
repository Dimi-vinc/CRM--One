// Sends an email FROM the user's own connected Gmail/Outlook account (not from Resend) — this
// is what makes replying to a contact feel native, with delivery from the salesperson's real
// address, not a generic no-reply. Falls back with a clear error if nothing is connected
// (callers should offer the Resend-based path instead in that case).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getValidConnection, sendViaGmail, sendViaOutlook } from "../_shared/email-connections.ts";

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
