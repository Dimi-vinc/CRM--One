// Stripe Checkout Edge Function
// Creates a Stripe Checkout Session for a recurring subscription to a plan.
// Caller: authenticated frontend via fetch. Validates tenant membership + plan.
//
// Required secret: STRIPE_SECRET_KEY (configured via Bolt Stripe setup).
// If not configured, returns 503 with a clear message so the frontend can inform the user.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@16.12.0";

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

// Currencies supported by Stripe for subscriptions (zero-decimal currencies handled)
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
    const isZero = ZERO_DECIMAL_CURRENCIES.has(cur);
    const unitAmount = PLAN_PRICES[planId].usd; // base price in USD cents
    // For simplicity (and to avoid live FX risk in demo), charge in USD unless currency == USD
    const chargeCurrency = "usd";
    const finalAmount = isZero ? Math.round(unitAmount / 100) : unitAmount;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: chargeCurrency,
            product_data: { name: `CRM-One — Plan ${planId}` },
            unit_amount: finalAmount,
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
