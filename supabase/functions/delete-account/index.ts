// GDPR "right to erasure": permanently deletes a tenant and every user account attached to it.
// Only callable by a tenant admin, verified via their JWT (not just trusted from the request body).
// Deleting the tenant row cascades (ON DELETE CASCADE) through every tenant-scoped table, then
// each auth.users record is removed via the admin API so no login remains either.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const { confirmTenantName } = await req.json();

    // Verify the caller via their own JWT (not a trusted tenant_id from the body)
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: jsonHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).single();
    if (!profile || profile.role !== "admin" || !profile.tenant_id) {
      return new Response(JSON.stringify({ error: "Seul un administrateur du compte peut supprimer les données." }), { status: 403, headers: jsonHeaders });
    }

    const { data: tenant } = await admin.from("tenants").select("*").eq("id", profile.tenant_id).single();
    if (!tenant) return new Response(JSON.stringify({ error: "Compte introuvable" }), { status: 404, headers: jsonHeaders });
    if (confirmTenantName !== tenant.name) {
      return new Response(JSON.stringify({ error: "Le nom saisi ne correspond pas au nom du compte." }), { status: 400, headers: jsonHeaders });
    }

    const { data: members } = await admin.from("profiles").select("id").eq("tenant_id", tenant.id);

    // Deleting the tenant cascades through every tenant-scoped table (contacts, deals, tickets,
    // quotes, invoices, automations, etc. all reference tenants(id) ON DELETE CASCADE).
    const { error: delErr } = await admin.from("tenants").delete().eq("id", tenant.id);
    if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 500, headers: jsonHeaders });

    // Remove each member's login entirely (profiles row is already gone via cascade)
    for (const m of members || []) {
      await admin.auth.admin.deleteUser(m.id);
    }

    return new Response(JSON.stringify({ ok: true, deletedUsers: (members || []).length }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});
