// Small UI/utility helpers shared across the app.
import { CURRENCY_BY_CODE } from './constants';

// Mirrors the key LanguageContext persists to (kept in sync manually since this is a plain
// module, not a React hook — see src/context/LanguageContext.tsx). Reading it here means every
// date/time/number in the app follows the user's chosen language, not a hardcoded locale —
// important for a SaaS with an international audience.
function getLocale(): 'fr-FR' | 'en-US' {
  if (typeof window === 'undefined') return 'fr-FR';
  return localStorage.getItem('liafrik-lang') === 'en' ? 'en-US' : 'fr-FR';
}

export function classNames(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Escapes HTML special characters. Required before interpolating any user-typed text into an
 * HTML string that will actually be rendered/sent as HTML (e.g. an outgoing email body) — plain
 * template-literal interpolation does NOT do this, and leaves the door open to broken rendering
 * or injected markup (e.g. a fake link disguised as plain text) if the text contains `<`, `>`,
 * `&`, or quote characters.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatMoney(amount: number, currencyCode: string): string {
  const cur = CURRENCY_BY_CODE[currencyCode] || CURRENCY_BY_CODE.USD;
  const value = Number(amount || 0);
  const formatted = value.toLocaleString(getLocale(), {
    minimumFractionDigits: cur.decimals,
    maximumFractionDigits: cur.decimals,
  });
  return `${cur.decimals === 2 ? formatted.replace(/,00$/, '') : formatted} ${cur.symbol}`;
}

export function convertToUsd(amount: number, fromCurrency: string): number {
  const cur = CURRENCY_BY_CODE[fromCurrency];
  if (!cur) return amount;
  return amount * cur.rateToUsd;
}

export function convertFromUsd(usdAmount: number, toCurrency: string): number {
  const cur = CURRENCY_BY_CODE[toCurrency];
  if (!cur || !cur.rateToUsd) return usdAmount;
  return usdAmount / cur.rateToUsd;
}

/**
 * Sums deal amounts into a single target currency, correctly converting each deal from its OWN
 * currency first. Tenants can price individual deals in different currencies (the multi_currency
 * plan feature) — naively summing `.amount` directly across deals silently produces a meaningless
 * number the moment more than one currency is actually in play (e.g. adding 100 USD + 50 000 XOF
 * as if they were the same unit). Always use this for any pipeline/revenue rollup across deals.
 * An optional `weight` (0..1) supports probability-weighted forecasts.
 */
export function sumDealAmounts<T extends { amount: number; currency_code?: string | null }>(
  deals: T[],
  targetCurrency: string,
  weight?: (d: T) => number,
): number {
  const usdTotal = deals.reduce((sum, d) => {
    const w = weight ? weight(d) : 1;
    return sum + convertToUsd(Number(d.amount || 0), d.currency_code || targetCurrency) * w;
  }, 0);
  return convertFromUsd(usdTotal, targetCurrency);
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('');
}

const TIME_AGO_STRINGS = {
  'fr-FR': { now: "à l'instant", min: (n: number) => `il y a ${n} min`, hour: (n: number) => `il y a ${n} h`, day: (n: number) => `il y a ${n} j` },
  'en-US': { now: 'just now', min: (n: number) => `${n}m ago`, hour: (n: number) => `${n}h ago`, day: (n: number) => `${n}d ago` },
} as const;

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const locale = getLocale();
  const strings = TIME_AGO_STRINGS[locale];
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return strings.now;
  const m = Math.floor(s / 60);
  if (m < 60) return strings.min(m);
  const h = Math.floor(m / 60);
  if (h < 24) return strings.hour(h);
  const days = Math.floor(h / 24);
  if (days < 30) return strings.day(days);
  return d.toLocaleDateString(locale);
}

export function formatDate(iso?: string | null, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(getLocale(), { day: '2-digit', month: 'short', year: 'numeric', ...opts });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(getLocale(), {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = rows.map(r => r.map(escape).join(',')).join('\n');
  // Prepend UTF-8 BOM so Excel correctly detects encoding and displays accented characters
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Stable color ramp for stat cards / avatars
export const COLOR_RAMPS = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-400', dot: 'bg-blue-500' },
  teal: { bg: 'bg-tealx-50', text: 'text-tealx-700', border: 'border-tealx-500', dot: 'bg-tealx-500' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-500', dot: 'bg-emerald-500' },
  violet: { bg: 'bg-violetx-50', text: 'text-violetx-700', border: 'border-violetx-500', dot: 'bg-violetx-500' },
  orange: { bg: 'bg-coral-50', text: 'text-coral-700', border: 'border-coral-500', dot: 'bg-coral-500' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-500', dot: 'bg-red-500' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', dot: 'bg-gray-400' },
} as const;

export type ColorKey = keyof typeof COLOR_RAMPS;
