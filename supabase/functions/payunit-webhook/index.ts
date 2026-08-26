// DEPLOY WITH: supabase functions deploy payunit-webhook --no-verify-jwt
// Required because PayUnit calls this directly from its servers — no Supabase JWT is ever present. Without this flag, Supabase's gateway rejects every call with a
// 401 before this function's own code ever runs — a failure that won't show up in these logs.
// PayUnit Webhook (notify_url) Edge Function.
// PayUnit's documented notify payload isn't a signed request (no HMAC secret to check, unlike
// Stripe), so — same defensive pattern as flutterwave-webhook — we treat the incoming POST as
// nothing more than a hint to go check ("a transaction may have completed"), and re-verify the
// real status directly against PayUnit's own API using our own credentials before trusting it or
// activating anything. A forged POST to this URL can, at most, tell us to go check a
// transaction_id — it can't fake what PayUnit's API itself reports back.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const PAYUNIT_BASE_URL = "https://gateway.payunit.net";

Deno.serve(async (req: Request) => {
  try {
    const apiKey = Deno.env.get("PAYUNIT_API_KEY");
    const apiUsername = Deno.env.get("PAYUNIT_API_USERNAME");
    const apiPassword = Deno.env.get("PAYUNIT_API_PASSWORD");
    const mode = Deno.env.get("PAYUNIT_MODE") === "live" ? "live" : "test";
    if (!apiKey || !apiUsername || !apiPassword) {
      return new Response(JSON.stringify({ error: "PayUnit non configuré" }), { status: 503 });
    }

    const payload = await req.json().catch(() => ({}));
    // PayUnit's docs are not fully consistent about which field carries the merchant-supplied
    // transaction_id in the notify payload across different examples (transaction_id vs t_id,
    // nested under `data` or not) — check every plausible shape rather than betting on one, since
    // a wrong guess here would mean 100% of webhooks silently fail to match anything.
    const txId: string | undefined =
      payload?.transaction_id || payload?.data?.transaction_id ||
      payload?.t_id || payload?.data?.t_id;
    if (!txId) {
      // Nothing usable to verify — acknowledge so PayUnit doesn't endlessly retry, do nothing.
      return new Response(JSON.stringify({ received: true, ignored: true }), { headers: { "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Only a transaction_id we ourselves generated at checkout time (see payunit-checkout) has a
    // matching row here — this is also what stops a forged notify call for a made-up
    // transaction_id from going any further.
    const { data: txRow } = await admin.from("payunit_transactions").select("*").eq("transaction_id", txId).maybeSingle();
    if (!txRow) {
      return new Response(JSON.stringify({ received: true, ignored: true }), { headers: { "Content-Type": "application/json" } });
    }
    if (txRow.status === "confirmed") {
      // Already processed (PayUnit may call notify_url more than once) — idempotent no-op.
      return new Response(JSON.stringify({ received: true, alreadyProcessed: true }), { headers: { "Content-Type": "application/json" } });
    }

    // Re-verify directly with PayUnit rather than trusting the notify payload's own status.
    const verifyRes = await fetch(`${PAYUNIT_BASE_URL}/api/gateway/paymentstatus/${encodeURIComponent(txId)}`, {
      headers: {
        "x-api-key": apiKey,
        mode,
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${apiUsername}:${apiPassword}`)}`,
      },
    });
    const verify = await verifyRes.json();
    const status = verify?.data?.transaction_status;

    if (status !== "SUCCESS") {
      if (status === "FAILED" || status === "CANCELLED") {
        await admin.from("payunit_transactions").update({ status: "failed" }).eq("transaction_id", txId);
      }
      return new Response(JSON.stringify({ received: true, status: status || "unknown" }), { headers: { "Content-Type": "application/json" } });
    }

    // Confirmed successful — activate the plan. 30-day period, same charge-once-per-period model
    // as Flutterwave (PayUnit has no native recurring-billing product in the base REST API).
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from("subscriptions").update({
      plan_id: txRow.plan_id,
      status: "active",
      current_period_end: periodEnd,
    }).eq("tenant_id", txRow.tenant_id);
    await admin.from("tenants").update({ plan_id: txRow.plan_id, status: "active" }).eq("id", txRow.tenant_id);
    await admin.from("payunit_transactions").update({ status: "confirmed" }).eq("transaction_id", txId);

    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500 });
  }
});
