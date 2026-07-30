-- ========== PARAMÈTRES: stockage des avatars ==========
-- Bucket public en lecture (les avatars s'affichent dans toute l'app sans authentification
-- nécessaire côté <img>), mais écriture strictement limitée au propriétaire de son propre
-- fichier (chemin préfixé par son user id).
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_owner_write" ON storage.objects;
CREATE POLICY "avatars_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ========== SÉCURITÉ CRITIQUE : anti-escalade de privilèges ==========
-- La policy "profiles_update_self" (existante) autorise un utilisateur à modifier SA PROPRE
-- ligne (id = auth.uid()), mais ne restreint aucune colonne. Sans garde-fou, un utilisateur
-- pourrait techniquement changer son propre "role" en 'admin'/'super_admin' ou son "tenant_id"
-- vers un autre tenant via un simple appel .update() — une brèche d'isolation totale.
-- Ce trigger bloque tout changement de role/tenant_id/status par l'utilisateur lui-même ;
-- seul le service role (utilisé par les Edge Functions, ex: invitations, delete-account) ou un
-- super admin peut légitimement modifier ces colonnes.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.uid() is NULL when called via the service role (Edge Functions) — always allowed.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- Super admins may legitimately change roles/tenant assignment (e.g. tenant management tools).
  IF public.is_super_admin() THEN
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

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- Tighten tenant settings updates to admins only (previously any tenant member could update
-- their tenant's row — name, currency, timezone — since the policy only checked tenant_id).
DROP POLICY IF EXISTS "tenants_update_own" ON public.tenants;
CREATE POLICY "tenants_update_own" ON public.tenants
  FOR UPDATE TO authenticated
  USING (id = public.current_tenant_id() AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (id = public.current_tenant_id());

-- ========== SÉCURITÉ CRITIQUE : anti-contournement de facturation ==========
-- Now that tenant admins can update their own tenant row (for name/currency/timezone in
-- Paramètres), they could otherwise also set plan_id='entreprise' or status='active' on
-- themselves directly — bypassing Stripe entirely. Only the service role (Stripe webhook,
-- Super Admin tools) may change plan_id, status, or trial_ends_at.
CREATE OR REPLACE FUNCTION public.prevent_tenant_billing_bypass()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    RAISE EXCEPTION 'Modification non autorisée : plan_id, status et trial_ends_at sont gérés uniquement par la facturation.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_tenant_billing_bypass ON public.tenants;
CREATE TRIGGER trg_prevent_tenant_billing_bypass
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_billing_bypass();

-- The previous "subscriptions_update_own" / "subscriptions_delete_own" policies let ANY tenant
-- member (not just admins) update or delete their tenant's subscription row directly — including
-- setting status='active' themselves, a full billing bypass. Only Stripe webhooks (service role,
-- which bypasses RLS) and Super Admin should ever write to subscriptions after creation.
DROP POLICY IF EXISTS "subscriptions_update_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_modify_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_super_admin_only" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete_super_admin_only" ON public.subscriptions;
CREATE POLICY "subscriptions_update_super_admin_only" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
CREATE POLICY "subscriptions_delete_super_admin_only" ON public.subscriptions
  FOR DELETE TO authenticated
  USING (public.is_super_admin());
