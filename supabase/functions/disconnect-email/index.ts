// Disconnects a user's Gmail/Outlook connection: revokes the token with the provider (best
// effort) and deletes the stored row.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: jsonHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: jsonHeaders });

  const { provider } = await req.json();
  if (!["gmail", "outlook"].includes(provider)) {
    return new Response(JSON.stringify({ error: "provider invalide" }), { status: 400, headers: jsonHeaders });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: conn } = await admin.from("email_connections").select("access_token").eq("user_id", user.id).eq("provider", provider).maybeSingle();

  if (conn) {
    try {
      if (provider === "gmail") {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${conn.access_token}`, { method: "POST" });
      }
      // Microsoft Graph has no simple universal token-revoke endpoint for this flow; deleting
      // the stored token below is what actually matters for our app's access.
    } catch { /* best-effort revoke; deletion below is what matters */ }
  }

  await admin.from("email_connections").delete().eq("user_id", user.id).eq("provider", provider);
  return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
});
