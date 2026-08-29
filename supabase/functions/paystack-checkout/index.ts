// Paystack Checkout Edge Function.
// Creates a Paystack hosted-checkout link for a plan subscription. Cards, bank transfer,
// mobile money, USSD, QR depending on the channels enabled on the merchant account — strongest
// coverage in Nigeria, Ghana, South Africa, Kenya.
//
// Required secret: PAYSTACK_SECRET_KEY (sk_test_... or sk_live_...).
//
// Self-contained by design: currency conversion is inlined here rather than imported from a
// shared folder, because Supabase's function bundler has a known, currently-active issue
// resolving relative imports into `_shared/` folders in some deployment paths, producing a
// "Module not found ... _shared/..." error at deploy time even when the file is present. If you
// change a currency in src/lib/constants.ts, mirror the change here (and in the other checkout
// functions) too.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface CurrencyRate { decimals: number; rateToUsd: number }
const CURRENCY_RATES: Record<string, CurrencyRate> = {
  XOF: { decimals: 0, rateToUsd: 0.00165 }, XAF: { decimals: 0, rateToUsd: 0.00165 },
  NGN: { decimals: 2, rateToUsd: 0.00065 }, GHS: { decimals: 2, rateToUsd: 0.075 },
  KES: { decimals: 2, rateToUsd: 0.0072 }, ZAR: { decimals: 2, rateToUsd: 0.053 },
  EGP: { decimals: 2, rateToUsd: 0.021 }, MAD: { decimals: 2, rateToUsd: 0.10 },
  DZD: { decimals: 2, rateToUsd: 0.0073 }, ETB: { decimals: 2, rateToUsd: 0.0094 },
  TZS: { decimals: 0, rateToUsd: 0.00039 }, UGX: { decimals: 0, rateToUsd: 0.00026 },
  USD: { decimals: 2, rateToUsd: 1 }, EUR: { decimals: 2, rateToUsd: 1.08 },
  GBP: { decimals: 2, rateToUsd: 1.27 }, AED: { decimals: 2, rateToUsd: 0.27 },
  SAR: { decimals: 2, rateToUsd: 0.27 }, CAD: { decimals: 2, rateToUsd: 0.72 },
  AUD: { decimals: 2, rateToUsd: 0.65 }, CHF: { decimals: 2, rateToUsd: 1.12 },
  JPY: { decimals: 0, rateToUsd: 0.0067 }, CNY: { decimals: 2, rateToUsd: 0.14 },
  INR: { decimals: 2, rateToUsd: 0.012 }, BRL: { decimals: 2, rateToUsd: 0.18 },
};
function convertUsdTo(usdAmount: number, currencyCode: string): { amount: number; decimals: number } {
  const rate = CURRENCY_RATES[currencyCode.toUpperCase()] || CURRENCY_RATES.USD;
  const converted = usdAmount / rate.rateToUsd;
  const factor = 10 ** rate.decimals;
  return { amount: Math.round(converted * factor) / factor, decimals: rate.decimals };
}

// Paystack only officially supports charging in a handful of currencies (NGN, GHS, ZAR, KES,
// USD as of writing) depending on the merchant account's country — anything else will be
// rejected by their API with a clear error, which we surface rather than guessing.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secretKey) {
      return new Response(JSON.stringify({ error: "Paystack n'est pas encore configuré.", notConfigured: true }), { status: 503, headers: jsonHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: jsonHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: jsonHeaders });

    const { planId, currency, tenantId, email, successUrl } = await req.json();
    if (!planId || !tenantId) {
      return new Response(JSON.stringify({ error: "Paramètres invalides" }), { status: 400, headers: jsonHeaders });
    }
    const { data: planRow } = await supabase.from("plans").select("price_monthly, is_active").eq("id", planId).maybeSingle();
    if (!planRow || !planRow.is_active) {
      return new Response(JSON.stringify({ error: "Plan inconnu ou inactif" }), { status: 400, headers: jsonHeaders });
    }
    const planPriceUsd = Number(planRow.price_monthly);

    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    if (!profile || profile.tenant_id !== tenantId) {
      return new Response(JSON.stringify({ error: "Accès refusé au tenant" }), { status: 403, headers: jsonHeaders });
    }

    const cur = (currency || "NGN").toUpperCase();
    const converted = convertUsdTo(planPriceUsd, cur);
    // Paystack amounts are always in the currency's smallest subunit (kobo for NGN, cents for
    // GHS/ZAR/KES/USD) — all currencies Paystack actually supports use 2 decimals, so *100.
    const amountSubunit = Math.round(converted.amount * 100);

    const reference = `crmone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: insertErr } = await admin.from("paystack_transactions").insert({
      reference, tenant_id: tenantId, plan_id: planId, currency: cur, status: "pending",
    });
    if (insertErr) {
      return new Response(JSON.stringify({ error: "Impossible d'initier la transaction." }), { status: 500, headers: jsonHeaders });
    }

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email || user.email,
        amount: amountSubunit,
        currency: cur,
        reference,
        callback_url: successUrl,
      }),
    });
    const data = await res.json();
    if (!data?.status || !data.data?.authorization_url) {
      await admin.from("paystack_transactions").update({ status: "failed" }).eq("reference", reference);
      return new Response(JSON.stringify({ error: data?.message || "Paystack a refusé la demande." }), { status: 502, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ url: data.data.authorization_url }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});
