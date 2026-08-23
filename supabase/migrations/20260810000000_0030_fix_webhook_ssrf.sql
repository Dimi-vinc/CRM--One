-- ========== CORRECTIF SÉCURITÉ : SSRF via URL de webhook non validée ==========
-- N'importe quel tenant pouvait enregistrer N'IMPORTE QUELLE URL comme cible de webhook, et le
-- serveur (webhook-dispatch, avec un accès réseau backend) l'appelait ensuite avec `fetch()` à
-- chaque événement CRM. Un tenant malveillant (ou un compte compromis) pouvait donc pointer un
-- webhook vers une adresse interne — endpoint de métadonnées cloud (169.254.169.254),
-- localhost, un service interne du réseau Supabase — pour sonder ou exfiltrer des informations
-- via le serveur lui-même. C'est la classe de vulnérabilité SSRF (Server-Side Request Forgery),
-- un problème connu et fréquent des fonctionnalités "webhook sortant".
--
-- La validation complète (résolution DNS, blocage des plages IP privées) est faite côté edge
-- function (voir supabase/functions/_shared/webhook-safety.ts) car SQL ne peut pas résoudre un
-- nom de domaine. Cette contrainte DB est une deuxième ligne de défense bon marché qui bloque au
-- moins les cas évidents (schéma non-https, littéraux d'IP privées/loopback) même si un futur
-- point d'insertion oubliait d'appeler la validation applicative.

ALTER TABLE public.webhooks DROP CONSTRAINT IF EXISTS webhooks_url_https_check;
ALTER TABLE public.webhooks ADD CONSTRAINT webhooks_url_https_check
  CHECK (
    url ~* '^https://'
    AND url !~* '^https://(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|\[::1\]|\[fc|\[fd)'
  );
