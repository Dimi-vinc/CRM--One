// Automations dispatch Edge Function
// Called (async, fire-and-forget) by DB triggers via pg_net whenever a row-based automation
// event happens (contact_added, deal_created, deal_won, activity_done) or by the
// automations-cron function (task_overdue). Looks up active automations matching the tenant +
// trigger, executes each one, and logs the outcome to automation_runs so it's auditable from
// the Automations UI.
//
// Required secrets:
//   RESEND_API_KEY            — from resend.com, used for the send_email action.
//   AUTOMATION_DISPATCH_SECRET — must match automation_config.dispatch_secret (see migration).
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — auto-provided by Supabase.
//   RESEND_FROM_EMAIL (optional) — verified sender address; defaults to onboarding@resend.dev
//   PLATFORM_NAME (optional) — used in email subjects/signatures; defaults to "LiAfrik One"

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const PLATFORM_NAME = Deno.env.get("PLATFORM_NAME") || "LiAfrik One";
// Implemented actions only. Anything else (e.g. a future 'update_deal') is logged as skipped
// rather than silently doing nothing, so the execution log stays honest.
const IMPLEMENTED_ACTIONS = new Set(["send_email", "create_task", "notify_team", "create_activity"]);

interface Automation {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  trigger: string;
  action: string;
  is_active: boolean;
}

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: automations, error: fetchErr } = await supabase
      .from("automations")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("trigger", trigger)
      .eq("is_active", true);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500, headers: jsonHeaders });
    }

    const results = [];
    for (const automation of (automations || []) as Automation[]) {
      const outcome = await runAutomation(supabase, automation, trigger, payload || {});
      await supabase.from("automation_runs").insert({
        tenant_id,
        automation_id: automation.id,
        trigger,
        action: automation.action,
        status: outcome.status,
        detail: outcome.detail,
      });
      results.push({ automation_id: automation.id, ...outcome });
    }

    return new Response(JSON.stringify({ ok: true, matched: results.length, results }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});

async function runAutomation(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  automation: Automation,
  trigger: string,
  payload: Record<string, unknown>,
): Promise<{ status: "success" | "error" | "skipped"; detail: string }> {
  if (!IMPLEMENTED_ACTIONS.has(automation.action)) {
    return { status: "skipped", detail: `Action "${automation.action}" pas encore disponible.` };
  }

  try {
    switch (automation.action) {
      case "send_email": {
        const to = await resolveTenantAdminEmails(supabase, automation.tenant_id);
        if (to.length === 0) return { status: "error", detail: "Aucun administrateur avec email à notifier." };
        const subject = `[${PLATFORM_NAME}] ${automation.name}`;
        const bodyText = automation.description || describeEvent(trigger, payload);
        await sendEmail(to, subject, bodyText);
        return { status: "success", detail: `Email envoyé à ${to.join(", ")}.` };
      }
      case "create_task": {
        const { error } = await supabase.from("tasks").insert({
          tenant_id: automation.tenant_id,
          title: automation.name,
          description: automation.description || describeEvent(trigger, payload),
          priority: "medium",
          status: "todo",
        });
        if (error) return { status: "error", detail: error.message };
        return { status: "success", detail: "Tâche créée." };
      }
      case "notify_team": {
        const { data: members } = await supabase.from("profiles").select("id").eq("tenant_id", automation.tenant_id);
        const rows = (members || []).map((m: { id: string }) => ({
          tenant_id: automation.tenant_id,
          user_id: m.id,
          title: automation.name,
          body: automation.description || describeEvent(trigger, payload),
        }));
        if (rows.length === 0) return { status: "error", detail: "Aucun membre à notifier." };
        const { error } = await supabase.from("notifications").insert(rows);
        if (error) return { status: "error", detail: error.message };
        return { status: "success", detail: `${rows.length} notification(s) créée(s).` };
      }
      case "create_activity": {
        const { error } = await supabase.from("activities").insert({
          tenant_id: automation.tenant_id,
          type: "task",
          title: automation.name,
          description: automation.description || describeEvent(trigger, payload),
          contact_id: (payload as { id?: string; contact_id?: string })?.contact_id
            || (trigger === "contact_added" ? (payload as { id?: string })?.id : null),
        });
        if (error) return { status: "error", detail: error.message };
        return { status: "success", detail: "Activité créée." };
      }
      default:
        return { status: "skipped", detail: "Action inconnue." };
    }
  } catch (err) {
    return { status: "error", detail: err?.message || "Erreur inconnue" };
  }
}

// deno-lint-ignore no-explicit-any
async function resolveTenantAdminEmails(supabase: any, tenantId: string): Promise<string[]> {
  const { data } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("tenant_id", tenantId)
    .in("role", ["admin", "super_admin"]);
  return (data || []).map((p: { email: string }) => p.email).filter(Boolean);
}

function describeEvent(trigger: string, payload: Record<string, unknown>): string {
  const labels: Record<string, string> = {
    deal_created: "Un nouveau deal a été créé",
    deal_won: "Un deal a été gagné",
    contact_added: "Un nouveau contact a été ajouté",
    activity_done: "Une activité a été marquée comme terminée",
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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend a refusé l'envoi (${res.status}): ${body}`);
  }
}
