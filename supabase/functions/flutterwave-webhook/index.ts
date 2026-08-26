// DEPLOY WITH: supabase functions deploy flutterwave-webhook --no-verify-jwt
// Required because Flutterwave calls this directly from its servers — no Supabase JWT is ever present. Without this flag, Supabase's gateway rejects every call with a
// 401 before this function's own code ever runs — a failure that won't show up in these logs.
// Flutterwave Webhook Edge Function
// Verifies the webhook signature AND re-verifies the transaction directly with Flutterwave's
// API before trusting it (defense in depth — never trust a webhook payload's amount/status
// blindly, since a forged request could otherwise claim any amount was paid).
//
// Required secrets: FLW_SECRET_KEY, FLW_SECRET_HASH (a random string YOU choose and set both
// here and in the Flutterwave Dashboard webhook config — see supabase/STRIPE_FLUTTERWAVE_SETUP.md).
//
// Register in Flutterwave Dashboard → Settings → Webhooks:
//   URL: https://<PROJECT_REF>.supabase.co/functions/v1/flutterwave-webhook
//   Secret hash: same value as FLW_SECRET_HASH

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

Deno.serve(async (req: Request) => {
  try {
    const secretHash = Deno.env.get("FLW_SECRET_HASH");
    const flwSecret = Deno.env.get("FLW_SECRET_KEY");
    if (!secretHash || !flwSecret) {
      return new Response(JSON.stringify({ error: "Flutterwave non configuré" }), { status: 503 });
    }

    // Flutterwave signs webhooks with a plain shared-secret header (not HMAC) — reject anything
    // that doesn't match exactly.
    const signature = req.headers.get("verif-hash");
    if (!signature || signature !== secretHash) {
      return new Response(JSON.stringify({ error: "Signature invalide" }), { status: 401 });
    }

    const payload = await req.json();
    const txId = payload?.data?.id;
    if (!txId || payload?.data?.status !== "successful") {
      return new Response(JSON.stringify({ received: true, ignored: true }), { headers: { "Content-Type": "application/json" } });
    }

    // Re-verify directly with Flutterwave rather than trusting the payload's own amount/status.
    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${txId}/verify`, {
      headers: { Authorization: `Bearer ${flwSecret}` },
    });
    const verify = await verifyRes.json();
    if (verify?.data?.status !== "successful") {
      return new Response(JSON.stringify({ error: "Transaction non confirmée par Flutterwave" }), { status: 400 });
    }

    const tenantId = verify.data.meta?.tenant_id;
    const planId = verify.data.meta?.plan_id;
    if (!tenantId || !planId) {
      return new Response(JSON.stringify({ error: "Métadonnées tenant/plan manquantes" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Flutterwave subscriptions here are charge-once-per-period (no native auto-recycling for
    // all payment methods, notably Mobile Money) — current_period_end tracks 30 days from now,
    // and re-billing/reminders for the next period are a separate follow-up, not automatic.
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("subscriptions").update({
      plan_id: planId,
      status: "active",
      current_period_end: periodEnd,
    }).eq("tenant_id", tenantId);
    await supabase.from("tenants").update({ plan_id: planId, status: "active" }).eq("id", tenantId);

    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500 });
  }
});
