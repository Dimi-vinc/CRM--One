// Automations cron Edge Function
// Two jobs, both time-based (not tied to a single row event), run on the same schedule:
//   1. "task_overdue" trigger check (unchanged from before).
//   2. Processing due steps from automation_run_queue — this is what actually makes multi-step
//      sequences with delays (e.g. "wait 2 days, then...") fire on time.
// Schedule via Supabase Dashboard → Edge Functions → Schedule. Every 15 min is reasonable;
// tighter scheduling makes delayed steps fire closer to their exact target time.
//
// Required secrets: same as automations-dispatch (AUTOMATION_DISPATCH_SECRET, RESEND_API_KEY,
// etc.), plus SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (auto-provided).

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


Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dispatchSecret = Deno.env.get("AUTOMATION_DISPATCH_SECRET");
    if (!dispatchSecret) {
      return new Response(JSON.stringify({ error: "AUTOMATION_DISPATCH_SECRET manquant" }), { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    // ---- Job 1: overdue tasks ----
    const today = new Date().toISOString().slice(0, 10);
    const { data: overdueTasks, error: taskErr } = await supabase
      .from("tasks").select("id, tenant_id, title, due_date, status")
      .lt("due_date", today).neq("status", "done").eq("overdue_notified", false);
    if (taskErr) return new Response(JSON.stringify({ error: taskErr.message }), { status: 500 });

    let dispatched = 0;
    for (const task of overdueTasks || []) {
      await fetch(`${supabaseUrl}/functions/v1/automations-dispatch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${dispatchSecret}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: task.tenant_id, trigger: "task_overdue", payload: task }),
      });
      await supabase.from("tasks").update({ overdue_notified: true }).eq("id", task.id);
      dispatched++;
    }

    // ---- Job 2: due steps in multi-step sequences ----
    // Atomically claims due rows (status -> 'processing', row-locked with SKIP LOCKED) before any
    // processing happens — see migration 0029. This is what prevents two overlapping invocations
    // of this function from both picking up and executing the same step.
    const { data: dueSteps, error: queueErr } = await supabase.rpc("claim_due_automation_steps", { p_limit: 200 });
    if (queueErr) return new Response(JSON.stringify({ error: queueErr.message }), { status: 500 });

    let stepsProcessed = 0;
    for (const item of dueSteps || []) {
      const [{ data: automation }, { data: step }] = await Promise.all([
        supabase.from("automations").select("name").eq("id", item.automation_id).maybeSingle(),
        item.step_id ? supabase.from("automation_steps").select("action, description").eq("id", item.step_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (!automation || !step) {
        await supabase.from("automation_run_queue").update({ status: "failed" }).eq("id", item.id);
        continue;
      }
      const outcome = await runAction(supabase, item.tenant_id, automation.name, step.action, step.description, item.trigger, item.payload || {});
      await logRun(supabase, item.tenant_id, item.automation_id, item.trigger, step.action, outcome);
      await supabase.from("automation_run_queue").update({ status: outcome.status === "error" ? "failed" : "done" }).eq("id", item.id);
      stepsProcessed++;
    }

    return new Response(JSON.stringify({
      ok: true, tasksChecked: (overdueTasks || []).length, tasksDispatched: dispatched,
      stepsChecked: (dueSteps || []).length, stepsProcessed,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500 });
  }
});
