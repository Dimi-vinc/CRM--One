// Lead scoring formula for edge functions. MUST stay in sync with src/lib/leadScoring.ts's
// WEIGHTS and computation exactly — duplicated rather than imported because Supabase deploys
// each edge function independently and doesn't bundle files outside supabase/functions/ (same
// rationale as supabase/functions/_shared/currency-rates.ts).
//
// This was previously reimplemented inline in send-campaign/index.ts, and had drifted from the
// real formula: it was missing the "has phone number" weight (15 points) entirely, so a
// contact's score for campaign segment_min_score filtering did not match the score shown for the
// same contact on the Contacts page. If you change the weights in src/lib/leadScoring.ts, mirror
// the change here too.

export const LEAD_SCORE_WEIGHTS = {
  hasEmail: 20,
  hasPhone: 15,
  hasCompany: 15,
  hasActivity: 25,
  hasDeal: 25,
};

export function computeLeadScoreValue(
  contact: { email?: string | null; phone?: string | null; company_id?: string | null },
  hasActivity: boolean,
  hasDeal: boolean,
): number {
  let score = 0;
  if (contact.email) score += LEAD_SCORE_WEIGHTS.hasEmail;
  if (contact.phone) score += LEAD_SCORE_WEIGHTS.hasPhone;
  if (contact.company_id) score += LEAD_SCORE_WEIGHTS.hasCompany;
  if (hasActivity) score += LEAD_SCORE_WEIGHTS.hasActivity;
  if (hasDeal) score += LEAD_SCORE_WEIGHTS.hasDeal;
  return score;
}
