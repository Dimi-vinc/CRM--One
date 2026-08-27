// DEPLOY WITH: supabase functions deploy automations-dispatch --no-verify-jwt
// Required because called via pg_net with a raw shared secret (AUTOMATION_DISPATCH_SECRET), not a Supabase JWT. Without this flag, Supabase's gateway rejects every call with a
// 401 before this function's own code ever runs — a failure that won't show up in these logs.
// Automations dispatch Edge Function
// Called (async, fire-and-forget) by DB triggers via pg_net whenever a row-based automation
// event happens. Looks up active automations matching the tenant + trigger.
//
// Multi-step sequences: an automation can have ordered `automation_steps` with a delay before
// each one (e.g. email immediately -> wait 2 days -> create a task -> wait 3 days -> notify the
// team). The first due step executes immediately; later steps are enqueued into
// automation_run_queue with a computed run_at, picked up later by automations-cron.
// Automations with NO steps fall back to the original single-action behavior unchanged.
//
// Required secrets:
//   RESEND_API_KEY, AUTOMATION_DISPATCH_SECRET, SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY,
//   RESEND_FROM_EMAIL (optional), PLATFORM_NAME (optional).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

// PLATFORM_NAME, IMPLEMENTED_ACTIONS, logRun(), and runAction() below are inlined (not imported
// from a shared folder) because Supabase's function bundler has a known, currently-active issue
// resolving relative imports into `_shared/` folders in some deployment paths, producing a
// "Module not found ... _shared/..." error at deploy time even when the file is present. This
// means automations-dispatch and automations-cron each carry their own copy of this logic — if
// you change action-execution behavior, mirror the change in BOTH files.

// Shared action-execution logic used by both automations-dispatch (immediate first step) and
// automations-cron (processing delayed steps from automation_run_queue). Keeping this in one
// place means every action behaves identically regardless of which function ran it.

const PLATFORM_NAME = Deno.env.get("PLATFORM_NAME") || "CRM-One";

// Implemented actions only. Anything else is logged as skipped rather than silently doing
// nothing, so the execution log stays honest.
const IMPLEMENTED_ACTIONS = new Set([
  "send_email", "create_task", "notify_team", "create_activity", "send_whatsapp", "email_contact",
]);

export interface ActionOutcome { status: "success" | "error" | "skipped"; detail: string }

async function logRun(supabase: SupabaseClient, tenantId: string, automationId: string, trigger: string, action: string, outcome: ActionOutcome) {
  await supabase.from("automation_runs").insert({
    tenant_id: tenantId, automation_id: automationId, trigger, action,
    status: outcome.status, detail: outcome.detail,
  });
}

async function runAction(
  supabase: SupabaseClient,
  tenantId: string,
  automationName: string,
  action: string,
  description: string | null,
  trigger: string,
  payload: Record<string, unknown>,
): Promise<ActionOutcome> {
  if (!IMPLEMENTED_ACTIONS.has(action)) {
    return { status: "skipped", detail: `Action "${action}" pas encore disponible.` };
  }

  try {
    switch (action) {
      case "send_email": {
        const to = await resolveTenantAdminEmails(supabase, tenantId);
        if (to.length === 0) return { status: "error", detail: "Aucun administrateur avec email à notifier." };
        await sendEmail(to, `[${PLATFORM_NAME}] ${automationName}`, description || describeEvent(trigger, payload));
        return { status: "success", detail: `Email interne envoyé à ${to.join(", ")}.` };
      }
      case "email_contact": {
        const contact = await resolveContact(supabase, tenantId, trigger, payload);
        if (!contact) return { status: "error", detail: "Aucun contact identifié pour cet événement." };
        if (!contact.email) return { status: "error", detail: `Le contact ${contact.first_name || ""} n'a pas d'email renseigné.` };
        if (!contact.marketing_consent) return { status: "skipped", detail: `Consentement marketing non donné par ${contact.email} — email non envoyé (RGPD).` };
        await sendEmail([contact.email], automationName, description || describeEvent(trigger, payload));
        return { status: "success", detail: `Email envoyé au contact ${contact.email}.` };
      }
      case "create_task": {
        const { error } = await supabase.from("tasks").insert({
          tenant_id: tenantId, title: automationName,
          description: description || describeEvent(trigger, payload), priority: "medium", status: "todo",
        });
        if (error) return { status: "error", detail: error.message };
        return { status: "success", detail: "Tâche créée." };
      }
      case "notify_team": {
        const { data: members } = await supabase.from("profiles").select("id").eq("tenant_id", tenantId);
        const rows = (members || []).map((m: { id: string }) => ({
          tenant_id: tenantId, user_id: m.id, title: automationName, body: description || describeEvent(trigger, payload),
        }));
        if (rows.length === 0) return { status: "error", detail: "Aucun membre à notifier." };
        const { error } = await supabase.from("notifications").insert(rows);
        if (error) return { status: "error", detail: error.message };
        return { status: "success", detail: `${rows.length} notification(s) créée(s).` };
      }
      case "create_activity": {
        const { error } = await supabase.from("activities").insert({
          tenant_id: tenantId, type: "task", title: automationName,
          description: description || describeEvent(trigger, payload),
          contact_id: (payload as { id?: string; contact_id?: string })?.contact_id
            || (trigger === "contact_added" ? (payload as { id?: string })?.id : null),
        });
        if (error) return { status: "error", detail: error.message };
        return { status: "success", detail: "Activité créée." };
      }
      case "send_whatsapp": {
        const numbers = await resolveTenantAdminPhones(supabase, tenantId);
        if (numbers.length === 0) return { status: "error", detail: "Aucun administrateur avec un numéro WhatsApp renseigné (Paramètres)." };
        const text = `[${PLATFORM_NAME}] ${automationName}\n${description || describeEvent(trigger, payload)}`;
        const results = await Promise.allSettled(numbers.map((n: string) => sendWhatsApp(n, text)));
        const failed = results.filter(r => r.status === "rejected");
        if (failed.length === results.length) {
          return { status: "error", detail: (failed[0] as PromiseRejectedResult).reason?.message || "Échec de l'envoi WhatsApp." };
        }
        return { status: "success", detail: `WhatsApp envoyé à ${results.length - failed.length}/${results.length} administrateur(s).` };
      }
      default:
        return { status: "skipped", detail: "Action inconnue." };
    }
  } catch (err) {
    return { status: "error", detail: err?.message || "Erreur inconnue" };
  }
}

