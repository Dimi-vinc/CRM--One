// Sends an email campaign to a segment of contacts via Resend.
// Respects marketing_consent (RGPD) — contacts without consent are always skipped, regardless
// of segment filters. Requires the same RESEND_API_KEY secret as automations-dispatch
// (see supabase/AUTOMATIONS_SETUP.md).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface Contact {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string | null;
  company_id: string | null;
  marketing_consent: boolean;
  country_code: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id requis" }), { status: 400, headers: jsonHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: jsonHeaders });

    // Caller-scoped client (anon key + caller's own JWT) — RLS applies exactly as it would in
    // the app, so a user can never trigger sending a campaign belonging to a tenant they aren't
    // in. Kept deliberately identical in shape to every other function in this codebase (e.g.
    // send-email) rather than the previous construction (service_role key with an overridden
    // Authorization header), which relied on PostgREST decoding the overridden JWT correctly
    // rather than the key the client was built with — likely fine, but an unnecessarily
    // confusing pattern for a function that mass-emails a tenant's contacts.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: jsonHeaders });

    // Elevated client for cross-table reads/writes once the caller's JWT has been validated above
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: campaign, error: campErr } = await supabase.from("email_campaigns").select("*").eq("id", campaign_id).single();
    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campagne introuvable" }), { status: 404, headers: jsonHeaders });
    }
    if (campaign.status === "sent") {
      return new Response(JSON.stringify({ error: "Cette campagne a déjà été envoyée" }), { status: 400, headers: jsonHeaders });
    }

    let query = admin.from("contacts").select("*").eq("tenant_id", campaign.tenant_id).eq("marketing_consent", true).not("email", "is", null);
    if (campaign.segment_country_code) query = query.eq("country_code", campaign.segment_country_code);
    const { data: contacts, error: contactsErr } = await query;
    if (contactsErr) return new Response(JSON.stringify({ error: contactsErr.message }), { status: 500, headers: jsonHeaders });

    let recipients = (contacts || []) as Contact[];

    // Optional min lead-score filter (same simple, transparent weights as the in-app scoring)
    if (campaign.segment_min_score) {
      const { data: activityContactIds } = await admin.from("activities").select("contact_id").eq("tenant_id", campaign.tenant_id);
      const { data: dealContactIds } = await admin.from("deals").select("contact_id").eq("tenant_id", campaign.tenant_id);
      const hasActivity = new Set((activityContactIds || []).map((a: { contact_id: string | null }) => a.contact_id));
      const hasDeal = new Set((dealContactIds || []).map((d: { contact_id: string | null }) => d.contact_id));
      recipients = recipients.filter((c) => {
        let score = 0;
        if (c.email) score += 20;
        if (c.company_id) score += 15;
        if (hasActivity.has(c.id)) score += 25;
        if (hasDeal.has(c.id)) score += 25;
        return score >= campaign.segment_min_score;
      });
    }

    await admin.from("email_campaigns").update({ status: "sending" }).eq("id", campaign_id);

    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    const platformName = Deno.env.get("PLATFORM_NAME") || "CRM-One";

    let sent = 0, failed = 0;
    for (const contact of recipients) {
      const personalized = campaign.body_html.replace(/\{\{first_name\}\}/g, contact.first_name || "");
      try {
        if (!apiKey) throw new Error("RESEND_API_KEY non configurée.");
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: `${platformName} <${from}>`, to: [contact.email], subject: campaign.subject, html: personalized }),
        });
        if (!res.ok) throw new Error(await res.text());
        await admin.from("email_campaign_recipients").insert({ tenant_id: campaign.tenant_id, campaign_id, contact_id: contact.id, status: "sent", sent_at: new Date().toISOString() });
        sent++;
      } catch (err) {
        await admin.from("email_campaign_recipients").insert({ tenant_id: campaign.tenant_id, campaign_id, contact_id: contact.id, status: "failed", error: err instanceof Error ? err.message : String(err) });
        failed++;
      }
    }

    await admin.from("email_campaigns").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", campaign_id);

    return new Response(JSON.stringify({ ok: true, sent, failed, total: recipients.length }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});
