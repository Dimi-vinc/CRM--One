// Stripe Webhook Edge Function
// This is the ONLY place that should ever mark a tenant/subscription as paid. The previous
// client-side code did this from a URL query param (?status=success), which was a full
// billing-bypass vulnerability (anyone could type that URL and get any plan for free) — it is
// now also blocked server-side by the anti-billing-bypass trigger from migration 0013.
//
// Required secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (from the Stripe Dashboard once
// this endpoint is registered — see supabase/STRIPE_FLUTTERWAVE_SETUP.md).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-provided.
//
// Register this endpoint in Stripe Dashboard → Developers → Webhooks:
//   URL: https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook
//   Events: checkout.session.completed, customer.subscription.updated,
//           customer.subscription.deleted, invoice.payment_failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@16.12.0";

Deno.serve(async (req: Request) => {
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeSecret || !webhookSecret) {
    return new Response(JSON.stringify({ error: "Stripe non configuré" }), { status: 503 });
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" as Stripe.LatestApiVersion });
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    // Verifies the payload was genuinely sent by Stripe (HMAC signature) — without this check,
    // anyone could POST a fake "payment succeeded" event directly to this URL.
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    return new Response(JSON.stringify({ error: `Signature invalide: ${err.message}` }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenant_id;
        const planId = session.metadata?.plan_id;
        if (!tenantId || !planId) break;

        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

        await supabase.from("subscriptions").update({
          plan_id: planId,
          status: "active",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        }).eq("tenant_id", tenantId);

        await supabase.from("tenants").update({ plan_id: planId, status: "active" }).eq("id", tenantId);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const tenantId = sub.metadata?.tenant_id;
        if (!tenantId) break;
        const status = sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : sub.status;
        await supabase.from("subscriptions").update({
          status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq("tenant_id", tenantId);
        if (status !== "active") {
          await supabase.from("tenants").update({ status: "past_due" }).eq("id", tenantId);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const tenantId = sub.metadata?.tenant_id;
        if (!tenantId) break;
        await supabase.from("subscriptions").update({ status: "canceled" }).eq("tenant_id", tenantId);
        await supabase.from("tenants").update({ status: "canceled" }).eq("id", tenantId);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        if (!subId) break;
        const { data: subRow } = await supabase.from("subscriptions").select("tenant_id").eq("stripe_subscription_id", subId).maybeSingle();
        if (subRow) {
          await supabase.from("subscriptions").update({ status: "past_due" }).eq("tenant_id", subRow.tenant_id);
          await supabase.from("tenants").update({ status: "past_due" }).eq("id", subRow.tenant_id);
        }
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500 });
  }
});
