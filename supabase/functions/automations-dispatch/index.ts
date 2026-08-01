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
import { runAction, logRun } from "../_shared/automation-actions.ts";

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
