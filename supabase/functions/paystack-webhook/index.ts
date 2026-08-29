// DEPLOY WITH: supabase functions deploy paystack-webhook --no-verify-jwt
// Required because Paystack calls this directly from its servers — no Supabase JWT is ever
// present. Without this flag, Supabase's gateway rejects every call with a 401 before this
// function's own code ever runs — a failure that won't show up in these logs.
//
// Paystack Webhook Edge Function.
// Verifies the x-paystack-signature header (HMAC-SHA512 of the RAW request body, keyed with the
// Paystack secret key) before trusting anything in the payload — this is Paystack's own
// documented verification method, unlike PayUnit which has no signing mechanism. As additional
// defense-in-depth (matching the pattern used for Flutterwave/PayUnit in this codebase), we also
// re-verify via the Verify Transaction API using our own credentials before activating anything,
// rather than trusting the webhook payload's own status field alone.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

async function hmacSha512Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  try {
    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secretKey) return new Response(JSON.stringify({ error: "Paystack non configuré" }), { status: 503 });

    // MUST verify against the raw, unparsed body — re-serializing JSON can produce different
    // bytes (key order, spacing) and silently break signature verification even when the
    // content is logically identical.
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) return new Response(JSON.stringify({ error: "Signature manquante" }), { status: 401 });

    const expected = await hmacSha512Hex(secretKey, rawBody);
    if (expected !== signature) {
      return new Response(JSON.stringify({ error: "Signature invalide" }), { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const reference: string | undefined = payload?.data?.reference;
    if (!reference) return new Response(JSON.stringify({ received: true, ignored: true }), { headers: { "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: txRow } = await admin.from("paystack_transactions").select("*").eq("reference", reference).maybeSingle();
    if (!txRow) return new Response(JSON.stringify({ received: true, ignored: true }), { headers: { "Content-Type": "application/json" } });
    if (txRow.status === "confirmed") {
      return new Response(JSON.stringify({ received: true, alreadyProcessed: true }), { headers: { "Content-Type": "application/json" } });
    }

    // Defense-in-depth: re-verify directly with Paystack rather than trusting the webhook
    // event name/payload status alone.
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const verify = await verifyRes.json();
    const status = verify?.data?.status;

    if (status !== "success") {
      if (status === "failed" || status === "abandoned") {
        await admin.from("paystack_transactions").update({ status: "failed" }).eq("reference", reference);
      }
      return new Response(JSON.stringify({ received: true, status: status || "unknown" }), { headers: { "Content-Type": "application/json" } });
    }

    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from("subscriptions").update({
      plan_id: txRow.plan_id, status: "active", current_period_end: periodEnd,
    }).eq("tenant_id", txRow.tenant_id);
    await admin.from("tenants").update({ plan_id: txRow.plan_id, status: "active" }).eq("id", txRow.tenant_id);
    await admin.from("paystack_transactions").update({ status: "confirmed" }).eq("reference", reference);

    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500 });
  }
});
