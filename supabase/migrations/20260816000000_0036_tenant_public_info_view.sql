-- ========== VUE PUBLIQUE MINIMALE : identité du tenant pour le centre d'aide public ==========
-- Le portail /help/:tenantId (PublicKnowledgeBase.tsx) est visité par des inconnus non
-- authentifiés qui n'ont, à raison, accès à AUCUNE ligne de public.tenants (RLS verrouillée à
-- juste titre — statut de facturation, plan, devise, etc. n'ont rien à faire d'exposé
-- publiquement). Mais un centre d'aide qui n'affiche même pas le nom de l'entreprise à laquelle
-- il appartient n'est pas professionnel — un visiteur ne sait pas où il est.
--
-- Solution standard Postgres : une vue étroite exposant UNIQUEMENT les deux colonnes non
-- sensibles utiles à l'affichage (nom, langue), jamais la table complète. La RLS sur
-- public.tenants elle-même reste totalement inchangée et verrouillée.

CREATE OR REPLACE VIEW public.tenant_public_info AS
SELECT id, name, locale FROM public.tenants;

GRANT SELECT ON public.tenant_public_info TO anon, authenticated;
