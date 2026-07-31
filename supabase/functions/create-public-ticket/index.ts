// Create Public Ticket Edge Function
// Lets an anonymous website visitor (not logged into the CRM) file a support ticket from the
// public Knowledge Base / chatbot widget. Uses the service role internally since anonymous
// visitors have no RLS-authenticated identity — this function IS the security boundary: it only
// ever creates a ticket for the tenant_id it's given, with input validated below.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const { tenantId, name, email, subject, description } = await req.json();
    if (!tenantId || !name || !email || !subject) {
      return new Response(JSON.stringify({ error: "Champs requis manquants" }), { status: 400, headers: jsonHeaders });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Email invalide" }), { status: 400, headers: jsonHeaders });
    }
    if (String(subject).length > 200 || String(description || "").length > 5000) {
      return new Response(JSON.stringify({ error: "Contenu trop long" }), { status: 400, headers: jsonHeaders });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: tenant } = await supabase.from("tenants").select("id").eq("id", tenantId).maybeSingle();
    if (!tenant) return new Response(JSON.stringify({ error: "Entreprise introuvable" }), { status: 404, headers: jsonHeaders });

    // Find or create the contact by email under this tenant, so the ticket is properly linked
    // (and future messages from the same visitor consolidate under one contact).
    let contactId: string;
    const { data: existing } = await supabase.from("contacts").select("id").eq("tenant_id", tenantId).eq("email", email).maybeSingle();
    if (existing) {
      contactId = existing.id;
    } else {
      const [firstName, ...rest] = String(name).trim().split(/\s+/);
      const { data: created, error: contactErr } = await supabase.from("contacts").insert({
        tenant_id: tenantId, first_name: firstName || name, last_name: rest.join(" ") || null, email,
      }).select("id").single();
      if (contactErr || !created) return new Response(JSON.stringify({ error: "Impossible de créer le contact." }), { status: 500, headers: jsonHeaders });
      contactId = created.id;
    }

    const { data: ticket, error: ticketErr } = await supabase.from("tickets").insert({
      tenant_id: tenantId, contact_id: contactId, subject, description: description || null,
      priority: "medium",
    }).select("id").single();
    if (ticketErr || !ticket) return new Response(JSON.stringify({ error: "Impossible de créer le ticket." }), { status: 500, headers: jsonHeaders });

    return new Response(JSON.stringify({ ok: true, ticketId: ticket.id }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});
