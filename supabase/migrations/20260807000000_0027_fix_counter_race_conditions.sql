-- ========== CORRECTIF BUG : compteurs non-atomiques (race conditions) ==========
-- Deux endroits du code lisaient un compteur puis le réécrivaient (`current + 1`) en deux étapes
-- séparées. Sous requêtes concurrentes, plusieurs lectures peuvent arriver avant qu'aucune
-- écriture n'ait eu lieu : elles voient toutes la même valeur de départ et se marchent dessus,
-- perdant des incréments (ou, pour le rate limiter, laissant passer plus de requêtes que la
-- limite autorisée — un vrai contournement de sécurité/coût, pas juste un chiffre imprécis).
-- On remplace ça par une seule opération atomique côté base de données.

-- 1) Rate limiter de l'API publique (api-v1) : vérifie ET incrémente en une seule transaction,
--    avec un verrou de ligne (FOR UPDATE) qui sérialise les appels concurrents pour la même clé
--    API au lieu de les laisser lire-puis-écrire indépendamment.
CREATE OR REPLACE FUNCTION public.check_and_increment_api_rate_limit(
  p_api_key_id uuid,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, request_count integer, window_start timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.api_rate_limits%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.api_rate_limits WHERE api_key_id = p_api_key_id FOR UPDATE;

  IF NOT FOUND OR EXTRACT(EPOCH FROM (now() - v_row.window_start)) > p_window_seconds THEN
    INSERT INTO public.api_rate_limits (api_key_id, window_start, request_count)
    VALUES (p_api_key_id, now(), 1)
    ON CONFLICT (api_key_id) DO UPDATE SET window_start = now(), request_count = 1
    RETURNING * INTO v_row;
    RETURN QUERY SELECT true, v_row.request_count, v_row.window_start;
    RETURN;
  END IF;

  IF v_row.request_count >= p_limit THEN
    RETURN QUERY SELECT false, v_row.request_count, v_row.window_start;
    RETURN;
  END IF;

  UPDATE public.api_rate_limits SET request_count = request_count + 1
  WHERE api_key_id = p_api_key_id
  RETURNING * INTO v_row;
  RETURN QUERY SELECT true, v_row.request_count, v_row.window_start;
END;
$$;

-- 2) Compteur de soumissions d'un formulaire web public : simple incrément atomique.
CREATE OR REPLACE FUNCTION public.increment_web_form_submission_count(p_form_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.web_forms SET submission_count = submission_count + 1 WHERE id = p_form_id;
$$;
