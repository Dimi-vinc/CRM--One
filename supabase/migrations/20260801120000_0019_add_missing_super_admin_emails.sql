-- ========== AJOUT DES 2 EMAILS SUPER ADMIN MANQUANTS ==========
-- La liste blanche d'origine (migration 0010) ne contenait que 3 emails. Si liyahjoha@yahoo.com
-- ou liyahjoha@gmail.com se sont déjà inscrits AVANT ce correctif, leur profil a été créé avec
-- le rôle par défaut (pas super_admin) — d'où l'absence du module Super Admin dans leur sidebar.
-- Ce script (1) complète la liste blanche pour toute future inscription, et (2) corrige
-- rétroactivement tout profil déjà existant pour ces 5 emails.

INSERT INTO public.super_admin_emails (email) VALUES
  ('vincentnogue2@gmail.com'),
  ('vincentnogue@yahoo.com'),
  ('webdxb1@gmail.com'),
  ('liyahjoha@yahoo.com'),
  ('liyahjoha@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- Corrige rétroactivement tout compte déjà créé avec l'un de ces 5 emails, quel que soit son
-- rôle actuel (y compris s'il a déjà un tenant_id, contrairement au trigger d'inscription qui ne
-- s'applique qu'aux nouveaux comptes).
UPDATE public.profiles
SET role = 'super_admin'
WHERE email IN (SELECT email FROM public.super_admin_emails)
  AND role <> 'super_admin';
