-- ========== CORRECTIF CRITIQUE : VERROU DE PAIEMENT AU NIVEAU BASE DE DONNÉES ==========
-- Jusqu'ici, le blocage "essai expiré, veuillez payer" n'existait QUE côté frontend (une
-- redirection React). Rien côté base de données n'empêchait un utilisateur dont l'essai a
-- expiré de continuer à lire/écrire ses données via l'API Supabase — la vraie barrière de
-- sécurité manquait. Ce correctif l'ajoute réellement, au niveau RLS.
--
-- Il corrige aussi un reliquat probable de l'ancienne faille (déjà patchée) où le statut d'un
-- tenant pouvait être mis à 'active' directement depuis l'URL sans paiement réel. Comme ni
-- Stripe ni Flutterwave ne sont branchés en production à ce jour, AUCUN tenant ne devrait
-- légitimement être à 'active' actuellement.

-- ---------- 1. Fonction de vérification d'accès (utilisée par toutes les policies) ----------
CREATE OR REPLACE FUNCTION public.tenant_has_active_access(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    status = 'active'
    OR (trial_ends_at IS NOT NULL AND trial_ends_at > now())
  FROM public.tenants
  WHERE id = p_tenant_id;
$$;

-- ---------- 2. Diagnostic : quels tenants sont actuellement 'active' sans preuve de paiement ----------
-- (Requête de lecture seule — regardez le résultat avant d'exécuter la correction ci-dessous
-- si vous voulez vérifier manuellement un cas particulier.)
-- SELECT t.id, t.name, t.status, t.trial_ends_at, s.stripe_customer_id, s.stripe_subscription_id
-- FROM public.tenants t LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
-- WHERE t.status = 'active';

-- ---------- 3. Correction : réinitialise tout tenant 'active' sans identifiant Stripe réel ----------
-- Remet le statut à 'trial' (l'ancienne date d'expiration d'essai est conservée telle quelle —
-- si elle est déjà passée, le tenant sera immédiatement re-bloqué par le nouveau verrou RLS,
-- ce qui est le comportement correct et attendu).
UPDATE public.tenants t
SET status = 'trial'
WHERE t.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.tenant_id = t.id AND s.stripe_subscription_id IS NOT NULL
  );

-- ---------- 4. Application réelle sur toutes les tables métier ----------
-- IMPORTANT : web_forms, api_keys, webhooks avaient une ancienne policy "FOR ALL" nommée
-- "*_tenant_all" (pas "*_select_perm" comme les tables déjà migrées en 0020). En RLS, les
-- policies permissives s'additionnent (OR) — si on ne la supprime pas explicitement ici, elle
-- resterait active en parallèle des nouvelles policies restrictives et les rendrait inopérantes.
DROP POLICY IF EXISTS "web_forms_tenant_all" ON public.web_forms;
DROP POLICY IF EXISTS "api_keys_tenant_all" ON public.api_keys;
DROP POLICY IF EXISTS "webhooks_tenant_all" ON public.webhooks;

-- Combine la vérification de permission de rôle personnalisé (migration 0020) ET la
-- vérification d'accès facturation — les deux doivent être vraies.
DO $$
DECLARE
  t text;
  module_key text;
  pairs text[][] := ARRAY[
    ARRAY['contacts', 'contacts'],
    ARRAY['companies', 'companies'],
    ARRAY['deals', 'pipeline'],
    ARRAY['activities', 'activities'],
    ARRAY['tasks', 'tasks'],
    ARRAY['documents', 'documents'],
    ARRAY['automations', 'automations'],
    ARRAY['tickets', 'tickets'],
    ARRAY['ticket_comments', 'tickets'],
    ARRAY['quotes', 'quotes_invoices'],
    ARRAY['quote_items', 'quotes_invoices'],
    ARRAY['invoices', 'quotes_invoices'],
    ARRAY['invoice_items', 'quotes_invoices'],
    ARRAY['email_campaigns', 'campaigns'],
    ARRAY['email_campaign_recipients', 'campaigns'],
    ARRAY['kb_articles', 'knowledge_base'],
    ARRAY['sales_territories', 'territories'],
    ARRAY['web_forms', 'web_forms'],
    ARRAY['api_keys', 'developers'],
    ARRAY['webhooks', 'developers']
  ];
  pair text[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY pairs
  LOOP
    t := pair[1];
    module_key := pair[2];

    EXECUTE format('DROP POLICY IF EXISTS "%I_select_perm" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%I_select_perm" ON public.%I FOR SELECT TO authenticated USING ((tenant_id = public.current_tenant_id() AND public.user_has_permission(%L, ''view'') AND public.tenant_has_active_access(tenant_id)) OR public.is_super_admin())',
      t, t, module_key
    );

    EXECUTE format('DROP POLICY IF EXISTS "%I_insert_perm" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%I_insert_perm" ON public.%I FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.current_tenant_id() AND public.user_has_permission(%L, ''create'') AND public.tenant_has_active_access(tenant_id)) OR public.is_super_admin())',
      t, t, module_key
    );

    EXECUTE format('DROP POLICY IF EXISTS "%I_update_perm" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%I_update_perm" ON public.%I FOR UPDATE TO authenticated USING ((tenant_id = public.current_tenant_id() AND public.user_has_permission(%L, ''edit'') AND public.tenant_has_active_access(tenant_id)) OR public.is_super_admin()) WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin())',
      t, t, module_key
    );

    EXECUTE format('DROP POLICY IF EXISTS "%I_delete_perm" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%I_delete_perm" ON public.%I FOR DELETE TO authenticated USING ((tenant_id = public.current_tenant_id() AND public.user_has_permission(%L, ''delete'') AND public.tenant_has_active_access(tenant_id)) OR public.is_super_admin())',
      t, t, module_key
    );
  END LOOP;
END $$;

-- ---------- 5. Même verrou sur les tables métier restantes sans permissions par rôle granulaires ----------
DROP POLICY IF EXISTS "sales_quotas_tenant_all" ON public.sales_quotas;
CREATE POLICY "sales_quotas_tenant_all" ON public.sales_quotas
  FOR ALL TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND public.tenant_has_active_access(tenant_id)) OR public.is_super_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());

-- ---------- 6. Journal d'audit de ce correctif (pour trace) ----------
INSERT INTO public.audit_log (actor_id, action, details)
SELECT NULL, 'security_fix_0025', jsonb_build_object('description', 'Verrou de paiement appliqué au niveau RLS ; tenants active sans stripe_subscription_id réinitialisés à trial.')
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_log');