async function resolveContact(supabase: SupabaseClient, tenantId: string, trigger: string, payload: Record<string, unknown>) {
  const contactId = trigger === "contact_added" ? (payload?.id as string) || null : (payload?.contact_id as string) || null;
  if (!contactId) return null;
  const { data } = await supabase.from("contacts").select("id, first_name, email, marketing_consent").eq("id", contactId).eq("tenant_id", tenantId).maybeSingle();
  return data;
}

async function resolveTenantAdminPhones(supabase: SupabaseClient, tenantId: string): Promise<string[]> {
  const { data } = await supabase.from("profiles").select("phone, role").eq("tenant_id", tenantId).in("role", ["admin", "super_admin"]);
  return (data || []).map((p: { phone?: string }) => p.phone).filter(Boolean) as string[];
}

async function sendWhatsApp(to: string, body: string): Promise<void> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM");
  if (!sid || !token || !from) throw new Error("Twilio non configuré (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM manquants).");
  const toFormatted = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: from, To: toFormatted, Body: body }),
  });
  if (!res.ok) { const errBody = await res.text(); throw new Error(`Twilio a refusé l'envoi (${res.status}): ${errBody}`); }
}

async function resolveTenantAdminEmails(supabase: SupabaseClient, tenantId: string): Promise<string[]> {
  const { data } = await supabase.from("profiles").select("email, role").eq("tenant_id", tenantId).in("role", ["admin", "super_admin"]);
  return (data || []).map((p: { email: string }) => p.email).filter(Boolean);
}

function describeEvent(trigger: string, payload: Record<string, unknown>): string {
  const labels: Record<string, string> = {
    deal_created: "Un nouveau deal a été créé", deal_won: "Un deal a été gagné",
    contact_added: "Un nouveau contact a été ajouté", activity_done: "Une activité a été marquée comme terminée",
    task_overdue: "Une tâche est en retard",
  };
  const name = (payload?.title as string) || (payload?.first_name as string) || (payload?.name as string) || "";
  return `${labels[trigger] || trigger}${name ? ` : ${name}` : ""}.`;
}

async function sendEmail(to: string[], subject: string, text: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY non configurée.");
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${PLATFORM_NAME} <${from}>`, to, subject, text }),
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`Resend a refusé l'envoi (${res.status}): ${body}`); }
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface Automation {
  id: string; tenant_id: string; name: string; description: string | null;
  trigger: string; action: string; is_active: boolean;
}
interface Step { id: string; position: number; delay_minutes: number; action: string; description: string | null }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const expectedSecret = Deno.env.get("AUTOMATION_DISPATCH_SECRET");
    const authHeader = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!expectedSecret || authHeader !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: jsonHeaders });
    }

    const { tenant_id, trigger, payload } = await req.json();
    if (!tenant_id || !trigger) {
      return new Response(JSON.stringify({ error: "tenant_id et trigger requis" }), { status: 400, headers: jsonHeaders });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: automations, error: fetchErr } = await supabase
      .from("automations").select("*").eq("tenant_id", tenant_id).eq("trigger", trigger).eq("is_active", true);
    if (fetchErr) return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500, headers: jsonHeaders });

    const results = [];
    for (const automation of (automations || []) as Automation[]) {
      const { data: steps } = await supabase
        .from("automation_steps").select("*").eq("automation_id", automation.id).order("position", { ascending: true });

      if (!steps || steps.length === 0) {
        // Legacy single-action automation: unchanged behavior.
        const outcome = await runAction(supabase, automation.tenant_id, automation.name, automation.action, automation.description, trigger, payload || {});
        await logRun(supabase, tenant_id, automation.id, trigger, automation.action, outcome);
        results.push({ automation_id: automation.id, ...outcome });
        continue;
      }

      let cumulativeMinutes = 0;
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i] as Step;
        cumulativeMinutes += step.delay_minutes;
        if (i === 0 && step.delay_minutes === 0) {
          const outcome = await runAction(supabase, automation.tenant_id, automation.name, step.action, step.description, trigger, payload || {});
          await logRun(supabase, tenant_id, automation.id, trigger, step.action, outcome);
          results.push({ automation_id: automation.id, step: step.position, ...outcome });
        } else {
          await supabase.from("automation_run_queue").insert({
            tenant_id, automation_id: automation.id, step_id: step.id, trigger,
            payload: payload || {}, run_at: new Date(Date.now() + cumulativeMinutes * 60_000).toISOString(),
          });
          results.push({ automation_id: automation.id, step: step.position, status: "scheduled", detail: `Planifiée dans ${cumulativeMinutes} min.` });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, matched: results.length, results }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});
