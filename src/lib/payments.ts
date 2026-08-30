// Payment abstraction layer.
// Today: Stripe. Tomorrow: Flutterwave can be added as a second provider without touching callers.
//
// The interface is intentionally generic: callers ask to create a checkout session
// for a plan+currency and get back a URL to redirect to. They never import Stripe directly.

import { supabase } from './supabase';
import { PLAN_BY_ID, CURRENCY_BY_CODE, COUNTRY_BY_CODE } from './constants';

/**
 * `fetch()` throws a bare `TypeError: Failed to fetch` for any network-level failure — the
 * function isn't deployed, the URL is wrong, CORS rejected the request, DNS failed, etc. Showing
 * that raw string to a person configuring payments for the first time is actively unhelpful (it
 * gives zero indication of what to actually check). Translate it into something actionable.
 */
function describeNetworkError(error: unknown, providerLabel: string): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('networkerror')) {
    return `Impossible de joindre le serveur de paiement ${providerLabel}. Vérifiez que la fonction correspondante a bien été déployée côté Supabase, et que l'URL/clé Supabase configurées sur ce site sont correctes.`;
  }
  return message || 'Échec réseau';
}

export type ProviderCode = 'stripe' | 'flutterwave' | 'payunit' | 'paystack';

/**
 * Picks a sensible default payment provider for a tenant based on their country, WITHOUT
 * overriding an explicit manual choice the person already made — see getPreferredProvider(),
 * which is what callers should actually use.
 *
 * Rule: Paystack is strongest in Nigeria, Ghana, South Africa and Kenya (its officially
 * supported currencies) — default to it there. Elsewhere, countries where mobile money is a
 * real local payment method (driven by the existing COUNTRY_BY_CODE data) default to PayUnit —
 * the first PSP validated for launch on this platform. Everywhere else defaults to Stripe.
 * Flutterwave stays manually selectable but is never auto-picked, to keep the automatic choice
 * limited to the providers actively confirmed live.
 */
export function defaultProviderForCountry(countryCode?: string | null): ProviderCode {
  if (!countryCode) return 'stripe';
  const PAYSTACK_COUNTRIES = new Set(['NG', 'GH', 'ZA', 'KE']);
  if (PAYSTACK_COUNTRIES.has(countryCode)) return 'paystack';
  const country = COUNTRY_BY_CODE[countryCode];
  if (country && country.mobileMoney.length > 0) return 'payunit';
  return 'stripe';
}

const MANUAL_PROVIDER_KEY = 'crm_payment_provider_manual';

/** True once the person has ever explicitly picked a provider themselves (as opposed to just
 *  inheriting whatever the location-based default was). */
export function hasManualProviderChoice(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem(MANUAL_PROVIDER_KEY) === 'true';
}

/** Call this when the person explicitly clicks a provider option, so their choice persists and
 *  is never silently overridden by the location-based default again. */
export function setManualProviderChoice(provider: ProviderCode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('crm_payment_provider', provider);
  localStorage.setItem(MANUAL_PROVIDER_KEY, 'true');
}

/** The provider to preselect on load: the person's own manual choice if they ever made one,
 *  otherwise a location-based default from their tenant's country. */
export function getPreferredProvider(countryCode?: string | null): ProviderCode {
  if (typeof window !== 'undefined' && hasManualProviderChoice()) {
    const stored = localStorage.getItem('crm_payment_provider');
    if (stored === 'stripe' || stored === 'flutterwave' || stored === 'payunit' || stored === 'paystack') return stored;
  }
  return defaultProviderForCountry(countryCode);
}

export interface CheckoutRequest {
  planId: 'starter' | 'pro' | 'premium' | 'entreprise';
  currency: string;
  tenantId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
  provider?: ProviderCode;
}

export interface CheckoutResult {
  ok: boolean;
  url?: string;
  provider: ProviderCode;
  error?: string;
}

export interface PaymentProvider {
  code: ProviderCode;
  label: string;
  createCheckoutSession(req: CheckoutRequest): Promise<CheckoutResult>;
  // Open a billing portal to manage cards / cancel
  createPortalSession(tenantId: string, returnUrl: string): Promise<CheckoutResult>;
}

// ---- Stripe provider (via Supabase edge function) ----
const stripeProvider: PaymentProvider = {
  code: 'stripe',
  label: 'Stripe',
  async createCheckoutSession(req: CheckoutRequest): Promise<CheckoutResult> {
    const plan = PLAN_BY_ID[req.planId];
    if (!plan) return { ok: false, provider: 'stripe', error: 'Plan inconnu' };
    const cur = CURRENCY_BY_CODE[req.currency];
    if (!cur) return { ok: false, provider: 'stripe', error: 'Devise non supportée' };

    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`;
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          planId: req.planId,
          currency: req.currency,
          tenantId: req.tenantId,
          email: req.email,
          successUrl: req.successUrl,
          cancelUrl: req.cancelUrl,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        return { ok: false, provider: 'stripe', error: errBody.error || `Erreur ${res.status}` };
      }
      const data = await res.json();
      if (!data || !data.url) return { ok: false, provider: 'stripe', error: 'Réponse invalide' };
      return { ok: true, provider: 'stripe', url: data.url };
    } catch (error) {
      return { ok: false, provider: 'stripe', error: describeNetworkError(error, 'Stripe') };
    }
  },
  async createPortalSession(tenantId: string, returnUrl: string): Promise<CheckoutResult> {
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`;
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ tenantId, returnUrl }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        return { ok: false, provider: 'stripe', error: errBody.error || `Erreur ${res.status}` };
      }
      const data = await res.json();
      if (!data?.url) return { ok: false, provider: 'stripe', error: 'Réponse invalide' };
      return { ok: true, provider: 'stripe', url: data.url };
    } catch (error) {
      return { ok: false, provider: 'stripe', error: describeNetworkError(error, 'Stripe') };
    }
  },
};

