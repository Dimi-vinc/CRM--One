// Shared helper: returns a currently-valid access token for a user's connected email account,
// automatically refreshing it via the stored refresh_token if it has expired. Used by any
// function that needs to send email "as" a connected Gmail/Outlook account.

interface Connection {
  id: string; user_id: string; provider: "gmail" | "outlook";
  email_address: string; access_token: string; refresh_token: string; expires_at: string;
}

// deno-lint-ignore no-explicit-any
export async function getValidConnection(supabase: any, userId: string, provider: "gmail" | "outlook"): Promise<Connection | null> {
  const { data: conn } = await supabase.from("email_connections").select("*").eq("user_id", userId).eq("provider", provider).maybeSingle();
  if (!conn) return null;

  const expiresInMs = new Date(conn.expires_at).getTime() - Date.now();
  if (expiresInMs > 60_000) return conn as Connection; // still valid for at least another minute

  // Expired (or about to) — refresh it.
  const refreshed = provider === "gmail" ? await refreshGoogleToken(conn.refresh_token) : await refreshMicrosoftToken(conn.refresh_token);
  if (!refreshed) return null;

  await supabase.from("email_connections").update({
    access_token: refreshed.access_token,
    expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", conn.id);

  return { ...conn, access_token: refreshed.access_token } as Connection;
}

async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function refreshMicrosoftToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
  const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken,
      grant_type: "refresh_token", scope: "offline_access Mail.Send User.Read",
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

// Sends an email via the Gmail API using a raw base64url-encoded RFC 2822 message.
export async function sendViaGmail(accessToken: string, fromEmail: string, to: string, subject: string, bodyHtml: string): Promise<void> {
  const message = [
    `From: ${fromEmail}`, `To: ${to}`, `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0", "Content-Type: text/html; charset=UTF-8", "", bodyHtml,
  ].join("\r\n");
  const raw = btoa(unescape(encodeURIComponent(message))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`Gmail a refusé l'envoi (${res.status}): ${body}`); }
}

// Sends an email via Microsoft Graph's sendMail endpoint.
export async function sendViaOutlook(accessToken: string, to: string, subject: string, bodyHtml: string): Promise<void> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: { subject, body: { contentType: "HTML", content: bodyHtml }, toRecipients: [{ emailAddress: { address: to } }] },
    }),
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`Outlook a refusé l'envoi (${res.status}): ${body}`); }
}
