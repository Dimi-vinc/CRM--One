// Approximate USD conversion rates, used ONLY for converting the platform's USD list prices into
// a tenant's chosen billing currency at checkout time. This intentionally mirrors the CURRENCIES
// array in src/lib/constants.ts (same codes, same decimals, same rateToUsd) — duplicated rather
// than imported because Supabase deploys each edge function independently and doesn't bundle
// files outside supabase/functions/, so a relative import into src/ would be fragile. If you add
// or change a currency in src/lib/constants.ts, mirror the change here too.
//
// These are fixed approximate rates, not a live FX feed (consistent with how the rest of the app
// already treats currency conversion — see convertToUsd in src/lib/utils.ts). For a payment
// amount, "approximately right" is not good enough forever: rates drift over time. Revisit
// periodically, or replace with a live FX API, before this matters for a large volume of
// non-USD/EUR charges.

export interface CurrencyRate { decimals: number; rateToUsd: number }

export const CURRENCY_RATES: Record<string, CurrencyRate> = {
  XOF: { decimals: 0, rateToUsd: 0.00165 },
  XAF: { decimals: 0, rateToUsd: 0.00165 },
  NGN: { decimals: 2, rateToUsd: 0.00065 },
  GHS: { decimals: 2, rateToUsd: 0.075 },
  KES: { decimals: 2, rateToUsd: 0.0072 },
  ZAR: { decimals: 2, rateToUsd: 0.053 },
  EGP: { decimals: 2, rateToUsd: 0.021 },
  MAD: { decimals: 2, rateToUsd: 0.10 },
  DZD: { decimals: 2, rateToUsd: 0.0073 },
  ETB: { decimals: 2, rateToUsd: 0.0094 },
  TZS: { decimals: 0, rateToUsd: 0.00039 },
  UGX: { decimals: 0, rateToUsd: 0.00026 },
  USD: { decimals: 2, rateToUsd: 1 },
  EUR: { decimals: 2, rateToUsd: 1.08 },
  GBP: { decimals: 2, rateToUsd: 1.27 },
  AED: { decimals: 2, rateToUsd: 0.27 },
  SAR: { decimals: 2, rateToUsd: 0.27 },
  CAD: { decimals: 2, rateToUsd: 0.72 },
  AUD: { decimals: 2, rateToUsd: 0.65 },
  CHF: { decimals: 2, rateToUsd: 1.12 },
  JPY: { decimals: 0, rateToUsd: 0.0067 },
  CNY: { decimals: 2, rateToUsd: 0.14 },
  INR: { decimals: 2, rateToUsd: 0.012 },
  BRL: { decimals: 2, rateToUsd: 0.18 },
};

/** Converts a USD amount into the given currency's smallest coherent unit, rounded sensibly. */
export function convertUsdTo(usdAmount: number, currencyCode: string): { amount: number; decimals: number } {
  const rate = CURRENCY_RATES[currencyCode.toUpperCase()] || CURRENCY_RATES.USD;
  const converted = usdAmount / rate.rateToUsd;
  const factor = 10 ** rate.decimals;
  return { amount: Math.round(converted * factor) / factor, decimals: rate.decimals };
}
