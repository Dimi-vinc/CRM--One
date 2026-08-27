// Stripe Checkout Edge Function
// Creates a Stripe Checkout Session for a recurring subscription to a plan.
// Caller: authenticated frontend via fetch. Validates tenant membership + plan.
//
// Required secret: STRIPE_SECRET_KEY (configured via Bolt Stripe setup).
// If not configured, returns 503 with a clear message so the frontend can inform the user.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@16.12.0";

// Approximate USD conversion rates, used ONLY for converting the platform's USD list prices into
// a tenant's chosen billing currency at checkout time. This intentionally mirrors the CURRENCIES
// array in src/lib/constants.ts (same codes, same decimals, same rateToUsd) — duplicated rather
// than imported from a shared folder, because Supabase's function bundler has a known,
// currently-active issue resolving relative imports into `_shared/` folders in some deployment
// paths (dashboard deploy in particular), producing a "Module not found ... _shared/..." error
// at deploy time even when the file is present and correctly referenced. Keeping every function
// fully self-contained avoids this entirely. If you add or change a currency in
// src/lib/constants.ts, mirror the change here too.
interface CurrencyRate { decimals: number; rateToUsd: number }

const CURRENCY_RATES: Record<string, CurrencyRate> = {
  XOF: { decimals: 0, rateToUsd: 0.00165 },
  XAF: { decimals: 0, rateToUsd: 0.00165 },
  NGN: { decimals: 2, rateToUsd: 0.00065 },
  GHS: { decimals: 2, rateToUsd: 0.075 },
  KES: { decimals: 2, rateToUsd: 0.0072 },
  ZAR: { decimals: 2, rateToUsd: 0.053 },
  EGP: { decimals: 2, rateToUsd: 0.021 },
  MAD: { decimals: 2, rateToUsd: 0.10 },
  DZD: { decimals: 2, rateToUsd: 0.0073 },
  ETB: { decimals: 2, rateToUsd: 0.0094 },
  TZS: { decimals: 0, rateToUsd: 0.00039 },
  UGX: { decimals: 0, rateToUsd: 0.00026 },
  USD: { decimals: 2, rateToUsd: 1 },
  EUR: { decimals: 2, rateToUsd: 1.08 },
  GBP: { decimals: 2, rateToUsd: 1.27 },
  AED: { decimals: 2, rateToUsd: 0.27 },
  SAR: { decimals: 2, rateToUsd: 0.27 },
  CAD: { decimals: 2, rateToUsd: 0.72 },
  AUD: { decimals: 2, rateToUsd: 0.65 },
  CHF: { decimals: 2, rateToUsd: 1.12 },
  JPY: { decimals: 0, rateToUsd: 0.0067 },
  CNY: { decimals: 2, rateToUsd: 0.14 },
  INR: { decimals: 2, rateToUsd: 0.012 },
  BRL: { decimals: 2, rateToUsd: 0.18 },
};

function convertUsdTo(usdAmount: number, currencyCode: string): { amount: number; decimals: number } {
  const rate = CURRENCY_RATES[currencyCode.toUpperCase()] || CURRENCY_RATES.USD;
  const converted = usdAmount / rate.rateToUsd;
  const factor = 10 ** rate.decimals;
  return { amount: Math.round(converted * factor) / factor, decimals: rate.decimals };
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PLAN_PRICES: Record<string, { usd: number }> = {
  starter: { usd: 900 },    // $9.00 in cents
  pro: { usd: 2900 },       // $29.00
  premium: { usd: 6900 },   // $69.00
  entreprise: { usd: 15900 }, // $159.00
};

// Currencies Stripe treats as having no decimal subunit (amount is already in whole units).
const ZERO_DECIMAL_CURRENCIES = new Set(['XOF','XAF','UGX','TZS','RWF','BIF','DJF','GNF','KMF','CLP','JPY','VND']);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      return new Response(
        JSON.stringify({ error: "Stripe n'est pas encore configuré. Configurez votre clé Stripe pour activer les paiements.", notConfigured: true }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { planId, currency, tenantId, email, successUrl, cancelUrl } = body;
    if (!planId || !tenantId || !email) {
      return new Response(JSON.stringify({ error: "Paramètres manquants" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!PLAN_PRICES[planId]) {
      return new Response(JSON.stringify({ error: "Plan inconnu" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify tenant membership
    const { data: profile } = await supabase.from("profiles").select("tenant_id, role").eq("id", user.id).maybeSingle();
    if (!profile || profile.tenant_id !== tenantId) {
      return new Response(JSON.stringify({ error: "Accès refusé au tenant" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" as Stripe.LatestApiVersion });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId = customers.data[0]?.id;
    if (!customerId) {
      const cust = await stripe.customers.create({ email, metadata: { tenant_id: tenantId } });
      customerId = cust.id;
    }

    const cur = (currency || "USD").toUpperCase();
    const usdAmount = PLAN_PRICES[planId].usd / 100; // base price in whole USD

    async function createSession(chargeCurrencyLower: string, unitAmount: number) {
      return stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: chargeCurrencyLower,
              product_data: { name: `CRM-One — Plan ${planId}` },
              unit_amount: unitAmount,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { tenant_id: tenantId, plan_id: planId, requested_currency: cur },
        subscription_data: { metadata: { tenant_id: tenantId, plan_id: planId } },
      });
    }

    // Charge in the tenant's chosen currency — Stripe supports 135+ presentment currencies
    // (including e.g. XOF) with automatic zero-decimal handling. Amount is properly converted
    // from the USD list price (see convertUsdTo() above), not a hardcoded
    // divide — the previous version always charged in "usd" but still (incorrectly) divided the
    // amount as if the charge currency were zero-decimal, undercharging by 100x whenever a
    // zero-decimal currency like XOF was selected.
    let session;
    try {
      const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(cur);
      const converted = convertUsdTo(usdAmount, cur);
      const unitAmount = isZeroDecimal ? Math.round(converted.amount) : Math.round(converted.amount * 100);
      session = await createSession(cur.toLowerCase(), unitAmount);
    } catch (stripeErr) {
      // This Stripe account/region doesn't support the requested presentment currency — fall
      // back to USD rather than hard-failing the checkout.
      if (cur === "USD") throw stripeErr;
      session = await createSession("usd", PLAN_PRICES[planId].usd);
    }

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
