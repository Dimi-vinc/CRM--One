// Flutterwave Checkout Edge Function
// Creates a Flutterwave payment link for a plan subscription (Mobile Money, cartes locales,
// virements — pertinent pour les marchés africains). Mirrors stripe-checkout's interface so the
// frontend payments.ts abstraction can call either provider interchangeably.
//
// Required secret: FLW_SECRET_KEY (from dashboard.flutterwave.com → Settings → API Keys).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const flwSecret = Deno.env.get("FLW_SECRET_KEY");
    if (!flwSecret) {
      return new Response(JSON.stringify({ error: "Flutterwave n'est pas encore configuré.", notConfigured: true }), { status: 503, headers: jsonHeaders });
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

    const { planId, currency, tenantId, email, successUrl } = await req.json();
    if (!planId || !tenantId || !email) {
      return new Response(JSON.stringify({ error: "Paramètres manquants" }), { status: 400, headers: jsonHeaders });
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

    const cur = (currency || "USD").toUpperCase();
    const amount = convertUsdTo(planPriceUsd, cur).amount;
    const txRef = `crmone-${tenantId}-${planId}-${Date.now()}`;

    const res = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: { Authorization: `Bearer ${flwSecret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref: txRef,
        amount,
        currency: cur,
        redirect_url: successUrl,
        customer: { email },
        payment_options: "card,mobilemoneyghana,mobilemoneyuganda,mobilemoneyrwanda,mobilemoneyzambia,mpesa,ussd",
        meta: { tenant_id: tenantId, plan_id: planId },
        customizations: { title: "CRM-One", description: `Abonnement plan ${planId}` },
      }),
    });

    const data = await res.json();
    if (data.status !== "success" || !data.data?.link) {
      return new Response(JSON.stringify({ error: data.message || "Flutterwave a refusé la demande." }), { status: 502, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ url: data.data.link }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});
