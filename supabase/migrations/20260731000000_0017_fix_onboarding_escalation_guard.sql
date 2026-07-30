-- ========== FIX: le trigger anti-escalade bloquait l'onboarding légitime ==========
-- La migration 0013 a introduit un trigger BEFORE UPDATE sur profiles empêchant un
-- utilisateur de modifier lui-même role/tenant_id/status (anti-escalade de privilèges).
-- Problème : complete_onboarding() (SECURITY DEFINER) doit justement faire
-- `UPDATE profiles SET tenant_id = <nouveau_tenant>, role = 'admin' WHERE id = auth.uid()`
-- pour promouvoir le créateur du compte admin de sa propre entreprise — auth.uid() n'est PAS
-- NULL dans ce contexte (SECURITY DEFINER change les privilèges d'exécution, pas les claims
-- JWT de la requête), donc le trigger bloquait aussi ce cas parfaitement légitime.
--
-- Correction : on autorise UNE seule transition précise, sans rouvrir la faille d'origine :
--   - AVANT : tenant_id IS NULL (l'utilisateur n'appartient encore à aucun tenant)
--   - APRÈS : role devient exactement 'admin' (jamais 'super_admin' — impossible de
--     s'auto-promouvoir super admin par ce chemin)
-- Une fois qu'un profil a un tenant_id, plus aucune auto-modification de
-- role/tenant_id/status n'est permise (le reste du trigger d'origine s'applique toujours).

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- Cas légitime unique : onboarding initial (première assignation à un tenant, en tant
  -- qu'admin de ce tenant). Ne s'applique qu'une fois : dès que tenant_id est déjà renseigné,
  -- cette exception ne s'applique plus.
  IF OLD.tenant_id IS NULL AND NEW.tenant_id IS NOT NULL AND NEW.role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Modification non autorisée : role, tenant_id et status ne peuvent pas être modifiés par l''utilisateur lui-même.';
  END IF;
  RETURN NEW;
END;
$$;
