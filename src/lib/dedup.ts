// Duplicate detection: groups records by normalized signals. Deliberately conservative
// (exact normalized match only, no fuzzy/typo matching) to avoid false-positive merges,
// which are far more damaging in a CRM than missing a near-duplicate.
import type { Contact, Company } from './types';

export interface DuplicateGroup<T> {
  key: string;
  reason: string;
  items: T[];
}

const normalize = (s: string | null | undefined) => (s || '').trim().toLowerCase();
const normalizeName = (s: string | null | undefined) => normalize(s).replace(/\s+/g, ' ');
const COMPANY_SUFFIXES = /\b(inc|ltd|llc|sarl|sas|sa|gmbh|co|corp|plc)\.?$/i;
const normalizeCompanyName = (s: string | null | undefined) =>
  normalizeName(s).replace(COMPANY_SUFFIXES, '').trim();

function domainOf(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith('http') ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export function findContactDuplicates(contacts: Contact[]): DuplicateGroup<Contact>[] {
  const groups: DuplicateGroup<Contact>[] = [];
  const byEmail = new Map<string, Contact[]>();
  const byName = new Map<string, Contact[]>();

  for (const c of contacts) {
    const email = normalize(c.email);
    if (email) {
      if (!byEmail.has(email)) byEmail.set(email, []);
      byEmail.get(email)!.push(c);
    }
    const name = normalizeName(`${c.first_name} ${c.last_name || ''}`);
    if (name.length > 2) {
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name)!.push(c);
    }
  }

  for (const [email, items] of byEmail) {
    if (items.length > 1) groups.push({ key: `email:${email}`, reason: `Même email (${email})`, items });
  }
  const emailedIds = new Set(groups.flatMap(g => g.items.map(i => i.id)));
  for (const [name, items] of byName) {
    if (items.length > 1 && !items.every(i => emailedIds.has(i.id))) {
      groups.push({ key: `name:${name}`, reason: `Même nom complet (${name})`, items });
    }
  }
  return groups;
}

export function findCompanyDuplicates(companies: Company[]): DuplicateGroup<Company>[] {
  const groups: DuplicateGroup<Company>[] = [];
  const byName = new Map<string, Company[]>();
  const byDomain = new Map<string, Company[]>();

  for (const c of companies) {
    const name = normalizeCompanyName(c.name);
    if (name.length > 1) {
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name)!.push(c);
    }
    const domain = domainOf(c.website);
    if (domain) {
      if (!byDomain.has(domain)) byDomain.set(domain, []);
      byDomain.get(domain)!.push(c);
    }
  }

  for (const [domain, items] of byDomain) {
    if (items.length > 1) groups.push({ key: `domain:${domain}`, reason: `Même site web (${domain})`, items });
  }
  const domainedIds = new Set(groups.flatMap(g => g.items.map(i => i.id)));
  for (const [name, items] of byName) {
    if (items.length > 1 && !items.every(i => domainedIds.has(i.id))) {
      groups.push({ key: `name:${name}`, reason: `Même nom d'entreprise (${name})`, items });
    }
  }
  return groups;
}