// ---- Flutterwave provider (via Supabase edge function) ----
const flutterwaveProvider: PaymentProvider = {
  code: 'flutterwave',
  label: 'Flutterwave',
  async createCheckoutSession(req: CheckoutRequest): Promise<CheckoutResult> {
    const plan = PLAN_BY_ID[req.planId];
    if (!plan) return { ok: false, provider: 'flutterwave', error: 'Plan inconnu' };
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/flutterwave-checkout`;
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          planId: req.planId,
          currency: req.currency,
          tenantId: req.tenantId,
          email: req.email,
          successUrl: req.successUrl,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        return { ok: false, provider: 'flutterwave', error: errBody.error || `Erreur ${res.status}` };
      }
      const data = await res.json();
      if (!data?.url) return { ok: false, provider: 'flutterwave', error: 'Réponse invalide' };
      return { ok: true, provider: 'flutterwave', url: data.url };
    } catch (error) {
      return { ok: false, provider: 'flutterwave', error: describeNetworkError(error, 'Flutterwave') };
    }
  },
  async createPortalSession(): Promise<CheckoutResult> {
    // Flutterwave has no self-service billing portal equivalent to Stripe's — subscription
    // management (cancel/upgrade) currently has to be handled by contacting support, or the
    // tenant simply lets the period lapse (no auto-recycling charge is made without a follow-up
    // Payment Plans integration).
    return { ok: false, provider: 'flutterwave', error: "Flutterwave ne propose pas de portail self-service. Contactez le support pour gérer votre abonnement." };
  },
};

// ---- PayUnit provider (via Supabase edge function) ----
// Payment aggregator giving access to cards, Mobile Money, and other international payment
// methods — the first PSP being validated for go-live on this platform.
const payunitProvider: PaymentProvider = {
  code: 'payunit',
  label: 'PayUnit',
  async createCheckoutSession(req: CheckoutRequest): Promise<CheckoutResult> {
    const plan = PLAN_BY_ID[req.planId];
    if (!plan) return { ok: false, provider: 'payunit', error: 'Plan inconnu' };
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payunit-checkout`;
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          planId: req.planId,
          currency: req.currency,
          tenantId: req.tenantId,
          email: req.email,
          successUrl: req.successUrl,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        return { ok: false, provider: 'payunit', error: errBody.error || `Erreur ${res.status}` };
      }
      const data = await res.json();
      if (!data?.url) return { ok: false, provider: 'payunit', error: 'Réponse invalide' };
      return { ok: true, provider: 'payunit', url: data.url };
    } catch (error) {
      return { ok: false, provider: 'payunit', error: describeNetworkError(error, 'PayUnit') };
    }
  },
  async createPortalSession(): Promise<CheckoutResult> {
    // Same situation as Flutterwave: no self-service billing portal API — subscription changes
    // go through re-checkout or support.
    return { ok: false, provider: 'payunit', error: "PayUnit ne propose pas de portail self-service. Contactez le support pour gérer votre abonnement." };
  },
};

// ---- Paystack provider (via Supabase edge function) ----
// Strongest coverage in Nigeria, Ghana, South Africa, Kenya — cards, bank transfer, mobile
// money, USSD depending on channels enabled on the merchant account.
const paystackProvider: PaymentProvider = {
  code: 'paystack',
  label: 'Paystack',
  async createCheckoutSession(req: CheckoutRequest): Promise<CheckoutResult> {
    const plan = PLAN_BY_ID[req.planId];
    if (!plan) return { ok: false, provider: 'paystack', error: 'Plan inconnu' };
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paystack-checkout`;
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          planId: req.planId,
          currency: req.currency,
          tenantId: req.tenantId,
          email: req.email,
          successUrl: req.successUrl,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        return { ok: false, provider: 'paystack', error: errBody.error || `Erreur ${res.status}` };
      }
      const data = await res.json();
      if (!data?.url) return { ok: false, provider: 'paystack', error: 'Réponse invalide' };
      return { ok: true, provider: 'paystack', url: data.url };
    } catch (error) {
      return { ok: false, provider: 'paystack', error: describeNetworkError(error, 'Paystack') };
    }
  },
  async createPortalSession(): Promise<CheckoutResult> {
    return { ok: false, provider: 'paystack', error: "Paystack ne propose pas de portail self-service. Contactez le support pour gérer votre abonnement." };
  },
};

const PROVIDERS: Record<ProviderCode, PaymentProvider> = {
  stripe: stripeProvider,
  flutterwave: flutterwaveProvider,
  payunit: payunitProvider,
  paystack: paystackProvider,
};

// Default provider is Stripe. Callers may request flutterwave when ready.
export function getPaymentProvider(code: ProviderCode = 'stripe'): PaymentProvider {
  return PROVIDERS[code];
}

export async function startCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
  const provider = getPaymentProvider(req.provider || 'stripe');
  return provider.createCheckoutSession(req);
}
