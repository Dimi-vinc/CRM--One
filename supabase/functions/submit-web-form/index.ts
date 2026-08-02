// Submit Web Form Edge Function
// Public, anonymous-callable: a visitor filling out an embedded form has no CRM login. Uses the
// service role internally — this function IS the security boundary, validating the form is
// active and belongs to the given tenant before writing anything.
//
// Creates (or finds by email) a Contact, links the submission, and — because the DB trigger on
// contacts fires on any INSERT regardless of who performed it — the tenant's 'contact_added'
// automations run exactly as if the contact had been added manually in the CRM.

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
    const { formId, data } = await req.json();
    if (!formId || !data || typeof data !== "object") {
      return new Response(JSON.stringify({ error: "formId et data requis" }), { status: 400, headers: jsonHeaders });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: form } = await supabase.from("web_forms").select("*").eq("id", formId).eq("is_active", true).maybeSingle();
    if (!form) return new Response(JSON.stringify({ error: "Formulaire introuvable ou inactif" }), { status: 404, headers: jsonHeaders });

    // Validate required fields are present and basic length sanity (defense against abuse).
    for (const field of form.fields as { key: string; label: string; required?: boolean }[]) {
      const value = data[field.key];
      if (field.required && (!value || String(value).trim() === "")) {
        return new Response(JSON.stringify({ error: `Le champ "${field.label}" est requis.` }), { status: 400, headers: jsonHeaders });
      }
      if (value && String(value).length > 2000) {
        return new Response(JSON.stringify({ error: `Le champ "${field.label}" est trop long.` }), { status: 400, headers: jsonHeaders });
      }
    }

    const email = data.email as string | undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Email invalide." }), { status: 400, headers: jsonHeaders });
    }

    let contactId: string | null = null;
    if (email) {
      const { data: existing } = await supabase.from("contacts").select("id").eq("tenant_id", form.tenant_id).eq("email", email).maybeSingle();
      if (existing) {
        contactId = existing.id;
      } else {
        const nameParts = String(data.name || data.full_name || email.split("@")[0]).trim().split(/\s+/);
        const { data: created, error: contactErr } = await supabase.from("contacts").insert({
          tenant_id: form.tenant_id,
          first_name: nameParts[0] || "Contact",
          last_name: nameParts.slice(1).join(" ") || null,
          email,
          phone: data.phone || null,
          marketing_consent: !!data.marketing_consent,
        }).select("id").single();
        if (contactErr) return new Response(JSON.stringify({ error: "Impossible de créer le contact." }), { status: 500, headers: jsonHeaders });
        contactId = created.id;
      }
    }

    await supabase.from("web_form_submissions").insert({ tenant_id: form.tenant_id, form_id: form.id, contact_id: contactId, data });
    await supabase.from("web_forms").update({ submission_count: (form.submission_count || 0) + 1 }).eq("id", form.id);

    return new Response(JSON.stringify({ ok: true, message: form.success_message, redirectUrl: form.redirect_url || null }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});
