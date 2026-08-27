-- ========== CORRECTIF MAJEUR : les invitations d'équipe ne fonctionnaient pas ==========
-- "Inviter un membre" (AdminModule.tsx) créait bien une ligne dans tenant_invitations, mais RIEN
-- ne reliait ensuite un nouvel inscrit à cette invitation : handle_new_user() créait un profil
-- avec tenant_id = NULL, point final, quel que soit son email. La personne invitée passait par
-- l'onboarding normal et créait SA PROPRE entreprise au lieu de rejoindre celle de l'inviteur —
-- la fonctionnalité d'invitation d'équipe était une façade depuis le début.
--
-- Corrigé : au moment de la création du profil, on cherche une invitation 'pending' pour cet
-- email. Si trouvée ET que l'entreprise a encore de la place (voir plafond ci-dessous), on
-- rattache directement le nouvel utilisateur au bon tenant avec le rôle prévu par l'invitation,
-- et on marque l'invitation comme acceptée.
--
-- ========== + CORRECTIF : les limites d'utilisateurs/deals des plans n'étaient jamais vérifiées ==========
-- La table public.plans (créée dès la migration 0001) contient bien max_users/max_deals pour
-- chaque plan, correctement alimentée — mais rien ne la consultait jamais nulle part. Un tenant
-- Starter (limite affichée : 2 utilisateurs, 100 deals) pouvait en réalité inviter un nombre
-- illimité de membres et créer un nombre illimité de deals, sans aucune restriction réelle.
-- Ajoute une vérification réelle à la place où chaque limite s'applique naturellement : le
-- rattachement d'un nouveau membre (ci-dessous) et la création d'un deal (trigger séparé).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_current_users int;
  v_max_users int;
BEGIN
  -- Cherche une invitation en attente pour cet email, la plus récente en premier.
  SELECT * INTO v_invite FROM public.tenant_invitations
  WHERE email = NEW.email AND status = 'pending'
  ORDER BY created_at DESC LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    SELECT count(*) INTO v_current_users FROM public.profiles WHERE tenant_id = v_invite.tenant_id;
    SELECT p.max_users INTO v_max_users FROM public.tenants t JOIN public.plans p ON p.id = t.plan_id WHERE t.id = v_invite.tenant_id;

    -- max_users = 0 signifie illimité (convention déjà utilisée par src/lib/constants.ts PLANS).
    IF v_max_users IS NULL OR v_max_users = 0 OR v_current_users < v_max_users THEN
      INSERT INTO public.profiles (id, email, full_name, tenant_id, role, role_id)
      VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), v_invite.tenant_id, 'custom', v_invite.role_id)
      ON CONFLICT (id) DO NOTHING;
      UPDATE public.tenant_invitations SET status = 'accepted' WHERE id = v_invite.id;
      RETURN NEW;
    END IF;
    -- Sinon (entreprise déjà au plafond) : on laisse tomber dans le cas normal ci-dessous, sans
    -- rattacher automatiquement — l'invitation reste 'pending', l'admin devra libérer une place
    -- (ou changer de plan) avant qu'elle puisse aboutir. La personne passera par l'onboarding
    -- normal en attendant plutôt que de bloquer complètement son inscription.
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ---------- Plafond du nombre de deals ----------
CREATE OR REPLACE FUNCTION public.enforce_max_deals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_deals int;
  v_max_deals int;
BEGIN
  SELECT p.max_deals INTO v_max_deals FROM public.tenants t JOIN public.plans p ON p.id = t.plan_id WHERE t.id = NEW.tenant_id;
  IF v_max_deals IS NULL OR v_max_deals = 0 THEN
    RETURN NEW; -- illimité (Pro/Premium/Entreprise)
  END IF;
  SELECT count(*) INTO v_current_deals FROM public.deals WHERE tenant_id = NEW.tenant_id;
  IF v_current_deals >= v_max_deals THEN
    RAISE EXCEPTION 'Limite de % deals atteinte pour votre plan actuel. Passez à un plan supérieur pour continuer.', v_max_deals
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_max_deals ON public.deals;
CREATE TRIGGER trigger_enforce_max_deals
  BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_deals();
