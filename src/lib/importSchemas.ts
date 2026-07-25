// Field schemas used to drive the CSV import mapping/validation UI for each entity.
import { DEAL_STAGES } from './constants';

export type FieldType = 'text' | 'email' | 'phone' | 'number' | 'date' | 'currency' | 'stage';

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  type?: FieldType;
  // Header names (lowercased) that auto-match this field when guessing the mapping
  aliases: string[];
}

export const CONTACT_FIELDS: ImportField[] = [
  { key: 'first_name', label: 'Prénom', required: true, aliases: ['prénom', 'prenom', 'first_name', 'firstname', 'first name'] },
  { key: 'last_name', label: 'Nom', aliases: ['nom', 'last_name', 'lastname', 'last name'] },
  { key: 'email', label: 'Email', type: 'email', aliases: ['email', 'e-mail', 'mail'] },
  { key: 'phone', label: 'Téléphone', type: 'phone', aliases: ['téléphone', 'telephone', 'phone', 'tel'] },
  { key: 'city', label: 'Ville', aliases: ['ville', 'city'] },
  { key: 'country_code', label: 'Pays (code)', aliases: ['pays', 'country', 'country_code'] },
];

export const COMPANY_FIELDS: ImportField[] = [
  { key: 'name', label: 'Nom', required: true, aliases: ['nom', 'name', 'entreprise', 'company'] },
  { key: 'industry', label: 'Secteur', aliases: ['secteur', 'industry'] },
  { key: 'email', label: 'Email', type: 'email', aliases: ['email', 'e-mail', 'mail'] },
  { key: 'phone', label: 'Téléphone', type: 'phone', aliases: ['téléphone', 'telephone', 'phone', 'tel'] },
  { key: 'website', label: 'Site web', aliases: ['site', 'website', 'site web'] },
  { key: 'city', label: 'Ville', aliases: ['ville', 'city'] },
  { key: 'country_code', label: 'Pays (code)', aliases: ['pays', 'country', 'country_code'] },
];

export const DEAL_FIELDS: ImportField[] = [
  { key: 'title', label: 'Titre', required: true, aliases: ['titre', 'title', 'nom du deal'] },
  { key: 'amount', label: 'Montant', required: true, type: 'number', aliases: ['montant', 'amount', 'valeur'] },
  { key: 'currency_code', label: 'Devise', type: 'currency', aliases: ['devise', 'currency', 'currency_code'] },
  { key: 'stage', label: 'Étape', type: 'stage', aliases: ['étape', 'etape', 'stage'] },
  { key: 'expected_close_date', label: 'Date de clôture prévue', type: 'date', aliases: ['date de clôture', 'expected_close_date', 'close date'] },
  { key: 'contact_email', label: 'Email du contact (liaison)', type: 'email', aliases: ['contact email', 'email contact'] },
  { key: 'company_name', label: "Nom de l'entreprise (liaison)", aliases: ['entreprise', 'company', 'company name'] },
];

export const VALID_STAGE_IDS = new Set(DEAL_STAGES.map(s => s.id));

// Best-effort auto-match of a source CSV header to one of the target fields
export function guessMapping(headers: string[], fields: ImportField[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const field of fields) {
    const match = headers.find(h => !used.has(h) && field.aliases.includes(h.trim().toLowerCase()));
    if (match) { mapping[field.key] = match; used.add(match); }
  }
  return mapping;
}
