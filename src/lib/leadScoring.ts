// Simple, transparent rule-based lead scoring (0-100). No black box: every point is
// explainable, which matters more for trust than a fancier model would for a first version.
import type { Contact } from './types';

export interface LeadScoreBreakdown {
  score: number;
  band: 'hot' | 'warm' | 'cold';
  reasons: string[];
}

const WEIGHTS = {
  hasEmail: 20,
  hasPhone: 15,
  hasCompany: 15,
  hasActivity: 25,
  hasDeal: 25,
};

export function computeLeadScore(
  contact: Contact,
  hasActivity: boolean,
  hasDeal: boolean,
): LeadScoreBreakdown {
  let score = 0;
  const reasons: string[] = [];

  if (contact.email) { score += WEIGHTS.hasEmail; reasons.push('Email renseigné'); }
  if (contact.phone) { score += WEIGHTS.hasPhone; reasons.push('Téléphone renseigné'); }
  if (contact.company_id) { score += WEIGHTS.hasCompany; reasons.push('Rattaché à une entreprise'); }
  if (hasActivity) { score += WEIGHTS.hasActivity; reasons.push('Au moins une activité enregistrée'); }
  if (hasDeal) { score += WEIGHTS.hasDeal; reasons.push('Au moins un deal lié'); }

  const band: LeadScoreBreakdown['band'] = score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold';
  return { score, band, reasons };
}

export const BAND_LABEL: Record<LeadScoreBreakdown['band'], string> = {
  hot: 'Chaud',
  warm: 'Tiède',
  cold: 'Froid',
};

export const BAND_COLOR: Record<LeadScoreBreakdown['band'], 'red' | 'orange' | 'blue'> = {
  hot: 'red',
  warm: 'orange',
  cold: 'blue',
};
