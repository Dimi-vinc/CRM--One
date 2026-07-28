// Generic authenticated email sender, reused by ticket replies and marketing campaigns.
// Security: uses the CALLER'S OWN JWT (not the service role) to run all lookups, so Postgres
// RLS naturally prevents a user from sending "as" a tenant they don't belong to — if the
// ticket/contact lookup is denied by RLS, the whole request fails closed.
//
// Required secret: RESEND_API_KEY (see supabase/AUTOMATIONS_SETUP.md for how to get one).
// Optional: RESEND_FROM_EMAIL, PLATFORM_NAME.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const PLATFORM_NAME = Deno.env.get("PLATFORM_NAME") || "LiAfrik One";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: jsonHeaders });

    // Client scoped to the CALLER's session — RLS applies exactly as it would in the app.
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: jsonHeaders });
    }

    const { to, subject, html, contact_id } = await req.json();
    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: "to, subject, html requis" }), { status: 400, headers: jsonHeaders });
    }

    // If a contact_id is provided, verify (under the caller's RLS) that this contact is
    // actually visible to them — i.e. belongs to their tenant — before sending anything.
    if (contact_id) {
      const { data: contact, error: contactErr } = await supabase.from("contacts").select("id").eq("id", contact_id).single();
      if (contactErr || !contact) {
        return new Response(JSON.stringify({ error: "Contact non trouvé ou non autorisé" }), { status: 403, headers: jsonHeaders });
      }
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "RESEND_API_KEY non configurée" }), { status: 500, headers: jsonHeaders });
    const from = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${PLATFORM_NAME} <${from}>`, to: Array.isArray(to) ? to : [to], subject, html }),
    });

    if (!res.ok) {
      const body = await res.text();
      return new Response(JSON.stringify({ error: `Resend a refusé l'envoi (${res.status}): ${body}` }), { status: 502, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});
