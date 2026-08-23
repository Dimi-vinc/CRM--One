// Flutterwave Checkout Edge Function
// Creates a Flutterwave payment link for a plan subscription (Mobile Money, cartes locales,
// virements — pertinent pour les marchés africains). Mirrors stripe-checkout's interface so the
// frontend payments.ts abstraction can call either provider interchangeably.
//
// Required secret: FLW_SECRET_KEY (from dashboard.flutterwave.com → Settings → API Keys).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { convertUsdTo } from "../_shared/currency-rates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Same base prices as Stripe (in the plan's home currency's smallest coherent unit — Flutterwave
// takes a plain decimal amount, not cents, unlike Stripe).
const PLAN_PRICES_USD: Record<string, number> = {
  starter: 9, pro: 29, premium: 69, entreprise: 159,
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
    if (!PLAN_PRICES_USD[planId]) {
      return new Response(JSON.stringify({ error: "Plan inconnu" }), { status: 400, headers: jsonHeaders });
    }

    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    if (!profile || profile.tenant_id !== tenantId) {
      return new Response(JSON.stringify({ error: "Accès refusé au tenant" }), { status: 403, headers: jsonHeaders });
    }

    const cur = (currency || "USD").toUpperCase();
    const amount = convertUsdTo(PLAN_PRICES_USD[planId], cur).amount;
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
