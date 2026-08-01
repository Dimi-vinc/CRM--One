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
import { runAction, logRun } from "../_shared/automation-actions.ts";

Deno.serve(async (_req: Request) => {
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
    const { data: dueSteps, error: queueErr } = await supabase
      .from("automation_run_queue")
      .select("id, tenant_id, automation_id, step_id, trigger, payload")
      .eq("status", "pending")
      .lte("run_at", new Date().toISOString())
      .limit(200); // safety cap per run; remaining items are picked up on the next scheduled run
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
