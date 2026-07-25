// Small UI/utility helpers shared across the app.
import { CURRENCY_BY_CODE } from './constants';

export function classNames(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function formatMoney(amount: number, currencyCode: string): string {
  const cur = CURRENCY_BY_CODE[currencyCode] || CURRENCY_BY_CODE.USD;
  const value = Number(amount || 0);
  // For 0-decimal currencies (XOF, XAF, TZS, UGX), no decimals at all.
  // For 2-decimal currencies, strip trailing .00 for clean display.
  const formatted = value.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${formatted} ${cur.symbol}`;
}

export function convertToUsd(amount: number, fromCurrency: string): number {
  const cur = CURRENCY_BY_CODE[fromCurrency];
  if (!cur) return amount;
  return amount * cur.rateToUsd;
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('');
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'à l\'instant';
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR');
}

export function formatDate(iso?: string | null, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', ...opts });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', {
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
