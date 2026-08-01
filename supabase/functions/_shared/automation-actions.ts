// Shared action-execution logic used by both automations-dispatch (immediate first step) and
// automations-cron (processing delayed steps from automation_run_queue). Keeping this in one
// place means every action behaves identically regardless of which function ran it.

export const PLATFORM_NAME = Deno.env.get("PLATFORM_NAME") || "CRM-One";

// Implemented actions only. Anything else is logged as skipped rather than silently doing
// nothing, so the execution log stays honest.
export const IMPLEMENTED_ACTIONS = new Set([
  "send_email", "create_task", "notify_team", "create_activity", "send_whatsapp", "email_contact",
]);

export interface ActionOutcome { status: "success" | "error" | "skipped"; detail: string }

// deno-lint-ignore no-explicit-any
export async function logRun(supabase: any, tenantId: string, automationId: string, trigger: string, action: string, outcome: ActionOutcome) {
  await supabase.from("automation_runs").insert({
    tenant_id: tenantId, automation_id: automationId, trigger, action,
    status: outcome.status, detail: outcome.detail,
  });
}

export async function runAction(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  tenantId: string,
  automationName: string,
  action: string,
  description: string | null,
  trigger: string,
  payload: Record<string, unknown>,
): Promise<ActionOutcome> {
  if (!IMPLEMENTED_ACTIONS.has(action)) {
    return { status: "skipped", detail: `Action "${action}" pas encore disponible.` };
  }

  try {
    switch (action) {
      case "send_email": {
        const to = await resolveTenantAdminEmails(supabase, tenantId);
        if (to.length === 0) return { status: "error", detail: "Aucun administrateur avec email à notifier." };
        await sendEmail(to, `[${PLATFORM_NAME}] ${automationName}`, description || describeEvent(trigger, payload));
        return { status: "success", detail: `Email interne envoyé à ${to.join(", ")}.` };
      }
      case "email_contact": {
        const contact = await resolveContact(supabase, tenantId, trigger, payload);
        if (!contact) return { status: "error", detail: "Aucun contact identifié pour cet événement." };
        if (!contact.email) return { status: "error", detail: `Le contact ${contact.first_name || ""} n'a pas d'email renseigné.` };
        if (!contact.marketing_consent) return { status: "skipped", detail: `Consentement marketing non donné par ${contact.email} — email non envoyé (RGPD).` };
        await sendEmail([contact.email], automationName, description || describeEvent(trigger, payload));
        return { status: "success", detail: `Email envoyé au contact ${contact.email}.` };
      }
      case "create_task": {
        const { error } = await supabase.from("tasks").insert({
          tenant_id: tenantId, title: automationName,
          description: description || describeEvent(trigger, payload), priority: "medium", status: "todo",
        });
        if (error) return { status: "error", detail: error.message };
        return { status: "success", detail: "Tâche créée." };
      }
      case "notify_team": {
        const { data: members } = await supabase.from("profiles").select("id").eq("tenant_id", tenantId);
        const rows = (members || []).map((m: { id: string }) => ({
          tenant_id: tenantId, user_id: m.id, title: automationName, body: description || describeEvent(trigger, payload),
        }));
        if (rows.length === 0) return { status: "error", detail: "Aucun membre à notifier." };
        const { error } = await supabase.from("notifications").insert(rows);
        if (error) return { status: "error", detail: error.message };
        return { status: "success", detail: `${rows.length} notification(s) créée(s).` };
      }
      case "create_activity": {
        const { error } = await supabase.from("activities").insert({
          tenant_id: tenantId, type: "task", title: automationName,
          description: description || describeEvent(trigger, payload),
          contact_id: (payload as { id?: string; contact_id?: string })?.contact_id
            || (trigger === "contact_added" ? (payload as { id?: string })?.id : null),
        });
        if (error) return { status: "error", detail: error.message };
        return { status: "success", detail: "Activité créée." };
      }
      case "send_whatsapp": {
        const numbers = await resolveTenantAdminPhones(supabase, tenantId);
        if (numbers.length === 0) return { status: "error", detail: "Aucun administrateur avec un numéro WhatsApp renseigné (Paramètres)." };
        const text = `[${PLATFORM_NAME}] ${automationName}\n${description || describeEvent(trigger, payload)}`;
        const results = await Promise.allSettled(numbers.map((n: string) => sendWhatsApp(n, text)));
        const failed = results.filter(r => r.status === "rejected");
        if (failed.length === results.length) {
          return { status: "error", detail: (failed[0] as PromiseRejectedResult).reason?.message || "Échec de l'envoi WhatsApp." };
        }
        return { status: "success", detail: `WhatsApp envoyé à ${results.length - failed.length}/${results.length} administrateur(s).` };
      }
      default:
        return { status: "skipped", detail: "Action inconnue." };
    }
  } catch (err) {
    return { status: "error", detail: err?.message || "Erreur inconnue" };
  }
}

// deno-lint-ignore no-explicit-any
async function resolveContact(supabase: any, tenantId: string, trigger: string, payload: Record<string, unknown>) {
  const contactId = trigger === "contact_added" ? (payload?.id as string) || null : (payload?.contact_id as string) || null;
  if (!contactId) return null;
  const { data } = await supabase.from("contacts").select("id, first_name, email, marketing_consent").eq("id", contactId).eq("tenant_id", tenantId).maybeSingle();
  return data;
}

// deno-lint-ignore no-explicit-any
async function resolveTenantAdminPhones(supabase: any, tenantId: string): Promise<string[]> {
  const { data } = await supabase.from("profiles").select("phone, role").eq("tenant_id", tenantId).in("role", ["admin", "super_admin"]);
  return (data || []).map((p: { phone?: string }) => p.phone).filter(Boolean) as string[];
}

async function sendWhatsApp(to: string, body: string): Promise<void> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM");
  if (!sid || !token || !from) throw new Error("Twilio non configuré (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM manquants).");
  const toFormatted = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: from, To: toFormatted, Body: body }),
  });
  if (!res.ok) { const errBody = await res.text(); throw new Error(`Twilio a refusé l'envoi (${res.status}): ${errBody}`); }
}

// deno-lint-ignore no-explicit-any
async function resolveTenantAdminEmails(supabase: any, tenantId: string): Promise<string[]> {
  const { data } = await supabase.from("profiles").select("email, role").eq("tenant_id", tenantId).in("role", ["admin", "super_admin"]);
  return (data || []).map((p: { email: string }) => p.email).filter(Boolean);
}

function describeEvent(trigger: string, payload: Record<string, unknown>): string {
  const labels: Record<string, string> = {
    deal_created: "Un nouveau deal a été créé", deal_won: "Un deal a été gagné",
    contact_added: "Un nouveau contact a été ajouté", activity_done: "Une activité a été marquée comme terminée",
    task_overdue: "Une tâche est en retard",
  };
  const name = (payload?.title as string) || (payload?.first_name as string) || (payload?.name as string) || "";
  return `${labels[trigger] || trigger}${name ? ` : ${name}` : ""}.`;
}

export async function sendEmail(to: string[], subject: string, text: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY non configurée.");
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${PLATFORM_NAME} <${from}>`, to, subject, text }),
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`Resend a refusé l'envoi (${res.status}): ${body}`); }
}
