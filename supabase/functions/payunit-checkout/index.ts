// PayUnit Checkout Edge Function
// Creates a PayUnit hosted-payment-page link for a plan subscription (Orange Money, MTN Mobile
// Money, cards — Cameroon/Central Africa focused). Mirrors stripe-checkout/flutterwave-checkout's
// interface so the frontend payments.ts abstraction can call any of the three interchangeably.
//
// Required secrets:
//   PAYUNIT_API_KEY       (x-api-key header — from dashboard, API CREDENTIALS tab)
//   PAYUNIT_API_USERNAME  (used for HTTP Basic Auth)
//   PAYUNIT_API_PASSWORD  (used for HTTP Basic Auth)
// Optional secret:
//   PAYUNIT_MODE          "live" or "test" (default "test" — deliberately conservative: a
//                          misconfigured deployment should fail safe into PayUnit's sandbox
//                          rather than silently take real payments).
//
// PayUnit's REST API (unlike Stripe/Flutterwave) has no request-level metadata field to carry
// tenant_id/plan_id through to the webhook, so that correlation is stored in our own
// payunit_transactions table (migration 0031) before calling PayUnit, keyed by the
// transaction_id we generate — which doubles as the ID we later query PayUnit's payment-status
// endpoint with.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { convertUsdTo } from "../_shared/currency-rates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const PAYUNIT_BASE_URL = "https://gateway.payunit.net";

// Same base USD prices as the other two providers (see stripe-checkout, flutterwave-checkout).
const PLAN_PRICES_USD: Record<string, number> = {
  starter: 9, pro: 29, premium: 69, entreprise: 159,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const apiKey = Deno.env.get("PAYUNIT_API_KEY");
    const apiUsername = Deno.env.get("PAYUNIT_API_USERNAME");
    const apiPassword = Deno.env.get("PAYUNIT_API_PASSWORD");
    const mode = Deno.env.get("PAYUNIT_MODE") === "live" ? "live" : "test";
    if (!apiKey || !apiUsername || !apiPassword) {
      return new Response(JSON.stringify({ error: "PayUnit n'est pas encore configuré.", notConfigured: true }), { status: 503, headers: jsonHeaders });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: jsonHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: jsonHeaders });

    const { planId, currency, tenantId, successUrl } = await req.json();
    if (!planId || !tenantId) {
      return new Response(JSON.stringify({ error: "Paramètres manquants" }), { status: 400, headers: jsonHeaders });
    }
    if (!PLAN_PRICES_USD[planId]) {
      return new Response(JSON.stringify({ error: "Plan inconnu" }), { status: 400, headers: jsonHeaders });
    }

    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    if (!profile || profile.tenant_id !== tenantId) {
      return new Response(JSON.stringify({ error: "Accès refusé au tenant" }), { status: 403, headers: jsonHeaders });
    }

    // PayUnit's principal, best-tested currency is XAF (Central African CFA franc); other
    // currencies depend on account configuration. We still convert correctly regardless of what
    // the tenant selected, and let PayUnit reject it with a clear error if unsupported for this
    // account rather than silently defaulting.
    const cur = (currency || "XAF").toUpperCase();
    const converted = convertUsdTo(PLAN_PRICES_USD[planId], cur);
    const amount = converted.decimals === 0 ? Math.round(converted.amount) : Math.round(converted.amount * 100) / 100;

    // transaction_id is OUR identifier: PayUnit's docs warn special characters break Orange Money
    // payments, so keep it alphanumeric-with-hyphens only.
    const txRef = `crmone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: insertErr } = await admin.from("payunit_transactions").insert({
      transaction_id: txRef, tenant_id: tenantId, plan_id: planId, currency: cur, status: "pending",
    });
    if (insertErr) {
      return new Response(JSON.stringify({ error: "Impossible d'initier la transaction." }), { status: 500, headers: jsonHeaders });
    }

    const res = await fetch(`${PAYUNIT_BASE_URL}/api/gateway/initialize`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        mode,
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${apiUsername}:${apiPassword}`)}`,
      },
      body: JSON.stringify({
        total_amount: amount,
        currency: cur,
        transaction_id: txRef,
        return_url: successUrl,
        notify_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payunit-webhook`,
      }),
    });

    const data = await res.json();
    if (data?.status !== "SUCCESS" || !data.data?.transaction_url) {
      await admin.from("payunit_transactions").update({ status: "failed" }).eq("transaction_id", txRef);
      return new Response(JSON.stringify({ error: data?.message || "PayUnit a refusé la demande." }), { status: 502, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ url: data.data.transaction_url }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});
