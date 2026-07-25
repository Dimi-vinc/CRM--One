// Automations cron Edge Function
// Time-based trigger check ("task_overdue") that can't be tied to a single row event.
// Schedule this to run periodically (e.g. every 15 min) via Supabase Dashboard →
// Edge Functions → your function → Schedule (cron). It does not need to be called by the
// frontend or by pg_net; it calls automations-dispatch itself for each affected tenant.
//
// Required secrets: same as automations-dispatch, since it re-uses AUTOMATION_DISPATCH_SECRET
// to call it, plus SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

Deno.serve(async (_req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dispatchSecret = Deno.env.get("AUTOMATION_DISPATCH_SECRET");
    if (!dispatchSecret) {
      return new Response(JSON.stringify({ error: "AUTOMATION_DISPATCH_SECRET manquant" }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().slice(0, 10);
    const { data: overdueTasks, error } = await supabase
      .from("tasks")
      .select("id, tenant_id, title, due_date, status")
      .lt("due_date", today)
      .neq("status", "done")
      .eq("overdue_notified", false);

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

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

    return new Response(JSON.stringify({ ok: true, checked: (overdueTasks || []).length, dispatched }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500 });
  }
});
