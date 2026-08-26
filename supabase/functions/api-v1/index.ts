// DEPLOY WITH: supabase functions deploy api-v1 --no-verify-jwt
// Required because external developers authenticate with a custom API key, not a Supabase JWT. Without this flag, Supabase's gateway rejects every call with a
// 401 before this function's own code ever runs — a failure that won't show up in these logs.
// Public API Gateway (v1)
// Authenticated via `Authorization: Bearer <api_key>` (generated in Paramètres → API & Webhooks),
// NOT a Supabase session — this is what lets external tools (Zapier "Webhooks/API Request"
// actions, custom scripts, integrations) read/write CRM data on the tenant's behalf.
//
// Routes (relative to /functions/v1/api-v1):
//   GET    /contacts            ?limit=50&offset=0
//   GET    /contacts/:id
//   POST   /contacts
//   PATCH  /contacts/:id
//   DELETE /contacts/:id
//   (same shape for /companies, /deals, /tasks)
//
// Rate limit: 100 requests/minute per API key (returns 429 past that, with Retry-After).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const RESOURCES: Record<string, { table: string; allowedFields: string[] }> = {
  contacts: { table: "contacts", allowedFields: ["first_name", "last_name", "email", "phone", "company_id", "country_code", "city", "marketing_consent"] },
  companies: { table: "companies", allowedFields: ["name", "industry", "email", "phone", "website", "country_code", "city"] },
  deals: { table: "deals", allowedFields: ["title", "amount", "currency_code", "stage", "contact_id", "company_id", "expected_close_date"] },
  tasks: { table: "tasks", allowedFields: ["title", "description", "due_date", "priority", "status"] },
};

const RATE_LIMIT_PER_MINUTE = 100;

async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  const authHeader = req.headers.get("Authorization") || "";
  const apiKey = authHeader.replace("Bearer ", "").trim();
  if (!apiKey) return new Response(JSON.stringify({ error: "Clé API manquante (Authorization: Bearer <clé>)" }), { status: 401, headers: jsonHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const keyHash = await sha256Hex(apiKey);
  const { data: keyRow } = await admin.from("api_keys").select("*").eq("key_hash", keyHash).is("revoked_at", null).maybeSingle();
  if (!keyRow) return new Response(JSON.stringify({ error: "Clé API invalide ou révoquée" }), { status: 401, headers: jsonHeaders });

  const now = new Date();

  // ---- Rate limiting: fixed 60s window per key, enforced atomically in a single DB call so
  // concurrent requests can't all read the same pre-increment count and all slip through.
  const { data: rlResult, error: rlErr } = await admin.rpc("check_and_increment_api_rate_limit", {
    p_api_key_id: keyRow.id,
    p_limit: RATE_LIMIT_PER_MINUTE,
    p_window_seconds: 60,
  }).single();
  if (rlErr) return new Response(JSON.stringify({ error: "Erreur de limitation de débit." }), { status: 500, headers: jsonHeaders });
  if (!rlResult.allowed) {
    const retryAfter = Math.max(1, Math.ceil(60 - (Date.now() - new Date(rlResult.window_start).getTime()) / 1000));
    return new Response(JSON.stringify({ error: "Limite de débit atteinte (100 requêtes/minute)." }), {
      status: 429, headers: { ...jsonHeaders, "Retry-After": String(retryAfter) },
    });
  }
  admin.from("api_keys").update({ last_used_at: now.toISOString() }).eq("id", keyRow.id).then(() => {});

  // ---- Route parsing: /functions/v1/api-v1/{resource}/{id?} ----
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/functions\/v1\/api-v1\/?/, "").split("/").filter(Boolean);
  const [resourceName, resourceId] = parts;
  const resource = RESOURCES[resourceName];
  if (!resource) {
    return new Response(JSON.stringify({ error: `Ressource inconnue. Disponibles : ${Object.keys(RESOURCES).join(", ")}` }), { status: 404, headers: jsonHeaders });
  }

  const tenantId = keyRow.tenant_id;

  try {
    if (req.method === "GET" && !resourceId) {
      const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
      const offset = Number(url.searchParams.get("offset")) || 0;
      const { data, count, error } = await admin.from(resource.table).select("*", { count: "exact" })
        .eq("tenant_id", tenantId).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: jsonHeaders });
      return new Response(JSON.stringify({ data, total: count, limit, offset }), { headers: jsonHeaders });
    }

    if (req.method === "GET" && resourceId) {
      const { data, error } = await admin.from(resource.table).select("*").eq("tenant_id", tenantId).eq("id", resourceId).maybeSingle();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: jsonHeaders });
      if (!data) return new Response(JSON.stringify({ error: "Introuvable" }), { status: 404, headers: jsonHeaders });
      return new Response(JSON.stringify({ data }), { headers: jsonHeaders });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const clean = pickAllowed(body, resource.allowedFields);
      const { data, error } = await admin.from(resource.table).insert({ ...clean, tenant_id: tenantId }).select().single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: jsonHeaders });
      return new Response(JSON.stringify({ data }), { status: 201, headers: jsonHeaders });
    }

    if (req.method === "PATCH" && resourceId) {
      const body = await req.json();
      const clean = pickAllowed(body, resource.allowedFields);
      const { data, error } = await admin.from(resource.table).update(clean).eq("tenant_id", tenantId).eq("id", resourceId).select().maybeSingle();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: jsonHeaders });
      if (!data) return new Response(JSON.stringify({ error: "Introuvable" }), { status: 404, headers: jsonHeaders });
      return new Response(JSON.stringify({ data }), { headers: jsonHeaders });
    }

    if (req.method === "DELETE" && resourceId) {
      const { error, count } = await admin.from(resource.table).delete({ count: "exact" }).eq("tenant_id", tenantId).eq("id", resourceId);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: jsonHeaders });
      if (!count) return new Response(JSON.stringify({ error: "Introuvable" }), { status: 404, headers: jsonHeaders });
      return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ error: "Méthode ou route non supportée" }), { status: 405, headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), { status: 500, headers: jsonHeaders });
  }
});

function pickAllowed(body: Record<string, unknown>, allowed: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) out[k] = body[k];
  return out;
}
