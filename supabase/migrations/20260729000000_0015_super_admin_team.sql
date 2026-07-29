-- ========== ÉQUIPE SUPER ADMIN : permissions sur la liste blanche ==========
-- La table super_admin_emails n'avait qu'une policy SELECT ouverte à TOUS les utilisateurs
-- authentifiés (fuite d'information : n'importe quel tenant pouvait voir qui sont les super
-- admins) et AUCUNE policy INSERT/UPDATE/DELETE (un super admin ne pouvait donc pas ajouter de
-- collègue depuis l'app malgré l'intention du mécanisme).

DROP POLICY IF EXISTS "read_super_admin_emails" ON public.super_admin_emails;
CREATE POLICY "super_admin_emails_select" ON public.super_admin_emails
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "super_admin_emails_insert" ON public.super_admin_emails
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "super_admin_emails_delete" ON public.super_admin_emails
  FOR DELETE TO authenticated
  USING (public.is_super_admin());
