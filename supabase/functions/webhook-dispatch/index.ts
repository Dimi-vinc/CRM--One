// DEPLOY WITH: supabase functions deploy webhook-dispatch --no-verify-jwt
// Required because called via pg_net with a raw shared secret (dispatch_secret), not a Supabase JWT. Without this flag, Supabase's gateway rejects every call with a
// 401 before this function's own code ever runs — a failure that won't show up in these logs.
// Webhook Dispatch Edge Function
// Called (async, fire-and-forget) by DB triggers via pg_net whenever a CRM event happens.
// Delivers the event to every active webhook the tenant configured for it — this is what makes
// "Webhooks by Zapier" (or Make.com "Catch Hook", or n8n, or any custom endpoint) actually work:
// the tenant pastes their catcher URL into Webhooks settings, and real HTTP POSTs land there.
//
// Each payload is HMAC-SHA256 signed (X-CRM-Signature header) using the webhook's own secret,
// so the receiving end can verify authenticity if it wants to.
//
// Required secret: AUTOMATION_DISPATCH_SECRET (same one used by automations-dispatch).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
// SSRF guard, inlined (not imported from a shared folder) because Supabase's function bundler
// has a known, currently-active issue resolving relative imports into `_shared/` folders in some
// deployment paths, producing a "Module not found ... _shared/..." error at deploy time even
// when the file is present. See git history for the full design rationale (DNS resolution +
// private-range checks, documented DNS-rebinding residual risk).
function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}
function isPrivateOrReservedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80")) return true;
  if (lower.startsWith("::ffff:")) return isPrivateOrReservedIPv4(lower.slice(7));
  return false;
}
async function assertWebhookUrlIsSafe(rawUrl: string): Promise<{ safe: boolean; reason?: string }> {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return { safe: false, reason: "URL invalide" }; }
  if (parsed.protocol !== "https:") return { safe: false, reason: "Seules les URLs https:// sont autorisées" };
  const hostname = parsed.hostname;
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    return { safe: false, reason: "Adresse locale non autorisée" };
  }
  if (isPrivateOrReservedIPv4(hostname) || isPrivateOrReservedIPv6(hostname.replace(/^\[|\]$/g, ""))) {
    return { safe: false, reason: "Adresse IP privée/interne non autorisée" };
  }
  try {
    const records = await Deno.resolveDns(hostname, "A").catch(() => []);
    const recordsV6 = await Deno.resolveDns(hostname, "AAAA").catch(() => []);
    for (const ip of [...records, ...recordsV6]) {
      if (isPrivateOrReservedIPv4(ip) || isPrivateOrReservedIPv6(ip)) {
        return { safe: false, reason: "Ce nom de domaine pointe vers une adresse interne" };
      }
    }
  } catch {
    return { safe: false, reason: "Impossible de vérifier la destination de cette URL" };
  }
  return { safe: true };
}

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  const expectedSecret = Deno.env.get("AUTOMATION_DISPATCH_SECRET");
  const authHeader = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!expectedSecret || authHeader !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: jsonHeaders });
  }

  try {
    const { tenant_id, event, payload } = await req.json();
    if (!tenant_id || !event) return new Response(JSON.stringify({ error: "tenant_id et event requis" }), { status: 400, headers: jsonHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: webhooks } = await supabase
      .from("webhooks").select("*").eq("tenant_id", tenant_id).eq("is_active", true).contains("events", [event]);

    let delivered = 0;
    for (const wh of webhooks || []) {
      const safety = await assertWebhookUrlIsSafe(wh.url);
      if (!safety.safe) {
        await supabase.from("webhook_deliveries").insert({ tenant_id, webhook_id: wh.id, event, status_code: null, success: false, response_body: `Livraison bloquée : ${safety.reason}` });
        continue;
      }
      const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
      const signature = await hmacSha256Hex(wh.secret, body);
      let statusCode: number | null = null;
      let responseBody = "";
      let success = false;
      try {
        const res = await fetch(wh.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CRM-Signature": signature, "X-CRM-Event": event },
          body,
        });
        statusCode = res.status;
        responseBody = (await res.text()).slice(0, 500);
        success = res.ok;
      } catch (err) {
        responseBody = err?.message || "network error";
      }
      await supabase.from("webhook_deliveries").insert({ tenant_id, webhook_id: wh.id, event, status_code: statusCode, success, response_body: responseBody });
      if (success) delivered++;
    }

    return new Response(JSON.stringify({ ok: true, matched: (webhooks || []).length, delivered }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});
