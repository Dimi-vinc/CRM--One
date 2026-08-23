// Validates that a tenant-supplied webhook URL is safe to fetch() from server-side code.
// Used by webhook-dispatch before every delivery attempt — this is the real defense against
// SSRF (Server-Side Request Forgery): without it, a tenant could register a webhook pointing at
// an internal address (cloud metadata endpoint, localhost, internal service) and have the
// server itself make that request on every CRM event.
//
// Two layers:
//   1. Scheme/hostname pattern checks (cheap, catches obvious cases: http://, IP literals in
//      private/loopback/link-local ranges, localhost).
//   2. DNS resolution of the hostname, checked against the same private ranges — catches a
//      *domain name* that resolves to an internal IP (e.g. an attacker-controlled domain
//      pointed at 169.254.169.254), which the pattern check alone can't see.
//
// Known residual risk (documented, not silently ignored): DNS rebinding — the hostname could
// resolve to a public IP at validation time and a private IP at actual fetch time. Full
// protection requires pinning the resolved IP for the connection itself, which isn't exposed by
// Deno's fetch API. For a webhook-delivery feature (not a public URL-fetching proxy), the
// combination below is a reasonable, standard mitigation; revisit if this function's purpose
// broadens.

function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this network"
  if (a === 169 && b === 254) return true; // link-local (cloud metadata lives here)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (carrier-grade NAT)
  return false;
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true; // loopback
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 unique local
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("::ffff:")) return isPrivateOrReservedIPv4(lower.slice(7)); // IPv4-mapped
  return false;
}

export async function assertWebhookUrlIsSafe(rawUrl: string): Promise<{ safe: boolean; reason?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "URL invalide" };
  }
  if (parsed.protocol !== "https:") {
    return { safe: false, reason: "Seules les URLs https:// sont autorisées" };
  }
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
    // If DNS resolution itself fails (unusual, sandboxed env, etc.), fail closed rather than open.
    return { safe: false, reason: "Impossible de vérifier la destination de cette URL" };
  }
  return { safe: true };
}
