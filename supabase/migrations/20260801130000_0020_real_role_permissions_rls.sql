-- ========== RÔLES PERSONNALISÉS : APPLICATION RÉELLE CÔTÉ BASE DE DONNÉES ==========
-- Jusqu'ici, "Rôles & Permissions" (Espace Admin) enregistrait des permissions dans une
-- colonne jsonb, mais RIEN ne les vérifiait nulle part — ni le frontend (juste corrigé), ni
-- surtout la base de données. Un utilisateur avec le rôle 'custom' pouvait appeler l'API
-- Supabase directement (hors de l'app) et lire/modifier n'importe quelle donnée de son tenant,
-- peu importe les permissions configurées pour son rôle. C'était 100% décoratif.
--
-- Cette migration ajoute la VRAIE barrière de sécurité : chaque table métier vérifie désormais,
-- via user_has_permission(), que l'utilisateur a bien la permission ('view'/'create'/'edit'/
-- 'delete') accordée par son rôle personnalisé — en plus de l'isolation par tenant déjà en place.
-- admin/super_admin gardent un accès total, comme avant.

CREATE OR REPLACE FUNCTION public.user_has_permission(p_module text, p_action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_role_id uuid;
  v_perms jsonb;
BEGIN
  SELECT role, role_id INTO v_role, v_role_id FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RETURN false; -- pas de profil (ex: service role direct) — fail closed pour ce chemin
  END IF;
  IF v_role IN ('admin', 'super_admin') THEN
    RETURN true;
  END IF;
  IF v_role = 'custom' AND v_role_id IS NULL THEN
    RETURN true; -- aucun rôle personnalisé assigné = accès complet (comportement historique préservé)
  END IF;
  IF v_role = 'custom' AND v_role_id IS NOT NULL THEN
    SELECT permissions INTO v_perms FROM public.roles WHERE id = v_role_id;
    IF v_perms IS NULL THEN RETURN false; END IF;
    RETURN COALESCE((v_perms -> p_module) ? p_action, false);
  END IF;
  RETURN false;
END;
$$;

-- Remplace la policy "FOR ALL" unique de chaque table métier par 4 policies granulaires
-- (SELECT/INSERT/UPDATE/DELETE), chacune exigeant en plus la permission correspondante.
-- Le service role (Edge Functions) bypass RLS entièrement et n'est jamais affecté.
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
    ARRAY['sales_territories', 'territories']
  ];
  pair text[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY pairs
  LOOP
    t := pair[1];
    module_key := pair[2];

    -- Nettoie l'ancienne policy "FOR ALL" générique si elle existe (plusieurs conventions de
    -- nommage ont été utilisées au fil des migrations précédentes)
    EXECUTE format('DROP POLICY IF EXISTS "%I_tenant_all" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%I_tenant_isolation" ON public.%I', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "%I_select_perm" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%I_select_perm" ON public.%I FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id() AND public.user_has_permission(%L, ''view'') OR public.is_super_admin())',
      t, t, module_key
    );

    EXECUTE format('DROP POLICY IF EXISTS "%I_insert_perm" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%I_insert_perm" ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() AND public.user_has_permission(%L, ''create'') OR public.is_super_admin())',
      t, t, module_key
    );

    EXECUTE format('DROP POLICY IF EXISTS "%I_update_perm" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%I_update_perm" ON public.%I FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.user_has_permission(%L, ''edit'') OR public.is_super_admin()) WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin())',
      t, t, module_key
    );

    EXECUTE format('DROP POLICY IF EXISTS "%I_delete_perm" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%I_delete_perm" ON public.%I FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.user_has_permission(%L, ''delete'') OR public.is_super_admin())',
      t, t, module_key
    );
  END LOOP;
END $$;
